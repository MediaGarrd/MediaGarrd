import { clockTime, seconds } from './format.js';

export const SERVER_HOST = '192.168.1.20';
export const SERVER_PORT = 38471;
export const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

const MAX_FAILED_ATTEMPTS = 5;
const RUN_DURATION_MS = 3200;
const DOWNLOAD_DURATION_MS = 1600;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const newPin = () => String(Math.floor(100000 + Math.random() * 900000));

function fail(message) {
  throw new Error(message);
}

function stamp(time) {
  const iso = new Date(time).toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}-${iso.slice(20, 23)}`;
}

export function createServer(onChange) {
  let state;
  let listeners = [];

  function reset() {
    state = {
      offset: 0,
      pin: newPin(),
      failedAttempts: 0,
      unlocked: false,
      setupDone: false,
      running: false,
      config: { backupLocation: '/var/lib/mediagarrd/backups', retentionCount: 10, backupInterval: 'PT12H' },
      services: [],
      backups: [],
      log: [],
    };
    log('INFO', `Started MediaGarrd server on port ${SERVER_PORT}`);
    logPin();
    onChange?.();
  }

  const now = () => Date.now() + state.offset;

  function log(level, message) {
    state.log.push(`${clockTime(now())} ${level.padEnd(5)} ${message}`);
    listeners.forEach((listener) => listener());
  }

  function logPin() {
    log('WARN', `Setup PIN: ${state.pin} (single use, enter it at http://<this-server>:<port>/config)`);
  }

  function requireConfigurable(session) {
    if (session && state.setupDone) fail('Setup is already finished. Use the MediaGarrd Client to change the configuration');
    if (session && !state.unlocked) fail('Enter the setup PIN first');
    if (!session && !state.setupDone) fail('The server has not finished its first-time setup');
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

  async function call(work, delay = 220) {
    await sleep(delay);
    const result = work();
    onChange?.();
    return structuredClone(result);
  }

  reset();

  return {
    reset,
    now,
    get log() { return state.log; },
    get setupDone() { return state.setupDone; },
    get unlocked() { return state.unlocked; },
    onLog(listener) { listeners.push(listener); },

    unlock: (pin) => call(() => {
      if (state.setupDone) fail('Setup is already finished');
      if (pin !== state.pin) {
        state.failedAttempts++;
        log('WARN', 'Rejected an invalid setup PIN');
        if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          state.failedAttempts = 0;
          state.pin = newPin();
          logPin();
        }
        fail('Invalid PIN, check the server logs for the current PIN');
      }
      state.unlocked = true;
      state.failedAttempts = 0;
      state.pin = newPin();
      log('INFO', 'Setup PIN accepted, a new PIN is required for any other device');
      logPin();
    }, 400),

    finishSetup: () => call(() => {
      requireConfigurable(true);
      if (!state.services.length) fail('Add at least one service before finishing setup');
      state.setupDone = true;
      log('INFO', 'Setup finished, the setup page is now disabled');
      log('INFO', `Next scheduled backup in ${state.config.backupInterval}`);
    }),

    exampleSetup: () => call(() => {
      state.services = [
        { name: 'radarr', paths: ['/srv/radarr/config'] },
        { name: 'sonarr', paths: ['/srv/sonarr/config'] },
        { name: 'jellyfin', paths: ['/srv/jellyfin/config', '/srv/jellyfin/data/metadata'] },
        { name: 'nginx', paths: ['/etc/nginx/sites-available/default'] },
      ];
      state.setupDone = true;
      state.unlocked = true;
      log('INFO', 'Setup finished with 4 services, the setup page is now disabled');
    }, 0),

    health: () => call(() => ({
      healthy: true,
      running: state.running,
      backupRetentionCount: state.config.retentionCount,
      backupInterval: state.config.backupInterval,
    }), 120),

    config: (session) => call(() => {
      if (!session && !state.setupDone) fail('The server has not finished its first-time setup');
      return state.config;
    }),

    updateConfig: (session, { backupLocation, retentionCount, backupInterval }) => call(() => {
      requireConfigurable(session);
      if (!backupLocation?.startsWith('/')) fail('Backup location must be an absolute path');
      if (backupLocation.startsWith('/proc') || backupLocation.startsWith('/sys')) fail(`Unable to create backup location ${backupLocation}`);
      if (!(retentionCount >= 1)) fail('Backups to keep must be at least 1');
      if (seconds(backupInterval) < 900) fail('Time between backups must be at least 15 minutes');
      state.config = { backupLocation, retentionCount, backupInterval };
      log('INFO', `Configuration updated: location=${backupLocation}, keep=${retentionCount}, interval=${backupInterval}`);
      return state.config;
    }),

    services: (session) => call(() => {
      if (!session && !state.setupDone) fail('The server has not finished its first-time setup');
      return state.services;
    }),

    addService: (session, service) => call(() => {
      requireConfigurable(session);
      const valid = validateService(service);
      if (state.services.some((existing) => existing.name === valid.name)) fail(`Service already exists: ${valid.name}`);
      state.services.push(valid);
      log('INFO', `Added service ${valid.name}: ${valid.paths.join(', ')}`);
      return valid;
    }),

    updateService: (session, name, service) => call(() => {
      requireConfigurable(session);
      const valid = validateService(service);
      const index = state.services.findIndex((existing) => existing.name === name);
      if (index < 0) fail(`Service not found: ${name}`);
      if (valid.name !== name && state.services.some((existing) => existing.name === valid.name)) fail(`Service already exists: ${valid.name}`);
      state.services[index] = valid;
      log('INFO', `Updated service ${name}${valid.name === name ? '' : ` -> ${valid.name}`}: ${valid.paths.join(', ')}`);
      return valid;
    }),

    removeService: (session, name) => call(() => {
      requireConfigurable(session);
      state.services = state.services.filter((service) => service.name !== name);
      log('INFO', `Removed service ${name}, existing backups are kept`);
    }),

    backups: () => call(() => state.backups),

    async runBackup() {
      await sleep(150);
      if (!state.setupDone) fail('The server has not finished its first-time setup');
      if (state.running) fail('A backup is already running');
      if (!state.services.length) fail('No services configured');
      state.running = true;
      log('INFO', `Backup run started: services=[${state.services.map((service) => service.name).join(', ')}]`);
      onChange?.();
      await sleep(RUN_DURATION_MS);
      createArchive('Manual');
      state.running = false;
      onChange?.();
    },

    async download(id, onProgress) {
      const backup = structuredClone(requireBackup(id));
      const start = performance.now();
      for (;;) {
        await sleep(90);
        const progress = Math.min(1, (performance.now() - start) / DOWNLOAD_DURATION_MS);
        onProgress(Math.round(backup.sizeBytes * progress), backup.sizeBytes);
        if (progress >= 1) return backup;
      }
    },

    skip(hours) {
      const interval = seconds(state.config.backupInterval) * 1000;
      const end = now() + hours * 3600e3;
      state.log.push(`··· skipping ${hours} hours ···`);
      if (!state.setupDone || !state.services.length) {
        state.offset += hours * 3600e3;
        log('INFO', `No scheduled backups: ${state.setupDone ? 'no services configured' : 'setup is not finished'}`);
        onChange?.();
        return;
      }
      const runs = Math.floor((hours * 3600e3) / interval);
      const skipped = Math.max(0, runs - state.config.retentionCount);
      state.offset += skipped * interval;
      if (skipped) log('INFO', `${skipped} older scheduled run${skipped === 1 ? '' : 's'} already pruned by retention`);
      for (let run = skipped; run < runs; run++) {
        state.offset += interval;
        createArchive('Scheduled');
      }
      state.offset += end - now();
      onChange?.();
    },
  };
}
