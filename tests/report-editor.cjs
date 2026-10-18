'use strict';
// Run: node tests/report-editor.cjs. Uses the real app.js in isolated VM contexts.
// No dependencies, browser, credentials, live network, or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clone = value => JSON.parse(JSON.stringify(value));
const decode = s => String(s).replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function attrs(text) {
  const out = {};
  for (const m of text.matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)')?/g)) out[m[1]] = decode(m[2] ?? m[3] ?? '');
  return out;
}
function classList(initial = '') {
  const set = new Set(initial.split(/\s+/).filter(Boolean));
  return { add(...names) { names.forEach(n => set.add(n)); }, remove(...names) { names.forEach(n => set.delete(n)); }, contains(n) { return set.has(n); }, toggle(n, force) { const yes = force ?? !set.has(n); yes ? set.add(n) : set.delete(n); return yes; }, toString() { return [...set].join(' '); } };
}
function classMatches(node, selector) {
  const checked = selector.endsWith(':checked');
  const base = checked ? selector.replace(/:checked$/, '') : selector;
  return base.startsWith('.') && base.slice(1).split('.').every(c => node.classList.contains(c)) && (!checked || node.checked);
}
// Deliberately small DOM: parses the actual reportRowHtml controls instead of
// duplicating its output, and preserves row/control identity across operations.
function parseRow(html) {
  const opening = html.match(/<tr\b([^>]*)>/);
  if (!opening) throw Error('Expected reportRowHtml to emit a <tr>');
  const a = attrs(opening[1]);
  const row = { dataset: {}, classList: classList(a.class), controls: [], cells: [], parentNode: null,
    scrollIntoView() {}, focus() {},
    closest(s) { return classMatches(this, s) ? this : null; },
    remove() { if (this.parentNode) { const list = this.parentNode.rows; list.splice(list.indexOf(this), 1); this.parentNode = null; } },
    setAttribute(name, value) { if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); },
    getAttribute(name) { if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null; return null; },
    querySelectorAll(selector) {
      if (selector.includes('passenger-picker') || selector.startsWith('input[')) return this.controls.filter(c => c.type === 'checkbox' && !c.classList.contains('row-select-check') && (!selector.includes(':checked') || c.checked));
      return [...this.controls, ...this.cells].filter(c => classMatches(c, selector));
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  };
  for (const [key, value] of Object.entries(a)) if (key.startsWith('data-')) row.setAttribute(key, value);
  for (const m of html.matchAll(/<input\b([^>]*)>|<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const p = attrs(m[1] ?? m[2]);
    let value = p.value ?? '';
    if (m[2] !== undefined) {
      const options = [...m[3].matchAll(/<option\b([^>]*)>/g)].map(x => attrs(x[1]));
      value = (options.find(o => 'selected' in o) || options[0] || {}).value ?? '';
    }
    row.controls.push({ value, disabled: false, checked: 'checked' in p, type: p.type || 'select', classList: classList(p.class), dataset: {}, focus() {}, closest(s) { return row.closest(s); } });
  }
  for (const m of html.matchAll(/<td\b([^>]*)>/g)) { const p = attrs(m[1]); if (p.class) row.cells.push({ classList: classList(p.class), textContent: '' }); }
  return row;
}
function harness(options = {}) {
  const body = { rows: [], empty: false,
    appendChild(row) { if (row.parentNode) row.remove(); this.rows.push(row); row.parentNode = this; return row; },
    querySelectorAll(s) { return this.rows.filter(r => classMatches(r, s)); },
    querySelector(s) { if (s === '.report-empty-row') return this.empty ? { remove: () => { this.empty = false; } } : null; return this.querySelectorAll(s)[0] || null; },
    set innerHTML(html) { this.rows.forEach(r => { r.parentNode = null; }); this.rows = []; this.empty = html.includes('report-empty-row'); },
    get innerHTML() { return ''; }
  };
  const plain = () => ({ textContent: '', innerHTML: '', disabled: false, checked: false, indeterminate: false, dataset: {}, classList: classList() });
  const elements = { app: plain(), toast: plain(), reportEditBody: body, editCountLabel: plain(), selectionCountLabel: plain(), bottomSelectionCount: plain(), deleteSelectedRowsButton: plain(), selectAllReportRows: plain(), saveReportEditsButton: plain() };
  elements.saveReportEditsButton.textContent = 'Save';
  const requests = [], messages = [];
  let reloads = 0;
  let responder = async req => req.method === 'DELETE' ? [] : [{ ...req.payload, id: req.payload?.id || decodeURIComponent(req.url.split('id=eq.')[1] || '') }];
  const document = {
    getElementById: id => elements[id] || null,
    querySelectorAll(s) {
      if (s === '[onclick="saveReportEdits()"]') return [elements.saveReportEditsButton];
      if (s === '.admin-shell button,.report-editor-card input,.report-editor-card select') return [elements.saveReportEditsButton, elements.deleteSelectedRowsButton, ...body.rows.flatMap(r => r.controls)];
      if (s.startsWith('.edit-trip-row')) return body.querySelectorAll(s);
      return body.rows.flatMap(row => row.querySelectorAll(s));
    },
    querySelector(s) { return this.querySelectorAll(s)[0] || null; },
    createElement(tag) { assert.equal(tag, 'tbody'); return { set innerHTML(html) { this.firstElementChild = parseRow(html); } }; }
  };
  const context = vm.createContext({ console, URLSearchParams, TextEncoder, TextDecoder, Blob, URL, crypto: options.crypto || webcrypto,
    location: { search: '' }, localStorage: { getItem() { return null; } }, setTimeout() {}, document,
    confirm: () => options.confirm !== false,
    fetch() { throw Error('Live network forbidden'); },
    __request: async (url, opts = {}) => { const request = { url, ...opts, payload: opts.body ? JSON.parse(opts.body) : null }; requests.push(request); return responder(request); },
    __toast: text => { messages.push(text); }, __reload() { reloads++; }
  });
  context.window = context;
  const run = code => vm.runInContext(code, context);
  vm.runInContext(source, context, { filename: 'app.js' });
  run(`restRequest=__request;toast=__toast;openReportEditorFromState=__reload;
    state.admin={profile:{id:'admin-1',role:'admin'}};
    state.reportEdit={month:'2026-10',vehicleId:'vehicle-1',facility:{id:'facility-1'},vehicle:{id:'vehicle-1'},
      members:[{id:'driver-1',name:'Driver'},{id:'passenger-1',name:'Passenger'}],purposes:[{id:'purpose-1',name:'Work'}],trips:[],original:{}};`);
  function add(record, { changed = false, reordered = false, selected = false } = {}) {
    context.__record = clone(record);
    run('state.reportEdit.trips.push(__record);state.reportEdit.original[__record.id]=JSON.stringify(__record)');
    const row = parseRow(run('reportRowHtml(__record,state.reportEdit.trips.length-1,state.reportEdit)'));
    body.appendChild(row);
    if (changed) row.classList.add('changed');
    if (reordered) row.classList.add('changed', 'reordered');
    row.querySelector('.row-select-check').checked = selected;
    return row;
  }
  return { run, context, body, elements, requests, messages, add,
    respond(fn) { responder = fn; }, reloads() { return reloads; }, state() { return clone(run('state.reportEdit')); }, collect() { return clone(run('collectReportRows()')); } };
}
function trip(overrides = {}) {
  return { id: 'existing-1', driver_id: 'driver-1', passenger_ids: ['passenger-1'], purpose_id: 'purpose-1', destination: 'Office',
    start_at: '2026-10-01T00:00:31.123Z', end_at: '2026-10-01T01:00:47.456Z', start_odometer: 100, end_odometer: 110, distance: 10,
    highpass_cost: null, fuel_cost: 0, note: 'original note', admin_sort_order: 1, ...overrides };
}
function edit(row, selector, value) { const control = row.querySelector(selector); assert(control, `Missing control ${selector}`); control.value = value; row.classList.add('changed'); }
function newRow(h) {
  h.run('addReportRow()');
  const row = h.body.rows[h.body.rows.length - 1];
  for (const [s, value] of Object.entries({ '.edit-date': '2026-10-03', '.edit-end-date': '2026-10-03', '.edit-start-time': '09:00', '.edit-end-time': '10:00', '.edit-driver': 'driver-1', '.edit-purpose': 'purpose-1', '.edit-destination': 'New destination', '.edit-start-km': '200', '.edit-end-km': '210' })) edit(row, s, value);
  return row;
}
function assertPromoted(row, id) {
  assert.equal(row.dataset.new, '0'); assert.equal(row.dataset.tripId, id);
  for (const c of ['new-row', 'changed', 'reordered']) assert(!row.classList.contains(c), `Successful row still has ${c}`);
}
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('reportRowHtml exposes independent end-date and safely escapes text', () => {
  const h = harness(); const row = h.add(trip({ start_at: '2026-10-01T14:30:13Z', end_at: '2026-10-03T15:45:19Z', note: '<script>" & test' }));
  assert.equal(row.querySelector('.edit-date').value, '2026-10-01');
  assert.equal(row.querySelector('.edit-end-date')?.value, '2026-10-04');
  assert.equal(row.querySelector('.edit-note').value, '<script>" & test');
  const html = h.run('reportRowHtml(state.reportEdit.trips[0],0,state.reportEdit)');
  assert(!html.includes('<script>')); assert(html.includes('&lt;script&gt;'));
});

test('UUID generation supports WebCrypto and getRandomValues fallback', () => {
  for (const crypto of [webcrypto, { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }]) {
    const h = harness({ crypto });
    const ids = Array.from({ length: 32 }, () => h.run('newReportTripId()'));
    ids.forEach(id => assert.match(id, UUID)); assert.equal(new Set(ids).size, ids.length);
  }
});

test('addReportRow and collectReportRows retain a stable client UUID', () => {
  const h = harness(); const first = newRow(h), second = newRow(h);
  edit(second, '.edit-date', '2026-10-04'); edit(second, '.edit-end-date', '2026-10-04');
  edit(second, '.edit-start-km', '210'); edit(second, '.edit-end-km', '220');
  assert.match(first.dataset.clientTripId, UUID); assert.match(second.dataset.clientTripId, UUID);
  assert.notEqual(first.dataset.clientTripId, second.dataset.clientTripId);
  assert.equal(first.dataset.tripId, 'new-' + first.dataset.clientTripId);
  const [a, b] = h.collect(); assert(a.isNew && b.isNew);
  assert.equal(a.clientTripId, first.dataset.clientTripId);
  assert.equal(h.collect()[0].clientTripId, a.clientTripId);
  assert.equal(h.run('validateReportRows(collectReportRows())'), '');
});

test('collectReportRows preserves overnight and greater-than-24-hour timestamps', () => {
  for (const end_at of ['2026-10-01T16:10:47.456Z', '2026-10-03T17:10:47.456Z']) {
    const h = harness(); const original = trip({ start_at: '2026-10-01T14:50:31.123Z', end_at });
    h.add(original, { changed: true });
    const [collected] = h.collect();
    assert.equal(collected.start_at, original.start_at); assert.equal(collected.end_at, end_at);
    assert.equal(h.run('validateReportRows(collectReportRows())'), '');
    assert(new Date(collected.end_at) > new Date(collected.start_at));
  }
});

test('explicit edited end date/time defines duration rather than guessing next day', async () => {
  const h = harness(); const row = h.add(trip());
  edit(row, '.edit-date', '2026-10-02'); edit(row, '.edit-start-time', '23:30');
  edit(row, '.edit-end-date', '2026-10-04'); edit(row, '.edit-end-time', '01:15');
  const [r] = h.collect(); assert.equal(r.start_at, '2026-10-02T14:30:00.000Z'); assert.equal(r.end_at, '2026-10-03T16:15:00.000Z');
  assert.equal(h.run('validateReportRows(collectReportRows())'), '');
  edit(row, '.edit-end-date', '2026-10-01');
  assert(h.run('validateReportRows(collectReportRows())'), 'End before start must fail validation');
  await h.run('saveReportEdits()'); assert.equal(h.requests.length, 0);
});

test('note-only existing save PATCHes and preserves original seconds/milliseconds', async () => {
  const h = harness(); const original = trip(); const row = h.add(original);
  edit(row, '.edit-note', 'updated note');
  await h.run('saveReportEdits()'); assert.equal(h.requests.length, 1);
  const req = h.requests[0]; assert.equal(req.method, 'PATCH'); assert.match(req.url, /^trips\?id=/);
  assert.equal(req.headers.Prefer, 'return=representation');
  assert.equal(req.payload.start_at, original.start_at); assert.equal(req.payload.end_at, original.end_at);
  assert.equal(req.payload.note, 'updated note'); assert.equal(req.payload.distance, 10);
  assertPromoted(row, original.id); assert.equal(h.state().trips.find(x => x.id === original.id).note, 'updated note');
  assert.equal(h.reloads(), 1, 'Complete save may refresh the editor');
});

test('successful new save upserts its client ID, promotes in place, and synchronizes state', async () => {
  const h = harness(); const row = newRow(h); const id = row.dataset.clientTripId;
  row.classList.add('reordered');
  h.respond(req => [{ ...req.payload, id: req.payload.id || decodeURIComponent(req.url.split('id=eq.')[1] || '') }]);
  await h.run('saveReportEdits()'); assert.equal(h.requests.length, 1);
  const req = h.requests[0]; assert.equal(req.method, 'POST');
  assert.equal(req.url, 'trips?on_conflict=id'); assert.equal(req.headers.Prefer, 'resolution=merge-duplicates,return=representation');
  assert.equal(req.payload.id, id); assert.equal(req.payload.facility_id, 'facility-1'); assert.equal(req.payload.vehicle_id, 'vehicle-1');
  assertPromoted(row, id); assert.equal(h.body.rows[0], row);
  const saved = h.state().trips.find(t => t.id === id); assert(saved); assert.equal(saved.destination, 'New destination');
  assert.equal(saved.start_at, req.payload.start_at); assert.equal(saved.end_at, req.payload.end_at);
  assert.equal(h.reloads(), 1);
  await h.run('saveReportEdits()'); assert.equal(h.requests.length, 1, 'Repeated Save must not insert a duplicate');
  edit(row, '.edit-note', 'after promotion'); await h.run('saveReportEdits()');
  assert.equal(h.requests[1].method, 'PATCH'); assert(h.requests[1].url.includes(id));
});

test('failed new save remains dirty with the same client ID for retry', async () => {
  const h = harness(); const row = newRow(h), id = row.dataset.clientTripId;
  h.respond(() => { throw Error('offline'); }); await h.run('saveReportEdits()');
  assert.equal(row.dataset.new, '1'); assert.equal(row.dataset.clientTripId, id); assert(row.classList.contains('changed'));
  assert.equal(h.elements.saveReportEditsButton.disabled, false);
  h.respond(req => [{ ...req.payload }]); await h.run('saveReportEdits()');
  assert.deepEqual(h.requests.map(r => r.payload.id), [id, id]); assertPromoted(row, id);
});

test('response loss after committed insert cannot create a duplicate on retry', async () => {
  const h = harness(); const row = newRow(h), id = row.dataset.clientTripId; const database = new Map(); let loseResponse = true;
  h.respond(req => {
    assert.equal(req.method, 'POST'); assert.equal(req.url, 'trips?on_conflict=id'); assert.match(req.headers.Prefer, /resolution=merge-duplicates/);
    assert.match(req.payload.id, UUID); database.set(req.payload.id, clone(req.payload));
    if (loseResponse) { loseResponse = false; throw Error('Connection lost after commit'); }
    return [{ ...database.get(req.payload.id) }];
  });
  await h.run('saveReportEdits()'); assert.equal(database.size, 1); assert.equal(row.dataset.new, '1');
  await h.run('saveReportEdits()'); assert.equal(database.size, 1); assert.equal(h.requests.length, 2);
  assert.equal(h.requests[0].payload.id, h.requests[1].payload.id); assertPromoted(row, id);
});

test('partially successful save immediately promotes confirmed rows before a later error', async () => {
  const h = harness(); const first = newRow(h), id = first.dataset.clientTripId;
  const later = h.add(trip({ id: 'existing-later', start_at: '2026-10-04T00:00:11Z', end_at: '2026-10-04T01:00:22Z', start_odometer: 220, end_odometer: 230 }), { changed: true });
  h.respond(req => { if (req.method === 'PATCH') throw Error('Later row failed'); return [{ ...req.payload }]; });
  await h.run('saveReportEdits()'); assertPromoted(first, id); assert(later.classList.contains('changed'));
  assert.equal(h.reloads(), 0, 'Partial save must not reload and discard remaining edits');
  assert(h.state().trips.some(x => x.id === id));
  h.respond(req => [{ ...req.payload, id: decodeURIComponent(req.url.split('id=eq.')[1] || '') }]); await h.run('saveReportEdits()');
  assert.equal(h.requests.filter(r => r.method === 'POST').length, 1, 'Confirmed new row must not be inserted again');
});

test('delete existing rows in place preserves unrelated unsaved edits and new rows', async () => {
  const h = harness(); const removed = h.add(trip({ id: 'delete-me' }), { selected: true });
  const dirty = h.add(trip({ id: 'keep-dirty' }), { changed: true }); edit(dirty, '.edit-note', 'UNSAVED TEXT');
  const fresh = newRow(h), id = fresh.dataset.clientTripId;
  await h.run('deleteSelectedReportRows()');
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].method, 'DELETE'); assert(h.requests[0].url.includes('delete-me'));
  assert(!h.body.rows.includes(removed)); assert(h.body.rows.includes(dirty)); assert(h.body.rows.includes(fresh));
  assert.equal(dirty.querySelector('.edit-note').value, 'UNSAVED TEXT'); assert(dirty.classList.contains('changed'));
  assert.equal(fresh.dataset.clientTripId, id); assert.equal(fresh.dataset.new, '1');
  assert(!h.state().trips.some(x => x.id === 'delete-me'));
  assert.equal(h.reloads(), 0, 'Delete must not reload and discard unrelated edits');
});

test('partial delete removes confirmed successes even if a later request fails', async () => {
  const h = harness(); const first = h.add(trip({ id: 'delete-first' }), { selected: true });
  const second = h.add(trip({ id: 'delete-second' }), { selected: true });
  const dirty = h.add(trip({ id: 'preserve-me' }), { changed: true }); edit(dirty, '.edit-note', 'keep local');
  const fresh = newRow(h); const id = fresh.dataset.clientTripId;
  h.respond(req => { if (req.url.includes('delete-second')) throw Error('Permission denied'); return []; });
  await h.run('deleteSelectedReportRows()');
  assert(!h.body.rows.includes(first)); assert(h.body.rows.includes(second)); assert(h.body.rows.includes(dirty)); assert(h.body.rows.includes(fresh));
  assert(!h.state().trips.some(x => x.id === 'delete-first')); assert(h.state().trips.some(x => x.id === 'delete-second'));
  assert.equal(h.reloads(), 0);
  assert.equal(dirty.querySelector('.edit-note').value, 'keep local'); assert.equal(fresh.dataset.clientTripId, id);
  h.respond(() => []); await h.run('deleteSelectedReportRows()');
  assert.equal(h.requests.filter(r => r.url.includes('delete-first')).length, 1); assert(!h.body.rows.includes(second));
});

test('deleting new rows makes no API call, and cancellation changes nothing', async () => {
  const h = harness(); const row = newRow(h); row.querySelector('.row-select-check').checked = true;
  await h.run('deleteSelectedReportRows()'); assert.equal(h.requests.length, 0); assert.equal(h.body.rows.length, 0);
  const cancelled = harness({ confirm: false }); const existing = cancelled.add(trip(), { selected: true });
  await cancelled.run('deleteSelectedReportRows()'); assert.equal(cancelled.requests.length, 0); assert.equal(cancelled.body.rows[0], existing);
});

test('partial reorder save retries every remaining row after moved row is confirmed', async () => {
  const h = harness();
  const moved = h.add(trip({ id: 'moved', admin_sort_order: 3, start_at: '2026-10-03T00:00:11Z', end_at: '2026-10-03T01:00:22Z', start_odometer: 120, end_odometer: 130 }), { reordered: true });
  const next = h.add(trip({ id: 'next', admin_sort_order: 1 }));
  const last = h.add(trip({ id: 'last', admin_sort_order: 2, start_at: '2026-10-02T00:00:11Z', end_at: '2026-10-02T01:00:22Z', start_odometer: 110, end_odometer: 120 }));
  h.respond(req => { if (req.url.includes('next')) throw Error('Second reordered row failed'); return [{ ...req.payload, id: 'moved' }]; });
  await h.run('saveReportEdits()');
  assertPromoted(moved, 'moved'); assert(next.classList.contains('changed')); assert(last.classList.contains('changed'));
  assert.equal(h.reloads(), 0);
  h.respond(req => [{ ...req.payload, id: decodeURIComponent(req.url.split('id=eq.')[1] || '') }]);
  await h.run('saveReportEdits()');
  assert.deepEqual(h.requests.map(r => r.payload.admin_sort_order), [1, 2, 2, 3]);
  assert.equal(h.requests.filter(r => r.url.includes('moved')).length, 1);
  for (const row of [moved, next, last]) assert(!row.classList.contains('changed'));
  assert.equal(h.state().trips.find(t => t.id === 'last').admin_sort_order, 3);
  assert.equal(h.reloads(), 1);
});

test('missing or mismatched save confirmation does not falsely mark a row saved', async () => {
  for (const response of [[], [{ id: 'someone-else' }], null]) {
    const h = harness(); const row = newRow(h); const id = row.dataset.clientTripId;
    h.respond(() => response); await h.run('saveReportEdits()');
    assert.equal(row.dataset.new, '1'); assert.equal(row.dataset.clientTripId, id);
    assert(row.classList.contains('changed')); assert.equal(h.reloads(), 0);
    assert.equal(h.elements.saveReportEditsButton.disabled, false);
  }
});

test('deleting an ambiguously saved new row removes its stable ID on the server', async () => {
  const h = harness(); const row = newRow(h); const id = row.dataset.clientTripId; const database = new Map();
  h.respond(req => { database.set(req.payload.id, clone(req.payload)); throw Error('Response lost after commit'); });
  await h.run('saveReportEdits()'); assert.equal(row.dataset.saveAttempted, '1'); assert(database.has(id));
  row.querySelector('.row-select-check').checked = true;
  h.respond(req => { assert.equal(req.method, 'DELETE'); assert(req.url.includes(id)); database.delete(id); return []; });
  await h.run('deleteSelectedReportRows()'); assert.equal(database.size, 0); assert.equal(h.body.rows.length, 0); assert.equal(h.reloads(), 0);
});

test('in-flight save locks controls and rejects overlapping add/save/delete mutations', async () => {
  const h = harness(); const row = newRow(h); let finish;
  const barrier = new Promise(resolve => { finish = resolve; });
  const previouslyDisabled = row.querySelector('.edit-destination'); previouslyDisabled.disabled = true;
  h.respond(async req => { await barrier; return [{ ...req.payload }]; });
  const pending = h.run('saveReportEdits()');
  assert.equal(h.requests.length, 1); assert.equal(h.elements.saveReportEditsButton.disabled, true);
  assert(row.controls.every(c => c.disabled));
  h.run('addReportRow()'); await h.run('saveReportEdits()');
  row.querySelector('.row-select-check').checked = true; await h.run('deleteSelectedReportRows()');
  assert.equal(h.body.rows.length, 1); assert.equal(h.requests.length, 1);
  finish(); await pending;
  assert.equal(h.elements.saveReportEditsButton.disabled, false); assert.equal(previouslyDisabled.disabled, true);
  assert.equal(row.querySelector('.edit-note').disabled, false);
});

(async () => {
  let failures = 0;
  for (const { name, fn } of tests) {
    try { await fn(); console.log('PASS:', name); }
    catch (error) { failures++; console.error('FAIL:', name); console.error(error.stack || error); }
  }
  console.log(`Report editor: ${tests.length - failures}/${tests.length} tests passed (no live network).`);
  if (failures) process.exitCode = 1;
})();
