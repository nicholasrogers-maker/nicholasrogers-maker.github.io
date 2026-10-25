// Turns a Byte Quest progress export into the public summary the site shows.
//
//   node scripts/sync-bytequest.mjs <progress.json> [--out src/data/bytequest.json]
//
// <progress.json> is the Byte Quest "progress/main" database record (Claude reads it
// with the artifact data tool). Only headline numbers are written out: goals, review
// queues and "unsure" flags stay private.
//
// The maths mirrors Byte Quest's own stats(), levelInfo() and badge rules. The track
// and badge lists live in scripts/bytequest/catalog.json; regenerate that when
// Byte Quest gains new tracks (see scripts/bytequest/README.md).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : path.join(here, '..', 'src', 'data', 'bytequest.json');
if (!input) {
  console.error('Usage: node scripts/sync-bytequest.mjs <progress.json> [--out file]');
  process.exit(1);
}

const cat = JSON.parse(fs.readFileSync(path.join(here, 'bytequest', 'catalog.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const P = raw && raw.done ? raw : raw.data ?? raw;
const done = P.done && typeof P.done === 'object' ? P.done : {};
const arcade = P.arcade ?? {};
const gymState = P.gym ?? {};
const streak = P.streak ?? {};

// ---- dates (local time, like the app)
const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date();
const today = dayStr(now);
const yesterday = dayStr(new Date(now.getTime() - 864e5));

// ---- lessons
const byId = {};
for (const t of cat.tracks) {
  const bosses = new Set(t.bosses);
  for (const id of t.lessons) byId[id] = { track: t.id, boss: bosses.has(id) };
}
let lessonXp = 0, count = 0, bosses = 0, pars = 0;
const unknown = [];
for (const [id, r] of Object.entries(done)) {
  if (!r) continue;
  if (!byId[id]) {
    unknown.push(id);
    continue;
  }
  lessonXp += +r.xp || 0;
  count++;
  if (byId[id].boss) bosses++;
  if (r.par) pars++;
}
const xp = lessonXp + (+arcade.xp || 0) + (+gymState.xp || 0);
const liveStreak = streak.last === today || streak.last === yesterday ? +streak.n || 0 : 0;
const best = Math.max(+streak.best || 0, liveStreak);

// ---- level (Byte Quest levelInfo)
let n = 1;
while (xp >= 50 * n * (n + 1)) n++;
const lo = 50 * (n - 1) * n;
const hi = 50 * n * (n + 1);
const level = { n, title: cat.levelTitles[Math.min(n - 1, cat.levelTitles.length - 1)], into: xp - lo, need: hi - lo };

// ---- practice gym
const gym = cat.gym.map((s) => {
  const lv = gymState.sk?.[s.id]?.lv ?? {};
  let mastered = 0;
  for (let i = 1; i <= s.levels; i++) if (lv[i]?.m) mastered++;
  return { id: s.id, name: s.name, mastered, levels: s.levels };
});
const gymBy = Object.fromEntries(gym.map((g) => [g.id, g]));

// ---- tracks and paths
const status = (d, t) => (t > 0 && d >= t ? 'up' : d > 0 ? 'learning' : 'down');
const trackDone = {};
const tracks = cat.tracks.map((t) => {
  const d = t.lessons.filter((id) => done[id]).length;
  trackDone[t.id] = t.lessons.every((id) => done[id]);
  return { id: t.id, name: t.name, group: t.group, done: d, total: t.lessons.length, status: status(d, t.lessons.length) };
});
const paths = cat.paths.map((p) => {
  const ts = tracks.filter((t) => t.group === p.id).map(({ group, ...rest }) => rest);
  const d = ts.reduce((s, t) => s + t.done, 0);
  const total = ts.reduce((s, t) => s + t.total, 0);
  return { id: p.id, name: p.name, done: d, total, status: status(d, total), tracks: ts };
});

// ---- badges (Byte Quest BADGES rules)
const st = {
  xp, count, bosses, pars, best,
  drillBest: +arcade.drillBest || 0,
  dailies: Object.keys(arcade.daily ?? {}).length,
  mastered: Object.values(arcade.cards ?? {}).filter((c) => c && c.box >= 3).length,
};
const earnedBadge = (b) => {
  const r = b.rule;
  if (r.type === 'track') return !!trackDone[r.track];
  if (r.type === 'gym') return !!gymBy[r.skill] && gymBy[r.skill].mastered >= gymBy[r.skill].levels;
  if (r.type === 'min') return (st[r.stat] ?? 0) >= r.min;
  return false;
};
const earned = cat.badges.filter(earnedBadge).map(({ id, name, desc }) => ({ id, name, desc }));

// ---- recent activity (lessons completed per day, last 30 days)
const stamps = Object.values(done).map((r) => r && +r.at).filter(Boolean);
const since = (days) => stamps.filter((t) => now.getTime() - t < days * 864e5).length;
const lastAt = stamps.length ? new Date(Math.max(...stamps)) : null;

const summary = {
  source: 'Byte Quest',
  syncedAt: now.toISOString(),
  xp,
  level,
  lessons: { done: count, total: Object.keys(byId).length },
  bosses,
  streak: { current: liveStreak, best, lastActive: streak.last ?? (lastAt ? dayStr(lastAt) : null) },
  recent: { days7: since(7), days30: since(30) },
  badges: { earned, total: cat.badges.length },
  gym,
  paths,
};

// --if-changed: leave the file alone when only the sync time would change,
// so days without study don't create empty commits.
if (args.includes('--if-changed') && fs.existsSync(out)) {
  try {
    const { syncedAt, ...prev } = JSON.parse(fs.readFileSync(out, 'utf8'));
    const { syncedAt: _now, ...next } = summary;
    if (JSON.stringify(prev) === JSON.stringify(next)) {
      console.log('Byte Quest: no new progress since the last sync. Nothing written.');
      process.exit(0);
    }
  } catch {
    // unreadable previous file: just overwrite it
  }
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(summary, null, 2) + '\n');

console.log(`Byte Quest synced → ${path.relative(process.cwd(), out)}`);
console.log(`  Level ${level.n} ${level.title} · ${xp} XP · ${count}/${summary.lessons.total} lessons · streak ${liveStreak} (best ${best}) · ${earned.length}/${cat.badges.length} badges`);
for (const p of paths.filter((p) => p.done)) console.log(`  ${p.name}: ${p.done}/${p.total}`);
if (unknown.length) {
  console.warn(`  ! ${unknown.length} completed lesson(s) aren't in catalog.json (${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? '…' : ''}).`);
  console.warn('    Byte Quest has new lessons: regenerate the catalog (scripts/bytequest/README.md).');
}
