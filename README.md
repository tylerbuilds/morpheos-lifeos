# Morpheos LifeOS

**Your apps, useful numbers and weekly journal, together on your phone.**

LifeOS is a small, self-hosted dashboard designed for Safari and the iPhone Home Screen. Make it yours without needing an AI subscription, a separate database service or provider API keys.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tylerbuilds/morpheos-lifeos)

**Start here:** use the button for a hosted installation, [give your coding agent the setup prompt](docs/agent-setup.md), or [run it on your computer](#run-it-on-your-computer).

The hosted route needs a Render account and **paid compute plus a persistent disk**. Review the price before approving deployment. It creates a password-protected HTTPS app with storage that survives restarts. See [the three-step hosted setup](docs/one-click.md).

![LifeOS on a phone, using fictional demo data](docs/phone.png)

## Choose where it lives

| Route | What you need | What you get |
| --- | --- | --- |
| [One-click hosted setup](docs/one-click.md) | A Render account and approval of its charges | An always-on HTTPS address, generated password and persistent storage |
| [Agent-assisted setup](docs/agent-setup.md) | A coding agent with access to your computer or server | A checked installation suited to your existing machine and network |
| [Local quick start](#run-it-on-your-computer) | Git and Node.js 24.14 or newer in the 24.x line | A working dashboard on your computer; no hosting account |
| [Docker or Node with HTTPS](docs/self-hosting.md) | An existing server and HTTPS route | A persistent installation you operate yourself |

The deploy button opens the provider's review screen; it does not purchase hosting without your approval. LifeOS is open-source and has no licence fee. Your hosting provider can charge for its services.

## Run it on your computer

Install [Node.js 24 LTS](https://nodejs.org/en/download), then run:

```sh
git clone https://github.com/tylerbuilds/morpheos-lifeos.git
cd morpheos-lifeos
node server.mjs
```

Open **http://127.0.0.1:3000**. Choose a name, then use **Apps → Organise** to add your links. Stop it with **Ctrl+C**. Starting it again keeps your saved settings.

No `npm install` is needed to run the app. It initially listens only on your own computer. For phone access, follow [the HTTPS setup](docs/self-hosting.md) or use the hosted button.

For a read-only tour with fictional data, run this instead:

```sh
node --env-file=.env.demo server.mjs
```

Demo mode never reads your saved dashboard and disables changes.

## What belongs here

- **Home:** favourite apps and optional information cards with a source and freshness time.
- **Apps:** searchable links across Life, Media, Games, Work & websites, Publishing, Projects in progress and Other.
- **Organise:** add, rename, reorder, move, favourite or hide a destination. Each link has one home.
- **Journal:** dated Markdown entries, newest first, including an existing Obsidian folder.
- **Guide:** searchable help and suggested chat topics for working with your own agent.
- **More:** settings, private export/import and recovery guidance.

Changes are saved on the server and shared across your devices. Conflicting edits are rejected rather than silently overwriting another device. Light, dark and system themes, large touch targets and safe-area spacing make it comfortable on a phone.

This is a **single-user starter**. Account-specific billing connectors, pantry and wardrobe databases, media servers, AI gateways and diary-writing schedules are not bundled. Link to services you already use, and add summaries through [the optional data adapter format](docs/adapters.md). Missing readings stay missing; they are never presented as zero.

## Put it on your iPhone

1. Open your installation's **HTTPS address** in Safari and sign in.
2. Tap **Share → Add to Home Screen**.
3. Open the new icon, add one favourite and try it.

After opening another service, use Safari Back, the browser sheet's Done control when available, or the app switcher after a native-app handoff. LifeOS does not control another app's navigation. Test your own usual links on your phone; automated browser tests do not prove every physical-device handoff.

## Keep your data yours

Your links and preferences live in `data/dashboard.json`; per-edit recovery copies live in `data/backups/`. An exclusive, crash-released lock permits one server per data directory. Your journal is read-only to LifeOS. Keep data on a local filesystem or Docker volume, not a shared network filesystem.

Use **More → Export settings** and make a separate backup of your data and journal. Exports can contain private addresses. Keep credentials out of exports and Git. [Back up and restore](docs/self-hosting.md#backup-and-upgrades) before upgrading. Hosted installations use `/var/data/lifeos` and must retain their persistent disk.

Passwords are required for remote access, with 24-hour sessions. There are no trackers, analytics or external fonts. Read [security and its limits](SECURITY.md).

## Make your own version

[Use this GitHub template](https://github.com/new?template_name=morpheos-lifeos&template_owner=tylerbuilds) to create an independent repository. Choose a **private repository** if you plan to keep private configuration alongside your customisations. Runtime data and secrets should stay outside Git regardless of repository visibility.

```sh
npm ci --include=dev
npm run check
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
```

The app uses Node built-ins and browser APIs; Playwright is development-only. CI checks adversarial server cases, persistence, authentication and phone flows in Chromium and WebKit. [The audit scope and remaining limits](docs/audit.md) distinguish tested behaviour from deployment-specific checks.

[Agent setup prompt](docs/agent-setup.md) · [Self-hosting](docs/self-hosting.md) · [Contributing](CONTRIBUTING.md) · [Architecture and provenance](docs/architecture.md) · [MIT licence](LICENSE)
