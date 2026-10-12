import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../server.mjs';
import { demoState, createStore, digest, readJournal, readMetrics } from '../lib/store.mjs';

test('private access, origin checks, durable edits and conflict protection', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lifeos-test-'));
  const app = await start({ port: 0, data: dir, password: 'a-test-only-password' });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const api = (path, options) => fetch(app.origin + path, options);
  assert.equal((await api('/api/dashboard')).status, 401);
  assert.equal((await api('/')).status, 200);
  const headers = { Origin: app.origin, 'Content-Type': 'application/json' };
  assert.equal((await api('/api/login', { method: 'POST', headers: { ...headers, Origin: 'https://attacker.invalid' }, body: '{}' })).status, 403);
  assert.equal((await api('/api/login', { method: 'POST', headers, body: '{"password":"incorrect"}' })).status, 401);
  const signed = await api('/api/login', { method: 'POST', headers, body: '{"password":"a-test-only-password"}' });
  assert.equal(signed.status, 200); const cookie = signed.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/); assert.match(cookie, /Max-Age=86400/);
  headers.Cookie = cookie.split(';')[0];
  const before = await (await api('/api/dashboard', { headers })).json();
  const state = demoState(); state.name = 'A fresh start';
  const save = () => api('/api/dashboard', { method: 'PUT', headers: { ...headers, 'If-Match': before.revision }, body: JSON.stringify(state) });
  const competing = await Promise.all([save(), save()]); assert.deepEqual(competing.map(x => x.status).sort(), [200, 409]);
  assert.equal(JSON.parse(await readFile(join(dir, 'dashboard.json'))).name, 'A fresh start');
  assert.equal((await readdir(join(dir, 'backups'))).length, 1);
  const after = await (await api('/api/dashboard', { headers })).json();
  const invalid = structuredClone(state); invalid.links[0].url = 'javascript:alert(1)';
  assert.equal((await api('/api/dashboard', { method: 'PUT', headers: { ...headers, 'If-Match': after.revision }, body: JSON.stringify(invalid) })).status, 400);
  invalid.links[0].url = state.links[1].url + '#duplicate';
  assert.equal((await api('/api/dashboard', { method: 'PUT', headers: { ...headers, 'If-Match': after.revision }, body: JSON.stringify(invalid) })).status, 400);
  await api('/api/logout', { method: 'POST', headers, body: '{}' }); assert.equal((await api('/api/dashboard', { headers })).status, 401);
  await assert.rejects(start({ port: 0, data: dir }), /writer lock/);
});
test('journal ordering, symlink boundary, missing and stale metrics', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lifeos-files-')); t.after(() => rm(dir, { recursive: true, force: true }));
  assert.deepEqual(await readMetrics(dir), []);
  await writeFile(join(dir, 'metrics.json'), JSON.stringify([{ label: 'Cloud', value: '£0', note: 'Verified reading', source: 'Fixture', checkedAt: '2020-01-01T00:00:00Z', maxAgeMinutes: 60 }]));
  assert.equal((await readMetrics(dir))[0].stale, true);
  await mkdir(join(dir, 'journal')); await writeFile(join(dir, 'journal', '2026-01-04 - First.md'), 'First'); await writeFile(join(dir, 'journal', '2026-01-11 - Second.md'), '---\nsensitivity: private\n---\nSecond');
  await symlink(join(dir, 'metrics.json'), join(dir, 'journal', '2026-01-18 - Outside.md'));
  const entries = await readJournal(join(dir, 'journal')); assert.deepEqual(entries.map(x => x.title), ['Second', 'First']); assert.equal(entries[0].body, 'Second');
});
test('fresh installs work without integrations; imports discard unknown fields', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'lifeos-import-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createStore(dir), old = await store.read(), next = demoState(); next.password = 'must-not-persist'; next.links[0].token = 'must-not-persist';
  const saved = await store.save(next, digest(old)); assert.equal(saved.password, undefined); assert.equal(saved.links[0].token, undefined);
  const restarted = createStore(dir); assert.deepEqual(await restarted.read(), saved);
});
test('network bind requires password and demo never writes', async t => {
  await assert.rejects(start({ host: '0.0.0.0', port: 0 }), /LIFEOS_PASSWORD/);
  const dir = await mkdtemp(join(tmpdir(), 'lifeos-demo-')); const app = await start({ port: 0, data: dir, demo: true }); t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const d = await (await fetch(app.origin + '/api/dashboard')).json(); assert.equal(d.demo, true); assert.equal(d.metrics[0].source, 'Example data');
  assert.equal((await fetch(app.origin + '/api/dashboard', { method: 'PUT', headers: { Origin: app.origin, 'Content-Type': 'application/json', 'If-Match': d.revision }, body: JSON.stringify(d.state) })).status, 403);
  assert.deepEqual(await readdir(dir), []);
});
