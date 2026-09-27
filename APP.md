# Coach V app

An offline Progressive Web App built from `data/` and `src/`. It uses plain HTML, CSS and ES modules, with no build step and no dependencies.

## Run locally

```bash
python3 -m http.server 8765
```

Open http://localhost:8765. Checks for data references, the precache list, bundle validation, block/week math and CSV:

```bash
node tools/check.mjs
```

## Install on Android / iPad

Browsers only install PWAs from **HTTPS**, so host this folder on any static host, such as GitHub Pages, Netlify or Cloudflare Pages. Upload the whole folder. `reference/` is optional because the app never loads it.

- **Android (Chrome):** open the URL, then use the menu and choose *Install app*.
- **iPad (Safari):** open the URL, then Share and *Add to Home Screen*.

Open the app once while online. After that it runs fully offline.

## Shipping a change

Every change, including data updates, follows the same steps:

```bash
node tools/bump.mjs          # 1.1 -> 1.2 in app/version.js AND sw.js (or: node tools/bump.mjs 2.0)
node tools/check.mjs         # fails if the two versions differ or a file is missing from the cache list
git commit -am "..." && git push
```

GitHub Pages redeploys on every push to `main`, usually within a minute. Open devices show *New version ready → Reload*. Settings shows **Version x.y**, so you can confirm each device picked up the update.

## Where things live

| Path | What |
|---|---|
| `index.html`, `manifest.webmanifest`, `sw.js`, `icons/` | App shell, install metadata, offline cache |
| `app/data.js` | Loads data, merges imported updates, resolves date → block → week → session |
| `app/validate.js` | Validation for days files, blocks, timers and update bundles (shared with `tools/check.mjs`) |
| `app/db.js` | IndexedDB: training log and imported program updates |
| `app/components/` | Stick-figure player, footwork player, round timer |
| `app/views/` | Today/day, week, library, log, settings, print |
| `src/pose-renderer.js` | Renderer, extended with `DARK_THEME`, ghost poses and the "what moves" arrow for print |

## Program update bundle

Use **Settings → Import program update** to load a JSON file shaped like this:

```json
{
  "type": "coach-v-update",
  "data_version": "1.2",
  "blocks": [
    { "id": "block-2", "name": "Weeks 3-4: ...", "start": "2026-10-11", "end": "2026-10-24",
      "days_file": "days-block-2.json", "check_in": "..." }
  ],
  "days_files": { "days-block-2.json": { "sunday": { ... }, "monday": { ... } } },
  "library": { "new-exercise-id": { ... } },
  "footwork": [ { "name": "New sequence", "frames": [ ... ] } ]
}
```

- `blocks` are added, or replace a block with the same `id`. Blocks can't overlap.
- `days_files` use the same format as `data/days.json` and must cover all 7 days.
- `library` and `footwork` can only add new entries. Changing an existing one is rejected.
- Every `ex` and `footwork` reference, every timer, and every block date is checked against the merged result. If anything fails, the app lists every problem and changes nothing.
- The accepted update is stored in IndexedDB, so it works offline. **Undo last update** restores the previous version (one level).

## Behaviour notes

- **Dates:** before the first block starts, Today shows the first session (Sunday). Inside a block, Today shows that weekday's session with "Block N, Week N". After the last block ends, its sessions keep showing and a persistent banner shows its `check_in` message with an Export log button.
- **Progression:** the `progression` list appears on the Week screen as guidance only. The app never changes sessions by itself.
- **Timers:** a timer button appears only where days.json has a `timer` object. `intervals` and `emom` use `athlete.level`. `rounds` with `work_sec: 0` means the work is counted in reps, so you tap DONE to start each rest.
- **Log CSV columns:** `date, block_id, week, day, session, rpe_target, rpe_hit, weights, notes`
- **Print:** Tuesday and Friday have identical sections, so they print as one combined guide, as in the reference PDFs.
