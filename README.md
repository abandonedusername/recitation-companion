# The Recitation Companion

*A Living Treasury of Scripture & Poetry*

Words Worth Learning • Words Worth Keeping


A working, mobile-responsive first version of the family's Charlotte Mason–inspired memory rotation. **No accounts or paid services are required.** The application is plain HTML, CSS, and JavaScript, so there is no build step, backend, or package manager.

## Open the app

- **Quick try:** Open `The-Recitation-Companion-App.html` from the download. It is one self-contained HTML file. Depending on how your phone handles downloaded HTML files, you may need to open it in Safari/Chrome or use the hosted version below.
- **Best for regular use on phones:** Publish the files from this folder to an HTTPS static site (e.g., Netlify, GitHub Pages, or Cloudflare Pages). Then open that website in Safari/Chrome; it can be added to the home screen. This hosted version caches files for offline use after the first visit.
- **For local development:** `python3 -m http.server 8000` from this folder, then visit `http://localhost:8000/` in a browser. Or open `index.html` locally; note that browsers differ in how they handle storage for local files.

**Important:** Even when the app is published online, content remains in each browser's local storage. The first version does **not** sync between devices or provide family accounts. Use **Settings → Export complete backup** and **Restore a backup** to transfer work or protect against loss. Clearing browser data may delete the saved library.

## How to use

1. Go to **Library**. Add a scripture or poem with a title/reference and pasted text. It is automatically added to the waiting list unless you uncheck the option.
2. Reorder the waiting list using the ↑ ↓ arrows, or drag rows on a computer. The first item is *suggested*, not required.
3. Open an item with **⋯ → Choose for Daily**. Repeat independently for the scripture and poetry tracks.
4. On **Today**, tap **Start session**. It creates a frozen snapshot of that session's Daily, Odd/Even, Weekly, and Monthly reviews.
5. Check items when reviewed. Use **Advance →** to schedule a manually chosen promotion; the current session remains unchanged.
6. Tap **Finish session**. Only then are promotions and cascading slot shifts applied. The next session picks up where this one ended, regardless of the date.
7. When Daily is empty, choose any piece from the waiting list. Alternatively, enable **Automatically fill an empty Daily slot** in Settings to pull the first waiting item at session start.

## Rotation design

Two independent tracks: **Scriptures** and **Poetry**, one shared family schedule. Each track has the same stages:

`Daily → Odd → Even → Weekly 1…N → Monthly 1…M → Completed`

The user initiates every promotion. If the destination is occupied, the existing card shifts to the following slot and continues cascading until an empty slot is found. A card displaced past the final Monthly slot goes to **Completed**; it is not permanently deleted.

The review selection for session S is:

- Daily
- Odd if S is odd; Even if S is even
- Weekly `1 + (S - 1) mod N`
- Monthly `1 + (S - 1) mod M`

The session number increments **only** when the user finishes a session. Weekends, vacations, skipped days, and holidays don't skip memory slots.

Defaults: `N = 4` and `M = 16`. The Settings screen supports weekly slots `4, 5, 7` and monthly slots `16, 20, 31`. When shortening a rotation, any occupied removed slots return to the waiting list, without losing their content.

When multiple promotions occur in one session, the deepest-stage promotions are applied first, then assignments, to avoid inadvertently advancing the same card twice during a cascade.

## Long passages: paragraphs, stanzas and review groups

- When adding a work, split by **blank-line-separated paragraphs/stanzas**, **individual lines**, or **one complete section**.
- Open the saved work in **Library → Saved works → Open**.
- Check any sections and select **Save selected sections to waiting list**. This makes a review card from those exact sections, without retyping text.
- Multiple overlapping groups can be made from one original work, and different groups can occupy different rotation slots.
- **Edit original text** or **Edit group** later. If you change the number of original sections, review existing groups afterward.

## Import / export

- Paste any original or permissioned scripture/poem text into the Add screen.
- Import `.txt` or `.md` to populate the Add form, where you confirm the title and track.
- Import `.csv` to add multiple items; the first row must be column headers. Use `Track,Title,Reference,Text`. Track values can be `Scripture` or `Poetry`, quoted CSV fields can contain line breaks.
- Backup and restore the **entire** app as `.json` in **Settings**.

**Not in this first version:** automatic Gospel Library/reference lookup (requires an authorized scripture text source), DOCX/PDF text extraction, shared accounts, cloud synchronization, notifications, editing imported documents directly, or native App Store deployment.

## Files and architecture

- `index.html` — app shell
- `styles.css` — responsive visual design
- `app.js` — all app logic, storage, data structures and events
- `manifest.webmanifest` — installable web app metadata
- `sw.js` — offline cache for a hosted HTTPS version
- `icon.svg`, `icon-*.png` — app icons
- `blank-import-template.csv` — sample CSV header

Data is stored under browser `localStorage` key `memory-garden-family-v1` for compatibility with the original prototype, so existing saved work is not lost by renaming. The main structure contains `works` (original texts split into sections), `cards` (selected sections of a work), `queues` (ordered candidate lists), `slots` (assigned rotation), `archived`, `session` (immutable review snapshot plus pending changes), `nextSession`, `history`, and `settings`.

### Recommended next step if the family uses multiple devices

Add authentication and remote persistence using a secure database (e.g., Supabase or Firebase), with one shared household record and conflict handling. Keep the session snapshot/pending-change design so multiple device interactions cannot shift a running session halfway through.

### Development notes

The v1 code has no third-party dependencies. All user text is HTML-escaped when rendered. Backups are not encrypted, so store them privately. There are no automatic edits or pushes to an external scripture source.
