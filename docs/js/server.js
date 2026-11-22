import { clockTime, seconds } from './format.js';

export const SERVER_HOST = '192.168.1.20';
export const SERVER_PORT = 38471;
export const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

const MAX_OPEN_CODES = 10;
const CODE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING = 10;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RUN_DURATION_MS = 3200;
const DOWNLOAD_DURATION_MS = 1600;
const MIN_INTERVAL_SECONDS = 15 * 60;
const MAX_INTERVAL_SECONDS = 365 * 24 * 3600;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const newPin = () => String(Math.floor(100000 + Math.random() * 900000));
const randomChars = (count) => Array.from({ length: count }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('');
const newToken = () => randomChars(32);

function fail(message) {
  throw new Error(message);
}

function cancelled() {
  const error = new Error('Demo was reset');
  error.cancelled = true;
  return error;
}

function stamp(time) {
  const iso = new Date(time).toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}-${iso.slice(20, 23)}`;
}

export function createServer(onChange) {
  let state;
  let listeners = [];
  let eventListeners = [];
  let generation = 0;

  function reset() {
    generation += 1;
    state = {
      offset: 0,
      nextRunAt: Date.now() + 12 * 3600e3,
      pin: newPin(),
      pairingOpen: true,
      epoch: 1,
      pending: [],
      clients: [],
      codes: [],
      running: false,
      config: { backupLocation: '/var/lib/mediagarrd/backups', retentionCount: 10, backupInterval: 'PT12H' },
      services: [
        { name: 'radarr', paths: ['/srv/radarr/config'] },
        { name: 'sonarr', paths: ['/srv/sonarr/config'] },
        { name: 'jellyfin', paths: ['/srv/jellyfin/config', '/srv/jellyfin/data/metadata'] },
        { name: 'nginx', paths: ['/etc/nginx/sites-available/default'] },
      ],
      backups: [],
      log: [],
    };
    log('INFO', `Started MediaGarrd server on port ${SERVER_PORT}`);
    log('INFO', 'Setup completed, the web setup page is now disabled');
    logPin();
    onChange?.();
  }

  const now = () => Date.now() + state.offset;

  function emit(name) {
    eventListeners.forEach((listener) => listener(name));
  }

  function log(level, message) {
    state.log.push(`${clockTime(now())} ${level.padEnd(5)} ${message}`);
    listeners.forEach((listener) => listener());
  }

  function logPin() {
    log('WARN', `Pairing PIN: ${state.pin} (enter it in the MediaGarrd Client, it stops working once a Client has paired)`);
  }

  function dropExpiredPending() {
    state.pending = state.pending.filter((entry) => entry.createdAt + PENDING_TTL_MS > now());
  }

  function authenticate(token) {
    const client = state.clients.find((entry) => entry.token === token);
    if (client) return client;
    dropExpiredPending();
    const pending = state.pending.find((entry) => entry.token === token);
    if (!pending) fail('Invalid or revoked token, pair this client again');
    const viaPin = pending.source === 'pin';
    if (viaPin && !(state.pairingOpen && pending.epoch === state.epoch)) {
      state.pending = state.pending.filter((entry) => entry !== pending);
      fail('Invalid or revoked token, pair this client again');
    }
    const firstClient = state.clients.length === 0;
    const confirmed = { id: pending.id, name: pending.name, token: pending.token };
    state.clients.push(confirmed);
    state.pending = state.pending.filter((entry) => entry !== pending);
    if (viaPin || firstClient) {
      if (state.pairingOpen) log('INFO', 'Pairing is now closed');
      state.pairingOpen = false;
      state.pin = null;
      state.pending = state.pending.filter((entry) => entry.source !== 'pin');
    }
    if (!viaPin) {
      state.codes = state.codes.filter((code) => code.value !== pending.source);
      state.pending = state.pending.filter((entry) => entry.source !== pending.source);
    }
    log('INFO', `Client ${confirmed.name} confirmed its pairing (${confirmed.id})`);
    return confirmed;
  }

  function requireIdle() {
    if (state.running) fail('Configuration changes are rejected while a backup is running');
  }

  function validateService(service) {
    if (!NAME.test(service.name ?? '')) fail(`Invalid service name: ${service.name}`);
    if (!service.paths?.length) fail('A service needs at least one host path');
    const bad = service.paths.find((path) => !path.startsWith('/'));
    if (bad) fail(`Host paths must be absolute: ${bad}`);
    return { name: service.name, paths: [...new Set(service.paths)] };
  }

  function createArchive(trigger) {
    const time = now();
    const files = state.services.reduce((total, service) => total + service.paths.length * 37, 0);
    const size = Math.round(state.services.length * 2.4e6 + files * 4100 + Math.random() * 3e5);
    const id = `${stamp(time)}-media-backup`;
    state.backups.unshift({ id, fileName: `${id}.zip`, sizeBytes: size, createdAt: new Date(time).toISOString() });
    state.services.forEach((service) => log('INFO', `[${service.name}] Archived ${service.paths.length} path${service.paths.length === 1 ? '' : 's'}`));
    log('INFO', `${trigger} backup finished: ${id}.zip`);
    const removed = state.backups.splice(state.config.retentionCount);
    removed.forEach((backup) => log('INFO', `Retention: deleted ${backup.fileName}`));
  }

  function requireBackup(id) {
    return state.backups.find((backup) => backup.id === id) ?? fail(`Backup not found: ${id}`);
  }

  async function call(work, { delay = 220, token, open = false } = {}) {
    const started = generation;
    await sleep(delay);
    if (started !== generation) throw cancelled();
    if (!open) authenticate(token);
    const result = work();
    onChange?.();
    return structuredClone(result);
  }

  reset();

  return {
    reset,
    now,
    get log() { return state.log; },
    onLog(listener) { listeners.push(listener); },
    onEvent(listener) { eventListeners.push(listener); },

    pair: (credential, name) => call(() => {
      const value = String(credential ?? '').trim();
      let source;
      if (/^[0-9]{6}$/.test(value)) {
        if (!state.pairingOpen) fail('Pairing is closed. Ask a paired Client for a pairing code, or restart the server with MEDIAGARRD_OPEN_PAIRING=true');
        if (value !== state.pin) fail('Invalid PIN or pairing code');
        source = 'pin';
        log('INFO', 'Pairing PIN accepted, pairing closes once the Client has used its token');
      } else {
        const normalized = value.replace(/[- ]/g, '').toUpperCase();
        const code = state.codes.find((entry) => entry.value.replace('-', '') === normalized && entry.expiresAt > now());
        if (!code) fail('Invalid PIN or pairing code');
        source = code.value;
      }
      dropExpiredPending();
      while (state.pending.length >= MAX_PENDING) state.pending.shift();
      const pending = { id: newId(), name: name || 'Demo Client', token: newToken(), source, epoch: state.epoch, createdAt: now() };
      state.pending.push(pending);
      log('INFO', `Client pairing started: ${pending.name} (${pending.id}), it is confirmed by the Client's first request with its token`);
      return { token: pending.token, id: pending.id, name: pending.name };
    }, { delay: 400, open: true }),

    createCode: (token) => call(() => {
      const value = `${randomChars(5)}-${randomChars(5)}`;
      const expiresAt = now() + CODE_TTL_MS;
      state.codes = state.codes.filter((code) => code.expiresAt > now());
      while (state.codes.length >= MAX_OPEN_CODES) {
        const [evicted] = state.codes.splice(0, 1);
        state.pending = state.pending.filter((entry) => entry.source !== evicted.value);
      }
      state.codes.push({ value, expiresAt });
      log('INFO', `Pairing code created, it expires at ${new Date(expiresAt).toISOString()}`);
      return { code: value, expiresAt: new Date(expiresAt).toISOString() };
    }, { token }),

    unpair: (token, id) => call(() => {
      state.clients = state.clients.filter((client) => client.id !== id);
      log('INFO', `Client ${id} was unpaired`);
      if (!state.clients.length) {
        state.pairingOpen = true;
        state.epoch += 1;
        state.pin = newPin();
        log('INFO', 'No Client is paired any more, opening pairing again');
        logPin();
      }
    }, { token }),

    health: (token) => call(() => (!token
      ? { healthy: true, backupInterval: state.config.backupInterval }
      : {
        healthy: true,
        running: state.running,
        backupRetentionCount: state.config.retentionCount,
        backupInterval: state.config.backupInterval,
      }), { delay: 120, token, open: !token }),

    config: (token) => call(() => state.config, { token }),

    updateConfig: (token, { backupLocation, retentionCount, backupInterval }) => call(() => {
      requireIdle();
      if (!backupLocation?.startsWith('/')) fail('Backup location must be an absolute path');
      if (backupLocation.startsWith('/proc') || backupLocation.startsWith('/sys')) fail(`Unable to create backup location ${backupLocation}`);
      if (!(retentionCount >= 1)) fail('Backups to keep must be at least 1');
      const intervalSeconds = seconds(backupInterval);
      if (!(intervalSeconds >= MIN_INTERVAL_SECONDS && intervalSeconds <= MAX_INTERVAL_SECONDS)) fail('Backup interval must be between 15 minutes and 365 days');
      if (backupInterval !== state.config.backupInterval) state.nextRunAt = now() + intervalSeconds * 1000;
      state.config = { backupLocation, retentionCount, backupInterval };
      log('INFO', `Configuration updated: location=${backupLocation}, keep=${retentionCount}, interval=${backupInterval}`);
      return state.config;
    }, { token }),

    services: (token) => call(() => state.services, { token }),

    addService: (token, service) => call(() => {
      requireIdle();
      const valid = validateService(service);
      if (state.services.some((existing) => existing.name === valid.name)) fail(`Service already exists: ${valid.name}`);
      state.services.push(valid);
      log('INFO', `Added service ${valid.name}: ${valid.paths.join(', ')}`);
      return valid;
    }, { token }),

    updateService: (token, name, service) => call(() => {
      requireIdle();
      const valid = validateService(service);
      const index = state.services.findIndex((existing) => existing.name === name);
      if (index < 0) fail(`Service not found: ${name}`);
      if (valid.name !== name && state.services.some((existing) => existing.name === valid.name)) fail(`Service already exists: ${valid.name}`);
      state.services[index] = valid;
      log('INFO', `Updated service ${name}${valid.name === name ? '' : ` -> ${valid.name}`}: ${valid.paths.join(', ')}`);
      return valid;
    }, { token }),

    removeService: (token, name) => call(() => {
      requireIdle();
      state.services = state.services.filter((service) => service.name !== name);
      log('INFO', `Removed service ${name}, existing backups are kept`);
    }, { token }),

    backups: (token) => call(() => state.backups, { token }),

    async runBackup(token) {
      authenticate(token);
      if (state.running) fail('A backup is already running');
      if (!state.services.length) fail('No services configured');
      const started = generation;
      state.running = true;
      log('INFO', `Backup run started: services=[${state.services.map((service) => service.name).join(', ')}]`);
      onChange?.();
      emit('run-started');
      await sleep(RUN_DURATION_MS);
      if (started !== generation) return;
      createArchive('Manual');
      state.running = false;
      onChange?.();
      emit('run-finished');
    },

    async download(token, id, onProgress) {
      authenticate(token);
      const started = generation;
      const backup = structuredClone(requireBackup(id));
      const start = performance.now();
      for (;;) {
        await sleep(90);
        if (started !== generation) throw cancelled();
        const progress = Math.min(1, (performance.now() - start) / DOWNLOAD_DURATION_MS);
        onProgress(Math.round(backup.sizeBytes * progress), backup.sizeBytes);
        if (progress >= 1) return backup;
      }
    },

    skip(hours) {
      if (state.running) fail('A backup is already running');
      const interval = seconds(state.config.backupInterval) * 1000;
      const end = now() + hours * 3600e3;
      state.nextRunAt = Math.max(state.nextRunAt, now());
      state.log.push(`··· skipping ${hours} hours ···`);
      listeners.forEach((listener) => listener());
      if (!state.services.length) {
        state.offset += hours * 3600e3;
        state.nextRunAt = now() + interval;
        log('INFO', 'No scheduled backups: no services configured');
        onChange?.();
        emit('backups-changed');
        return;
      }
      const runs = state.nextRunAt > end ? 0 : Math.floor((end - state.nextRunAt) / interval) + 1;
      const skipped = Math.max(0, runs - state.config.retentionCount);
      state.nextRunAt += skipped * interval;
      if (skipped) log('INFO', `${skipped} older scheduled run${skipped === 1 ? '' : 's'} already pruned by retention`);
      for (let run = skipped; run < runs; run++) {
        state.offset += state.nextRunAt - now();
        createArchive('Scheduled');
        state.nextRunAt += interval;
      }
      state.offset += end - now();
      if (!runs) log('INFO', 'No scheduled backup due in this window');
      onChange?.();
      emit('backups-changed');
    },
  };
}
