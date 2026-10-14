// Validation for program data and update bundles. Pure functions, no DOM,
// so the same code runs in the app and in tools/check-data.mjs under Node.

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const POSE_KEYS = ['h', 't', 'a', 'b', 'l', 'm'];
const TIMER_REQ = {
  rounds: ['rounds', 'work_sec', 'rest_sec'],
  intervals: ['rounds', 'by_level'],
  emom: ['rounds', 'work_sec', 'labels'],
  countdown: ['seconds'],
};

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

export function validateTimer(t, where, errors) {
  if (!isObj(t)) return errors.push(`${where}: timer must be an object`);
  const req = TIMER_REQ[t.type];
  if (!req) return errors.push(`${where}: unknown timer type "${t.type}" (expected ${Object.keys(TIMER_REQ).join(', ')})`);
  for (const k of req) if (t[k] == null) errors.push(`${where}: ${t.type} timer is missing "${k}"`);
  for (const k of ['rounds', 'work_sec', 'rest_sec', 'seconds', 'warning_sec'])
    if (t[k] != null && !(Number.isFinite(t[k]) && t[k] >= 0)) errors.push(`${where}: timer "${k}" must be a number >= 0`);
  if (t.type === 'intervals' && isObj(t.by_level))
    for (const [lvl, v] of Object.entries(t.by_level))
      if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => Number.isFinite(n) && n >= 0))
        errors.push(`${where}: by_level.${lvl} must be [work_sec, rest_sec]`);
  if (t.type === 'emom' && t.labels != null && (!Array.isArray(t.labels) || !t.labels.length))
    errors.push(`${where}: emom "labels" must be a non-empty list`);
}

// Check one days file against the library ids and footwork names available.
// `required` = keys that must exist (the cycle keys of every block using the file).
// Every entry present is validated, required or not.
export function validateDays(days, name, libIds, fwNames, errors, required = WEEKDAYS) {
  if (!isObj(days)) return errors.push(`${name}: must be an object keyed by session id`);
  for (const wd of new Set([...required, ...Object.keys(days)])) {
    const d = days[wd], at = `${name} › ${wd}`;
    if (!isObj(d)) { errors.push(`${at}: missing day`); continue; }
    if (typeof d.title !== 'string') errors.push(`${at}: missing "title"`);
    if (!Array.isArray(d.sections)) { errors.push(`${at}: missing "sections" list`); continue; }
    d.sections.forEach((s, si) => {
      const sat = `${at} › section ${si + 1}${s && s.name ? ` "${s.name}"` : ''}`;
      if (!isObj(s)) return errors.push(`${sat}: must be an object`);
      if (typeof s.name !== 'string') errors.push(`${sat}: missing "name"`);
      if (s.timer != null) validateTimer(s.timer, sat, errors);
      if (!Array.isArray(s.items)) return errors.push(`${sat}: missing "items" list`);
      s.items.forEach((it, ii) => {
        const iat = `${sat} › item ${ii + 1}`;
        if (!isObj(it)) return errors.push(`${iat}: must be an object`);
        const kinds = ['ex', 'footwork', 'text'].filter((k) => it[k] != null);
        if (kinds.length !== 1) return errors.push(`${iat}: needs exactly one of "ex", "footwork", "text"`);
        if (it.ex != null && !libIds.has(it.ex)) errors.push(`${iat}: unknown exercise "${it.ex}"`);
        if (it.footwork != null && !fwNames.has(it.footwork)) errors.push(`${iat}: unknown footwork sequence "${it.footwork}"`);
        if (it.props != null && !isObj(it.props)) errors.push(`${iat}: "props" must be an object`);
        if (it.timer != null) validateTimer(it.timer, iat, errors);
      });
    });
  }
}

export function validateExercise(id, ex, errors) {
  const at = `library › ${id}`;
  if (!isObj(ex)) return errors.push(`${at}: must be an object`);
  for (const k of ['name', 'category']) if (typeof ex[k] !== 'string') errors.push(`${at}: missing "${k}"`);
  if (!Array.isArray(ex.cues)) errors.push(`${at}: missing "cues" list`);
  if (!Array.isArray(ex.frames) || !ex.frames.length) return errors.push(`${at}: missing "frames"`);
  ex.frames.forEach((fr, i) => {
    if (!Array.isArray(fr) || fr.length !== 2 || !isObj(fr[1])) return errors.push(`${at}: frame ${i + 1} must be [label, pose]`);
    for (const k of POSE_KEYS) if (fr[1][k] == null) errors.push(`${at}: frame ${i + 1} pose is missing "${k}"`);
  });
  if (ex.print_frames != null && (!Array.isArray(ex.print_frames) || ex.print_frames.some((n) => !(n >= 0 && n < ex.frames.length))))
    errors.push(`${at}: "print_frames" must be indexes into frames`);
}

export function validateFootwork(seq, errors) {
  const at = `footwork › ${seq && seq.name ? seq.name : '(unnamed)'}`;
  if (!isObj(seq) || typeof seq.name !== 'string') return errors.push(`${at}: needs a "name"`);
  if (!Array.isArray(seq.frames) || !seq.frames.length) return errors.push(`${at}: missing "frames"`);
  if (seq.pivot) return;
  seq.frames.forEach((fr, i) => {
    if (!Array.isArray(fr.feet) || !fr.feet.length) errors.push(`${at}: frame ${i + 1} has no "feet"`);
  });
}

// Validate blocks: an ordered list, each `cycles` x 7 sessions with a resolvable days file.
export function validateBlocks(blocks, daysFiles, errors) {
  if (!Array.isArray(blocks) || !blocks.length) return errors.push('blocks: need at least one block');
  const ids = new Set();
  blocks.forEach((b, i) => {
    const at = `blocks › ${b && b.id ? b.id : `#${i + 1}`}`;
    if (!isObj(b)) return errors.push(`${at}: must be an object`);
    if (typeof b.id !== 'string' || !b.id) errors.push(`${at}: missing "id"`);
    else if (ids.has(b.id)) errors.push(`${at}: duplicate id`);
    ids.add(b.id);
    if (b.start != null || b.end != null) errors.push(`${at}: uses "start"/"end" dates; blocks are now defined by "cycles" (how many times the cycle repeats)`);
    if (!(Number.isInteger(b.cycles) && b.cycles >= 1)) errors.push(`${at}: "cycles" must be a whole number >= 1`);
    if (typeof b.days_file !== 'string') errors.push(`${at}: missing "days_file"`);
    else if (!daysFiles[b.days_file]) errors.push(`${at}: days file "${b.days_file}" is not in the bundle or the app`);
    if (b.check_in != null && typeof b.check_in !== 'string') errors.push(`${at}: "check_in" must be text`);
    if (b.cycle != null && (!Array.isArray(b.cycle) || !b.cycle.length || !b.cycle.every((k) => typeof k === 'string' && k)))
      errors.push(`${at}: "cycle" must be a non-empty list of session ids (keys in its days file)`);
    else if (Array.isArray(b.cycle) && daysFiles[b.days_file])
      for (const k of b.cycle) if (!isObj(daysFiles[b.days_file][k])) errors.push(`${at}: cycle uses "${k}", which is not in ${b.days_file}`);
  });
}

// Keys each days file must contain: the union of the cycles of the blocks that use it.
export function requiredKeys(blocks) {
  const req = {};
  for (const b of blocks) req[b.days_file] ??= new Set();
  for (const b of blocks) for (const k of (Array.isArray(b.cycle) && b.cycle.length ? b.cycle : WEEKDAYS)) req[b.days_file].add(k);
  return Object.fromEntries(Object.entries(req).map(([f, set]) => [f, [...set]]));
}

// Merge an update bundle onto the current effective data and validate the result.
// base    = { blocks, daysFiles: {name: days}, library: {id: ex}, footwork: [seq] }  (bundled data)
// overlay = previously imported overlay or null
// Returns { ok, errors, overlay } where overlay is the new cumulative overlay to store.
export function applyBundle(base, overlay, bundle) {
  const errors = [];
  if (!isObj(bundle)) return { ok: false, errors: ['The file is not a JSON object.'] };
  if (bundle.type !== 'coach-v-update') errors.push('Missing "type": "coach-v-update". Is this the right file?');
  const prev = overlay || { blocks: [], daysFiles: {}, library: {}, footwork: [] };
  const next = {
    data_version: bundle.data_version ?? prev.data_version ?? null,
    importedAt: new Date().toISOString(),
    blocks: [...prev.blocks],
    daysFiles: { ...prev.daysFiles },
    library: { ...prev.library },
    footwork: [...prev.footwork],
  };

  // Library additions: new ids only (identical re-sends are fine).
  const libAdd = bundle.library ?? {};
  if (!isObj(libAdd)) errors.push('"library" must be an object keyed by exercise id');
  else for (const [id, ex] of Object.entries(libAdd)) {
    const existing = base.library[id] ?? next.library[id];
    if (existing && JSON.stringify(existing) !== JSON.stringify(ex)) { errors.push(`library › ${id}: already exists; updates can only add new exercises`); continue; }
    validateExercise(id, ex, errors);
    next.library[id] = ex;
  }

  // Footwork additions: accept a list or { sequences: [...] }.
  const fwAdd = Array.isArray(bundle.footwork) ? bundle.footwork : (bundle.footwork?.sequences ?? []);
  if (!Array.isArray(fwAdd)) errors.push('"footwork" must be a list of sequences');
  else for (const seq of fwAdd) {
    validateFootwork(seq, errors);
    if (!seq?.name) continue;
    const existing = base.footwork.find((s) => s.name === seq.name) ?? next.footwork.find((s) => s.name === seq.name);
    if (existing && JSON.stringify(existing) !== JSON.stringify(seq)) { errors.push(`footwork › ${seq.name}: already exists; updates can only add new sequences`); continue; }
    if (!existing) next.footwork.push(seq);
  }

  // Days files.
  const daysAdd = bundle.days_files ?? {};
  if (!isObj(daysAdd)) errors.push('"days_files" must be an object keyed by file name');
  else for (const [name, days] of Object.entries(daysAdd)) next.daysFiles[name] = days;

  // Blocks: replace by id, otherwise append (blocks run in list order).
  if (bundle.blocks != null && !Array.isArray(bundle.blocks)) errors.push('"blocks" must be a list');
  for (const b of bundle.blocks ?? []) {
    const i = next.blocks.findIndex((x) => x.id === b?.id);
    if (i >= 0) next.blocks[i] = b; else next.blocks.push(b);
  }
  if (!(bundle.blocks ?? []).length && !Object.keys(daysAdd).length && !Object.keys(libAdd).length && !fwAdd.length)
    errors.push('The bundle has no blocks, days files, exercises or footwork in it.');

  // Validate the merged result.
  const eff = effective(base, next);
  const libIds = new Set(Object.keys(eff.library));
  const fwNames = new Set(eff.footwork.map((s) => s.name));
  validateBlocks(eff.blocks, eff.daysFiles, errors);
  // Every days file a block points at must be valid and contain its blocks' cycle keys.
  for (const [name, keys] of Object.entries(requiredKeys(eff.blocks)))
    if (eff.daysFiles[name]) validateDays(eff.daysFiles[name], name, libIds, fwNames, errors, keys);

  return { ok: errors.length === 0, errors, overlay: next };
}

// Effective data = bundled base + overlay.
export function effective(base, overlay) {
  if (!overlay) return base;
  const blocks = [...base.blocks];
  for (const b of overlay.blocks) { const i = blocks.findIndex((x) => x.id === b.id); if (i >= 0) blocks[i] = b; else blocks.push(b); }
  return {
    blocks,
    daysFiles: { ...base.daysFiles, ...overlay.daysFiles },
    library: { ...base.library, ...overlay.library },
    footwork: [...base.footwork, ...overlay.footwork.filter((s) => !base.footwork.some((b) => b.name === s.name))],
  };
}
