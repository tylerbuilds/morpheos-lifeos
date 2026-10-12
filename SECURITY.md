# Security

This is a personal, single-user dashboard. Use HTTPS and a strong password for remote access. It is not designed for mutually untrusted users. Loopback access without a password is a convenience for local setup only. The shared demo contains only synthetic data and disables writes.

Passwords come from the process environment. They are compared through scrypt; they are not persisted by the app. Sessions use random, HttpOnly, SameSite cookies and expire after 24 hours. Secure cookies are used with an HTTPS origin. At most ten login attempts per client address are admitted in five minutes; concurrent requests reserve their slots before authentication. Password hashing and in-memory session storage are bounded. Behind a proxy this limit applies to the proxy address.

The app rejects unexpected hosts and cross-origin writes, validates link schemes, rejects URL credentials, escapes user content and applies a restrictive content security policy. Data files remain private to the service account. There is no telemetry or analytics.

Report a suspected vulnerability using GitHub's private vulnerability reporting for this repository if available. Otherwise contact the maintainer through a private channel. Do not open public issues containing private URLs, passwords, logs or account data.

The `/healthz` endpoint reveals only a minimal status and is available to platform probes. All private routes still validate Host and session. The [versioned audit report](docs/audit.md) documents coverage and remaining limits.
