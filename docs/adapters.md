# Bring your own data

LifeOS reads small local files. Provider credentials stay with your existing collector; the dashboard does not receive them or make provider calls.

An optional collector can atomically replace `data/metrics.json` with an array:

```json
[
  {
    "label": "Cloud costs",
    "value": "£0.00",
    "note": "Invoice month, after credits",
    "source": "Your billing export",
    "checkedAt": "2026-01-11T10:00:00Z",
    "maxAgeMinutes": 1440
  }
]
```

This is a format example, not a current reading. `checkedAt` must be a real observation time, not the time an old snapshot was copied. Stale values are replaced with “Needs an update”. Missing or invalid feeds never become zero. Up to 12 metrics are accepted. Each card has a label, formatted value, note, source and timestamp.

Use the same format for allowances, costs, service status, pantry reminders or upcoming renewals. This release ships no account connectors: wire a collector you control, with read-only permissions where possible. Never put tokens, private provider responses or signed URLs into the feed. The file is visible to anyone authorised to use your LifeOS.

For a journal, save `YYYY-MM-DD - Title.md` in `data/journal/`, or set `LIFEOS_JOURNAL_DIR` to a vault directory. Frontmatter is omitted; content is rendered as plain text. Symlinks, invalid dates and entries larger than 100 kB are ignored. The reader considers at most 10,000 directory entries and displays up to 104 valid dated notes, newest first. Your existing scheduler or agent can write there; LifeOS remains a reader.

Agents can propose changes to the exported settings format. Review and import them through More. Do not give an agent the dashboard password merely to organise links, and preserve whatever approval system you already use for consequential work.
