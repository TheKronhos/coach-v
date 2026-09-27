Build an offline-capable Progressive Web App for my boxing training program.
It must install to the home screen on Android and iPad and work fully offline
after the first load (service worker, all assets cached locally).

Read README.md first, then the files in data/ and src/. They are the source of
truth. Don't rewrite or invent program content.

Features:
1. Today view: opens to today's session using the schedule in program.json
   (start 2026-09-27, week starts Sunday) and the plan in days.json. Shows RPE
   target, time estimate, and every section in order.
2. Weekly schedule: all 7 days, training and active recovery clearly marked.
3. Exercise demos: every "ex" item plays its animation from library.json using
   src/pose-renderer.js, with the dose and coaching cues beside it. Merge
   item-level props over exercise props. Every "footwork" item plays the matching
   footwork.json sequence, animated step by step.
4. Exercise library: browse all 56 exercises by category.
5. Round timer: configurable work/rest/rounds (default 2 min / 1 min) with a bell,
   a 10-second warning, and a screen wake lock while running. Launch it from any
   section with a round format.
6. Training log: date, session, RPE hit, weights, notes. Saved on the device,
   exportable as CSV.
7. Printable view for each day, matching the PDFs in reference/.

Design: mobile-first, large tap targets, high contrast, readable at arm's length
from the heavy bag. Dark mode (pass a dark THEME to the renderer).

Start by proposing the file structure and tech choices, wait for my OK, then build
it step by step. Test that it works offline before calling it done.
