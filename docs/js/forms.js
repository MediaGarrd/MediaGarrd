import { seconds, toDuration } from './format.js';

const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true);

export function createNotifier(banner) {
  function show(message, kind) {
    banner.textContent = message;
    banner.className = `banner visible ${kind}`;
  }

  return {
    ok: (message) => show(message, 'ok'),
    error: (error) => show(error.message || String(error), 'error'),
    clear: () => { banner.className = 'banner'; },
  };
}

export function initSettings(panel, api, notify, onSaved = () => {}) {
  panel.replaceChildren(fromTemplate('settingsTemplate'));
  const form = panel.querySelector('form');
  const { backupLocation, intervalHours, retentionCount } = form.elements;

  function show(config) {
    backupLocation.value = config.backupLocation;
    intervalHours.value = seconds(config.backupInterval) / 3600;
    retentionCount.value = config.retentionCount;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    notify.clear();
    try {
      show(await api.updateConfig({
        backupLocation: backupLocation.value,
        retentionCount: Number(retentionCount.value),
        backupInterval: toDuration(Number(intervalHours.value) * 60),
      }));
      notify.ok('Backup settings saved');
      onSaved();
    } catch (error) {
      notify.error(error);
    }
  });

  return { show };
}

export function initServices(panel, api, notify, onChanged = () => {}) {
  panel.replaceChildren(fromTemplate('servicesTemplate'));
  const form = panel.querySelector('form');
  const title = panel.querySelector('[data-form-title]');
  const paths = panel.querySelector('[data-paths]');
  const cancel = panel.querySelector('[data-cancel]');
  const rows = panel.querySelector('tbody');
  const empty = panel.querySelector('[data-empty]');
  let editing = null;

  function addPathInput(value = '') {
    const row = fromTemplate('pathTemplate').firstElementChild;
    row.querySelector('input').value = value;
    row.querySelector('button').addEventListener('click', () => {
      row.remove();
      if (!paths.children.length) addPathInput();
    });
    paths.append(row);
  }

  function resetForm() {
    editing = null;
    form.reset();
    paths.replaceChildren();
    addPathInput();
    title.textContent = 'Add Service';
    cancel.hidden = true;
  }

  function editService(service) {
    editing = service.name;
    form.elements.name.value = service.name;
    paths.replaceChildren();
    service.paths.forEach((path) => addPathInput(path));
    title.textContent = `Edit ${service.name}`;
    cancel.hidden = false;
    form.elements.name.focus();
  }

  async function removeService(service) {
    if (!confirm(`Remove ${service.name}? Existing backups are kept.`)) return;
    notify.clear();
    try {
      await api.removeService(service.name);
      if (editing === service.name) resetForm();
      notify.ok(`Removed ${service.name}`);
      await refresh();
    } catch (error) {
      notify.error(error);
    }
  }

  function renderRow(service) {
    const row = fromTemplate('serviceRowTemplate').firstElementChild;
    row.querySelector('[data-name]').textContent = service.name;
    row.querySelector('[data-paths]').textContent = service.paths.join('\n');
    row.querySelector('[data-edit]').addEventListener('click', () => editService(service));
    row.querySelector('[data-remove]').addEventListener('click', () => removeService(service));
    return row;
  }

  function show(services) {
    rows.replaceChildren(...services.map(renderRow));
    empty.hidden = services.length > 0;
    onChanged(services);
  }

  async function refresh() {
    show(await api.services());
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    notify.clear();
    const service = {
      name: form.elements.name.value,
      paths: [...paths.querySelectorAll('input')].map((input) => input.value),
    };
    try {
      const saved = editing ? await api.updateService(editing, service) : await api.addService(service);
      notify.ok(`Saved ${saved.name}`);
      resetForm();
      await refresh();
    } catch (error) {
      notify.error(error);
    }
  });

  panel.querySelector('[data-add-path]').addEventListener('click', () => addPathInput());
  cancel.addEventListener('click', resetForm);

  resetForm();
  return { show, refresh, resetForm };
}
