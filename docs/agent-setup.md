# Give your agent this setup prompt

Paste the block below into a coding agent that can use a terminal on the computer or server where LifeOS should run. It works with agents that can clone a Git repository, inspect files and run commands. You do not need an AI account after setup.

If you prefer a hosted installation, use [Deploy to Render](one-click.md). An agent cannot bypass a provider's account, payment or domain-ownership steps.

```text
Set up Morpheos LifeOS for me from https://github.com/tylerbuilds/morpheos-lifeos.
Complete the installation and verify it, rather than giving me a plan.

First read the repository README, SECURITY.md, docs/self-hosting.md and this
setup guide. Inspect my operating system, available Node/Docker versions,
free disk space, occupied ports and any existing LifeOS installation.
Preserve existing data and unrelated work. Use the current stable release,
record its commit, and inspect what you will run; don't pipe a remote script
straight into a shell.

If I have already named a server, domain or installation directory, use it.
Otherwise start on this computer at http://127.0.0.1:3000, choosing an unused
loopback port if necessary. Ask only for missing information that prevents
phone access or an always-on installation. A localhost page is not phone
access. Do not silently buy hosting, register a domain, change DNS/firewall
rules, install a privileged service or expose an unauthenticated instance.

Use Node 24.14 or newer in the 24.x line, or the supplied Docker setup.
For an existing server, prefer its established service manager and HTTPS
proxy. Run as an unprivileged user. Keep one application process and one
persistent local data directory. Never use ephemeral hosting storage for
my dashboard and never run two writers against the same directory.

For remote access, require a unique strong LIFEOS_PASSWORD and an exact
HTTPS LIFEOS_ORIGIN. Use the host's private secret-entry mechanism or ask
me to enter it locally. Never print, commit or ask me to paste passwords
into chat. For Render, use the provided blueprint with its persistent disk,
generated password and native external URL; show the provider's charges
before asking me to approve deployment. Keep automatic upstream deploys off.

Keep .env and saved data out of Git. Use the app's Organise controls or its
validated import format for links. Add only destinations I provide or ask
you to find. Do not import credentials, invent billing values, scrape my
accounts, install an agent gateway or create diary schedules. Optional
metrics and journal integrations must use the documented read-only formats
and the existing source's permissions and scheduler.

Verify the result with real requests and browser interactions:
- Unauthenticated remote requests cannot read or change the dashboard.
- I can sign in, complete setup, add a link, move it and save it.
- Reloading and restarting the service preserve that link.
- Home, Apps, Life, Guide and More work at a phone-sized viewport.
- Sign out works; cross-origin writes are rejected.
- Export a recovery copy, and prove a restore in a separate temporary
  instance before replacing anything. Keep recovery data private.
Run the repository checks and tests when development dependencies are
available. Report any check you could not perform; do not call a build
or screenshot proof of a real iPhone journey.

Finally give me the working URL, where data is stored, how the service
starts/stops/updates, how to restore a backup, and any remaining owner action.
Tell me to open the HTTPS URL in Safari and use Share → Add to Home Screen.
Have me try one favourite and return to LifeOS using Back, Done or the app
switcher. Do not claim one-click completion if a required step is unfinished.
```

## What you should receive

A useful handover contains your URL, the installed commit, the data directory, the service name, restart and backup instructions, the checks that passed and any remaining action. It should never contain your password or provider tokens.

The agent can prepare account-specific adapters later. LifeOS itself does not require Codex, OpenClaw, Telegram, Google Drive or any particular AI provider.
