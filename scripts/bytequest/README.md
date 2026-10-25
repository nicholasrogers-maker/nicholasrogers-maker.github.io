# Byte Quest sync

The site shows progress from **Byte Quest**, a private Claude artifact
(https://claude.ai/artifact/NwsLAU8HDi6wu2BfLGeMpc). The public site can't read that artifact,
so a snapshot of the headline numbers is saved into the repo and published with the site.

## What gets published

`src/data/bytequest.json` holds: level, XP, lessons cleared, streak, badges earned,
Practice Gym mastery and per-track lesson counts. Nothing else. Goals, review queues,
"unsure" flags and lesson answers are never copied.

## Refreshing (ask Claude: "sync Byte Quest")

1. Read the `progress/main` record from the Byte Quest artifact database and save it as JSON.
2. Run:
   ```bash
   npm run sync:bytequest -- path/to/progress.json
   ```
3. Commit `src/data/bytequest.json` and push. GitHub Pages redeploys.

The script prints a one-line summary (level, XP, lessons, streak, badges) to check against the app.

## When Byte Quest gets new tracks or lessons

`catalog.json` lists every track, its lesson ids, boss lessons, badges and gym skills.
If the sync warns that completed lessons aren't in the catalog, regenerate it:

1. Open a copy of the Byte Quest page in a browser (served from localhost).
2. Run this in the page's console and save the result over `catalog.json`
   (keep the `source` line updated with the artifact version):

```js
const rule = (b) => {
  const s = b.test.toString();
  let m = s.match(/p\.tracks(?:\.([\w-]+)|\["([\w-]+)"\])/); if (m) return { type: 'track', track: m[1] || m[2] };
  m = s.match(/p\.gym\.(\w+) >= Gym\.SK\.(\w+)\.levels\.length/); if (m) return { type: 'gym', skill: m[1] };
  m = s.match(/p\.(\w+) >= (\d+)/); if (m) return { type: 'min', stat: m[1], min: +m[2] };
  return { type: 'unknown', src: s };
};
JSON.stringify({
  levelTitles: LEVEL_TITLES,
  paths: PATHS.map(p => ({ id: p.id, name: p.name })),
  gym: Gym.SKILLS.map(s => ({ id: s.id, name: s.name, levels: s.levels.length })),
  badges: BADGES.map(b => ({ id: b.id, name: b.name, desc: b.desc, rule: rule(b) })),
  tracks: TRACKS.map(t => ({ id: t.id, name: t.name, group: t.group, lessons: t.lessons.map(l => l.id), bosses: t.lessons.filter(l => l.boss).map(l => l.id) })),
}, null, 2)
```

Any badge with `"type": "unknown"` needs a new rule in `scripts/sync-bytequest.mjs`.

## Display settings

`src/data/bytequest.ts`: turn the section off (`showBytequest`), choose which paths are shown
in full (`featuredPaths`), and map tracks to roadmap hops (`roadmapTracks`).
