const ISO_DURATION = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i;

export function seconds(duration) {
  if (typeof duration === 'number') return duration;
  const [, hours = 0, minutes = 0, secs = 0] = ISO_DURATION.exec(duration ?? '') || [];
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(secs);
}

export function toDuration(minutes) {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `PT${hours ? `${hours}H` : ''}${rest || !hours ? `${rest}M` : ''}`;
}

export function formatInterval(duration) {
  const total = seconds(duration);
  if (!total) return '—';
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return [hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(' ');
}

export function bytes(size) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  let value = size;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function relativeTime(iso, now) {
  const elapsed = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (elapsed < 60) return `${elapsed}s ago`;
  const minutes = Math.floor(elapsed / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function percent(written, total) {
  return total > 0 ? Math.max(0, Math.min(100, Math.floor((written / total) * 100))) : 0;
}

export function clockTime(time) {
  return new Date(time).toTimeString().slice(0, 8);
}
