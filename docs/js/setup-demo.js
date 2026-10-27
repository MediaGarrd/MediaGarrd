import { createNotifier, initServices, initSettings } from './forms.js';

export function initSetupDemo(root, server, { onFinished }) {
  const pinPanel = root.querySelector('[data-pin]');
  const pinForm = pinPanel.querySelector('form');
  const pinError = pinPanel.querySelector('[data-error]');
  const workspace = root.querySelector('[data-setup-workspace]');
  const content = root.querySelector('[data-setup-content]');
  const finishButton = root.querySelector('[data-finish] button');
  const finished = root.querySelector('[data-finished]');
  const notify = createNotifier(root.querySelector('[data-banner]'));

  const api = {
    config: () => server.config(true),
    updateConfig: (config) => server.updateConfig(true, config),
    services: () => server.services(true),
    addService: (service) => server.addService(true, service),
    updateService: (name, service) => server.updateService(true, name, service),
    removeService: (name) => server.removeService(true, name),
  };

  const settings = initSettings(root.querySelector('[data-settings]'), api, notify);
  const services = initServices(root.querySelector('[data-services]'), api, notify, (list) => {
    finishButton.title = list.length ? '' : 'Add at least one service first';
  });

  function showFinished() {
    pinPanel.hidden = true;
    workspace.hidden = false;
    content.hidden = true;
    finished.hidden = false;
  }

  async function start() {
    pinPanel.hidden = true;
    workspace.hidden = false;
    content.hidden = false;
    finished.hidden = true;
    const [config, list] = await Promise.all([api.config(), api.services()]);
    settings.show(config);
    services.show(list);
  }

  function render() {
    notify.clear();
    pinForm.reset();
    pinError.textContent = '';
    services.resetForm();
    if (server.setupDone) {
      showFinished();
      notify.ok('Setup is finished. This page is disabled, further changes go through the API or the MediaGarrd Client.');
    } else if (server.unlocked) {
      start().catch(notify.error);
    } else {
      pinPanel.hidden = false;
      workspace.hidden = true;
    }
  }

  pinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = pinForm.querySelector('button');
    button.disabled = true;
    try {
      await server.unlock(pinForm.elements.pin.value);
      pinError.textContent = '';
      await start();
    } catch (error) {
      pinError.textContent = error.message;
      pinForm.reset();
    } finally {
      button.disabled = false;
    }
  });

  finishButton.addEventListener('click', async () => {
    if (!confirm('Finish setup? This page will be disabled and further changes must go through the API or the MediaGarrd Client.')) return;
    notify.clear();
    try {
      await server.finishSetup();
      showFinished();
      notify.ok('Setup complete. This page is now disabled, further changes go through the API or the MediaGarrd Client.');
      onFinished();
    } catch (error) {
      notify.error(error);
    }
  });

  render();
  return { render };
}
