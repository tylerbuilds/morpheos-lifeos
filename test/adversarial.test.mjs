import test from 'node:test';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, readdir, symlink, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../server.mjs';
import { blankState, demoState, createStore, digest, validateState, safeUrl, readJournal, readMetrics } from '../lib/store.mjs';

async function directory(t) { const path = await mkdtemp(join(tmpdir(), 'lifeos-adversarial-')); t.after(() => rm(path, { recursive: true, force: true })); return path; }
async function appFor(t, options = {}) {
  const data = options.data ?? await directory(t);
  const app = await start({ port: 0, data, ...options });
  t.after(() => app.close());
  const headers = { Origin: app.origin, 'Content-Type': 'application/json' };
  return { ...app, data, headers, api: (path, options) => fetch(app.origin + path, options) };
}

// Malformed inputs and type confusion: no coerced IDs, arrays, nulls or ambiguous URLs.
test('state schema rejects non-record links, non-string IDs and invisible control characters', () => {
  for (const link of [null, [], 2, 'link', { ...demoState().links[0], id: 42 }, { ...demoState().links[0], id: true }]) {
    const state = demoState(); state.links = [link]; assert.throws(() => validateState(state));
  }
  for (const url of ['https://exam\tple.com/', 'https://example.com/\u0000x', 'https://user:secret@example.com/', 'javascript:alert(1)', '//example.com/']) assert.throws(() => safeUrl(url));
  const state = blankState(); state.name = 'trusted\u202Eevil'; assert.throws(() => validateState(state));
});

test('schema honours exact collection and text boundaries; unknown fields cannot survive', () => {
  const state = blankState(); state.name = 'x'.repeat(60);
  state.links = Array.from({ length: 100 }, (_, i) => ({ id: String(i), label: 'x'.repeat(80), detail: '', url: `https://example.com/${i}`, section: 'Other', favourite: false, hidden: false }));
  assert.equal(validateState(state).links.length, 100);
  assert.throws(() => validateState({ ...state, name: 'x'.repeat(61) }));
  assert.throws(() => validateState({ ...state, links: [...state.links, state.links[0]] }));
  assert.throws(() => validateState({ ...state, timezone: 'Definitely/Unknown' }));
  assert.equal(validateState({ ...state, password: 'fake-secret' }).password, undefined);
  assert.throws(() => validateState(JSON.parse('{"version":1,"__proto__":{"polluted":true}}')));
  assert.equal({}.polluted, undefined);
});

// Injection: use structured data only; stored HTML is inert text in the browser suite.
test('traversal-shaped IDs and duplicate normalised addresses are refused', () => {
  const state = demoState(); state.links[0].id = '../outside'; assert.throws(() => validateState(state));
  state.links[0].id = 'safe'; state.links[0].url = state.links[1].url + '#other'; assert.throws(() => validateState(state));
  const literal = demoState(); literal.links[0].detail = '$(touch /tmp/no) <script>alert(1)</script>';
  assert.equal(validateState(literal).links[0].detail, literal.links[0].detail);
});

test('stored state refuses symlinks, oversized files and malformed JSON without overwriting', async t => {
  const data = await directory(t), outside = await directory(t), source = join(outside, 'private.json');
  await writeFile(source, JSON.stringify(demoState()));
  await symlink(source, join(data, 'dashboard.json'));
  await assert.rejects(createStore(data).read());
  await assert.rejects(createStore(data).save(blankState(), digest(blankState())));
  assert.deepEqual(JSON.parse(await readFile(source)), demoState());
  await rm(join(data, 'dashboard.json'));
  for (const content of ['{"private":"fake-private-content",', 'x'.repeat(100_001)]) {
    await writeFile(join(data, 'dashboard.json'), content);
    await assert.rejects(createStore(data).read());
    assert.equal(await readFile(join(data, 'dashboard.json'), 'utf8'), content);
  }
});

test('backup symlinks and failed temporary commits leave saved state unchanged and queue usable', async t => {
  const data = await directory(t), outside = await directory(t), store = createStore(data), before = await store.read();
  await symlink(outside, join(data, 'backups'));
  await assert.rejects(store.save(demoState(), digest(before)));
  assert.deepEqual(await readdir(outside), []); assert.deepEqual(await store.read(), before);
  await rm(join(data, 'backups')); await store.save(demoState(), digest(before));
  assert.deepEqual(await store.read(), demoState());
});

// Race and state corruption: one winning revision, and invalid disk data is never auto-reset.
test('many competing saves produce one complete state and no partial reads', async t => {
  const data = await directory(t), store = createStore(data), revision = digest(await store.read());
  const results = await Promise.allSettled(Array.from({ length: 32 }, (_, i) => store.save({ ...demoState(), name: `Attempt ${i}` }, revision)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.status === 409));
  assert.match((await store.read()).name, /^Attempt /);
  await writeFile(join(data, 'dashboard.json'), 'broken');
  await assert.rejects(store.save(demoState(), digest(blankState())));
  assert.equal(await readFile(join(data, 'dashboard.json'), 'utf8'), 'broken');
});

test('metrics reject non-string timestamps and journal ignores impossible dates and special files', async t => {
  const data = await directory(t), metric = { label: 'Cloud', value: '£0', note: '', source: 'Fixture', checkedAt: '2026-01-01T00:00:00Z' };
  for (const checkedAt of [5, null, {}, '2026-01-01', '2099-01-01T00:00:00Z']) {
    await writeFile(join(data, 'metrics.json'), JSON.stringify([{ ...metric, checkedAt }]));
    await assert.rejects(readMetrics(data));
  }
  for (const name of ['2026-02-30 - Impossible.md', '2026-01-01 - Valid.md']) await writeFile(join(data, name), 'Fixture');
  await mkdir(join(data, '2026-01-03 - Directory.md'));
  assert.deepEqual((await readJournal(data)).map(entry => entry.title), ['Valid']);
});

test('corrupt state API response does not echo private file content', async t => {
  const app = await appFor(t);
  await writeFile(join(app.data, 'dashboard.json'), '{"private":"fake-private-content",');
  const response = await app.api('/api/dashboard'); assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /fake-private-content/);
});

test('API treats malformed JSON, null login and oversized bodies as bounded errors', async t => {
  const app = await appFor(t, { password: 'test-password-1234' });
  for (const body of ['{', 'null', '[]', '{"password":{}}', '['.repeat(150) + ']'.repeat(150)]) {
    const response = await app.api('/api/login', { method: 'POST', headers: app.headers, body });
    assert.ok([400, 401].includes(response.status)); assert.ok((await response.text()).length < 300);
  }
  const huge = await app.api('/api/login', { method: 'POST', headers: app.headers, body: 'x'.repeat(100_001) });
  assert.equal(huge.status, 413);
  const wrongType = await app.api('/api/login', { method: 'POST', headers: { ...app.headers, 'Content-Type': 'application/json-invalid' }, body: '{}' });
  assert.equal(wrongType.status, 403);
  assert.equal((await app.api('/')).status, 200);
});

test('parallel login attempts cannot bypass the limit while the server remains responsive', async t => {
  const app = await appFor(t, { password: 'test-password-1234' });
  const responses = await Promise.all(Array.from({ length: 24 }, () => app.api('/api/login', { method: 'POST', headers: app.headers, body: '{"password":"wrong"}' })));
  assert.ok(responses.filter(response => response.status === 401).length <= 10);
  assert.ok(responses.filter(response => response.status === 429).length >= 14);
  assert.ok(responses.every(response => [401, 429, 503].includes(response.status)));
  assert.equal((await app.api('/')).status, 200);
});

test('network exposure through a configured HTTPS proxy requires a password', async t => {
  const data = await directory(t);
  await assert.rejects(start({ port: 0, data, origin: 'https://lifeos.example' }).then(async app => { await app.close(); return app; }), /password|LIFEOS_PASSWORD/i);
});

test('static prototype names and encoded traversal never resolve local files', async t => {
  const app = await appFor(t);
  for (const path of ['/constructor', '/__proto__', '/toString', '/%2e%2e%2fserver.mjs', '/data/dashboard.json']) assert.equal((await app.api(path)).status, 404);
});

test('failed listen releases writer ownership so the same data folder can restart', async t => {
  const first = await appFor(t), data = await directory(t);
  await assert.rejects(start({ port: first.server.address().port, data }), /EADDRINUSE/);
  const retry = await start({ port: 0, data }); await retry.close(); await retry.close();
});

test('exclusive writer lock survives contention and automatically releases after process death', async t => {
  const data = await directory(t);
  const script = `import {start} from ${JSON.stringify(new URL('../server.mjs', import.meta.url).href)}; await start({port:0,data:${JSON.stringify(data)}}); console.log('READY');`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  await new Promise((resolve, reject) => { child.stdout.on('data', chunk => { if (String(chunk).includes('READY')) resolve(); }); child.once('exit', code => reject(new Error(`child startup exited ${code}`))); });
  await assert.rejects(start({ port: 0, data }), /writer lock/i);
  child.kill('SIGKILL'); await once(child, 'exit');
  const recovered = await start({ port: 0, data }); await recovered.close();
});

test('simulated disk-full and rename errors preserve prior state and remove incomplete files', async t => {
  const data = await directory(t), store = createStore(data);
  const initial = await store.save(demoState(), digest(blankState()));
  const filesBefore = await readdir(data), backupsBefore = await readdir(join(data, 'backups'));
  const originalOpen = fsPromises.open;
  for (const failure of ['write', 'rename']) {
    if (failure === 'write') {
      t.mock.method(fsPromises, 'open', async function(path, ...args) {
        const handle = await originalOpen(path, ...args);
        if (String(path).endsWith('.tmp')) t.mock.method(handle, 'writeFile', async function() {
          await handle.write('partial'); throw Object.assign(new Error('simulated full disk'), { code: 'ENOSPC' });
        });
        return handle;
      });
    } else t.mock.method(fsPromises, 'rename', async () => { throw Object.assign(new Error('simulated rename failure'), { code: 'EACCES' }); });
    syncBuiltinESMExports();
    try { await assert.rejects(store.save({ ...initial, name: 'Should not save' }, digest(initial)), /simulated/); }
    finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
    assert.deepEqual(await store.read(), initial);
    assert.deepEqual(await readdir(data), filesBefore);
    assert.deepEqual(await readdir(join(data, 'backups')), backupsBefore);
  }
  assert.equal((await store.save({ ...initial, name: 'Recovered' }, digest(initial))).name, 'Recovered');
});

test('journal caps retained entries and stops scanning an unbounded directory', async t => {
  const data = await directory(t);
  for (let i = 0; i < 110; i++) {
    const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
    await writeFile(join(data, `${date} - Entry.md`), 'Fixture');
  }
  const entries = await readJournal(data); assert.equal(entries.length, 104); assert.equal(entries.at(-1).date, '2025-01-07');
  let scanned = 0, closed = false;
  t.mock.method(fsPromises, 'opendir', async () => ({ async *[Symbol.asyncIterator]() {
    try { while (scanned < 100_000) { scanned++; yield { name: `irrelevant-${scanned}`, isFile: () => true }; } }
    finally { closed = true; }
  } })); syncBuiltinESMExports();
  try { await assert.rejects(readJournal(data), /too large/); }
  finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  assert.ok(scanned < 100_000); assert.equal(closed, true);
});

test('Render native origin is validated, requires auth and issues Secure cookies', async t => {
  const original = Object.fromEntries(['RENDER', 'RENDER_EXTERNAL_URL', 'LIFEOS_ORIGIN'].map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(original)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  process.env.RENDER = 'true'; process.env.RENDER_EXTERNAL_URL = 'https://fixture.onrender.com'; delete process.env.LIFEOS_ORIGIN;
  const data = await directory(t);
  await assert.rejects(start({ port: 0, data }), /LIFEOS_PASSWORD/);
  const app = await start({ port: 0, data, password: 'test-password-1234' }); t.after(() => app.close());
  assert.equal(app.origin, 'https://fixture.onrender.com');
  const local = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await fetch(local + '/', { headers: { Host: 'attacker.invalid' } })).status, 421);
  const signed = await new Promise((resolve, reject) => {
    const req = request(local + '/api/login', { method: 'POST', headers: { Host: 'fixture.onrender.com', Origin: app.origin, 'Content-Type': 'application/json' } }, res => {
      res.resume(); res.once('end', () => resolve({ status: res.statusCode, cookie: res.headers['set-cookie']?.[0] }));
    }); req.once('error', reject); req.end('{"password":"test-password-1234"}');
  });
  assert.equal(signed.status, 200); assert.match(signed.cookie, /; Secure/);
  const probe = await fetch(local + '/healthz'); assert.equal(probe.status, 200); assert.deepEqual(await probe.json(), { status: 'ok' });
  const head = await fetch(local + '/healthz', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal((await fetch(local + '/api/dashboard')).status, 421);
  process.env.RENDER_EXTERNAL_URL = 'http://unsafe.example';
  await assert.rejects(start({ port: 0, data: await directory(t), password: 'test-password-1234' }), /https origin/);
  process.env.RENDER = 'false';
  const ignored = await start({ port: 0, data: await directory(t) }); assert.match(ignored.origin, /^http:\/\/127\.0\.0\.1:/); await ignored.close();
});

test('chunked oversized JSON returns 413 without resetting the client connection', async t => {
  const app = await appFor(t);
  const result = await new Promise((resolve, reject) => {
    const req = request(app.origin + '/api/login', { method: 'POST', headers: app.headers }, res => {
      let body = ''; res.on('data', data => body += data); res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject); req.write('x'.repeat(60_000)); req.end('x'.repeat(60_000));
  });
  assert.equal(result.status, 413); assert.match(result.body, /too large/);
  assert.equal((await app.api('/')).status, 200);
});

test('repeated identical saves do not consume disk space with duplicate backups', async t => {
  const data = await directory(t), store = createStore(data), state = demoState();
  const saved = await store.save(state, digest(blankState()));
  const before = await readdir(join(data, 'backups'));
  await Promise.all(Array.from({ length: 128 }, () => store.save(saved, digest(saved))));
  assert.deepEqual(await readdir(join(data, 'backups')), before);
});

test('writer lock rejects linked or corrupt databases and refuses an active legacy writer', async t => {
  const outside = await directory(t), data = await directory(t), sentinel = join(outside, 'fixture.txt');
  await writeFile(sentinel, 'fixture must remain unchanged');
  await symlink(sentinel, join(data, '.writer-lock.sqlite'));
  await assert.rejects(start({ port: 0, data }));
  assert.equal(await readFile(sentinel, 'utf8'), 'fixture must remain unchanged');
  await rm(join(data, '.writer-lock.sqlite'));
  await writeFile(join(data, '.writer-lock.sqlite'), 'not a sqlite database');
  await assert.rejects(start({ port: 0, data }), /writer lock/);
  await rm(join(data, '.writer-lock.sqlite'));
  await writeFile(join(data, '.writer.lock'), JSON.stringify({ pid: process.pid }));
  await assert.rejects(start({ port: 0, data }), /legacy.*writer lock/i);
  await writeFile(join(data, '.writer.lock'), JSON.stringify({ pid: 2_147_483_647 }));
  const app = await start({ port: 0, data }); await app.close();
  assert.equal(JSON.parse(await readFile(join(data, '.writer.lock'))).pid, 2_147_483_647);
});

test('invalid UTF-8 is treated as damaged state and metrics cannot follow a symlink', async t => {
  const data = await directory(t), outside = await directory(t);
  const state = Buffer.from(JSON.stringify(demoState())); state[state.indexOf('My LifeOS')] = 0xff;
  await writeFile(join(data, 'dashboard.json'), state); await assert.rejects(createStore(data).read());
  assert.deepEqual(await readFile(join(data, 'dashboard.json')), state);
  const source = join(outside, 'fixture.json'); await writeFile(source, '[]'); await symlink(source, join(data, 'metrics.json'));
  await assert.rejects(readMetrics(data)); assert.equal(await readFile(source, 'utf8'), '[]');
});
