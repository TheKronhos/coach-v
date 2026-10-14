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
| `app/data.js` | Loads data, merges imported updates, stores the session queue |
| `app/schedule.js` | Rolling schedule: queue, Done / Skip / restart / Start over, projected dates (pure, tested by `check.mjs`) |
| `app/validate.js` | Validation for days files, blocks, timers and update bundles (shared with `tools/check.mjs`) |
| `app/db.js` | IndexedDB: training log and imported program updates |
| `app/components/` | Stick-figure player, footwork player, round timer |
| `app/views/` | Today and sessions, schedule (Week), library, log, settings, print |
| `tools/make-block-1r.mjs` | Builds `data/days-block-1r.json` from `days.json` with Coach V's reset edits listed one by one (no Sunday session, adds `rest`) |
| `src/pose-renderer.js` | Renderer, extended with `DARK_THEME`, ghost poses and the "what moves" arrow for print |

## Program update bundle

Use **Settings → Import program update** to load a JSON file shaped like this:

```json
{
  "type": "coach-v-update",
  "data_version": "1.3",
  "blocks": [
    { "id": "block-2", "cycles": 2,
      "cycle": ["monday", "wednesday", "tuesday", "thursday", "friday", "saturday", "rest"],
      "days_file": "days-block-2.json", "check_in": "..." }
  ],
  "days_files": { "days-block-2.json": { "sunday": { ... }, "monday": { ... } } },
  "library": { "new-exercise-id": { ... } },
  "footwork": [ { "name": "New sequence", "frames": [ ... ] } ]
}
```

- A block runs its **`cycle`** (an ordered list of keys in its days file) **`cycles`** times. In the example that's 2 × 7 = 14 sessions. The keys are only ids: `"monday"` doesn't mean a Monday, and the rolling schedule assigns the dates. A key can appear more than once in a cycle. Without a `cycle`, a block runs Sun..Sat. Blocks run in list order. A block with the same `id` replaces the existing one, and new blocks are appended. `start`/`end` dates are rejected.
- The header label comes from the id: `block-2` shows as "Block 2", `block-1r` as "Block 1R". An optional `name` is shown in Settings.
- `days_files` use the same format as `data/days.json`. A days file must contain every key its blocks' cycles use, and it doesn't need the others. Every entry in the file is validated.
- `library` and `footwork` can only add new entries. Changing an existing one is rejected.
- Every `ex` and `footwork` reference, every timer, and every block is checked against the merged result. If anything fails, the app lists every problem and changes nothing.
- The accepted update is stored in IndexedDB, so it works offline. **Undo last update** restores the previous version (one level).
- If the current block is already finished when a new block is imported, the queue moves on to the new block's Session 1.

## Behaviour notes

- **Rolling schedule:** sessions run in the block's cycle order. Today shows the next incomplete session, whatever the date. Days passing never advance it.
  - **Done** (or saving a new log entry for that session) completes it and plans the next one for tomorrow. Done writes a minimal log row. Its toast offers *Add details* and *Undo*.
  - **Skip today** completes nothing. The same session moves to tomorrow, every later session shifts a day, and a `skipped` row goes in the log.
  - **Week** lists the block's sessions by number and name, grouped by cycle: done ones, then the rest with projected dates, one per day.
  - After **7+ days** with nothing completed (mid-cycle), Today offers to restart the cycle from its first session. It never restarts on its own.
  - **Settings → Start over** asks first, then goes back to Session 1 of the active block, starting today. The log is kept.
  - When the **last block** is finished, a persistent banner shows its `check_in` message with Export log. Extra sessions repeat the cycle until the next block is imported.
- **Progression:** the `progression` list appears on the Week screen as guidance only. The app never changes sessions by itself.
- **Timers:** a timer button appears only where the days file has a `timer` object. `intervals` and `emom` use `athlete.level`. `rounds` with `work_sec: 0` means the work is counted in reps, so you tap DONE to start each rest.
- **Log CSV columns:** `date, block_id, week, day, session_number, session, status, rpe_target, rpe_hit, weights, notes`. `week` is the cycle number, and `day` is the session's key in the days file. `status` is `done` or `skipped`. Entries from before the rolling schedule have no `session_number` and export as `done`.
- **Print:** prints a session of the active block with its session numbers, titled by session name. Recovery sessions with identical sections print as one combined guide.
