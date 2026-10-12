import { mkdir, readFile, writeFile, rename, lstat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const sections = ['Life', 'Media', 'Games', 'Work & websites', 'Publishing', 'Projects in progress', 'Other'];
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = (value, max = 160) => typeof value === 'string' && value.length <= max;
export function safeUrl(value) {
  if (!text(value, 2000)) throw new Error('Enter a complete http or https address.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http or https address without passwords.');
  return url.href;
}
export function validateState(value) {
  if (!value || value.version !== 1 || !text(value.name, 60) || !value.name.trim() || !text(value.timezone, 80) || typeof value.onboarded !== 'boolean') throw new Error('Invalid dashboard settings.');
  new Intl.DateTimeFormat('en', { timeZone: value.timezone });
  if (!Array.isArray(value.links) || value.links.length > 100) throw new Error('Use up to 100 links.');
  const ids = new Set(), urls = new Set();
  for (const link of value.links) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(link.id) || ids.has(link.id) || !text(link.label, 80) || !link.label.trim() || !text(link.detail, 180) || !sections.includes(link.section) || typeof link.favourite !== 'boolean' || typeof link.hidden !== 'boolean') throw new Error('Invalid or repeated link.');
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
    try { return validateState(JSON.parse(await readFile(file, 'utf8'))); }
    catch (error) { if (error.code === 'ENOENT') return blankState(); throw error; }
  }
  async function save(value, revision) {
    const next = validateState(value);
    const operation = pending.then(async () => {
      const current = await read();
      if (revision !== digest(current)) throw Object.assign(new Error('Your dashboard changed elsewhere. Reload before saving.'), { status: 409 });
      await mkdir(join(root, 'backups'), { recursive: true, mode: 0o700 });
      await writeFile(join(root, 'backups', `${Date.now()}-${randomUUID()}.json`), JSON.stringify(current, null, 2), { mode: 0o600, flag: 'wx' });
      const temporary = join(root, `${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      await rename(temporary, file); return next;
    });
    pending = operation.catch(() => {}); return operation;
  }
  return { read, save };
}

export async function readMetrics(directory) {
  try {
    const file = join(directory, 'metrics.json'); const info = await lstat(file);
    if (!info.isFile() || info.size > 100_000) throw new Error('Invalid metrics file.');
    const values = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(values) || values.length > 12) throw new Error('Use up to 12 metrics.');
    return values.map(metric => {
      if (!text(metric.label, 80) || !text(metric.value, 80) || !text(metric.note, 180) || !text(metric.source, 80) || !Number.isFinite(Date.parse(metric.checkedAt)) || Date.parse(metric.checkedAt) > Date.now() + 60_000) throw new Error('Invalid metric.');
      const ttl = Number.isFinite(metric.maxAgeMinutes) ? Math.max(1, Math.min(43200, metric.maxAgeMinutes)) : 60;
      return { label: metric.label, value: metric.value, note: metric.note, source: metric.source, checkedAt: metric.checkedAt, stale: Date.now() - Date.parse(metric.checkedAt) > ttl * 60_000 };
    });
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function readJournal(directory) {
  let files;
  try { files = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const names = files.filter(name => /^\d{4}-\d{2}-\d{2} - .+\.md$/.test(name)).sort().reverse().slice(0, 104);
  const entries = [];
  for (const name of names) {
    const path = join(directory, name), info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 100_000) continue;
    let body = await readFile(path, 'utf8'); body = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    entries.push({ date: name.slice(0, 10), title: name.slice(13, -3), body });
  }
  return entries;
}
