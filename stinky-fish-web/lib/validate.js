// Session codes become part of Redis keys, so keep them to a safe, predictable
// character set. Mirrors the normalization done client-side, but re-checked
// here since API input should never be trusted just because the UI cleaned it.
export function normalizeCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60);
}

export function isValidCode(code) {
  return typeof code === 'string' && code.length > 0 && code.length <= 60;
}
