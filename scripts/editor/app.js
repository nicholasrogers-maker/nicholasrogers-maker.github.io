// Local content editor UI. Talks to scripts/editor/server.mjs.
import { marked } from '/vendor/marked.js';

const TOKEN = document.querySelector('meta[name="editor-token"]').content;
const main = document.getElementById('main');
const nav = document.getElementById('nav');

// ------------------------------------------------------------------ helpers

async function api(method, url, body, raw = false) {
  const opts = { method, headers: { 'x-editor-token': TOKEN } };
  if (body !== undefined) {
    if (raw) opts.body = body;
    else {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({ error: `Unexpected response (${r.status})` }));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

let toastTimer;
function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = isErr ? 'err' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), isErr ? 6000 : 2500);
}

// ------------------------------------------------------------------ state

let S = null;
let view = 'profile';
let sub = null; // entry slug, 'new', or null
let dirty = false;
let currentSave = null;

function setDirty(v = true) {
  dirty = v;
  const st = document.getElementById('save-status');
  if (st) {
    st.textContent = dirty ? '● Unsaved changes' : 'All changes saved';
    st.classList.toggle('dirty', dirty);
  }
}
window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && currentSave) {
    e.preventDefault();
    currentSave();
  }
});

function go(v, s = null) {
  if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
  dirty = false;
  view = v;
  sub = s;
  if (s === '__newcert') pendingNew = { slug: '', data: newData('certs'), body: '' };
  render();
  main.focus();
  window.scrollTo(0, 0);
}

async function load() {
  S = await api('GET', '/api/state');
  const link = document.getElementById('site-link');
  if (S.siteUrl) {
    link.href = S.siteUrl;
    link.hidden = false;
  }
}

const SECTIONS = [
  ['profile', 'Profile'],
  ['skills', 'Skills'],
  ['experience', 'Experience'],
  ['roadmap', 'Roadmap'],
  null,
  ['certs', 'Certifications'],
  ['labs', 'Labs'],
  ['blog', 'Blog posts'],
  null,
  ['publish', 'Publish'],
];

function renderNav() {
  const pending = S.git.files.length + (S.git.ahead ? 1 : 0);
  nav.replaceChildren(
    ...SECTIONS.map((s) => {
      if (!s) return h('div', { class: 'sep' });
      const [id, label] = s;
      const count = S[id] && Array.isArray(S[id]) && ['labs', 'blog', 'certs'].includes(id) ? S[id].length : null;
      return h(
        'button',
        { type: 'button', 'aria-current': view === id ? 'page' : null, onclick: () => go(id) },
        label,
        id === 'publish' && pending ? h('span', { class: 'pill' }, S.git.files.length || '↑') : count != null ? h('span', { class: 'count' }, count) : null,
      );
    }),
  );
}

function render() {
  renderNav();
  currentSave = null;
  const views = { profile: viewProfile, skills: viewSkills, experience: viewExperience, roadmap: viewRoadmap, certs: viewEntries, labs: viewEntries, blog: viewEntries, publish: viewPublish };
  main.replaceChildren(...[views[view]()].flat(Infinity).filter(Boolean));
}

// ------------------------------------------------------------------ building blocks

function header(cmd, title, lead) {
  return [h('p', { class: 'prompt' }, h('b', {}, 'editor#'), ' ', cmd), h('h1', {}, title), lead && h('p', { class: 'lead' }, lead)];
}

function field(label, obj, key, o = {}) {
  const type = o.type || 'text';
  const onInput = (e) => {
    let v = type === 'checkbox' ? e.target.checked : e.target.value;
    if (type === 'number') v = e.target.value === '' ? undefined : Number(e.target.value);
    if (o.csv)
      v = e.target.value
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    obj[key] = v;
    setDirty();
    o.onChange?.(v, e.target);
  };
  let input;
  if (type === 'textarea') {
    input = h('textarea', { rows: o.rows || 3, oninput: onInput, placeholder: o.placeholder });
    input.value = obj[key] ?? '';
  } else if (type === 'select') {
    input = h('select', { onchange: onInput }, o.options.map(([v, l]) => h('option', { value: v }, l)));
    input.value = obj[key] ?? '';
  } else if (type === 'checkbox') {
    input = h('input', { type: 'checkbox', onchange: onInput });
    input.checked = !!obj[key];
  } else {
    input = h('input', { type, oninput: onInput, placeholder: o.placeholder });
    input.value = o.csv ? (obj[key] || []).join(', ') : (obj[key] ?? '');
  }
  if (o.id) input.id = o.id;
  if (type === 'checkbox') return h('label', { class: 'field check' + (o.wide ? ' wide' : '') }, input, h('span', {}, label));
  return h(
    'label',
    { class: 'field' + (o.wide ? ' wide' : '') },
    h('span', {}, label, o.required ? h('span', { class: 'req' }, ' *') : null),
    input,
    o.help ? h('small', {}, o.help) : null,
  );
}

function listEditor(arr, renderItem, makeNew, addLabel) {
  const wrap = h('div', { class: 'rows' });
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setDirty();
    draw();
  };
  function draw() {
    wrap.replaceChildren(
      ...arr.map((item, i) =>
        h(
          'div',
          { class: 'row' },
          renderItem(item, i),
          h(
            'div',
            { class: 'row-tools' },
            h('button', { class: 'icon', type: 'button', title: 'Move up', 'aria-label': 'Move up', onclick: () => move(i, -1) }, '↑'),
            h('button', { class: 'icon', type: 'button', title: 'Move down', 'aria-label': 'Move down', onclick: () => move(i, 1) }, '↓'),
            h(
              'button',
              {
                class: 'icon del',
                type: 'button',
                title: 'Remove',
                'aria-label': 'Remove',
                onclick: () => {
                  arr.splice(i, 1);
                  setDirty();
                  draw();
                },
              },
              '✕',
            ),
          ),
        ),
      ),
      h(
        'div',
        {},
        h(
          'button',
          {
            class: 'btn ghost sm',
            type: 'button',
            onclick: () => {
              arr.push(makeNew());
              setDirty();
              draw();
            },
          },
          `+ ${addLabel}`,
        ),
      ),
    );
  }
  draw();
  return wrap;
}

function saveBar(onSave, ...extra) {
  currentSave = onSave;
  const errors = h('p', { class: 'errors', id: 'save-errors' });
  const btn = h('button', { class: 'btn', type: 'button', onclick: onSave }, 'Save');
  return [
    errors,
    h('div', { class: 'savebar' }, h('span', { class: 'status', id: 'save-status' }, 'All changes saved'), ...extra, btn, h('span', { class: 'muted small' }, 'Ctrl+S')),
  ];
}

async function runSave(fn, okMsg = 'Saved') {
  const err = document.getElementById('save-errors');
  if (err) err.textContent = '';
  try {
    await fn();
    dirty = false;
    await load();
    toast(okMsg);
    return true;
  } catch (e) {
    if (err) err.textContent = e.message;
    toast(e.message, true);
    return false;
  }
}

// ------------------------------------------------------------------ profile

const DEFAULT_LINK_IDS = new Set(['linkedin', 'github', 'credly', 'tryhackme', 'hackthebox', 'email']);

function viewProfile() {
  const P = clone(S.profile);
  const save = () =>
    runSave(async () => {
      P.links = P.links.map((l) => ({ ...l, id: DEFAULT_LINK_IDS.has(l.id) ? l.id : slugify(l.label) || l.id }));
      await api('PUT', '/api/profile', P);
    }).then((ok) => ok && render());

  const cvInput = h('input', {
    type: 'file',
    accept: 'application/pdf',
    hidden: true,
    onchange: async () => {
      const f = cvInput.files[0];
      if (!f) return;
      try {
        await api('POST', '/api/upload?kind=cv', f, true);
        await load();
        toast('CV uploaded');
        render();
      } catch (e) {
        toast(e.message, true);
      }
    },
  });

  return [
    header('show running-config | section profile', 'Profile', 'Your name, headline and contact details. These appear on every page, the boot screen and the CLI.'),
    h(
      'div',
      { class: 'card grid' },
      field('Name', P, 'name', { required: true }),
      field('Router hostname', P, 'hostname', { required: true, help: 'The green prompt, e.g. NROGERS-R1. Letters, numbers, dashes.' }),
      field('Headline title', P, 'title', { help: 'e.g. Aspiring Network Engineer' }),
      field('Tagline', P, 'tagline', { help: 'One line under your title.' }),
      field('Location', P, 'location'),
      field('Currently', P, 'currently', { help: 'Status pill on the home page, e.g. Studying for CCNA 200-301' }),
      field('Open to', P, 'openTo', { help: 'Roles you are looking for.' }),
      field('Public email', P, 'email', { type: 'email' }),
    ),
    h('h2', {}, 'About me'),
    h('p', { class: 'muted small' }, 'One box per paragraph. Shown on the About page.'),
    listEditor(
      P.bio,
      (_, i) => {
        const ta = h('textarea', {
          rows: 3,
          oninput: (e) => {
            P.bio[i] = e.target.value;
            setDirty();
          },
        });
        ta.value = P.bio[i];
        return h('div', { class: 'field' }, ta);
      },
      () => '',
      'Add paragraph',
    ),
    h('h2', {}, 'Links'),
    h('p', { class: 'muted small' }, 'Leave a URL empty to hide that link. They appear in the footer, Contact page and `ping` in the CLI.'),
    listEditor(
      P.links,
      (l) => h('div', { class: 'grid' }, field('Label', l, 'label'), field('URL', l, 'url', { type: 'url', placeholder: 'https://' })),
      () => ({ id: `link-${Date.now()}`, label: '', url: '' }),
      'Add link',
    ),
    h('h2', {}, 'CV'),
    h(
      'div',
      { class: 'card actions' },
      cvInput,
      S.profile.cvFile ? h('a', { href: '/cv.pdf', target: '_blank' }, 'Current CV (cv.pdf) ↗') : h('span', { class: 'muted' }, 'No CV on the site yet.'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => cvInput.click() }, S.profile.cvFile ? 'Replace PDF…' : 'Upload PDF…'),
      S.profile.cvFile &&
        h(
          'button',
          {
            class: 'btn danger sm',
            type: 'button',
            onclick: () => {
              P.cvFile = '';
              setDirty();
              toast('CV button will be hidden once you save');
            },
          },
          'Hide CV button',
        ),
    ),
    ...saveBar(save),
  ];
}

// ------------------------------------------------------------------ skills

const SKILL_STATUS = [
  ['up', 'Comfortable (up / up)'],
  ['learning', 'Learning now'],
  ['planned', 'Planned (admin down)'],
];

function viewSkills() {
  const P = clone(S.profile);
  const save = () => runSave(() => api('PUT', '/api/profile', P)).then((ok) => ok && render());
  return [
    header('show ip interface brief', 'Skills', 'Shown on the About page as an interface table. Be honest: "learning" looks better than an inflated "comfortable".'),
    listEditor(
      P.skills,
      (g) =>
        h(
          'div',
          { class: 'card', style: 'margin:0' },
          h('div', { class: 'grid' }, field('Group name', g, 'group')),
          h('div', { style: 'height:.75rem' }),
          listEditor(
            g.items,
            (it) => h('div', { class: 'grid' }, field('Skill', it, 'name'), field('Status', it, 'status', { type: 'select', options: SKILL_STATUS })),
            () => ({ name: '', status: 'learning' }),
            'Add skill',
          ),
        ),
      () => ({ group: 'New group', items: [] }),
      'Add group',
    ),
    ...saveBar(save),
  ];
}

// ------------------------------------------------------------------ experience

const FACILITIES = [
  ['JOB-6-ROLE', 'Job'],
  ['EDU-6-COMPLETE', 'Education'],
  ['CERT-5-PASS', 'Certification passed'],
  ['STUDY-5-START', 'Started studying'],
  ['PROJECT-6-BUILD', 'Project'],
  ['VOL-6-ROLE', 'Volunteering'],
];

function viewExperience() {
  const P = clone(S.profile);
  const save = () => runSave(() => api('PUT', '/api/profile', P)).then((ok) => ok && render());
  return [
    header('show logging', 'Experience & education', 'Newest first. Shown on the About page as syslog messages.'),
    listEditor(
      P.experience,
      (e) =>
        h(
          'div',
          { class: 'grid' },
          field('When', e, 'date', { help: 'e.g. 2025 or 2023–2025' }),
          field('Type', e, 'facility', { type: 'select', options: FACILITIES }),
          field('Title', e, 'title', { help: 'Role or course, e.g. IT Support Technician' }),
          field('Detail', e, 'detail', { type: 'textarea', rows: 2, wide: true, help: 'Organisation · one line on what you did.' }),
        ),
      () => ({ date: String(new Date().getFullYear()), facility: 'JOB-6-ROLE', title: '', detail: '' }),
      'Add entry',
    ),
    ...saveBar(save),
  ];
}

// ------------------------------------------------------------------ roadmap

const HOP_STATUS = [
  ['reached', 'Reached'],
  ['current', 'You are here'],
  ['planned', 'Planned'],
];

function viewRoadmap() {
  const R = clone(S.roadmap);
  const save = () =>
    runSave(async () => {
      R.forEach((hop) => (hop.id = hop.id || slugify(hop.name)));
      await api('PUT', '/api/roadmap', R);
    }).then((ok) => ok && render());
  return [
    header('traceroute career', 'Roadmap', 'Your growth path, shown as a traceroute on the Certifications page. Mark one step as "You are here".'),
    listEditor(
      R,
      (hop) =>
        h(
          'div',
          { class: 'grid' },
          field('Step name', hop, 'name', { required: true }),
          field('Status', hop, 'status', { type: 'select', options: HOP_STATUS }),
          field('When', hop, 'when', { help: 'e.g. 2027 or Ongoing' }),
          field('Short id', hop, 'id', { help: 'Labs link to a step with this id. Lowercase, dashes.' }),
          field('Summary', hop, 'summary', { type: 'textarea', rows: 2, wide: true }),
          field('Goals', hop, 'goals', { csv: true, wide: true, help: 'Comma separated, e.g. VLANs, OSPF, Pass CCNA' }),
        ),
      () => ({ id: '', name: '', status: 'planned', when: '', summary: '', goals: [] }),
      'Add step',
    ),
    ...saveBar(save),
  ];
}

// ------------------------------------------------------------------ certs, labs, blog

const LAB_TEMPLATE = `## Objective

What you set out to build or fix, in one or two sentences.

## Topology

Describe the devices and links, or add a screenshot with the **Image** button.

| Device | Interface | VLAN / Network | Address |
| --- | --- | --- | --- |
| R1 | Gi0/0 | | |

## Configuration

\`\`\`text
R1(config)#
\`\`\`

## Verification

\`\`\`text
R1# show ip interface brief
\`\`\`

## Problems & troubleshooting

What broke, and how you tracked it down.

## Lessons learned

-
`;

const NOTES_TEMPLATE = `## Key ideas

-

## Example

## Commands to remember

\`\`\`text

\`\`\`

## Exam tips

-
`;

const CTF_TEMPLATE = `> Only write up rooms and boxes that allow it (retired or explicitly permitted).

## Overview

Platform, room / box name, difficulty, and what it teaches.

## Recon

\`\`\`text
nmap -sC -sV <target>
\`\`\`

## Findings

## What I learned

-
`;

const TEMPLATES = {
  labs: [
    ['Lab write-up', 'Objective, topology, config, verification, lessons learned.', LAB_TEMPLATE, {}],
    ['Blank lab', 'Start from an empty page.', '', {}],
  ],
  blog: [
    ['Study notes', 'Key ideas, an example, commands, exam tips.', NOTES_TEMPLATE, {}],
    ['CTF / security write-up', 'Recon, findings, lessons. Listed on the Security page.', CTF_TEMPLATE, { track: 'security', milestone: 'security' }],
    ['Blank post', 'Start from an empty page.', '', {}],
  ],
};

const COPY = {
  labs: { cmd: 'dir flash:/labs/', title: 'Labs', lead: 'Hands-on write-ups. These are the strongest thing on your site for recruiters.', one: 'lab', path: 'labs' },
  blog: { cmd: 'dir flash:/blog/', title: 'Blog posts', lead: 'Study notes, cheat sheets and CTF write-ups.', one: 'post', path: 'blog' },
  certs: { cmd: 'show certifications', title: 'Certifications', lead: 'Earned, in progress and planned.', one: 'certification', path: 'certifications' },
};

function newData(col, extra = {}) {
  if (col === 'certs') return { name: '', code: '', issuer: 'Cisco', status: 'planned', target: '', verifyUrl: '', order: 10 };
  const base = { title: '', summary: '', date: today(), tags: [], track: 'networking', milestone: col === 'labs' ? 'ccna' : '', draft: true };
  if (col === 'labs') base.tools = ['Packet Tracer'];
  return { ...base, ...extra };
}

function viewEntries() {
  const col = view;
  if (sub === 'new') return viewTemplatePicker(col);
  if (sub) return viewEntryEditor(col);
  const c = COPY[col];
  const items = [...S[col]].sort((a, b) =>
    col === 'certs' ? (a.data.order ?? 99) - (b.data.order ?? 99) : String(b.data.date).localeCompare(String(a.data.date)),
  );
  return [
    header(c.cmd, c.title, c.lead),
    h('div', { class: 'actions', style: 'margin-bottom:1rem' }, h('button', { class: 'btn', type: 'button', onclick: () => go(col, col === 'certs' ? '__newcert' : 'new') }, `+ New ${c.one}`)),
    items.length
      ? h(
          'div',
          { class: 'entries' },
          items.map((e) => {
            const d = e.data;
            const sample = /^sample/i.test(d.summary || '') || /sample/i.test(e.body.slice(0, 80));
            return h(
              'button',
              { class: 'entry', type: 'button', onclick: () => go(col, e.slug) },
              h('b', {}, d.title || d.name || e.slug),
              h(
                'span',
                { class: 'actions' },
                col !== 'certs' && (d.draft ? h('span', { class: 'tag draft' }, 'draft') : h('span', { class: 'tag live' }, 'live')),
                col === 'certs' && h('span', { class: 'tag live' }, d.status),
                sample && h('span', { class: 'tag sample' }, 'sample'),
              ),
              h('span', { class: 'meta' }, col === 'certs' ? [d.issuer, d.code].filter(Boolean).join(' · ') : [d.date, ...(d.tags || [])].join(' · ')),
              h('span', { class: 'sum' }, d.summary || ''),
            );
          }),
        )
      : h('p', { class: 'muted' }, `No ${c.one}s yet.`),
  ];
}

function viewTemplatePicker(col) {
  return [
    header(`copy template flash:/${col}/`, `New ${COPY[col].one}`, 'Pick a starting point. You can change everything afterwards.'),
    h(
      'div',
      { class: 'choice' },
      TEMPLATES[col].map(([name, desc, body, extra]) =>
        h(
          'button',
          {
            type: 'button',
            onclick: () => {
              pendingNew = { slug: '', data: newData(col, extra), body };
              sub = '__new';
              render();
            },
          },
          h('b', {}, name),
          h('span', {}, desc),
        ),
      ),
    ),
    h('p', {}, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => go(col) }, '← Back')),
  ];
}

let pendingNew = null;

function viewEntryEditor(col) {
  const isNew = sub === '__new' || sub === '__newcert';
  const src = isNew ? pendingNew : S[col].find((e) => e.slug === sub);
  if (!src) return [h('p', {}, 'Not found. '), h('button', { class: 'btn ghost', type: 'button', onclick: () => go(col) }, 'Back')];
  const E = clone(src);
  const orig = isNew ? '' : src.slug;
  const d = E.data;
  // fill in optional fields older files may not have
  if (col !== 'certs') {
    d.tags ??= [];
    d.track ??= 'networking';
    d.draft ??= false;
    if (col === 'labs') d.tools ??= [];
  }
  let slugAuto = isNew;
  const c = COPY[col];

  const slugField = field('URL name', E, 'slug', {
    required: true,
    id: 'slug-input',
    help: `Address: /${c.path}/${E.slug || 'url-name'}/. Lowercase letters, numbers, dashes.`,
    onChange: () => (slugAuto = false),
  });
  const setSlug = (title) => {
    if (!slugAuto) return;
    E.slug = slugify(title);
    const input = slugField.querySelector('input');
    input.value = E.slug;
  };

  const save = () =>
    runSave(async () => {
      if (!E.slug) throw new Error('Give it a URL name.');
      const data = { ...d };
      if (col === 'certs') {
        if (data.status !== 'earned') delete data.earned;
        if (data.order === undefined) data.order = 99;
      } else {
        if (!data.milestone) delete data.milestone;
      }
      await api('PUT', `/api/entry?collection=${col}&slug=${encodeURIComponent(E.slug)}${orig ? `&old=${encodeURIComponent(orig)}` : ''}`, { data, body: E.body });
      pendingNew = null;
      sub = E.slug;
    }).then((ok) => ok && render());

  const del = async () => {
    if (isNew) return go(col);
    if (!confirm(`Delete "${d.title || d.name}"? This removes the file. You can't undo this from the editor.`)) return;
    try {
      await api('DELETE', `/api/entry?collection=${col}&slug=${encodeURIComponent(orig)}`);
      dirty = false;
      await load();
      toast('Deleted');
      go(col);
    } catch (e) {
      toast(e.message, true);
    }
  };

  const previewBtn = h(
    'button',
    {
      class: 'btn ghost',
      type: 'button',
      disabled: !S.siteUrl || isNew,
      title: !S.siteUrl ? 'Site preview is not running' : isNew ? 'Save first' : 'Open on the local site',
      onclick: () => window.open(`${S.siteUrl}${c.path}/${col === 'certs' ? '' : `${orig}/`}`, '_blank'),
    },
    'Preview on site ↗',
  );

  const milestoneOpts = [['', '(none)'], ...S.roadmap.map((r) => [r.id, r.name])];
  let fields;
  if (col === 'certs') {
    fields = h(
      'div',
      { class: 'card grid' },
      field('Certification name', d, 'name', { required: true, onChange: (v) => setSlug(v) }),
      field('Exam code', d, 'code', { help: 'e.g. CCNA 200-301' }),
      field('Issuer', d, 'issuer', { required: true }),
      field('Status', d, 'status', {
        type: 'select',
        options: [
          ['earned', 'Earned'],
          ['in-progress', 'In progress'],
          ['planned', 'Planned'],
        ],
      }),
      field('Date earned', d, 'earned', { type: 'date', help: 'Only used when status is Earned.' }),
      field('Target', d, 'target', { help: 'e.g. June 2027' }),
      field('Verify URL', d, 'verifyUrl', { type: 'url', placeholder: 'https://www.credly.com/badges/…' }),
      field('Sort order', d, 'order', { type: 'number', help: 'Lower numbers show first.' }),
      slugField,
      field('Short description', E, 'body', { type: 'textarea', rows: 3, wide: true }),
    );
  } else {
    fields = h(
      'div',
      { class: 'card grid' },
      field('Title', d, 'title', { required: true, wide: true, onChange: (v) => setSlug(v) }),
      field('Summary', d, 'summary', { type: 'textarea', rows: 2, wide: true, required: true, help: 'One or two sentences. Shown on the card and in search results.' }),
      field('Date', d, 'date', { type: 'date', required: true }),
      slugField,
      field('Tags', d, 'tags', { csv: true, help: 'Comma separated, e.g. VLAN, 802.1Q' }),
      col === 'labs' && field('Tools', d, 'tools', { csv: true, help: 'e.g. Packet Tracer, GNS3, Wireshark' }),
      field('Track', d, 'track', {
        type: 'select',
        options: [
          ['networking', 'Networking'],
          ['security', 'Security (also on the Security page)'],
        ],
      }),
      field('Roadmap step', d, 'milestone', { type: 'select', options: milestoneOpts, help: 'Shows this under that step on the roadmap.' }),
      field('Draft: hide from the live site (still shows in local preview)', d, 'draft', { type: 'checkbox', wide: true }),
    );
  }

  return [
    h('p', {}, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => go(col) }, `← All ${c.title.toLowerCase()}`)),
    header(isNew ? `copy template flash:/${col}/` : `edit flash:/${col}/${orig}.md`, isNew ? `New ${c.one}` : d.title || d.name, null),
    fields,
    col !== 'certs' && [h('h2', {}, 'Write-up'), mdEditor(E, 'body', { col, slug: () => E.slug || orig })],
    ...saveBar(save, previewBtn, h('button', { class: 'btn danger', type: 'button', onclick: del }, isNew ? 'Discard' : 'Delete')),
  ];
}

function mdEditor(obj, key, ctx) {
  const ta = h('textarea', { spellcheck: 'true', 'aria-label': 'Write-up (Markdown)' });
  ta.value = obj[key] || '';
  const pv = h('div', { class: 'preview prose', 'aria-label': 'Preview' });
  const renderPv = () => (pv.innerHTML = marked.parse(ta.value || '*Nothing written yet.*'));
  let t;
  const changed = () => {
    obj[key] = ta.value;
    setDirty();
    clearTimeout(t);
    t = setTimeout(renderPv, 150);
  };
  ta.addEventListener('input', changed);

  const insert = (before, after = '', placeholder = '') => {
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || placeholder;
    ta.setRangeText(before + sel + after, s, e, 'end');
    if (!ta.value.slice(s, e).length && placeholder) ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    ta.focus();
    changed();
  };
  const block = (text) => {
    const s = ta.selectionStart;
    const pre = s > 0 && ta.value[s - 1] !== '\n' ? '\n\n' : s > 1 && ta.value[s - 2] !== '\n' ? '\n' : '';
    ta.setRangeText(pre + text, s, ta.selectionEnd, 'end');
    ta.focus();
    changed();
  };

  async function uploadImage(file) {
    const slug = ctx.slug();
    if (!slug) return toast('Give it a title (URL name) before adding images.', true);
    try {
      const r = await api('POST', `/api/upload?kind=image&collection=${ctx.col}&slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(file.name || 'pasted.png')}`, file, true);
      block(`![${(file.name || 'screenshot').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')}](${r.url})\n`);
      toast('Image added');
    } catch (e) {
      toast(e.message, true);
    }
  }
  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    hidden: true,
    onchange: () => {
      if (fileInput.files[0]) uploadImage(fileInput.files[0]);
      fileInput.value = '';
    },
  });
  ta.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) {
      e.preventDefault();
      uploadImage(f);
    }
  });

  const split = h('div', { class: 'md-split' }, ta, pv);
  const B = (label, fn, title) => h('button', { type: 'button', onclick: fn, title }, label);
  const bar = h(
    'div',
    { class: 'md-bar' },
    B('Heading', () => block('## Heading\n'), 'Section heading'),
    B('Bold', () => insert('**', '**', 'bold text')),
    B('`code`', () => insert('`', '`', 'show run'), 'Inline command'),
    B('Config block', () => block('```text\nR1# configure terminal\nR1(config)# \n```\n'), 'IOS config or show output'),
    B('Table', () => block('| Device | Interface | Address |\n| --- | --- | --- |\n| R1 | Gi0/0 | 192.168.1.1/24 |\n')),
    B('List', () => block('- \n- \n')),
    B('Link', () => insert('[', '](https://)', 'link text')),
    B('Image…', () => fileInput.click(), 'Upload a screenshot (or paste one into the text)'),
    ctx.col === 'labs' && B('Lab sections', () => block(LAB_TEMPLATE), 'Insert the lab write-up sections'),
    h('span', { class: 'gap' }),
    B('Toggle preview', () => split.classList.toggle('no-preview')),
    fileInput,
  );
  renderPv();
  return h('div', { class: 'md' }, bar, split);
}

// ------------------------------------------------------------------ publish

function placeholderWarnings() {
  const w = [];
  const p = S.profile;
  if (p.name === 'Your Name') w.push(['Profile', 'Name is still "Your Name".', 'profile']);
  if (/example\.com$/.test(p.email)) w.push(['Profile', 'Email is still the example address.', 'profile']);
  if (p.links.some((l) => /your-(profile|username)/.test(l.url))) w.push(['Profile', 'LinkedIn / GitHub links are still placeholders.', 'profile']);
  if (p.bio.some((b) => /^Write two or three sentences/.test(b))) w.push(['Profile', 'About me still has the placeholder text.', 'profile']);
  if (p.experience.some((e) => /Your current or most recent role|Replace with your own/.test(e.title + e.detail))) w.push(['Experience', 'Experience still has example entries.', 'experience']);
  for (const col of ['labs', 'blog'])
    for (const e of S[col]) if (!e.data.draft && /^sample/i.test(e.data.summary || '')) w.push([col === 'labs' ? 'Labs' : 'Blog', `"${e.data.title}" is a sample and is live.`, col]);
  return w;
}

function viewPublish() {
  const g = S.git;
  const msg = { message: 'Update site content' };
  const log = h('div', { class: 'log', hidden: true });
  const warnings = placeholderWarnings();
  const drafts = [...S.labs, ...S.blog].filter((e) => e.data.draft);
  const btn = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      disabled: !g.files.length && !g.ahead,
      onclick: async () => {
        btn.disabled = true;
        btn.textContent = 'Publishing…';
        try {
          const r = await api('POST', '/api/publish', { message: msg.message });
          log.hidden = false;
          log.textContent = r.log.filter(Boolean).join('\n');
          await load();
          renderNav();
          toast(r.ok ? 'Published. The live site updates in about a minute.' : 'Publish failed. See the log.', !r.ok);
          btn.textContent = r.ok ? 'Published ✓' : 'Try again';
          btn.disabled = r.ok;
        } catch (e) {
          toast(e.message, true);
          btn.disabled = false;
          btn.textContent = 'Publish';
        }
      },
    },
    'Publish',
  );

  return [
    header('copy running-config github:', 'Publish', 'Saves your changes to GitHub. The live site rebuilds automatically, usually within a minute.'),
    warnings.length
      ? h(
          'div',
          { class: 'card', style: 'border-color: rgba(245,185,66,.5)' },
          h('b', { style: 'color:var(--amber)' }, 'Still placeholder content'),
          h(
            'ul',
            {},
            warnings.map(([where, text, to]) => h('li', {}, h('a', { href: '#', onclick: (e) => (e.preventDefault(), go(to)) }, where), ': ', text)),
          ),
          h('p', { class: 'muted small' }, 'You can still publish. These are just reminders.'),
        )
      : null,
    h('h2', {}, 'Changes waiting to publish'),
    g.files.length
      ? h(
          'ul',
          { class: 'files card' },
          g.files.map((f) => h('li', {}, h('span', { class: 'code' }, f.code === '??' ? 'new' : f.code === 'D' ? 'del' : 'mod'), f.file)),
        )
      : h('p', { class: 'muted' }, g.ahead ? `${g.ahead} saved commit(s) not pushed yet.` : 'Nothing to publish. Everything is already live.'),
    drafts.length ? h('p', { class: 'muted small' }, `${drafts.length} draft(s) are included but stay hidden on the live site until you untick "Draft".`) : null,
    g.otherFiles.length ? h('p', { class: 'muted small' }, `Other changed files (not published from here): ${g.otherFiles.join(', ')}`) : null,
    h('div', { class: 'card grid' }, field('What changed?', msg, 'message', { wide: true, help: 'A short note saved in the history, e.g. "Add OSPF lab".' })),
    h('div', { class: 'actions' }, btn, S.siteUrl ? h('a', { class: 'btn ghost', href: S.siteUrl, target: '_blank' }, 'Check local preview first ↗') : null),
    log,
  ];
}

// ------------------------------------------------------------------ start

try {
  await load();
  render();
  // the site preview starts a few seconds after the editor; pick up its URL when ready
  if (!S.siteUrl) {
    const poll = setInterval(async () => {
      const prev = S.siteUrl;
      try {
        const st = await api('GET', '/api/state');
        if (st.siteUrl && !prev) {
          S.siteUrl = st.siteUrl;
          const link = document.getElementById('site-link');
          link.href = st.siteUrl;
          link.hidden = false;
          if (!dirty) render();
          clearInterval(poll);
        }
      } catch {}
    }, 2000);
    setTimeout(() => clearInterval(poll), 60000);
  }
} catch (e) {
  main.replaceChildren(h('p', { class: 'errors' }, `Couldn't load: ${e.message}`));
}
