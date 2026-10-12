import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { start } from '../server.mjs';

function request(app, method, path, data, cookie) {
  return new Promise((resolve, reject) => {
    const payload = data === undefined ? undefined : JSON.stringify(data);
    const req = http.request({ hostname: '127.0.0.1', port: app.server.address().port, method, path, headers: { Host: new URL(app.origin).host, Origin: app.origin, ...(cookie ? { Cookie: cookie } : {}), ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) } }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: body ? JSON.parse(body) : null }));
    });
    req.on('error', reject); req.end(payload);
  });
}

test('hosted setup protects data, saves first-run settings, survives restart and restores a backup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lifeos-onboarding-')); const data = join(root, 'persistent');
  const saved = Object.fromEntries(['RENDER', 'RENDER_EXTERNAL_URL', 'LIFEOS_ORIGIN'].map(k => [k, process.env[k]]));
  let app;
  try {
    process.env.RENDER = 'true'; process.env.RENDER_EXTERNAL_URL = 'https://lifeos-test.onrender.com'; delete process.env.LIFEOS_ORIGIN;
    const options = { host: '127.0.0.1', port: 0, data, password: 'test-only-long-password' };
    app = await start(options); assert.equal(app.origin, process.env.RENDER_EXTERNAL_URL);
    assert.equal((await request(app, 'GET', '/healthz')).status, 200);
    assert.equal((await request(app, 'GET', '/api/dashboard')).status, 401);
    let login = await request(app, 'POST', '/api/login', { password: options.password }); assert.equal(login.status, 200);
    assert.match(login.headers['set-cookie'][0], /Secure/); let cookie = login.headers['set-cookie'][0].split(';')[0];
    let loaded = await request(app, 'GET', '/api/dashboard', undefined, cookie); assert.equal(loaded.status, 200);
    const state = { ...loaded.body.state, onboarded: true, name: 'My hosted life', links: [{ id: 'library', label: 'Library', url: 'https://example.com/library', detail: '', section: 'Media', favourite: true, hidden: false }] };
    const result = await new Promise((resolve, reject) => {
      const payload = JSON.stringify(state);const req = http.request({ hostname: '127.0.0.1', port: app.server.address().port, path: '/api/dashboard', method: 'PUT', headers: { Host: new URL(app.origin).host, Origin: app.origin, Cookie: cookie, 'Content-Type': 'application/json', 'If-Match': loaded.body.revision } },res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end(payload);
    });assert.equal(result, 200);
    await app.close();app = await start(options);
    assert.equal((await request(app, 'GET', '/api/dashboard', undefined, cookie)).status, 401);
    login = await request(app, 'POST', '/api/login', { password: options.password });cookie = login.headers['set-cookie'][0].split(';')[0];
    loaded = await request(app, 'GET', '/api/dashboard', undefined, cookie);assert.equal(loaded.body.state.links[0].label, 'Library');
    await app.close();app = null;
    const backup = await readFile(join(data, 'dashboard.json')); const restore = join(root, 'restore');
    const fs = await import('node:fs/promises'); await fs.mkdir(restore); await writeFile(join(restore, 'dashboard.json'), backup);
    app = await start({ ...options, data: restore });login = await request(app, 'POST', '/api/login', { password: options.password });cookie = login.headers['set-cookie'][0].split(';')[0];
    loaded = await request(app, 'GET', '/api/dashboard', undefined, cookie);assert.deepEqual(loaded.body.state, state);
  } finally {
    await app?.close(); await rm(root, { recursive: true, force: true });
    for (const [k,v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});
