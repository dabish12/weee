'use strict';
/* DDEO-SRATMS frontend. All DOM is built with h()/textContent; user data is never inserted as HTML. */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
let csrf = '', me = null;
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, { method, credentials: 'same-origin', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-Token': csrf }, body: body ? JSON.stringify(body) : undefined });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  const data = isJson ? await res.json() : await res.text();
  if (res.ok && !isJson && !path.startsWith('/roster')) { const e = new Error('The server did not return API data. Is the backend running at this address?'); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error(data.error || 'Request failed.'); e.code = data.code; e.status = res.status; throw e; }
  return data;
}
function toast(msg, bad) { const t = h('div', { class: 'toast' + (bad ? ' err' : '') }, msg); $('#toasts').append(t); setTimeout(() => t.remove(), 5000); }
const fail = (e) => { if (e.code === 'UNAUTHENTICATED') return start(); if (e.code === 'PASSWORD_CHANGE_REQUIRED') return start(); toast(e.message, true); };
const run = (fn) => async (ev) => { const b = ev && ev.currentTarget; if (b && b.disabled !== undefined) b.disabled = true; try { await fn(ev); } catch (e) { fail(e); } finally { if (b && b.disabled !== undefined) b.disabled = false; } };

function confirmDlg(message, okText = 'Confirm') {
  return new Promise((resolve) => {
    const d = $('#dlg');
    d.replaceChildren(h('p', {}, message), h('div', { class: 'row' },
      h('button', { class: 'ghost', onclick: () => { d.close(); resolve(false); } }, 'Cancel'),
      h('button', { onclick: () => { d.close(); resolve(true); } }, okText)));
    d.showModal();
  });
}
function notice(title, text) {
  const d = $('#dlg');
  d.replaceChildren(h('h3', {}, title), h('p', {}, text), h('button', { onclick: () => d.close() }, 'Close'));
  d.showModal();
}
function promptDlg(title, fields) {
  return new Promise((resolve) => {
    const d = $('#dlg'); const inputs = fields.map((f) => h('input', { id: 'pd-' + f.name, required: true, autocomplete: 'off' }));
    d.replaceChildren(h('h3', {}, title), ...fields.map((f, i) => h('label', {}, f.label, inputs[i])),
      h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => { d.close(); resolve(null); } }, 'Cancel'),
        h('button', { onclick: () => { const o = {}; fields.forEach((f, i) => (o[f.name] = inputs[i].value.trim())); if (Object.values(o).some((v) => !v)) return; d.close(); resolve(o); } }, 'Save')));
    d.showModal();
  });
}
const field = (label, input, hint) => h('label', {}, label, input, hint && h('span', { class: 'hint' }, hint));
const select = (name, opts, val) => h('select', { name }, opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(val) }, t)));
const fd = (form) => Object.fromEntries(new FormData(form));
const table = (cols, rows, empty = 'Nothing here yet.') => rows.length
  ? h('div', { class: 'tablewrap' }, h('table', {}, h('thead', {}, h('tr', {}, cols.map((c) => h('th', { scope: 'col' }, c.t)))), h('tbody', {}, rows.map((r) => h('tr', {}, cols.map((c) => h('td', {}, c.f(r))))))))
  : h('p', { class: 'empty' }, empty);
const badge = (t, cls = '') => h('span', { class: 'badge ' + cls }, t);
const ROLE = { super_admin: 'Education Office', school_admin: 'School administrator', homeroom_teacher: 'Homeroom teacher', subject_teacher: 'Subject teacher', student: 'Student' };

/* ---------- shell ---------- */
const NAV = {
  super_admin: [['dashboard', 'Dashboard'], ['schools', 'Schools'], ['settings', 'Academic rules'], ['audit', 'Audit log']],
  school_admin: [['dashboard', 'Dashboard'], ['students', 'Students'], ['setup', 'School setup'], ['review', 'Review marks'], ['results', 'Results'], ['audit', 'Audit log']],
  homeroom_teacher: [['students', 'Class roster'], ['results', 'Class results']],
  subject_teacher: [['marks', 'Enter marks']],
  student: [['mine', 'My results']],
};
const VIEWS = {};
async function go(name) {
  const main = $('#main'); main.replaceChildren(h('p', { class: 'loading' }, 'Loading…'));
  document.querySelectorAll('button.nav').forEach((b) => b.removeAttribute('aria-current'));
  document.querySelectorAll('button.nav').forEach((b) => { if (b.dataset.v === name) b.setAttribute('aria-current', 'page'); });
  try { const node = await VIEWS[name](); main.replaceChildren(node); main.focus(); } catch (e) { main.replaceChildren(h('p', { class: 'err-text' }, e.message)); fail(e); }
}
function shell() {
  const items = NAV[me.role];
  $('#app').replaceChildren(h('div', { class: 'shell' },
    h('aside', { class: 'side' }, h('div', { class: 'flagbar' }), h('div', { class: 'brand' }, 'Dembi Dollo Education Office'),
      h('nav', { 'aria-label': 'Main' }, items.map(([v, t]) => h('button', { class: 'nav', 'data-v': v, onclick: () => go(v) }, t))),
      h('div', { class: 'who' }, h('div', {}, me.fullName), h('div', {}, ROLE[me.role]), h('button', { class: 'ghost small', onclick: run(async () => { await api('/auth/logout', { method: 'POST' }); me = null; start(); }) }, 'Sign out'))),
    h('main', { id: 'main', tabindex: '-1' })));
  go(items[0][0]);
}

/* ---------- login / password ---------- */
function loginView() {
  const err = h('p', { class: 'err-text', role: 'alert' });
  $('#app').replaceChildren(h('div', { class: 'login' }, h('div', { class: 'flagbar' }), h('div', { class: 'body' },
    h('h1', {}, 'Student Records'), h('p', { class: 'sub' }, 'Dembi Dollo Education Office, Oromia'),
    h('form', { onsubmit: run(async (ev) => {
      ev.preventDefault(); err.textContent = '';
      try { const r = await api('/auth/login', { method: 'POST', body: fd(ev.target) }); csrf = r.csrf; me = r.user; start(); } catch (e) { err.textContent = e.message; }
    }) }, field('Username', h('input', { name: 'username', autocomplete: 'username', required: true })), h('p'),
    field('Password', h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true })), err, h('button', { type: 'submit' }, 'Sign in')))));
}
function passwordView() {
  const err = h('p', { class: 'err-text', role: 'alert' });
  $('#app').replaceChildren(h('div', { class: 'login' }, h('div', { class: 'flagbar' }), h('div', { class: 'body' },
    h('h1', {}, 'Set a new password'), h('p', { class: 'sub' }, 'You must change your temporary password before continuing.'),
    h('form', { onsubmit: run(async (ev) => {
      ev.preventDefault(); err.textContent = ''; const v = fd(ev.target);
      if (v.next !== v.again) { err.textContent = 'The new passwords do not match.'; return; }
      try { await api('/auth/change-password', { method: 'POST', body: { current: v.current, next: v.next } }); me.mustChangePassword = false; toast('Password changed.'); start(); } catch (e) { err.textContent = e.message; }
    }) }, field('Current password', h('input', { name: 'current', type: 'password', autocomplete: 'current-password', required: true })), h('p'),
    field('New password', h('input', { name: 'next', type: 'password', autocomplete: 'new-password', required: true }), 'At least 10 characters with upper case, lower case and a number.'), h('p'),
    field('Repeat new password', h('input', { name: 'again', type: 'password', autocomplete: 'new-password', required: true })), err, h('button', { type: 'submit' }, 'Save password')))));
}

/* ---------- shared data ---------- */
const cache = {};
const load = async (k) => (cache[k] ||= await api('/' + k));
const reload = (k) => { delete cache[k]; return load(k); };
const yearOpts = async () => (await load('years')).map((y) => [y.id, y.label + (y.is_current ? ' (current)' : '')]);
const sectionOpts = async (grade) => (await load('sections')).filter((s) => !grade || s.grade === Number(grade)).map((s) => [s.id, `Grade ${s.grade}${s.name}`]);
const currentYear = async () => { const y = await load('years'); return (y.find((v) => v.is_current) || y[y.length - 1] || {}).id; };

/* ---------- views ---------- */
VIEWS.dashboard = async () => {
  const s = await api('/stats');
  const cards = me.role === 'super_admin' ? [['Schools', s.schools], ['Active students', s.students], ['Teachers', s.teachers]] : [['Active students', s.students], ['Teachers', s.teachers], ['Mark sheets awaiting approval', s.pendingApprovals]];
  return h('div', {}, h('h1', {}, 'Dashboard'), h('div', { class: 'stats' }, cards.map(([t, n]) => h('div', { class: 'stat' }, h('b', {}, n), h('span', {}, t)))),
    s.bySchool && h('div', {}, h('h2', {}, 'Enrolment by school'), table([{ t: 'School', f: (r) => r.name }, { t: 'Active students', f: (r) => r.students }], s.bySchool, 'No schools are registered yet.')));
};

VIEWS.schools = async () => {
  const rows = await api('/schools'); const root = h('div', {});
  const form = h('form', { class: 'row', onsubmit: run(async (ev) => { ev.preventDefault(); await api('/schools', { method: 'POST', body: fd(ev.target) }); toast('School registered.'); go('schools'); }) },
    field('School code', h('input', { name: 'code', required: true })), field('School name', h('input', { name: 'name', required: true })), field('Woreda', h('input', { name: 'woreda' })), h('button', { type: 'submit' }, 'Register school'));
  root.append(h('h1', {}, 'Schools'), h('div', { class: 'card' }, form), table([
    { t: 'Code', f: (r) => r.code }, { t: 'School', f: (r) => r.name }, { t: 'Woreda', f: (r) => r.woreda || '' }, { t: 'Students', f: (r) => r.active_students },
    { t: 'Status', f: (r) => badge(r.status, r.status === 'active' ? '' : 'bad') },
    { t: 'Actions', f: (r) => h('div', { class: 'row' },
      h('button', { class: 'ghost small', onclick: run(async () => { const v = await promptDlg('Add school administrator', [{ name: 'fullName', label: 'Full name' }, { name: 'username', label: 'Username' }]); if (!v) return; const o = await api(`/schools/${r.id}/admin`, { method: 'POST', body: v }); notice('Administrator created', `Temporary password (shown once): ${o.temporaryPassword}`); }) }, 'Add administrator'),
      h('button', { class: 'ghost small', onclick: run(async () => { const next = r.status === 'active' ? 'suspended' : 'active'; if (!(await confirmDlg(`Set ${r.name} to ${next}? Its users ${next === 'active' ? 'will be able' : 'will no longer be able'} to sign in.`))) return; await api(`/schools/${r.id}/status`, { method: 'PATCH', body: { status: next } }); go('schools'); }) }, r.status === 'active' ? 'Suspend' : 'Activate')) }], rows, 'Register the first school above.'));
  return root;
};

VIEWS.settings = async () => {
  const cfg = await api('/config');
  const defs = [['ranking_method', 'Ranking tie method', '"competition" (1,2,2,4) or "dense" (1,2,2,3)'], ['grading_scale', 'Grading scale', '[{"min": 0, "grade": "…"}, …] using the officially approved bands'],
    ['promotion_rule', 'Promotion rule (Grades 9–11)', '{"passMark": …, "maxFailedSubjects": …, "minAverage": …}'], ['graduation_rule', 'Graduation rule (Grade 12)', '{"minAverage": …}']];
  return h('div', {}, h('h1', {}, 'Academic rules'), h('p', { class: 'hint' }, 'Enter only values from the officially approved policy. Until a rule is set, results that depend on it show as unconfigured.'),
    defs.map(([k, t, ex]) => { const ta = h('textarea', { 'aria-label': t, placeholder: ex }); if (cfg[k] !== undefined) ta.value = JSON.stringify(cfg[k], null, 2);
      return h('div', { class: 'card' }, h('h3', {}, t), ta, h('p'), h('button', { onclick: run(async () => { let v; try { v = JSON.parse(ta.value); } catch { throw new Error('This is not valid JSON.'); } await api(`/config/${k}`, { method: 'PUT', body: { value: v } }); toast(`${t} saved.`); }) }, 'Save')); }));
};

VIEWS.audit = async () => table([{ t: 'When', f: (r) => new Date(r.created_at).toLocaleString() }, { t: 'Action', f: (r) => r.action }, { t: 'Record', f: (r) => [r.entity, r.entity_id].filter(Boolean).join(' #') }, { t: 'User ID', f: (r) => r.user_id }], await api('/audit'), 'No activity recorded yet.');

/* students / roster */
VIEWS.students = async () => {
  const root = h('div', {}); const isAdmin = me.role === 'school_admin';
  const years = await yearOpts(); if (!years.length) return h('p', { class: 'empty' }, 'No academic year exists yet. Ask the school administrator to create one in School setup.');
  const f = { yearId: await currentYear(), grade: '', sectionId: '', status: 'active', q: '', sort: 'name', page: 1 };
  const out = h('div', {}); const filters = h('form', { class: 'row', onsubmit: (ev) => { ev.preventDefault(); Object.assign(f, fd(ev.target), { page: 1 }); draw(); } },
    field('Academic year', select('yearId', years, f.yearId)), field('Grade', select('grade', [['', 'All'], ...[9, 10, 11, 12].map((g) => [g, 'Grade ' + g])], '')),
    field('Section', select('sectionId', [['', 'All'], ...(await sectionOpts())], '')), field('Status', select('status', [['', 'All'], ['active', 'Active'], ['transferred', 'Transferred'], ['withdrawn', 'Withdrawn'], ['graduated', 'Graduated']], 'active')),
    field('Search', h('input', { name: 'q', type: 'search' })), field('Sort by', select('sort', [['name', 'Name'], ['code', 'Student ID'], ['section', 'Section']], 'name')), h('button', { type: 'submit' }, 'Apply'));
  const qs = (extra = {}) => new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v !== '' && v != null)).toString();
  async function draw() {
    out.replaceChildren(h('p', { class: 'loading' }, 'Loading…'));
    try {
      const d = await api('/roster?' + qs({ pageSize: 25 })); const pages = Math.max(1, Math.ceil(d.total / d.pageSize));
      out.replaceChildren(table([{ t: 'Student ID', f: (r) => r.student_code }, { t: 'Name', f: (r) => [r.first_name, r.father_name, r.grandfather_name].filter(Boolean).join(' ') }, { t: 'Sex', f: (r) => r.sex },
        { t: 'Class', f: (r) => `Grade ${r.grade}${r.section}` }, { t: 'Status', f: (r) => badge(r.status, r.status === 'active' ? '' : 'warn') },
        ...(isAdmin ? [{ t: 'Actions', f: (r) => h('div', { class: 'row' },
          h('button', { class: 'ghost small', onclick: () => go2('transcript', r.id) }, 'Transcript'),
          h('button', { class: 'ghost small', onclick: run(async () => { const v = await promptDlg('Record a status change', [{ name: 'event', label: 'Event: transfer, withdrawal, graduation or reactivation' }, { name: 'note', label: 'Note' }]); if (!v) return; await api(`/students/${r.id}/status`, { method: 'POST', body: v }); draw(); }) }, 'Status'),
          h('button', { class: 'ghost small', onclick: run(async () => { const o = await api(`/students/${r.id}/account`, { method: 'POST' }); notice('Student account created', `Username: ${o.username}\nTemporary password (shown once): ${o.temporaryPassword}`); }) }, 'Login')) }] : [])], d.rows, 'No students match these filters.'),
        h('div', { class: 'pager' }, h('button', { class: 'ghost small', disabled: f.page <= 1, onclick: () => { f.page--; draw(); } }, 'Previous'), h('span', {}, `Page ${f.page} of ${pages} · ${d.total} students`),
          h('button', { class: 'ghost small', disabled: f.page >= pages, onclick: () => { f.page++; draw(); } }, 'Next'),
          h('a', { href: '/api/roster?' + qs({ format: 'csv' }), class: 'noprint' }, 'Download CSV'), h('button', { class: 'ghost small noprint', onclick: () => window.print() }, 'Print')));
    } catch (e) { out.replaceChildren(h('p', { class: 'err-text' }, e.message)); }
  }
  root.append(h('h1', {}, me.role === 'school_admin' ? 'Students' : 'Class roster'), h('div', { class: 'card' }, filters));
  if (isAdmin) root.append(await studentForm(() => draw()));
  root.append(out); draw(); return root;
};
async function studentForm(done) {
  const form = h('form', { class: 'row', onsubmit: run(async (ev) => {
    ev.preventDefault(); const v = fd(ev.target);
    const body = { studentCode: v.studentCode, firstName: v.firstName, fatherName: v.fatherName, grandfatherName: v.grandfatherName || undefined, sex: v.sex, dateOfBirth: v.dateOfBirth };
    if (v.sectionId) { body.sectionId = Number(v.sectionId); body.academicYearId = Number(v.academicYearId); }
    try { await api('/students', { method: 'POST', body }); }
    catch (e) { if (e.code !== 'POSSIBLE_DUPLICATE') throw e; if (!(await confirmDlg(e.message, 'This is a different student'))) return; await api('/students', { method: 'POST', body: { ...body, confirmPossibleDuplicate: true } }); }
    toast('Student registered.'); ev.target.reset(); done();
  }) }, field('Student ID', h('input', { name: 'studentCode', required: true })), field('First name', h('input', { name: 'firstName', required: true })), field('Father’s name', h('input', { name: 'fatherName', required: true })),
    field('Grandfather’s name', h('input', { name: 'grandfatherName' })), field('Sex', select('sex', [['M', 'Male'], ['F', 'Female']])), field('Date of birth', h('input', { name: 'dateOfBirth', type: 'date', required: true })),
    field('Academic year', select('academicYearId', await yearOpts())), field('Section', select('sectionId', [['', 'Enrol later'], ...(await sectionOpts())])), h('button', { type: 'submit' }, 'Register student'));
  return h('details', { class: 'card' }, h('summary', {}, 'Register a new student'), h('p'), form);
}

/* school setup */
VIEWS.setup = async () => {
  const tabs = ['Years', 'Sections', 'Subjects', 'Teachers', 'Assignments', 'Assessment weights']; const body = h('div', {}); const bar = h('div', { class: 'tabs', role: 'tablist' });
  async function show(i) {
    bar.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
    body.replaceChildren(h('p', { class: 'loading' }, 'Loading…')); try { body.replaceChildren(await SETUP[i]()); } catch (e) { body.replaceChildren(h('p', { class: 'err-text' }, e.message)); }
  }
  tabs.forEach((t, i) => bar.append(h('button', { role: 'tab', onclick: () => show(i) }, t))); show(0);
  return h('div', {}, h('h1', {}, 'School setup'), bar, body);
};
const simple = (key, label, cols, inputs) => async () => {
  const rows = await reload(key);
  const form = h('form', { class: 'row', onsubmit: run(async (ev) => { ev.preventDefault(); const v = fd(ev.target); await api('/' + key, { method: 'POST', body: inputs.post(v) }); toast(label + ' added.'); await reload(key); go('setup'); }) }, inputs.fields, h('button', { type: 'submit' }, 'Add'));
  return h('div', {}, h('div', { class: 'card' }, form), table(cols, rows));
};
const SETUP = [
  simple('years', 'Academic year', [{ t: 'Year', f: (r) => r.label }, { t: 'Current', f: (r) => (r.is_current ? badge('Current') : '') }],
    { fields: [field('Label', h('input', { name: 'label', placeholder: 'e.g. 2018', required: true })), h('label', {}, 'Current year', h('input', { name: 'is_current', type: 'checkbox' }))], post: (v) => ({ label: v.label, is_current: v.is_current === 'on' }) }),
  simple('sections', 'Section', [{ t: 'Grade', f: (r) => r.grade }, { t: 'Section', f: (r) => r.name }, { t: 'Stream', f: (r) => r.stream.replace('_', ' ') }],
    { fields: [field('Grade', select('grade', [9, 10, 11, 12].map((g) => [g, g]))), field('Section name', h('input', { name: 'name', required: true })), field('Stream', select('stream', [['none', 'None (Grades 9–10)'], ['natural_science', 'Natural Science'], ['social_science', 'Social Science']]))], post: (v) => ({ grade: Number(v.grade), name: v.name, stream: v.stream }) }),
  simple('subjects', 'Subject', [{ t: 'Subject', f: (r) => r.name }, { t: 'Grade', f: (r) => r.grade }, { t: 'Stream', f: (r) => r.stream.replace('_', ' ') }],
    { fields: [field('Subject name', h('input', { name: 'name', required: true })), field('Grade', select('grade', [9, 10, 11, 12].map((g) => [g, g]))), field('Stream', select('stream', [['none', 'All students'], ['natural_science', 'Natural Science'], ['social_science', 'Social Science']]))], post: (v) => ({ name: v.name, grade: Number(v.grade), stream: v.stream }) }),
  async () => {
    const rows = await api('/users');
    const form = h('form', { class: 'row', onsubmit: run(async (ev) => { ev.preventDefault(); const o = await api('/users', { method: 'POST', body: fd(ev.target) }); notice('Teacher account created', `Temporary password (shown once): ${o.temporaryPassword}`); cache.users = null; go('setup'); }) },
      field('Full name', h('input', { name: 'fullName', required: true })), field('Username', h('input', { name: 'username', required: true })), field('Role', select('role', [['subject_teacher', 'Subject teacher'], ['homeroom_teacher', 'Homeroom teacher']])), h('button', { type: 'submit' }, 'Create account'));
    return h('div', {}, h('div', { class: 'card' }, form), table([{ t: 'Name', f: (r) => r.full_name }, { t: 'Username', f: (r) => r.username }, { t: 'Role', f: (r) => ROLE[r.role] }, { t: 'Status', f: (r) => badge(r.status, r.status === 'active' ? '' : 'bad') },
      { t: 'Actions', f: (r) => (['school_admin', 'student'].includes(r.role) ? '' : h('div', { class: 'row' },
        h('button', { class: 'ghost small', onclick: run(async () => { if (!(await confirmDlg(`Reset the password for ${r.full_name}?`))) return; const o = await api(`/users/${r.id}/reset-password`, { method: 'POST' }); notice('Password reset', `Temporary password (shown once): ${o.temporaryPassword}`); }) }, 'Reset password'),
        h('button', { class: 'ghost small', onclick: run(async () => { await api(`/users/${r.id}/status`, { method: 'PATCH', body: { status: r.status === 'active' ? 'suspended' : 'active' } }); go('setup'); }) }, r.status === 'active' ? 'Suspend' : 'Activate'))) }], rows));
  },
  async () => {
    const [rows, users, years, sections, subjects] = await Promise.all([api('/assignments'), api('/users'), yearOpts(), sectionOpts(), load('subjects')]);
    const teachers = users.filter((u) => ['subject_teacher', 'homeroom_teacher'].includes(u.role)).map((u) => [u.id, u.full_name]);
    const form = h('form', { class: 'row', onsubmit: run(async (ev) => { ev.preventDefault(); const v = fd(ev.target); const home = v.kind === 'homeroom';
      await api('/assignments', { method: 'POST', body: { academicYearId: Number(v.yearId), teacherId: Number(v.teacherId), sectionId: Number(v.sectionId), subjectId: home ? null : Number(v.subjectId), isHomeroom: home } }); toast('Assignment saved.'); go('setup'); }) },
      field('Year', select('yearId', years)), field('Teacher', select('teacherId', teachers)), field('Section', select('sectionId', sections)), field('Type', select('kind', [['subject', 'Subject teacher'], ['homeroom', 'Homeroom teacher']])),
      field('Subject', select('subjectId', subjects.map((s) => [s.id, `${s.name} (G${s.grade})`])), 'Ignored for homeroom'), h('button', { type: 'submit' }, 'Assign'));
    return h('div', {}, h('div', { class: 'card' }, form), table([{ t: 'Teacher', f: (r) => r.teacher }, { t: 'Class', f: (r) => `Grade ${r.grade}${r.section}` }, { t: 'Role', f: (r) => (r.is_homeroom ? 'Homeroom' : r.subject) }], rows));
  },
  async () => {
    const years = await yearOpts(); const box = h('div', {}); let comps = [{ name: 'Test', weight: 0, max_score: 10 }];
    const sel = { yearId: await currentYear(), semester: 1, grade: 9 };
    const form = h('form', { class: 'row', onsubmit: (ev) => { ev.preventDefault(); Object.assign(sel, fd(ev.target)); fetchComps(); } }, field('Year', select('yearId', years, sel.yearId)), field('Semester', select('semester', [[1, 'Semester I'], [2, 'Semester II']])), field('Grade', select('grade', [9, 10, 11, 12].map((g) => [g, g]))), h('button', { type: 'submit' }, 'Load'));
    async function fetchComps() { const r = await api(`/components?yearId=${sel.yearId}&semester=${sel.semester}&grade=${sel.grade}`); comps = r.length ? r.map(({ name, weight, max_score }) => ({ name, weight, max_score })) : [{ name: 'Test', weight: 0, max_score: 10 }]; drawComps(); }
    function drawComps() {
      const total = comps.reduce((s, c) => s + Math.round(Number(c.weight || 0) * 100), 0) / 100;
      box.replaceChildren(h('div', { class: 'tablewrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Component', 'Weight (%)', 'Maximum score', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, comps.map((c, i) => h('tr', {}, h('td', {}, h('input', { value: c.name, 'aria-label': 'Component name', oninput: (e) => (c.name = e.target.value) })),
          h('td', {}, h('input', { type: 'number', step: '0.01', value: c.weight, 'aria-label': 'Weight', oninput: (e) => { c.weight = Number(e.target.value); updTotal(); } })),
          h('td', {}, h('input', { type: 'number', step: '0.01', value: c.max_score, 'aria-label': 'Maximum score', oninput: (e) => (c.max_score = Number(e.target.value)) })),
          h('td', {}, h('button', { class: 'ghost small', onclick: () => { comps.splice(i, 1); drawComps(); } }, 'Remove'))))))),
        h('p', { id: 'wt' }, `Total weight: ${total}%`), h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => { comps.push({ name: '', weight: 0, max_score: 10 }); drawComps(); } }, 'Add component'),
          h('button', { onclick: run(async () => { await api('/components', { method: 'PUT', body: { academicYearId: Number(sel.yearId), semester: Number(sel.semester), grade: Number(sel.grade), components: comps } }); toast('Assessment weights saved.'); }) }, 'Save weights')));
    }
    const updTotal = () => { const t = comps.reduce((s, c) => s + Math.round(Number(c.weight || 0) * 100), 0) / 100; $('#wt').textContent = `Total weight: ${t}%${t === 100 ? '' : ' (must be exactly 100%)'}`; };
    fetchComps(); return h('div', {}, h('div', { class: 'card' }, form), box);
  },
];

/* mark entry (subject teacher) and review (admin) */
async function sheetView(sel, mode) {
  const d = await api(`/marksheet?${new URLSearchParams(sel)}`); const vals = {}; d.marks.forEach((m) => (vals[`${m.student_id}:${m.component_id}`] = m.score));
  if (!d.components.length) return h('p', { class: 'err-text' }, 'No assessment weights are set for this grade and semester. Ask the school administrator.');
  const editable = mode === 'teacher' && d.sheet.status === 'draft';
  const inputs = [];
  const tbl = table([{ t: 'Student', f: (s) => `${s.first_name} ${s.father_name} (${s.student_code})` }, ...d.components.map((c) => ({ t: `${c.name} /${c.max_score}`, f: (s) => {
    const key = `${s.id}:${c.id}`; if (!editable) return vals[key] ?? '–';
    const i = h('input', { class: 'mark', type: 'number', min: '0', max: c.max_score, step: '0.01', value: vals[key] ?? '', 'aria-label': `${c.name} for ${s.first_name}` }); inputs.push({ i, s, c }); return i; } }))], d.students, 'No active students are enrolled in this class.');
  const collect = () => inputs.filter((x) => x.i.value !== '').map((x) => { const n = Number(x.i.value); if (n < 0 || n > Number(x.c.max_score)) throw new Error(`${x.c.name} for ${x.s.first_name}: enter a score from 0 to ${x.c.max_score}.`); return { studentId: x.s.id, componentId: x.c.id, score: n }; });
  const body = (extra) => ({ ...Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, Number(v)])), ...extra });
  const act = [];
  if (editable) act.push(h('button', { onclick: run(async () => { const entries = collect(); if (!entries.length) return toast('Enter at least one mark.', true); await api('/marksheet/marks', { method: 'PUT', body: body({ entries }) }); toast('Draft saved.'); }) }, 'Save draft'),
    h('button', { class: 'ghost', onclick: run(async () => { const entries = collect(); if (!(await confirmDlg('Submit these marks for review? You cannot edit them afterwards.', 'Submit'))) return; if (entries.length) await api('/marksheet/marks', { method: 'PUT', body: body({ entries }) }); await api('/marksheet/submit', { method: 'POST', body: body({}) }); toast('Submitted for review.'); go('marks'); }) }, 'Submit for review'));
  if (mode === 'review' && d.sheet.status === 'submitted') act.push(h('button', { onclick: run(async () => { if (!(await confirmDlg('Approve and seal these marks?', 'Approve'))) return; await api('/marksheet/approve', { method: 'POST', body: body({}) }); toast('Approved.'); go('review'); }) }, 'Approve'),
    h('button', { class: 'danger', onclick: run(async () => { await api('/marksheet/return', { method: 'POST', body: body({}) }); toast('Returned to the teacher.'); go('review'); }) }, 'Return to teacher'));
  return h('div', {}, h('p', {}, 'Status: ', badge(d.sheet.status, d.sheet.status === 'draft' ? 'warn' : '')), tbl, h('div', { class: 'row' }, act));
}
VIEWS.marks = async () => {
  const a = (await api('/assignments')).filter((x) => !x.is_homeroom); if (!a.length) return h('p', { class: 'empty' }, 'You have no subject assignments yet. Ask the school administrator.');
  const out = h('div', {});
  const form = h('form', { class: 'row', onsubmit: run(async (ev) => { ev.preventDefault(); const v = fd(ev.target); const x = a[Number(v.a)];
    out.replaceChildren(await sheetView({ yearId: x.academic_year_id, semester: v.semester, sectionId: x.section_id, subjectId: x.subject_id }, 'teacher')); }) },
    field('Class and subject', select('a', a.map((x, i) => [i, `Grade ${x.grade}${x.section} – ${x.subject}`]))), field('Semester', select('semester', [[1, 'Semester I'], [2, 'Semester II']])), h('button', { type: 'submit' }, 'Open mark sheet'));
  return h('div', {}, h('h1', {}, 'Enter marks'), h('div', { class: 'card' }, form), out);
};
VIEWS.review = async () => {
  const [years, sections, subjects] = await Promise.all([yearOpts(), sectionOpts(), load('subjects')]); const out = h('div', {});
  const form = h('form', { class: 'row', onsubmit: run(async (ev) => { ev.preventDefault(); const v = fd(ev.target); out.replaceChildren(await sheetView(v, 'review')); }) },
    field('Year', select('yearId', years)), field('Semester', select('semester', [[1, 'Semester I'], [2, 'Semester II']])), field('Section', select('sectionId', sections)), field('Subject', select('subjectId', subjects.map((s) => [s.id, `${s.name} (G${s.grade})`]))), h('button', { type: 'submit' }, 'Open sheet'));
  return h('div', {}, h('h1', {}, 'Review marks'), h('div', { class: 'card' }, form), out);
};

/* results */
VIEWS.results = async () => {
  const [years, sections] = await Promise.all([yearOpts(), sectionOpts()]); const out = h('div', {});
  async function show(v) { const r = await api(`/results/annual?yearId=${v.yearId}&sectionId=${v.sectionId}`);
    out.replaceChildren(table([{ t: 'Rank', f: (x) => x.class_rank }, { t: 'Student', f: (x) => `${x.first_name} ${x.father_name} (${x.student_code})` }, { t: 'Total', f: (x) => x.total }, { t: 'Average', f: (x) => x.average }, { t: 'Decision', f: (x) => badge(x.decision, x.decision === 'UNCONFIGURED' ? 'warn' : '') }], r, 'No annual results have been computed for this class.')); }
  const form = h('form', { class: 'row', onsubmit: run(async (ev) => { ev.preventDefault(); await show(fd(ev.target)); }) }, field('Year', select('yearId', years)), field('Section', select('sectionId', sections)), h('button', { type: 'submit' }, 'Show results'));
  const compute = me.role === 'school_admin' && h('button', { class: 'ghost', onclick: run(async () => { const v = fd(form); if (!(await confirmDlg('Compute annual results from approved Semester I and II marks?', 'Compute'))) return; const o = await api('/results/annual/compute', { method: 'POST', body: { academicYearId: Number(v.yearId), sectionId: Number(v.sectionId) } }); toast(`Computed for ${o.computed} students.`); await show(v); }) }, 'Compute annual results');
  return h('div', {}, h('h1', {}, 'Results'), h('div', { class: 'card' }, form, compute && h('p'), compute), out);
};

/* transcript */
function transcriptDoc(t, issued) {
  const s = t.student;
  return h('article', { class: 'doc' }, h('header', {}, h('div', {}, 'Dembi Dollo Education Office · Oromia, Ethiopia'), h('h2', {}, s.school_name), h('div', {}, 'Academic transcript, Grades 9–12')),
    h('div', { class: 'meta' }, h('div', {}, 'Name: ', [s.first_name, s.father_name, s.grandfather_name].filter(Boolean).join(' ')), h('div', {}, 'Student ID: ', s.student_code), h('div', {}, 'Sex: ', s.sex), h('div', {}, 'Date of birth: ', String(s.date_of_birth).slice(0, 10)), h('div', {}, 'Status: ', s.status), issued && h('div', {}, 'Serial: ', issued)),
    t.years.length ? t.years.map((y) => h('section', {}, h('h3', {}, `Grade ${y.grade}${y.section} · ${y.label}`),
      table([{ t: 'Subject', f: (x) => x.subject }, { t: 'Semester I', f: (x) => x.s1 }, { t: 'Semester II', f: (x) => x.s2 }, { t: 'Annual', f: (x) => x.annual }, { t: 'Grade', f: (x) => x.grade || '–' }], y.subjects),
      h('p', {}, `Total ${y.total} · Average ${y.average} · Rank ${y.class_rank} · Decision: ${y.decision}`))) : h('p', { class: 'empty' }, 'No computed annual results yet.'),
    h('p', { class: 'hint' }, 'Authorised signature and stamp: ____________________'));
}
async function go2(view, id) { const main = $('#main'); main.replaceChildren(h('p', { class: 'loading' }, 'Loading…')); try { main.replaceChildren(await VIEWS[view](id)); } catch (e) { fail(e); } }
VIEWS.transcript = async (id) => {
  const t = await api(`/transcripts/student/${id}`); const issued = await api(`/transcripts/student/${id}/issued`); const box = h('div', {});
  box.append(h('div', { class: 'row noprint' }, h('button', { class: 'ghost', onclick: () => go('students') }, 'Back'), h('button', { onclick: () => window.print() }, 'Print / save as PDF'),
    h('button', { class: 'ghost', onclick: run(async () => { if (!(await confirmDlg('Issue an official transcript? A permanent snapshot with a serial number will be recorded.', 'Issue'))) return; const o = await api(`/transcripts/student/${id}/issue`, { method: 'POST' }); notice('Transcript issued', `Serial: ${o.serial}`); go2('transcript', id); }) }, 'Issue official copy')),
    issued.length && h('p', { class: 'hint noprint' }, 'Issued: ' + issued.map((i) => i.serial).join(', ')), transcriptDoc(t));
  return box;
};
VIEWS.mine = async () => h('div', {}, h('div', { class: 'row noprint' }, h('button', { onclick: () => window.print() }, 'Print / save as PDF')), transcriptDoc(await api('/me/results')));

/* ---------- boot ---------- */
function offlineView(msg) {
  $('#app').replaceChildren(h('div', { class: 'login' }, h('div', { class: 'flagbar' }), h('div', { class: 'body' },
    h('h1', {}, 'Cannot reach the server'), h('p', { class: 'sub' }, msg),
    h('p', {}, 'Start the backend (npm run dev in the backend folder) and open the app at http://localhost:3000, not by double-clicking index.html.'),
    h('button', { onclick: () => { $('#app').replaceChildren(h('p', { class: 'loading' }, 'Loading…')); start(); } }, 'Try again'))));
}
async function start() {
  try { const r = await api('/auth/me'); csrf = r.csrf; me = r.user; }
  catch (e) {
    if (!e.status) return offlineView('The page could not connect to the API.');
    if (e.status !== 401) return offlineView(e.message);
    me = null;
  }
  if (!me) return loginView();
  if (me.mustChangePassword) return passwordView();
  shell();
}
start();
