import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../server.mjs';
const dir = await mkdtemp(join(tmpdir(), 'lifeos-browser-'));
const app = await start({ port: 3099, data: dir });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); await rm(dir, { recursive: true, force: true }); process.exit(0); });
