import { mkdir, open, rename, lstat, opendir, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const sections = ['Life', 'Media', 'Games', 'Work & websites', 'Publishing', 'Projects in progress', 'Other'];
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const controls = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
const text = (value, max = 160) => typeof value === 'string' && value.length <= max && !controls.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Read from the opened inode, never through a symlink; bound growth during the read too.
async function boundedFile(file, limit) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit) throw new Error('Invalid or oversized data file.');
    const buffer = Buffer.alloc(limit + 1); let size = 0;
    while (size <= limit) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break; size += bytesRead;
    }
    if (size > limit) throw new Error('Data file is too large.');
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size));
  } finally { await handle.close(); }
}

async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Object.assign(new Error('A private data directory is required.'), { code: 'EBADDATA' });
}

async function durableNewFile(path, content) {
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(content); await handle.sync(); }
  catch (error) { await unlink(path).catch(() => {}); throw error; }
  finally { await handle.close(); }
}
export function safeUrl(value) {
  if (!text(value, 2000)) throw new Error('Enter a complete http or https address.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http or https address without passwords.');
  return url.href;
}
export function validateState(value) {
  if (!record(value) || value.version !== 1 || !text(value.name, 60) || !value.name.trim() || !text(value.timezone, 80) || typeof value.onboarded !== 'boolean') throw new Error('Invalid dashboard settings.');
  new Intl.DateTimeFormat('en', { timeZone: value.timezone });
  if (!Array.isArray(value.links) || value.links.length > 100) throw new Error('Use up to 100 links.');
  const ids = new Set(), urls = new Set();
  for (const link of value.links) {
    if (!record(link) || typeof link.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(link.id) || ids.has(link.id) || !text(link.label, 80) || !link.label.trim() || !text(link.detail, 180) || !sections.includes(link.section) || typeof link.favourite !== 'boolean' || typeof link.hidden !== 'boolean') throw new Error('Invalid or repeated link.');
    const url = new URL(safeUrl(link.url)); url.hash = ''; const key = url.href.replace(/\/$/, '');
    if (urls.has(key)) throw new Error('That address is already in your dashboard.');
    ids.add(link.id); urls.add(key);
  }
  // Retain only public configuration fields. Never persist credentials from an import.
  return { version: 1, name: value.name.trim(), timezone: value.timezone, onboarded: value.onboarded, links: value.links.map(({ id, label, detail, url, section, favourite, hidden }) => ({ id, label, detail, url: safeUrl(url), section, favourite, hidden })) };
}
export const blankState = () => ({ version: 1, name: 'My LifeOS', timezone: 'Europe/London', onboarded: false, links: [] });
export const demoState = () => ({ ...blankState(), name: 'My LifeOS', onboarded: true, links: [
  ['library', 'My library', 'A little time for a good book', 'https://www.gutenberg.org/', 'Media'],
  ['recipes', 'What’s for dinner?', 'Recipes and pantry ideas', 'https://www.bbcgoodfood.com/', 'Life'],
  ['photos', 'Photo library', 'Your people, places and memories', 'https://immich.app/', 'Media'],
  ['writing', 'Writing desk', 'Make something worth sharing', 'https://ghost.org/', 'Publishing'],
  ['work', 'My work', 'Projects, issues and ideas', 'https://github.com/', 'Work & websites'],
  ['garden', 'Garden notebook', 'An idea taking shape', 'https://example.com/garden', 'Projects in progress']
].map(([id, label, detail, url, section], i) => ({ id, label, detail, url, section, favourite: i < 4, hidden: false })) });

export function createStore(directory) {
  const root = resolve(directory), file = join(root, 'dashboard.json'); let pending = Promise.resolve();
  async function read() {
    try { return validateState(JSON.parse(await boundedFile(file, 256_000))); }
    catch (error) {
      if (error.code === 'ENOENT') return blankState();
      throw Object.assign(new Error('The saved dashboard needs attention; it has not been reset.'), { code: 'EBADDATA', cause: error });
    }
  }
  async function save(value, revision) {
    const next = validateState(value), content = JSON.stringify(next, null, 2) + '\n';
    if (Buffer.byteLength(content) > 256_000) throw new Error('Dashboard settings are too large.');
    const operation = pending.then(async () => {
      const current = await read();
      if (revision !== digest(current)) throw Object.assign(new Error('Your dashboard changed elsewhere. Reload before saving.'), { status: 409 });
      if (digest(next) === digest(current)) return current;
      await privateDirectory(root);
      const backups = join(root, 'backups'); await privateDirectory(backups);
      const backup = join(backups, `${Date.now()}-${randomUUID()}.json`), temporary = join(root, `${randomUUID()}.tmp`);
      let committed = false, backupCreated = false, temporaryCreated = false;
      try {
        await durableNewFile(backup, JSON.stringify(current, null, 2)); backupCreated = true;
        await durableNewFile(temporary, content); temporaryCreated = true;
        await rename(temporary, file); committed = true; return next;
      } finally {
        // A failed save must not leave partial state or partial backup files behind.
        if (temporaryCreated) await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (!committed && backupCreated) await unlink(backup).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
    });
    pending = operation.catch(() => {}); return operation;
  }
  return { read, save };
}

export async function readMetrics(directory) {
  try {
    const values = JSON.parse(await boundedFile(join(directory, 'metrics.json'), 100_000));
    if (!Array.isArray(values) || values.length > 12) throw new Error('Use up to 12 metrics.');
    return values.map(metric => {
      if (!record(metric) || !text(metric.label, 80) || !metric.label.trim() || !text(metric.value, 80) || !text(metric.note, 180) || !text(metric.source, 80) || !text(metric.checkedAt, 80) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(metric.checkedAt) || !Number.isFinite(Date.parse(metric.checkedAt)) || Date.parse(metric.checkedAt) > Date.now() + 60_000) throw new Error('Invalid metric.');
      const ttl = Number.isFinite(metric.maxAgeMinutes) ? Math.max(1, Math.min(43200, metric.maxAgeMinutes)) : 60;
      return { label: metric.label, value: metric.value, note: metric.note, source: metric.source, checkedAt: metric.checkedAt, stale: Date.now() - Date.parse(metric.checkedAt) > ttl * 60_000 };
    });
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function readJournal(directory) {
  let directoryHandle;
  try { directoryHandle = await opendir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const names = []; let scanned = 0;
  // Retain at most 104 names even in a large folder. Never allocate a full listing.
  for await (const entry of directoryHandle) {
    if (++scanned > 10_000) throw new Error('The journal directory is too large. Use a dedicated weekly journal folder.');
    const name = entry.name;
    if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2} - .+\.md$/.test(name)) continue;
    const date = name.slice(0, 10), parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue;
    names.push(name); names.sort().reverse(); if (names.length > 104) names.pop();
  }
  const entries = [];
  for (const name of names) {
    const path = join(directory, name);
    let info;
    try { info = await lstat(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.size > 100_000) continue;
    let body;
    try { body = await boundedFile(path, 100_000); }
    catch (error) { if (['ENOENT', 'ELOOP'].includes(error.code)) continue; throw error; }
    body = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    entries.push({ date: name.slice(0, 10), title: name.slice(13, -3), body });
  }
  return entries;
}
