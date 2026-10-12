import http from 'node:http';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createStore, demoState, digest, readMetrics, readJournal, sections } from './lib/store.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
export async function start(options = {}) {
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  const port = options.port ?? Number(process.env.PORT || 3000);
  const password = options.password ?? process.env.LIFEOS_PASSWORD ?? '';
  const demo = options.demo ?? process.env.LIFEOS_DEMO === '1';
  const data = resolve(options.data ?? process.env.LIFEOS_DATA_DIR ?? './data');
  const configuredOrigin = options.origin ?? process.env.LIFEOS_ORIGIN;
  if (!demo && !['127.0.0.1', '::1', 'localhost'].includes(host) && password.length < 12) throw new Error('Set LIFEOS_PASSWORD (12+ characters) before allowing network access.');
  if (password && password.length < 12) throw new Error('Use a password with at least 12 characters.');
  if (configuredOrigin && (new URL(configuredOrigin).origin !== configuredOrigin || !configuredOrigin.startsWith('https://'))) throw new Error('LIFEOS_ORIGIN must be an https origin without a path.');
  const salt = randomBytes(16), passwordHash = scryptSync(password, salt, 32);
  const sessions = new Map(), attempts = new Map();
  const store = createStore(data);
  let lock;
  if (!demo) {
    await mkdir(data, { recursive: true, mode: 0o700 });
    try { lock = await open(join(data, '.writer.lock'), 'wx', 0o600); await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('A LifeOS writer lock exists. Stop the other server; inspect data/.writer.lock before recovery.'); throw error; }
  }
  const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon.svg': ['icon.svg', 'image/svg+xml'], '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'] };
  let origin;
  const server = http.createServer(async (req, res) => {
    const json = (status, value, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'");
    try {
      if (req.headers.host !== new URL(origin).host) return json(421, { error: 'Unrecognised host.' });
      const path = new URL(req.url, origin).pathname;
      if (['POST', 'PUT', 'DELETE'].includes(req.method) && (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json'))) return json(403, { error: 'Open LifeOS at its configured address and try again.' });
      const body = async () => {
        let bytes = 0, chunks = [];
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 100_000) throw Object.assign(new Error('Request is too large.'), { status: 413 }); chunks.push(chunk); }
        try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('Invalid JSON.'); }
      };
      if (path === '/api/login' && req.method === 'POST') {
        const key = req.socket.remoteAddress, recent = attempts.get(key) || { count: 0, since: Date.now() };
        if (Date.now() - recent.since > 300_000) { recent.count = 0; recent.since = Date.now(); }
        if (recent.count >= 10) return json(429, { error: 'Too many attempts. Try again in five minutes.' });
        const input = await body();
        if (typeof input.password !== 'string' || input.password.length > 512 || !timingSafeEqual(scryptSync(input.password, salt, 32), passwordHash)) { recent.count++; attempts.set(key, recent); return json(401, { error: 'That password did not match.' }); }
        attempts.delete(key);
        for (const [token, expiry] of sessions) if (expiry < Date.now()) sessions.delete(token);
        if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
        const token = randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 86400_000);
        return json(200, { ok: true }, { 'Set-Cookie': `lifeos=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${origin.startsWith('https:') ? '; Secure' : ''}` });
      }
      if (path.startsWith('/api/')) {
        const token = req.headers.cookie?.match(/(?:^|;\s*)lifeos=([a-f0-9]{64})(?:;|$)/)?.[1];
        if (!demo && password && (!token || (sessions.get(token) || 0) <= Date.now())) return json(401, { error: 'Sign in to your LifeOS.' });
        if (path === '/api/logout' && req.method === 'POST') { sessions.delete(token); return json(200, { ok: true }, { 'Set-Cookie': 'lifeos=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
        if (path === '/api/dashboard' && req.method === 'GET') {
          const state = demo ? demoState() : await store.read();
          let metrics = [], journal = [], notices = [];
          if (demo) {
            metrics = [{ label: 'AI allowance', value: '72% left', source: 'Example data', checkedAt: new Date().toISOString(), stale: false, note: 'Your own adapter can go here' }, { label: 'Cloud costs', value: '£0.00', source: 'Example data', checkedAt: new Date().toISOString(), stale: false, note: 'A sample, not a live bill' }];
            journal = [{ date: '2026-01-11', title: 'A little more breathing room', body: 'This is a fictional weekly entry.\n\nThe useful things finally have a home: a few favourite links, a place for ideas, and a clear view of what needs attention.' }];
          } else {
            try { metrics = await readMetrics(data); } catch { notices.push('Your metrics file needs attention. No amounts have been assumed.'); }
            try { journal = await readJournal(options.journal ?? process.env.LIFEOS_JOURNAL_DIR ?? join(data, 'journal')); } catch { notices.push('The journal folder could not be read.'); }
          }
          return json(200, { state, revision: digest(state), sections, metrics, journal, notices, demo, passwordEnabled: !!password });
        }
        if (path === '/api/dashboard' && req.method === 'PUT') {
          if (demo) return json(403, { error: 'The shared demo is read-only. Run your own copy to save changes.' });
          if (!req.headers['if-match']) return json(428, { error: 'Reload before saving.' });
          const state = await store.save(await body(), req.headers['if-match']); return json(200, { state, revision: digest(state) });
        }
        return json(404, { error: 'Page not found.' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Method not allowed.' });
      const asset = assets[path]; if (!asset) return json(404, { error: 'Page not found.' });
      const content = await readFile(join(here, 'public', asset[0])); res.writeHead(200, { 'Content-Type': asset[1] }); res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { json(error.status || 400, { error: error.status === 409 || !error.code ? error.message : 'The saved files could not be accessed.' }); }
  });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  origin = configuredOrigin ?? `http://${host === '::1' ? '[::1]' : host}:${server.address().port}`;
  const close = async () => { await new Promise(resolve => server.close(resolve)); if (lock) { await lock.close(); await unlink(join(data, '.writer.lock')); lock = null; } };
  return { server, origin, close };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await start(); console.log(`LifeOS listening at ${app.origin}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit(0)));
}
