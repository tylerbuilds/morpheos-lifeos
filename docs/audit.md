# Adversarial review for version 0.2

The 12 October 2026 review exercised authentication, persistence, browser recovery and installation assumptions. Tests use temporary data, synthetic credentials and loopback servers. They do not send requests to personal integrations or modify an operator's files.

## Fixes with permanent regression tests

| Area | Before | Guard now |
| --- | --- | --- |
| Restart and ownership | A failed start or crash could strand a JSON lock | Operating-system-managed SQLite lock, crash/restart and competing-writer tests |
| Login | Parallel requests could pass the same attempt check; hashing blocked requests | Reserved attempt slots, asynchronous bounded hashing and bounded session storage |
| Remote installation | A loopback bind with a configured public origin could run without a password | Remote origins require a strong password; wrong Host/Origin stays rejected |
| Saved data | Symlinks, oversized files and invalid UTF-8 could be read | Bounded descriptor-based reads and explicit structural validation |
| Failed saves | Temporary files could remain after a disk/rename failure | Cleanup with the previous configuration preserved |
| Private error handling | A JSON parser error could include saved file content | Generic API error; corrupt data retained for recovery |
| State and links | Type coercion and invisible characters made identifiers ambiguous | Strict types, own-property route lookups and control-character rejection |
| Journal and feeds | Ambiguous timestamps, impossible dates and an unbounded directory scan | Zoned observations, valid dates and bounded streaming reads |
| Session expiry | Navigation could redisplay cached private links after a 401 | Clear cached state and close the editor before showing sign-in |
| Conflicting edits | A stale editor could only fail again | Explicit, confirmed reload of the latest saved links |
| Browser controls | Logout failure escaped its handler; skip navigation changed the page | Visible error handling and a focus-only skip link |

The suite covers malformed inputs, races, boundaries, resource exhaustion, corrupted state, type confusion, injection and invalid assumptions. SQL for the writer lock is a fixed literal and no shell command is assembled from input.

## Run the same checks

```sh
npm ci --include=dev
npm run check
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
```

There are 26 server/store/onboarding tests and four browser journeys run in each browser engine. The onboarding test uses the Render environment contract, requires authentication, saves a first link, restarts, and restores a copy in a separate data directory. CI also builds the Docker image. The Render blueprint was checked against the provider's published JSON schema.

## What these checks do not prove

This review is a bounded engineering audit, not a security certification or a promise that no defects remain. No paid Render instance was provisioned for testing. Physical iPhone handoffs, a particular reverse proxy, DNS, custom domains, third-party destinations and account connectors need verification in the installation where they are used.

Use one process on a private local filesystem. A hostile process running as the same operating-system user can still access that user's files. Network filesystems and multi-tenant deployments are unsupported. Node 24 currently labels its built-in SQLite API experimental; no external runtime package is required. Backups of actual edits are retained and need an operator-managed storage policy.

[Security model](../SECURITY.md) · [Recovery and upgrades](self-hosting.md#backup-and-upgrades) · [Deployment limits](one-click.md)
