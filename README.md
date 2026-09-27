# Coach V Boxing App — Build Package

Everything needed to build the training app. Hand this whole folder to Claude Code
along with PROMPT.md.

## Data (source of truth, don't rewrite the content)

**data/program.json**: The program itself. Athlete profile, rules, round timer defaults,
the Weeks 1–2 schedule with dates, progression, scaling, and nutrition notes.

**data/days.json**: What happens each day, in order. Each day has a title, RPE, time, and
sections (warm-up, blocks, core, cool-down). Each section has an optional `format` line
and `items` of three kinds:
- `{"ex": "<library id>", "dose": "...", "props": {...}}`: an exercise from library.json.
  `dose` overrides the library default. `props` is merged over the exercise's own props
  (used to put a heavy bag or double-end bag in front of the boxing animations).
- `{"footwork": "<sequence name>", "dose": "..."}`: a sequence from footwork.json.
- `{"text": "..."}`: a plain instruction with no animation (walks, breathing, freestyle rounds).
Tuesday and Friday are active recovery days (`"recovery": true`) with an `emphasis` line.

**data/library.json**: 56 exercises keyed by id. Each has name, category, view, default dose,
coaching cues, props, animation `frames` (`[label, pose]`), and `print_frames` (which frames
the printable view shows).

**data/footwork.json**: 9 top-down footprint sequences (stance, 4 step directions, pivot,
in-and-out, lateral shuffle, agility ladder). The format is described at the top of the file.
The pivot is defined by rotation, not frame positions (see `pivot` and `note`). The ladder
has `lines` for the rungs.

## Code

**src/pose-renderer.js**: Reference implementation of the stick-figure system: kinematics,
interpolation, props, SVG output, and the animation loop. The pose format and every prop
are documented at the top. `frameSVG(pose, props)` renders a still frame; `animate()` loops
an exercise.

## Reference

**reference/**: What the athlete already has: the program as a Word doc, the footwork sheet,
and one printable guide per day. The app's printable views should match these.

## Known limits

- Stick figures show positions, not fine technique (hip turn on the cross, for example).
  Keep the coaching cues next to every animation.
- Some movements are simplified: front views use a single shoulder point, the side-view hook
  is shortened (see lead-hook for the clear front view), and 90/90 hips are shown as
  windshield wipers.
