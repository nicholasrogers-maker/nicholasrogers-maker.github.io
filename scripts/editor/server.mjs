// Local content editor for the portfolio site.
//
//   npm run editor            → editor at http://127.0.0.1:4400 + site preview (astro dev)
//   npm run editor -- --no-site --no-open
//
// It only listens on 127.0.0.1, every API call needs a token that is embedded in the
// editor page, and it can only write inside src/data, src/content and public/.
// Nothing here is part of the deployed site.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const PORT = Number(process.env.EDITOR_PORT || 4400);
const HOST = '127.0.0.1';
const TOKEN = crypto.randomBytes(24).toString('hex');
const args = process.argv.slice(2);
const MAX_BODY = 15 * 1024 * 1024;

const COLLECTIONS = {
  labs: 'src/content/labs',
  blog: 'src/content/blog',
  certs: 'src/content/certs',
};
const PROFILE = 'src/data/profile.json';
const ROADMAP = 'src/data/roadmap.json';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

let siteUrl = null; // set once astro dev reports its URL

// ---------------------------------------------------------------- files

const abs = (rel) => path.join(ROOT, rel);

function writeAtomic(rel, content) {
  const file = abs(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

const readJson = (rel) => JSON.parse(fs.readFileSync(abs(rel), 'utf8'));
const writeJson = (rel, v) => writeAtomic(rel, JSON.stringify(v, null, 2) + '\n');

function parseMd(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  return { data: YAML.parse(m[1]) ?? {}, body: m[2].replace(/^\r?\n/, '') };
}

function toMd(data, body) {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)),
  );
  return `---\n${YAML.stringify(clean, { lineWidth: 0 })}---\n\n${(body ?? '').trim()}\n`;
}

function readCollection(name) {
  const dir = abs(COLLECTIONS[name]);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data, body } = parseMd(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const k of ['date', 'earned']) if (data[k] instanceof Date) data[k] = data[k].toISOString().slice(0, 10);
      return { slug: f.replace(/\.md$/, ''), data, body };
    });
}

// ---------------------------------------------------------------- validation

class Bad extends Error {}
const need = (cond, msg) => {
  if (!cond) throw new Bad(msg);
};
const isStr = (v) => typeof v === 'string';
const isDate = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isUrlOrEmpty = (v) => v === '' || v === undefined || (isStr(v) && /^(https?:\/\/|mailto:)/.test(v));

function checkProfile(p) {
  need(p && typeof p === 'object', 'Profile must be an object.');
  for (const k of ['name', 'hostname', 'title', 'tagline', 'location', 'currently', 'openTo', 'email', 'cvFile'])
    need(isStr(p[k]), `Profile field "${k}" is missing.`);
  need(p.name.trim(), 'Name is required.');
  need(/^[A-Za-z0-9-]{1,24}$/.test(p.hostname), 'Hostname: letters, numbers and dashes only, up to 24 characters.');
  need(Array.isArray(p.bio) && p.bio.every(isStr), 'Bio must be a list of paragraphs.');
  need(Array.isArray(p.links) && p.links.every((l) => isStr(l.id) && isStr(l.label) && isUrlOrEmpty(l.url)), 'Each link needs a label and a URL starting with https://');
  need(
    Array.isArray(p.skills) && p.skills.every((g) => isStr(g.group) && Array.isArray(g.items) && g.items.every((i) => isStr(i.name) && ['up', 'learning', 'planned'].includes(i.status))),
    'Skills are malformed.',
  );
  need(Array.isArray(p.experience) && p.experience.every((e) => ['date', 'facility', 'title', 'detail'].every((k) => isStr(e[k]))), 'Experience entries are malformed.');
}

function checkRoadmap(r) {
  need(Array.isArray(r), 'Roadmap must be a list.');
  const ids = new Set();
  for (const h of r) {
    need(isStr(h.id) && SLUG.test(h.id), `Roadmap id "${h.id}" must be lowercase letters, numbers and dashes.`);
    need(!ids.has(h.id), `Roadmap id "${h.id}" is used twice.`);
    ids.add(h.id);
    need(isStr(h.name) && h.name.trim(), 'Every roadmap hop needs a name.');
    need(['reached', 'current', 'planned'].includes(h.status), 'Roadmap status must be reached, current or planned.');
    need(isStr(h.when) && isStr(h.summary) && Array.isArray(h.goals) && h.goals.every(isStr), `Roadmap hop "${h.name}" is malformed.`);
  }
}

function checkEntry(col, d) {
  need(d && typeof d === 'object', 'Missing fields.');
  if (col === 'certs') {
    need(isStr(d.name) && d.name.trim(), 'Certification name is required.');
    need(isStr(d.issuer) && d.issuer.trim(), 'Issuer is required.');
    need(['earned', 'in-progress', 'planned'].includes(d.status), 'Pick a status.');
    need(d.earned === undefined || d.earned === '' || isDate(d.earned), 'Earned date must be a date.');
    need(isUrlOrEmpty(d.verifyUrl), 'Verify URL must start with https://');
    need(d.order === undefined || Number.isFinite(d.order), 'Order must be a number.');
    return;
  }
  need(isStr(d.title) && d.title.trim(), 'Title is required.');
  need(isStr(d.summary) && d.summary.trim(), 'Summary is required (it shows on the card).');
  need(isDate(d.date), 'Date is required.');
  need(Array.isArray(d.tags) && d.tags.every(isStr), 'Tags must be a list.');
  need(['networking', 'security'].includes(d.track), 'Track must be networking or security.');
  need(d.milestone === undefined || d.milestone === '' || isStr(d.milestone), 'Milestone is malformed.');
  need(typeof d.draft === 'boolean', 'Draft must be true or false.');
  if (col === 'labs') need(Array.isArray(d.tools) && d.tools.every(isStr), 'Tools must be a list.');
}

// ---------------------------------------------------------------- git

function git(argv) {
  return new Promise((resolve) => {
    execFile('git', argv, { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: `${stdout}${stderr}`.trim() });
    });
  });
}

async function gitStatus() {
  const st = await git(['status', '--porcelain', '--', 'src', 'public']);
  const files = st.out ? st.out.split('\n').map((l) => ({ code: l.slice(0, 2).trim(), file: l.slice(3) })) : [];
  const ahead = await git(['rev-list', '--count', '@{u}..HEAD']);
  const other = await git(['status', '--porcelain']);
  const otherFiles = other.out
    ? other.out
        .split('\n')
        .map((l) => l.slice(3))
        .filter((f) => !f.startsWith('src/') && !f.startsWith('public/') && !f.startsWith('"src/') && !f.startsWith('"public/'))
    : [];
  return { files, ahead: ahead.ok ? Number(ahead.out) || 0 : 0, otherFiles };
}

async function publish(message) {
  const log = [];
  const step = async (argv) => {
    const r = await git(argv);
    log.push(`$ git ${argv.join(' ')}`, r.out);
    return r;
  };
  await step(['add', '--', 'src', 'public']);
  const staged = await git(['diff', '--cached', '--quiet']);
  if (staged.ok) {
    const st = await gitStatus();
    if (!st.ahead) return { ok: true, log: [...log, 'Nothing new to publish.'] };
  } else {
    const c = await step(['commit', '-m', message]);
    if (!c.ok) return { ok: false, log };
  }
  const p = await step(['push']);
  return { ok: p.ok, log };
}

// ---------------------------------------------------------------- http

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Bad('File is too large (15 MB max).'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const readJsonBody = async (req) => {
  try {
    return JSON.parse((await readBody(req)).toString('utf8'));
  } catch (e) {
    if (e instanceof Bad) throw e;
    throw new Bad('Request body is not valid JSON.');
  }
};

const STATIC = {
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/app.css': ['app.css', 'text/css; charset=utf-8'],
};
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

async function handle(req, res) {
  // Only answer requests addressed to this local server (blocks DNS-rebinding tricks).
  const hostOk = [`127.0.0.1:${PORT}`, `localhost:${PORT}`].includes(req.headers.host);
  if (!hostOk) return send(res, 403, { error: 'Forbidden host' });

  const u = new URL(req.url, `http://${req.headers.host}`);
  const p = u.pathname;

  if (req.method === 'GET' && p === '/') {
    const html = fs
      .readFileSync(path.join(here, 'index.html'), 'utf8')
      .replace('__TOKEN__', TOKEN);
    return send(res, 200, html, 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && STATIC[p]) {
    const [f, type] = STATIC[p];
    return send(res, 200, fs.readFileSync(path.join(here, f)), type);
  }
  if (req.method === 'GET' && p === '/vendor/marked.js') {
    return send(res, 200, fs.readFileSync(abs('node_modules/marked/lib/marked.esm.js')), 'text/javascript; charset=utf-8');
  }
  // Images and the CV from public/, so the preview can show them.
  if (req.method === 'GET' && (p.startsWith('/images/') || p === '/cv.pdf' || p === '/favicon.svg')) {
    const file = path.normalize(path.join(abs('public'), decodeURIComponent(p)));
    if (!file.startsWith(abs('public') + path.sep) || !fs.existsSync(file)) return send(res, 404, { error: 'Not found' });
    return send(res, 200, fs.readFileSync(file), MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  }

  if (!p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
  if (req.headers['x-editor-token'] !== TOKEN) return send(res, 403, { error: 'Missing or wrong editor token. Reload the editor page.' });

  try {
    if (req.method === 'GET' && p === '/api/state') {
      return send(res, 200, {
        profile: readJson(PROFILE),
        roadmap: readJson(ROADMAP),
        labs: readCollection('labs'),
        blog: readCollection('blog'),
        certs: readCollection('certs'),
        git: await gitStatus(),
        siteUrl,
      });
    }

    if (req.method === 'PUT' && p === '/api/profile') {
      const body = await readJsonBody(req);
      checkProfile(body);
      writeJson(PROFILE, body);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'PUT' && p === '/api/roadmap') {
      const body = await readJsonBody(req);
      checkRoadmap(body);
      writeJson(ROADMAP, body);
      return send(res, 200, { ok: true });
    }

    if (p === '/api/entry') {
      const col = u.searchParams.get('collection');
      const slug = u.searchParams.get('slug') || '';
      need(COLLECTIONS[col], 'Unknown collection.');
      need(SLUG.test(slug), 'The URL name (slug) can only use lowercase letters, numbers and dashes.');
      const file = `${COLLECTIONS[col]}/${slug}.md`;

      if (req.method === 'PUT') {
        const old = u.searchParams.get('old') || '';
        const { data, body } = await readJsonBody(req);
        checkEntry(col, data);
        need(isStr(body ?? ''), 'Body must be text.');
        const renaming = old && old !== slug;
        if (renaming) need(SLUG.test(old), 'Bad old slug.');
        if (!old || renaming) need(!fs.existsSync(abs(file)), `Something called "${slug}" already exists. Pick another URL name.`);
        writeAtomic(file, toMd(data, body));
        if (renaming) {
          fs.rmSync(abs(`${COLLECTIONS[col]}/${old}.md`), { force: true });
          const oldImg = abs(`public/images/${col}/${old}`);
          if (fs.existsSync(oldImg) && !fs.existsSync(abs(`public/images/${col}/${slug}`))) fs.renameSync(oldImg, abs(`public/images/${col}/${slug}`));
        }
        return send(res, 200, { ok: true, slug });
      }
      if (req.method === 'DELETE') {
        need(fs.existsSync(abs(file)), 'Already deleted.');
        fs.rmSync(abs(file));
        return send(res, 200, { ok: true });
      }
    }

    if (req.method === 'POST' && p === '/api/upload') {
      const kind = u.searchParams.get('kind');
      const data = await readBody(req);
      need(data.length > 0, 'Empty file.');
      if (kind === 'cv') {
        need(data.subarray(0, 5).toString('latin1') === '%PDF-', 'The CV must be a PDF.');
        writeAtomic('public/cv.pdf', data);
        const prof = readJson(PROFILE);
        prof.cvFile = 'cv.pdf';
        writeJson(PROFILE, prof);
        return send(res, 200, { ok: true, cvFile: 'cv.pdf' });
      }
      if (kind === 'image') {
        const col = u.searchParams.get('collection');
        const slug = u.searchParams.get('slug') || '';
        need(COLLECTIONS[col] && col !== 'certs', 'Images can be added to labs and posts.');
        need(SLUG.test(slug), 'Give the entry a URL name before adding images.');
        const raw = (u.searchParams.get('name') || 'image.png').toLowerCase();
        const ext = path.extname(raw);
        need(IMAGE_EXT.has(ext), 'Images must be PNG, JPG, GIF, WebP or SVG.');
        const base = path.basename(raw, ext).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
        let name = `${base}${ext}`;
        for (let i = 2; fs.existsSync(abs(`public/images/${col}/${slug}/${name}`)); i++) name = `${base}-${i}${ext}`;
        writeAtomic(`public/images/${col}/${slug}/${name}`, data);
        return send(res, 200, { ok: true, url: `/images/${col}/${slug}/${name}` });
      }
      throw new Bad('Unknown upload type.');
    }

    if (req.method === 'GET' && p === '/api/git') return send(res, 200, await gitStatus());

    if (req.method === 'POST' && p === '/api/publish') {
      const { message } = await readJsonBody(req);
      need(isStr(message) && message.trim() && message.length < 200, 'Write a short description of what changed.');
      return send(res, 200, await publish(message.trim()));
    }

    return send(res, 404, { error: 'Unknown API route' });
  } catch (e) {
    if (e instanceof Bad) return send(res, 400, { error: e.message });
    console.error(e);
    return send(res, 500, { error: `Something went wrong: ${e.message}` });
  }
}

// ---------------------------------------------------------------- start

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => send(res, 500, { error: e.message }));
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is busy. Is the editor already running? (set EDITOR_PORT to use another)`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`\n  Content editor:  ${url}`);
  if (!args.includes('--no-site')) startSite();
  else console.log('  Site preview:    not started (--no-site)');
  console.log('  Press Ctrl+C to stop.\n');
  if (!args.includes('--no-open')) {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
});

function startSite() {
  const bin = abs('node_modules/astro/astro.js');
  const child = spawn(process.execPath, [bin, 'dev', '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const onData = (buf) => {
    const text = buf.toString();
    const m = text.replace(/\x1b\[[0-9;]*m/g, '').match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/?/);
    if (m && !siteUrl) {
      siteUrl = m[0].endsWith('/') ? m[0] : `${m[0]}/`;
      console.log(`  Site preview:    ${siteUrl}`);
    }
    if (/error/i.test(text)) process.stderr.write(`[site] ${text}`);
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  const stop = () => {
    child.kill();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => {
    if (code) console.error(`[site] preview server stopped (code ${code})`);
    siteUrl = null;
  });
}
