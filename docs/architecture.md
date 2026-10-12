# Architecture and provenance

Morpheos LifeOS 0.2 is an independently authored, minimal implementation of a phone-first personal dashboard. The layout direction comes from the owner's private Brain dashboard. No private repository history, personal records, credentials, native configuration or third-party application code was copied into this repository.

The server uses Node's HTTP, filesystem, crypto and built-in SQLite APIs. It serves an explicit static-file allowlist and an authenticated configuration API. The browser uses plain HTML, CSS and JavaScript. There is no build pipeline or runtime package dependency. The SVG icon and visual styles were authored for this project. System fonts are used; no stock imagery or proprietary UI assets are included.

Playwright and its browser downloads are development tools under their upstream licences; they are not vendored into the application. Docker uses the official Node image, whose component licences still apply. Links to independent projects are navigation examples, not bundled integrations or endorsements.

Configuration writes are validated, serialised within the single process, revision-checked and atomically renamed. An exclusive SQLite transaction holds an operating-system lock for the process lifetime, enforcing one writer per local data directory and releasing ownership after a crash. Dashboard data itself remains JSON; no separate database service is required. Read-only metrics and journal files can be maintained by external tools. Keep those writers responsible for their own atomic writes and scheduling.

Release target: public source starter, version 0.2.0. The repository is backed up by Git; user installations need their own data backups. No personal runtime is provisioned by cloning this repository. CI proves the source and browser behaviour, not an individual user's network, accounts or physical iPhone.
