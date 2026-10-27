import { initClientDemo } from './client-demo.js';
import { createServer } from './server.js';
import { initSetupDemo } from './setup-demo.js';

const CLIENT_URL = 'http://192.168.1.50:8081/';
const SETUP_URL = 'http://192.168.1.20:38471/config';

const tabs = document.querySelectorAll('[data-demo-tab]');
const screens = document.querySelectorAll('[data-demo]');
const windowUrl = document.querySelector('[data-window-url]');
const logView = document.querySelector('[data-log]');
const clientOnly = document.querySelector('[data-client-only]');
const exampleSetup = document.querySelector('[data-example-setup]');
let current = 'setup';

const server = createServer();
const setup = initSetupDemo(document.getElementById('setupDemo'), server, { onFinished: renderAside });
const client = initClientDemo(document.getElementById('clientDemo'), server, {
  downloadsList: document.querySelector('[data-downloads]'),
  onViewChanged: renderUrl,
});

function renderLog() {
  logView.textContent = server.log.join('\n');
  logView.scrollTop = logView.scrollHeight;
}

function renderUrl() {
  windowUrl.textContent = current === 'setup' ? SETUP_URL : `${CLIENT_URL}${client.view === 'config' ? '#config' : ''}`;
}

function renderAside() {
  document.querySelectorAll('[data-steps]').forEach((steps) => { steps.hidden = steps.dataset.steps !== current; });
  clientOnly.hidden = current !== 'client';
  exampleSetup.hidden = current !== 'client' || server.setupDone;
}

function showDemo(name) {
  current = name;
  tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.demoTab === name)));
  screens.forEach((screen) => { screen.hidden = screen.dataset.demo !== name; });
  if (name === 'setup') setup.render();
  else client.shown();
  renderUrl();
  renderAside();
}

tabs.forEach((tab) => tab.addEventListener('click', () => showDemo(tab.dataset.demoTab)));
document.querySelector('[data-open-client]').addEventListener('click', () => showDemo('client'));

exampleSetup.querySelector('button').addEventListener('click', async () => {
  await server.exampleSetup();
  renderAside();
  client.shown();
});

document.querySelector('[data-fast-forward]').addEventListener('click', () => client.skip(12));

document.querySelector('[data-reset]').addEventListener('click', () => {
  server.reset();
  client.reset();
  showDemo('setup');
  renderLog();
});

document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
  const text = button.parentElement.querySelector('pre').textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Select it';
  }
  setTimeout(() => { button.textContent = 'Copy'; }, 1400);
}));

server.onLog(renderLog);
renderLog();
showDemo('setup');
