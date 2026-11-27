import { initClientDemo } from './client-demo.js';
import { createServer } from './server.js';

const CLIENT_URL = 'http://192.168.1.50:8081/';

const windowUrl = document.querySelector('[data-window-url]');
const logView = document.querySelector('[data-log]');

const server = createServer();
const skipButton = document.querySelector('[data-fast-forward]');
const client = initClientDemo(document.getElementById('clientDemo'), server, {
  downloadsList: document.querySelector('[data-downloads]'),
  skipButton,
  onViewChanged: renderUrl,
});

const PIN_PATTERN = /(Pairing PIN: )(\d{6})/;

function renderLine(line) {
  const match = PIN_PATTERN.exec(line);
  if (!match) return [document.createTextNode(line)];
  const mark = document.createElement('mark');
  mark.textContent = match[2];
  const end = match.index + match[0].length;
  return [
    document.createTextNode(line.slice(0, match.index + match[1].length)),
    mark,
    document.createTextNode(line.slice(end)),
  ];
}

let renderedLines = 0;

function clearLog() {
  logView.replaceChildren();
  renderedLines = 0;
}

function renderLog() {
  const lines = server.log;
  const nodes = [];
  for (let index = renderedLines; index < lines.length; index++) {
    if (index) nodes.push(document.createTextNode('\n'));
    nodes.push(...renderLine(lines[index]));
  }
  logView.append(...nodes);
  renderedLines = lines.length;
  logView.scrollTop = logView.scrollHeight;
}

function renderUrl(view) {
  windowUrl.textContent = `${CLIENT_URL}${view === 'config' ? '#config' : ''}`;
}

skipButton.addEventListener('click', () => client.skip(12));

document.querySelector('[data-reset]').addEventListener('click', () => {
  clearLog();
  server.reset();
  client.reset();
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
