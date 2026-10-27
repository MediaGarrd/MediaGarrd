import { createNotifier, initServices, initSettings } from './forms.js';
import { bytes, formatInterval, percent, relativeTime } from './format.js';
import { SERVER_HOST, SERVER_PORT, SERVER_URL } from './server.js';

const HEALTH_INTERVAL_MS = 1000;
const AUTO_DOWNLOAD_SUFFIX = '-AD';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const autoName = (fileName) => fileName.replace(/\.zip$/, `${AUTO_DOWNLOAD_SUFFIX}.zip`);

export function initClientDemo(root, server, { downloadsList, onViewChanged }) {
  const notify = createNotifier(root.querySelector('[data-banner]'));
  const badge = root.querySelector('[data-badge]');
  const connection = root.querySelector('[data-connection]');
  const ipForm = connection.querySelector('[data-ip-form]');
  const known = connection.querySelector('[data-known]');
  const controls = connection.querySelectorAll('button, input, select');
  const scanBar = connection.querySelector('[data-scan-bar]');
  const scanNote = connection.querySelector('[data-scan-note]');
  const status = root.querySelector('[data-status]');
  const details = status.querySelector('[data-details]');
  const noServer = status.querySelector('[data-no-server]');
  const stateTag = status.querySelector('[data-state]');
  const runButton = status.querySelector('[data-run]');
  const pickupButton = status.querySelector('[data-pickup]');
  const pickupForm = status.querySelector('[data-pickup-form]');
  const backupsPanel = root.querySelector('[data-backups]');
  const rows = backupsPanel.querySelector('tbody');
  const empty = backupsPanel.querySelector('[data-empty]');
  const headers = backupsPanel.querySelectorAll('th[data-sort-key]');
  const views = root.querySelectorAll('[data-view]');
  const viewLinks = root.querySelectorAll('[data-view-link]');
  const configContent = root.querySelector('[data-config-content]');
  const unavailable = root.querySelector('[data-unavailable]');

  const sort = { key: 'createdAt', dir: 'desc' };
  const rowTasks = new Map();
  let client;
  let backups = [];
  let busy = false;
  let runInFlight = false;
  let serverRunning = false;
  let latestTask = null;
  let view = 'dashboard';

  const configApi = {
    config: () => requireServer().then(() => server.config(false)),
    updateConfig: (config) => requireServer().then(() => server.updateConfig(false, config)),
    services: () => requireServer().then(() => server.services(false)),
    addService: (service) => requireServer().then(() => server.addService(false, service)),
    updateService: (name, service) => requireServer().then(() => server.updateService(false, name, service)),
    removeService: (name) => requireServer().then(() => server.removeService(false, name)),
  };
  const settings = initSettings(root.querySelector('[data-config-content] [data-settings]'), configApi, notify, refreshHealth);
  const services = initServices(root.querySelector('[data-config-content] [data-services]'), configApi, notify);

  async function requireServer() {
    if (!client.activeServer) throw new Error('No active MediaGarrd server selected');
  }

  function setBadge(kind, label) {
    badge.className = `conn-badge ${kind}`;
    badge.querySelector('[data-label]').textContent = label;
  }

  async function refreshHealth() {
    const connected = Boolean(client.activeServer);
    details.hidden = !connected;
    noServer.hidden = connected;
    if (!connected) {
      if (!busy) setBadge('', 'Not Connected');
      return;
    }
    const health = await server.health();
    status.querySelector('[data-url]').textContent = client.activeServer;
    status.querySelector('[data-interval]').textContent = formatInterval(health.backupInterval);
    status.querySelector('[data-retention]').textContent = `${health.backupRetentionCount} archives`;
    stateTag.textContent = health.running ? 'Running' : 'Idle';
    stateTag.classList.toggle('running', health.running);
    if (!busy) setBadge('ok', client.activeServer.replace(/^https?:\/\//, ''));
    const finished = serverRunning && !health.running;
    serverRunning = health.running;
    renderActions();
    if (finished) refreshBackups();
  }

  function renderKnown() {
    const options = client.known.map((url) => new Option(url, url, false, url === client.activeServer));
    known.replaceChildren(...(options.length ? options : [new Option('— none discovered yet —', '')]));
  }

  async function connect(label, action) {
    if (busy) return null;
    notify.clear();
    busy = true;
    setBadge('checking', label);
    scanBar.classList.add('active');
    controls.forEach((control) => { control.disabled = true; });
    let result = null;
    try {
      result = await action();
    } catch (error) {
      notify.error(error);
    }
    busy = false;
    scanBar.classList.remove('active');
    controls.forEach((control) => { control.disabled = false; });
    renderKnown();
    await refreshHealth();
    if (result) serverChanged();
    return result;
  }

  function select(url) {
    client.activeServer = url;
    if (!client.known.includes(url)) client.known.push(url);
  }

  async function resolveByIp(input, portInput) {
    const [host, inlinePort] = input.trim().split(':');
    const port = portInput ? Number(portInput) : Number(inlinePort) || null;
    if (host !== SERVER_HOST) {
      await sleep(550);
      throw new Error(`No MediaGarrd server found at ${host}`);
    }
    await sleep(port && port !== SERVER_PORT ? 1400 : 450);
    select(SERVER_URL);
    return SERVER_URL;
  }

  async function discover() {
    await sleep(2000);
    const found = [SERVER_URL];
    client.known = [...new Set([...found, ...(client.activeServer ? [client.activeServer] : [])])];
    if (!client.activeServer) client.activeServer = found[0];
    return found;
  }

  function renderActions() {
    const backupBusy = serverRunning || runInFlight;
    runButton.disabled = backupBusy;
    runButton.classList.toggle('busy', backupBusy);
    runButton.querySelector('.btn-label').textContent = backupBusy ? 'Backup In Progress' : 'Run Backup Now';
    pickupButton.disabled = Boolean(latestTask);
    pickupButton.classList.toggle('busy', Boolean(latestTask));
    pickupButton.querySelector('.btn-label').textContent = latestTask ? 'Downloading...' : 'Download Latest';
    pickupButton.querySelector('.btn-progress-fill').style.width = `${latestTask ? percent(latestTask.written, latestTask.total) : 0}%`;
  }

  function compare(a, b) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'sizeBytes') return (a.sizeBytes - b.sizeBytes) * dir;
    if (sort.key === 'createdAt') return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
    return a[sort.key].localeCompare(b[sort.key]) * dir;
  }

  function renderRowButton(button, id) {
    const task = rowTasks.get(id);
    button.disabled = Boolean(task);
    if (!task) {
      button.textContent = '↓';
      return;
    }
    const progress = document.createElement('span');
    progress.className = 'row-progress-circle';
    progress.style.setProperty('--p', `${percent(task.written, task.total)}%`);
    button.replaceChildren(progress);
  }

  function renderTable(emptyMessage = 'No backup archives found on server.') {
    headers.forEach((header) => {
      const active = header.dataset.sortKey === sort.key;
      header.classList.toggle('active', active);
      header.querySelector('.sort-indicator').textContent = active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕';
    });
    rows.replaceChildren(...[...backups].sort(compare).map((backup) => {
      const row = document.getElementById('backupRowTemplate').content.firstElementChild.cloneNode(true);
      row.querySelector('[data-file]').textContent = backup.fileName;
      row.querySelector('[data-size]').textContent = bytes(backup.sizeBytes);
      row.querySelector('[data-created]').textContent = relativeTime(backup.createdAt, server.now());
      const button = row.querySelector('button');
      button.dataset.id = backup.id;
      button.addEventListener('click', () => download(backup, false));
      renderRowButton(button, backup.id);
      return row;
    }));
    empty.textContent = emptyMessage;
    empty.hidden = backups.length > 0;
  }

  async function refreshBackups() {
    try {
      await requireServer();
      backups = await server.backups();
      renderTable();
    } catch (error) {
      backups = [];
      renderTable(`${error.message}. Connect to a server to view archives.`);
    }
  }

  function save(backup, name, auto) {
    if (auto) client.downloads = client.downloads.filter((file) => !file.auto || file.name === name);
    client.downloads = client.downloads.filter((file) => file.name !== name);
    client.downloads.unshift({ name, size: backup.sizeBytes, time: server.now(), auto, fresh: true });
    renderDownloads();
  }

  async function download(backup, latest) {
    if (latest ? latestTask : rowTasks.has(backup.id)) return;
    const task = { written: 0, total: backup.sizeBytes };
    const button = () => rows.querySelector(`button[data-id="${backup.id}"]`);
    if (latest) latestTask = task;
    else rowTasks.set(backup.id, task);
    const render = () => (latest ? renderActions() : button() && renderRowButton(button(), backup.id));
    render();
    try {
      if (!client.downloads.some((file) => file.name === backup.fileName && file.size === backup.sizeBytes)) {
        await server.download(backup.id, (written, total) => {
          task.written = written;
          task.total = total;
          render();
        });
        save(backup, backup.fileName, false);
      }
    } catch (error) {
      notify.error(error);
    } finally {
      if (latest) latestTask = null;
      else rowTasks.delete(backup.id);
      render();
    }
  }

  function renderDownloads() {
    if (!client.downloads.length) {
      const item = document.createElement('li');
      item.className = 'empty';
      item.textContent = 'Nothing downloaded yet.';
      downloadsList.replaceChildren(item);
      return;
    }
    downloadsList.replaceChildren(...client.downloads.map((file) => {
      const item = document.createElement('li');
      item.className = file.fresh ? 'fresh' : '';
      file.fresh = false;
      const name = document.createElement('span');
      name.textContent = file.name;
      const size = document.createElement('span');
      size.textContent = bytes(file.size);
      item.append(name, size);
      return item;
    }));
  }

  async function loadConfig() {
    try {
      await requireServer();
      const [config, list] = await Promise.all([server.config(false), server.services(false)]);
      settings.show(config);
      services.show(list);
      configContent.hidden = false;
      unavailable.hidden = true;
    } catch (error) {
      configContent.hidden = true;
      unavailable.hidden = false;
      unavailable.querySelector('[data-reason]').textContent =
        `${error.message}. Connect to a MediaGarrd server that has finished setup on the Dashboard to manage its configuration.`;
    }
  }

  function serverChanged() {
    refreshBackups();
    services.resetForm();
    if (view === 'config') loadConfig();
  }

  function showView(next) {
    view = next;
    views.forEach((element) => { element.hidden = element.dataset.view !== view; });
    viewLinks.forEach((link) => link.setAttribute('aria-pressed', String(link.dataset.viewLink === view)));
    notify.clear();
    if (view === 'config') loadConfig();
    else refreshHealth();
    onViewChanged(view);
  }

  function scheduledPickup() {
    const runs = Math.floor((12 * 60) / client.pickupMinutes);
    if (!runs || !client.activeServer || !server.setupDone) return;
    server.backups().then((list) => {
      if (!list.length) return;
      const latest = list[0];
      const names = [latest.fileName, autoName(latest.fileName)];
      if (!client.downloads.some((file) => names.includes(file.name))) save(latest, names[1], true);
    });
  }

  ipForm.addEventListener('submit', (event) => {
    event.preventDefault();
    connect('Probing…', () => resolveByIp(ipForm.elements.ip.value, ipForm.elements.port.value));
  });

  connection.querySelector('[data-connect-known]').addEventListener('click', () => {
    if (!known.value) {
      notify.error('No server selected.');
      return;
    }
    connect('Connecting…', async () => {
      await sleep(300);
      select(known.value);
      return known.value;
    });
  });

  connection.querySelector('[data-discover]').addEventListener('click', async () => {
    if (busy) return;
    scanNote.textContent = 'Scan in progress…';
    const found = await connect('Scanning…', discover);
    const count = found?.length ?? 0;
    scanNote.textContent = found ? `Last scan: found ${count} server${count === 1 ? '' : 's'}.` : 'Last scan: failed.';
  });

  runButton.addEventListener('click', async () => {
    if (serverRunning || runInFlight) return;
    notify.clear();
    runInFlight = true;
    renderActions();
    try {
      await requireServer();
      const run = server.runBackup();
      setTimeout(refreshHealth, 300);
      await run;
      await refreshBackups();
    } catch (error) {
      notify.error(error);
    } finally {
      runInFlight = false;
      await refreshHealth();
    }
  });

  pickupButton.addEventListener('click', async () => {
    if (latestTask) return;
    notify.clear();
    try {
      await requireServer();
      const list = await server.backups();
      if (!list.length) throw new Error('No backups found on server');
      await download(list[0], true);
    } catch (error) {
      notify.error(error);
    }
  });

  pickupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    notify.clear();
    await sleep(200);
    client.pickupMinutes = Number(pickupForm.elements.minutes.value);
    notify.ok('Pickup interval saved');
  });

  headers.forEach((header) => header.addEventListener('click', () => {
    const key = header.dataset.sortKey;
    if (sort.key === key) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    else {
      sort.key = key;
      sort.dir = key === 'createdAt' ? 'desc' : 'asc';
    }
    renderTable();
  }));

  backupsPanel.querySelector('[data-refresh]').addEventListener('click', () => {
    notify.clear();
    refreshBackups();
  });

  viewLinks.forEach((link) => link.addEventListener('click', () => showView(link.dataset.viewLink)));

  setInterval(() => {
    if (!document.hidden && !root.hidden) refreshHealth();
  }, HEALTH_INTERVAL_MS);

  function reset() {
    client = { activeServer: null, known: [], pickupMinutes: 720, downloads: [] };
    backups = [];
    rowTasks.clear();
    latestTask = null;
    serverRunning = false;
    ipForm.reset();
    pickupForm.elements.minutes.value = client.pickupMinutes;
    scanNote.textContent = 'Last scan: not run yet.';
    renderKnown();
    renderActions();
    renderDownloads();
    renderTable('No backups loaded. Connect to a server to view archives.');
    showView('dashboard');
  }

  reset();

  return {
    reset,
    get view() { return view; },
    shown() {
      refreshHealth();
      if (client.activeServer) refreshBackups();
      if (view === 'config') loadConfig();
    },
    skip(hours) {
      server.skip(hours);
      scheduledPickup();
      refreshBackups();
      refreshHealth();
      notify.clear();
    },
  };
}
