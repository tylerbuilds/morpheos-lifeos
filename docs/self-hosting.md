# Self-hosting

LifeOS is a single-user application. Start with the loopback-only quick start in the README. To reach it from a phone, use a trusted HTTPS reverse proxy and set a strong application password.

## Node and Caddy

Create a private `.env` using `.env.example`. Set `LIFEOS_PASSWORD` to a unique password of at least 12 characters, and `LIFEOS_ORIGIN` to your exact HTTPS origin, for example `https://life.example.com`. Keep `HOST=127.0.0.1` when Caddy runs on the same machine. Run:

```sh
node --env-file=.env server.mjs
```

Example Caddyfile, after configuring your own DNS:

```caddyfile
life.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Use a service manager to keep Node running. Give its user access only to the app and required data directories. Do not expose port 3000 to the public internet. A VPN-only HTTPS route is also suitable. The proxy must preserve the original Host header. Only requests matching `LIFEOS_ORIGIN` are accepted; writes additionally require the same Origin.

## Docker

Set `LIFEOS_PASSWORD` and `LIFEOS_ORIGIN` in `.env`, then:

```sh
docker compose up -d --build
```

The provided compose file binds port 3000 to host loopback. Put Caddy on the host as above. The application runs as a non-root user with a named volume for data. An existing journal can be mounted read-only at `/journal` with `LIFEOS_JOURNAL_DIR=/journal`.

## Backup and upgrades

Stop the service before copying the data directory or Docker volume. Back up journal files separately if they live elsewhere. Store backups outside the server's failure domain. Per-edit copies are useful undo points, not a full disaster-recovery plan. Do not copy `.env`, passwords or provider credentials into an unencrypted general backup.

For Docker, after `docker compose stop`, an example data export is:

```sh
docker compose run --rm --no-deps --entrypoint tar lifeos -C /data --exclude=.writer.lock -czf - . > lifeos-data.tar.gz
```

Keep the previous source commit and a data backup before upgrading. Pull the reviewed version and restart, or rebuild the Docker image. Verify Home, one favourite, editing and the journal. For rollback, stop, restore the previous source and data copy, then restart. Never overwrite newer data without reviewing it.

The server removes `.writer.lock` on graceful shutdown. After a crash, verify the old process/container is stopped before removing only that stale lock. A second running writer must never be bypassed. Sessions are in memory; a restart signs devices out.

Restore into an isolated copy first. Start it on loopback with the same Node major version and a different port, inspect the saved links and notes, and test an edit before replacing your main instance.
