# Deploy a hosted LifeOS

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tylerbuilds/morpheos-lifeos)

This route creates a single password-protected web service with HTTPS and a **1 GB persistent disk**. It uses paid compute and disk storage. Review [Render's current pricing](https://render.com/pricing) and the deployment summary before approving any charge. LifeOS has no separate licence fee.

## Three steps

1. **Deploy.** Open the button, sign in to Render and review the `lifeos` service and disk. Approve the deployment if the price and region suit you. The build runs the source checks; wait for the service to become live.
2. **Sign in.** Open the service's **Environment** page and reveal the generated `LIFEOS_PASSWORD` privately. Save it in your password manager, then use it at the service's HTTPS URL. Do not put it in an issue or send it to an agent. You can replace it in Environment with your own strong password and redeploy.
3. **Make it yours.** Choose a name, add a favourite in **Apps → Organise**, then reload to check it saved. Open the same address on your iPhone in Safari and use **Share → Add to Home Screen**.

The button starts the provider's installation flow; account creation, payment approval and first sign-in still require you.

## What is configured

| Setting | Purpose |
| --- | --- |
| One Node 24 service | One writer owns your saved settings |
| Persistent disk at `/var/data` | Links, backups, journal and feeds survive a restart or redeploy |
| `LIFEOS_DATA_DIR=/var/data/lifeos` | Keeps every default data file on that disk |
| Generated `LIFEOS_PASSWORD` | No default or shared account password |
| Render's native `RENDER_EXTERNAL_URL` | Exact HTTPS origin validation without copying an address into a config file |
| `autoDeployTrigger: "off"` | Upstream commits do not silently replace your installation |
| `/healthz` | A minimal health response without private data |

See the [reviewable blueprint](../render.yaml). The service reads Render's external URL only when `RENDER=true`; it never trusts a browser-supplied forwarding header to choose an origin.

## After installation

Export your settings from **More** and keep the file privately outside Render. Journal files belong in `/var/data/lifeos/journal`; metrics belong in `/var/data/lifeos/metrics.json`. [The adapter guide](adapters.md) explains their format. Render's disk snapshots are useful recovery points, but keep your own independent backup too. [Disk behaviour and limitations](https://render.com/docs/disks).

Before upgrading, export settings and back up your data. Use Render's manual deploy control for a reviewed release, then check login, saving and journal reading. A disk-backed service pauses briefly during a redeploy. Restarting signs devices out; saved data remains.

For a custom domain, add it using Render's domain controls, then set `LIFEOS_ORIGIN` to its exact HTTPS origin and redeploy. Use that address thereafter. The explicit origin takes precedence over the generated Render address.

## Troubleshooting

- **403 or an unexpected-origin message:** use the exact configured HTTPS address. If you set `LIFEOS_ORIGIN`, remove a trailing path or incorrect domain; preserve the password.
- **Login fails:** retrieve the current password from the service's Environment page. A redeploy or restart ends existing sessions.
- **Settings disappear after redeploy:** check that the persistent disk is still attached and `LIFEOS_DATA_DIR` is inside `/var/data`. Stop edits and restore a backup before continuing.
- **Service cannot obtain its writer lock:** stop the other process using the same data directory. Do not delete an active lock or add a replica.
- **Cancel hosting:** export settings and separately download journal/metrics first, then remove the service and disk using Render's controls. Removing a disk deletes its data; review the provider's billing page afterwards.

The blueprint is checked against [Render's official schema](https://render.com/docs/blueprint-spec), and the application is tested with simulated Render environment values. A paid Render instance is not created by this repository's CI. Verify your own first deployment before relying on it.
