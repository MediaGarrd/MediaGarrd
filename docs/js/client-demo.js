import { createNotifier, initServices, initSettings } from './forms.js';
import { bytes, formatInterval, percent, relativeTime } from './format.js';
import { SERVER_HOST, SERVER_PORT, SERVER_URL } from './server.js';

const CONNECT_MS = 700;
const AUTO_DOWNLOAD_SUFFIX = '-AD';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const autoName = (fileName) => fileName.replace(/\.zip$/, `${AUTO_DOWNLOAD_SUFFIX}.zip`);

export function initClientDemo(root, server, { downloadsList, skipButton, onViewChanged }) {
  const banner = createNotifier(root.querySelector('[data-banner]'));
  const notify = { ...banner, error: (error) => { if (!error?.cancelled) banner.error(error); } };
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
  const pairing = root.querySelector('[data-pairing]');
  const pairForm = pairing.querySelector('[data-pair-form]');
  const pairNote = pairing.querySelector('[data-pair-note]');
  const manage = pairing.querySelector('[data-manage]');
  const codeBox = pairing.querySelector('[data-code-box]');
  const codeText = pairing.querySelector('[data-code]');
  const codeExpiry = pairing.querySelector('[data-code-expiry]');
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
  let generation = 0;
  let backups = [];
  let busy = false;
  let runInFlight = false;
  let serverRunning = false;
  let link = 'LIVE';
  let health = null;
  let latestTask = null;
  let view = 'dashboard';
  let code = null;
  let codeTimer = null;

  const configApi = {
    config: () => requireServer().then(() => server.config(client.token)),
    updateConfig: (config) => requireServer().then(() => server.updateConfig(client.token, config)),
    services: () => requireServer().then(() => server.services(client.token)),
    addService: (service) => requireServer().then(() => server.addService(client.token, service)),
    updateService: (name, service) => requireServer().then(() => server.updateService(client.token, name, service)),
    removeService: (name) => requireServer().then(() => server.removeService(client.token, name)),
  };
  const settings = initSettings(root.querySelector('[data-config-content] [data-settings]'), configApi, notify, refreshHealth);
  const services = initServices(root.querySelector('[data-config-content] [data-services]'), configApi, notify);

  async function requireServer() {
    if (!client.activeServer) throw new Error('No active MediaGarrd server selected');
    if (!client.token) throw new Error('This client is not paired with the server');
  }

  function renderCode() {
    if (!code) {
      codeBox.hidden = true;
      return;
    }
    const left = Math.round((Date.parse(code.expiresAt) - server.now()) / 1000);
    codeText.textContent = code.code;
    codeExpiry.textContent = left > 0 ? `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Expired';
    codeBox.hidden = false;
    if (left <= 0) {
      clearInterval(codeTimer);
      codeTimer = null;
    }
  }

  function clearCode() {
    code = null;
    clearInterval(codeTimer);
    codeTimer = null;
    renderCode();
  }

  function renderPairing() {
    const visible = Boolean(client.activeServer) && link === 'LIVE';
    pairing.hidden = !visible;
    pairForm.hidden = Boolean(client.token);
    manage.hidden = !client.token;
    pairNote.textContent = 'Enter the PIN the server prints in its logs ("Pairing PIN"), or a pairing code created by a client that is already paired.';
  }

  function setBadge(kind, label) {
    badge.className = `conn-badge ${kind}`;
    badge.querySelector('[data-label]').textContent = label;
  }

  function renderStatus() {
    const connected = Boolean(client.activeServer);
    const live = connected && link === 'LIVE';
    details.hidden = !live;
    noServer.hidden = live;
    if (!live) {
      noServer.textContent = connected ? `Connecting to ${client.activeServer}…` : 'No server connected.';
    }
    if (live && health) {
      status.querySelector('[data-url]').textContent = client.activeServer;
      status.querySelector('[data-interval]').textContent = formatInterval(health.backupInterval);
      status.querySelector('[data-retention]').textContent = health.backupRetentionCount ? `${health.backupRetentionCount} archives` : '—';
    }
    stateTag.textContent = serverRunning ? 'Running' : 'Idle';
    stateTag.classList.toggle('running', serverRunning);
    if (!busy) {
      if (!connected) setBadge('', 'Not Connected');
      else if (link === 'CONNECTING') setBadge('checking', 'Connecting…');
      else setBadge('ok', client.activeServer.replace(/^https?:\/\//, ''));
    }
    renderPairing();
    renderActions();
  }

  async function refreshHealth() {
    if (client.activeServer && link === 'LIVE') {
      try {
        health = await server.health(client.token);
        const finished = serverRunning && !health.running;
        serverRunning = Boolean(health.running);
        if (finished) refreshBackups();
      } catch {
        health = null;
      }
    }
    renderStatus();
  }

  function onServerEvent(name) {
    if (!client.activeServer) return;
    if (busy || link !== 'LIVE') return;
    if (name === 'run-started') {
      serverRunning = true;
      renderStatus();
    } else if (name === 'run-finished') {
      serverRunning = false;
      renderStatus();
      refreshBackups();
    } else if (name === 'backups-changed') {
      refreshBackups();
    }
  }

  function renderKnown() {
    const options = client.known.map((url) => new Option(url, url, false, url === client.activeServer));
    known.replaceChildren(...(options.length ? options : [new Option('— none discovered yet —', '')]));
  }

  function cancelled() {
    const error = new Error('Demo was reset');
    error.cancelled = true;
    return error;
  }

  async function connect(label, action) {
    if (busy) return null;
    notify.clear();
    const started = generation;
    const stale = () => started !== generation;
    const pause = async (ms) => {
      await sleep(ms);
      if (stale()) throw cancelled();
    };
    const before = client.activeServer;
    busy = true;
    setBadge('checking', label);
    scanBar.classList.add('active');
    controls.forEach((control) => { control.disabled = true; });
    let result = null;
    try {
      result = await action(pause);
    } catch (error) {
      notify.error(error);
    }
    if (stale()) return null;
    busy = false;
    scanBar.classList.remove('active');
    controls.forEach((control) => { control.disabled = false; });
    renderKnown();
    const switched = Boolean(result) && client.activeServer !== before;
    if (switched) {
      link = 'CONNECTING';
      health = null;
      serverRunning = false;
      renderStatus();
      await sleep(CONNECT_MS);
      if (stale()) return null;
    }
    link = 'LIVE';
    await refreshHealth();
    if (stale()) return null;
    if (result) serverChanged();
    return result;
  }

  function select(url) {
    client.activeServer = url;
    if (!client.known.includes(url)) client.known.push(url);
  }

  async function resolveByIp(input, portInput, pause) {
    const [host, inlinePort] = input.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].split(':');
    const port = portInput ? Number(portInput) : Number(inlinePort) || null;
    if (host !== SERVER_HOST) {
      await pause(550);
      throw new Error(`No MediaGarrd server found at ${host}`);
    }
    await pause(port && port !== SERVER_PORT ? 1400 : 450);
    select(SERVER_URL);
    return SERVER_URL;
  }

  async function discover(pause) {
    await pause(2000);
    const found = [SERVER_URL];
    client.known = [...new Set([...found, ...(client.activeServer ? [client.activeServer] : [])])];
    if (!client.activeServer && found.length) client.activeServer = found[0];
    return found;
  }

  function renderActions() {
    const backupBusy = serverRunning || runInFlight;
    runButton.disabled = backupBusy || link !== 'LIVE' || !client.token;
    skipButton.disabled = backupBusy;
    runButton.classList.toggle('busy', backupBusy);
    runButton.querySelector('.btn-label').textContent = backupBusy ? 'Backup In Progress' : 'Run Backup Now';
    pickupButton.disabled = Boolean(latestTask) || !client.token;
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
      header.setAttribute('aria-sort', active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
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
    if (client.activeServer && link !== 'LIVE') return;
    if (client.activeServer && !client.token) {
      backups = [];
      renderTable('No backups loaded. Pair this client with the server to view archives.');
      return;
    }
    const started = generation;
    try {
      await requireServer();
      const list = await server.backups(client.token);
      if (started !== generation) return;
      backups = list;
      renderTable();
    } catch (error) {
      if (started !== generation || error.cancelled) return;
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
    const started = generation;
    const task = { written: 0, total: backup.sizeBytes };
    const button = () => rows.querySelector(`button[data-id="${backup.id}"]`);
    if (latest) latestTask = task;
    else rowTasks.set(backup.id, task);
    const render = () => (latest ? renderActions() : button() && renderRowButton(button(), backup.id));
    render();
    try {
      if (!client.downloads.some((file) => file.name === backup.fileName && file.size === backup.sizeBytes)) {
        await server.download(client.token, backup.id, (written, total) => {
          task.written = written;
          task.total = total;
          render();
        });
        if (started !== generation) return;
        save(backup, backup.fileName, false);
      }
    } catch (error) {
      notify.error(error);
    } finally {
      if (started !== generation) return;
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
    const started = generation;
    try {
      await requireServer();
      const [config, list] = await Promise.all([server.config(client.token), server.services(client.token)]);
      if (started !== generation) return;
      settings.show(config);
      services.show(list);
      configContent.hidden = false;
      unavailable.hidden = true;
    } catch (error) {
      if (started !== generation || error.cancelled) return;
      configContent.hidden = true;
      unavailable.hidden = false;
      unavailable.querySelector('[data-reason]').textContent =
        `${error.message}. Connect and pair with a MediaGarrd server on the Dashboard to manage its configuration.`;
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

  function pickupDue() {
    const interval = client.pickupMinutes * 60e3;
    const time = server.now();
    if (time < client.nextPickupAt) return false;
    client.nextPickupAt += Math.floor((time - client.nextPickupAt) / interval + 1) * interval;
    return true;
  }

  function scheduledPickup() {
    if (!pickupDue() || !client.activeServer || link !== 'LIVE' || !client.token) return;
    const started = generation;
    server.backups(client.token).then((list) => {
      if (started !== generation || !list.length) return;
      const latest = list[0];
      const names = [latest.fileName, autoName(latest.fileName)];
      if (!client.downloads.some((file) => names.includes(file.name))) save(latest, names[1], true);
    }).catch(() => {});
  }

  ipForm.addEventListener('submit', (event) => {
    event.preventDefault();
    connect('Probing…', (pause) => resolveByIp(ipForm.elements.ip.value, ipForm.elements.port.value, pause));
  });

  connection.querySelector('[data-connect-known]').addEventListener('click', () => {
    if (!known.value) {
      notify.error('No server selected.');
      return;
    }
    connect('Connecting…', async (pause) => {
      await pause(300);
      select(known.value);
      return known.value;
    });
  });

  connection.querySelector('[data-discover]').addEventListener('click', async () => {
    if (busy) return;
    scanNote.textContent = 'Scan in progress…';
    const started = generation;
    const found = await connect('Scanning…', discover);
    if (started !== generation) return;
    const count = found?.length ?? 0;
    scanNote.textContent = found ? `Last scan: found ${count} server${count === 1 ? '' : 's'}.` : 'Last scan: failed.';
  });

  runButton.addEventListener('click', async () => {
    if (serverRunning || runInFlight) return;
    notify.clear();
    const started = generation;
    runInFlight = true;
    renderActions();
    try {
      await requireServer();
      await server.runBackup(client.token);
    } catch (error) {
      notify.error(error);
    } finally {
      if (started === generation) {
        runInFlight = false;
        renderActions();
      }
    }
  });

  pickupButton.addEventListener('click', async () => {
    if (latestTask) return;
    notify.clear();
    try {
      await requireServer();
      const list = await server.backups(client.token);
      if (!list.length) throw new Error('No backups found on server');
      await download(list[0], true);
    } catch (error) {
      notify.error(error);
    }
  });

  const isRefusal = (error) => error.message.startsWith('Invalid or revoked token');

  async function refuseWhileStillPaired() {
    try {
      await server.health(client.token);
    } catch (error) {
      if (isRefusal(error)) return;
      throw error;
    }
    throw new Error('This client is already paired with this server. Unpair it first.');
  }

  pairForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    notify.clear();
    const button = pairForm.querySelector('button');
    button.disabled = true;
    const started = generation;
    try {
      if (client.token) await refuseWhileStillPaired();
      if (started !== generation) return;
      const paired = await server.pair(pairForm.elements.pin.value, 'Demo Client');
      if (started !== generation) return;
      client.token = paired.token;
      client.clientId = paired.id;
      pairForm.reset();
      try {
        await server.health(paired.token);
      } catch (error) {
        if (started === generation) {
          client.token = null;
          client.clientId = null;
        }
        throw error;
      }
      if (started !== generation) return;
      notify.ok('Paired with the server');
      await refreshHealth();
      if (started !== generation) return;
      serverChanged();
    } catch (error) {
      notify.error(error);
    } finally {
      button.disabled = false;
    }
  });

  pairing.querySelector('[data-create-code]').addEventListener('click', async () => {
    notify.clear();
    const started = generation;
    try {
      const created = await server.createCode(client.token);
      if (started !== generation) return;
      code = created;
      clearInterval(codeTimer);
      codeTimer = setInterval(renderCode, 1000);
      renderCode();
    } catch (error) {
      notify.error(error);
    }
  });

  pairing.querySelector('[data-unpair]').addEventListener('click', async () => {
    if (!confirm('Unpair this client from the server?')) return;
    notify.clear();
    const started = generation;
    try {
      await server.unpair(client.token, client.clientId);
      if (started !== generation) return;
      client.token = null;
      client.clientId = null;
      clearCode();
      notify.ok('Unpaired from the server');
      await refreshHealth();
      if (started !== generation) return;
      serverChanged();
    } catch (error) {
      notify.error(error);
    }
  });

  pickupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    notify.clear();
    await sleep(200);
    client.pickupMinutes = Number(pickupForm.elements.minutes.value);
    client.nextPickupAt = server.now() + client.pickupMinutes * 60e3;
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

  server.onEvent(onServerEvent);

  function reset() {
    generation += 1;
    busy = false;
    runInFlight = false;
    scanBar.classList.remove('active');
    controls.forEach((control) => { control.disabled = false; });
    pairForm.reset();
    pairForm.querySelector('button').disabled = false;
    client = { activeServer: null, known: [], pickupMinutes: 720, nextPickupAt: server.now() + 720 * 60e3, downloads: [], token: null, clientId: null };
    clearCode();
    backups = [];
    rowTasks.clear();
    latestTask = null;
    serverRunning = false;
    link = 'LIVE';
    health = null;
    ipForm.reset();
    pickupForm.elements.minutes.value = client.pickupMinutes;
    scanNote.textContent = 'Last scan: not run yet.';
    renderKnown();
    renderStatus();
    renderDownloads();
    renderTable('No backups loaded. Connect to a server to view archives.');
    showView('dashboard');
  }

  reset();

  return {
    reset,
    skip(hours) {
      if (serverRunning || runInFlight) return;
      notify.clear();
      try {
        server.skip(hours);
      } catch (error) {
        notify.error(error);
        return;
      }
      scheduledPickup();
    },
  };
}
