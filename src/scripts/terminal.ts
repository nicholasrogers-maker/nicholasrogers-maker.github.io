// IOS-style command line for the site.
// Supports Cisco-style abbreviations (`sh ip int br`), `?` context help,
// Tab completion, command history and a few easter eggs.

type Link = { id: string; label: string; url: string };
type Entry = { title: string; url: string; date: string };
interface Data {
  profile: {
    name: string;
    hostname: string;
    title: string;
    tagline: string;
    location: string;
    currently: string;
    openTo: string;
    email: string;
    bio: string[];
  };
  links: Link[];
  skills: { group: string; items: { name: string; status: string }[] }[];
  experience: { date: string; facility: string; title: string; detail: string }[];
  roadmap: { id: string; name: string; status: string; when: string; summary: string; goals: string[] }[];
  certs: { name: string; code: string; status: string; when: string }[];
  labs: Entry[];
  posts: Entry[];
  pages: Record<string, string>;
  bytequest: BqData | null;
}

type BqTrack = { id: string; name: string; done: number; total: number; status: 'up' | 'learning' | 'down' };
interface BqData {
  synced: string;
  xp: number;
  level: { n: number; title: string; into: number; need: number };
  lessons: { done: number; total: number };
  streak: { current: number; best: number; lastActive: string | null };
  recent: { days7: number; days30: number };
  badges: { earned: { id: string; name: string; desc: string }[]; total: number };
  featured: string[];
  paths: (BqTrack & { tracks: BqTrack[] })[];
  url: string;
}

interface Cmd {
  help: string;
  run?: (args: string[]) => void | Promise<void>;
  sub?: Record<string, Cmd>;
  /** possible argument values, for Tab and `?` */
  args?: () => string[];
  argHelp?: string;
  /** works when typed in full, but not listed in help */
  hidden?: boolean;
  /** only available after `enable` */
  priv?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pad = (s: string, n: number) => (s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length));

export function initTerminal() {
  const el = document.getElementById('cli');
  const out = document.getElementById('cli-out');
  const form = document.getElementById('cli-form') as HTMLFormElement | null;
  const input = document.getElementById('cli-input') as HTMLInputElement | null;
  const promptEl = document.getElementById('cli-prompt');
  const dataEl = document.getElementById('cli-data');
  if (!el || !out || !form || !input || !promptEl || !dataEl) return;

  const data: Data = JSON.parse(dataEl.textContent || '{}');
  const host = data.profile.hostname;
  const t0 = Date.now();
  let priv = false;
  let busy = false;
  let greeted = false;
  let lastToggle: HTMLElement | null = null;
  const history: string[] = [];
  let hIdx = 0;

  const prompt = () => `${host}${priv ? '#' : '>'}`;
  const setPrompt = () => (promptEl.textContent = prompt());

  // ---------- output helpers ----------
  function print(html: string, cls = '') {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html || '&nbsp;';
    out!.appendChild(d);
    out!.scrollTop = out!.scrollHeight;
    return d;
  }
  const say = (text = '', cls = '') => print(esc(text), cls);
  const lines = (arr: string[], cls = '') => arr.forEach((t) => say(t, cls));
  const link = (href: string, text: string) =>
    `<a href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${esc(text)}</a>`;

  const findLink = (q: string) => {
    const t = q.toLowerCase();
    return data.links.find((l) => l.id === t) || data.links.find((l) => l.id.startsWith(t));
  };
  const findPage = (q: string) => {
    const t = q.toLowerCase().replace(/^\//, '');
    const key = Object.keys(data.pages).find((k) => k === t) || Object.keys(data.pages).find((k) => k.startsWith(t));
    return key ? { key, url: data.pages[key] } : undefined;
  };

  function uptime() {
    const s = Math.floor((Date.now() - t0) / 1000);
    const m = Math.floor(s / 60);
    return `${m} minute${m === 1 ? '' : 's'}, ${s % 60} second${s % 60 === 1 ? '' : 's'}`;
  }

  // ---------- commands ----------
  const show: Record<string, Cmd> = {
    version: {
      help: 'Who I am and what I run',
      run() {
        const p = data.profile;
        const year = new Date().getFullYear();
        const earned = data.certs.filter((c) => c.status === 'earned').length;
        const inprog = data.certs.filter((c) => c.status === 'in-progress').length;
        lines([
          `${host} IOS-style Software (NETFOLIO-K9), Version ${year}.1, RELEASE SOFTWARE`,
          `Copyright (c) ${year} by ${p.name}`,
          '',
          `${host} uptime is ${uptime()}`,
          `System image file is "flash:career.bin"`,
          '',
          `Role       : ${p.title}`,
          `Focus      : ${p.tagline}`,
          `Location   : ${p.location}`,
          `Currently  : ${p.currently}`,
          `Open to    : ${p.openTo}`,
          '',
          `${earned} certification(s) earned, ${inprog} in progress`,
          `${data.labs.length} lab write-up(s) and ${data.posts.length} post(s) in flash:`,
          ...(data.bytequest
            ? [`Byte Quest: level ${data.bytequest.level.n} (${data.bytequest.level.title}), ${data.bytequest.xp} XP, ${data.bytequest.lessons.done} lessons cleared`]
            : []),
          '',
          'Configuration register is 0x2102',
        ]);
      },
    },
    'running-config': {
      help: 'About me, as a config',
      run() {
        const p = data.profile;
        const body = [
          '!',
          `hostname ${host}`,
          '!',
          `banner motd ^C ${p.title} ^C`,
          '!',
          'interface Career0/0',
          ` description ${p.tagline}`,
          ` location ${p.location}`,
          ' no shutdown',
          '!',
          ...p.bio.map((b) => `! ${b}`),
          '!',
          'line vty 0 4',
          ' transport input ssh',
          '!',
          'end',
        ];
        lines(['Building configuration...', '', `Current configuration : ${body.join('\n').length} bytes`]);
        lines(body);
      },
    },
    certifications: {
      help: 'Certifications: earned, in progress, planned',
      run() {
        if (!data.certs.length) return say('% No certifications configured');
        say(`${pad('Certification', 36)}${pad('Code', 16)}${pad('Status', 13)}Date`, 'c-dim');
        data.certs.forEach((c) => {
          const cls = c.status === 'earned' ? 'c-ok' : c.status === 'in-progress' ? 'c-warn' : 'c-dim';
          print(
            `${esc(pad(c.name, 36))}${esc(pad(c.code, 16))}<span class="${cls}">${esc(pad(c.status, 13))}</span>${esc(c.when)}`,
          );
        });
        print(`\nFull list: ${link(data.pages.certifications, 'certifications page')}`);
      },
    },
    labs: {
      help: 'Lab write-ups and projects',
      run() {
        if (!data.labs.length) return say('% No labs in flash: yet');
        say(`Directory of flash:/labs/`, 'c-dim');
        data.labs.forEach((l, i) => print(`  ${pad(String(i + 1), 4)}${l.date}  ${link(l.url, l.title)}`));
      },
    },
    blog: {
      help: 'Study notes and posts',
      run() {
        if (!data.posts.length) return say('% No posts in flash: yet');
        say(`Directory of flash:/blog/`, 'c-dim');
        data.posts.forEach((l, i) => print(`  ${pad(String(i + 1), 4)}${l.date}  ${link(l.url, l.title)}`));
      },
    },
    ip: {
      help: 'IP information',
      sub: {
        route: { help: 'My career roadmap, as a routing table', run: () => showRoute() },
        interface: {
          help: 'Interface status',
          sub: { brief: { help: 'Skills summary', run: () => showSkills() } },
        },
      },
    },
    interfaces: {
      help: 'How to reach me',
      run() {
        data.links.forEach((l, i) => {
          const name = `${l.label.replace(/\s+/g, '')}0/${i}`;
          say(`${name} is up, line protocol is up`, 'c-ok');
          print(`  Description: ${esc(l.label)}`);
          print(`  Address is ${link(l.url, l.url.replace(/^mailto:/, ''))}`);
        });
      },
    },
    logging: {
      help: 'Experience and education log',
      run() {
        say(`Syslog logging: enabled, ${data.experience.length} messages logged`, 'c-dim');
        say();
        data.experience.forEach((e) => print(`*${esc(e.date)}: <span class="c-warn">%${esc(e.facility)}</span>: ${esc(e.title)}. ${esc(e.detail)}`));
      },
    },
    history: {
      help: 'Commands you have typed',
      run() {
        history.forEach((h) => say(`  ${h}`));
      },
    },
  };

  // ---------- Byte Quest
  const bqBar = (done: number, total: number, width = 20) => {
    const n = total ? Math.round((done / total) * width) : 0;
    return '#'.repeat(n) + '.'.repeat(width - n);
  };
  const bqCls = (s: string) => (s === 'up' ? 'c-ok' : s === 'learning' ? 'c-warn' : 'c-dim');

  function bqSummary() {
    const b = data.bytequest!;
    lines([
      `Byte Quest training log, synced ${b.synced}`,
      '',
      `  Level      : ${b.level.n} (${b.level.title}), ${b.level.into}/${b.level.need} XP to next`,
      `  Total XP   : ${b.xp}`,
      `  Lessons    : ${b.lessons.done} cleared, ${b.recent.days7} in the last 7 days`,
      `  Streak     : ${b.streak.current} day(s), best ${b.streak.best}`,
      `  Badges     : ${b.badges.earned.length} of ${b.badges.total}`,
      '',
    ]);
    say(`${pad('Path', 18)}${pad('Progress', 23)}Lessons`, 'c-dim');
    const shown = b.paths.filter((p) => b.featured.includes(p.id) || p.done > 0);
    shown.forEach((p) =>
      print(`${esc(pad(p.name, 18))}<span class="${bqCls(p.status)}">[${bqBar(p.done, p.total)}]</span> ${p.done}/${p.total}`),
    );
    print(`\nPer track: <span class="c-ok">show bytequest detail</span>  ·  ${link(b.url, 'training log page')}`);
  }

  function bqDetail() {
    const b = data.bytequest!;
    say(`${pad('Port', 9)}${pad('Track', 40)}${pad('Status', 12)}Lessons`, 'c-dim');
    b.paths
      .filter((p) => b.featured.includes(p.id) || p.done > 0)
      .forEach((p, pi) => {
        say(`! ${p.name}`, 'c-dim');
        p.tracks.forEach((t, ti) => {
          const st = t.status === 'up' ? 'connected' : t.status === 'learning' ? 'learning' : 'notconnect';
          print(`${esc(pad(`Bq${pi}/${ti + 1}`, 9))}${esc(pad(t.name, 40))}<span class="${bqCls(t.status)}">${esc(pad(st, 12))}</span>${t.done}/${t.total}`);
        });
      });
  }

  function bqBadges() {
    const b = data.bytequest!;
    say(`${b.badges.earned.length} of ${b.badges.total} badges earned`, 'c-dim');
    b.badges.earned.forEach((x) => print(`  <span class="c-warn">*</span> ${esc(pad(x.name, 20))}<span class="c-dim">${esc(x.desc)}</span>`));
  }

  if (data.bytequest) {
    show.bytequest = {
      help: 'My Byte Quest training progress',
      run: bqSummary,
      sub: {
        detail: { help: 'Every track, like show interfaces status', run: bqDetail },
        badges: { help: 'Badges earned', run: bqBadges },
      },
    };
    show.bq = { ...show.bytequest, hidden: true };
  }

  function showRoute() {
    lines([
      'Codes: C - connected (achieved), S - static (in progress), O - OSPF (planned)',
      '',
    ], 'c-dim');
    const last = data.roadmap[data.roadmap.length - 1];
    say(`Gateway of last resort is ${last ? last.name : 'not set'}`);
    say();
    data.roadmap.forEach((h, i) => {
      const net = `10.0.${i + 1}.0/24`;
      if (h.status === 'reached') print(`<span class="c-ok">C</span>        ${net} is directly connected, ${esc(h.name)} (${esc(h.when)})`);
      else if (h.status === 'current') print(`<span class="c-warn">S</span>        ${net} [1/0] via ${esc(h.name)}, in progress (${esc(h.when)})`);
      else print(`<span class="c-dim">O</span>        ${net} [110/${(i + 1) * 10}] via ${esc(h.name)}, ETA ${esc(h.when)}`);
    });
  }

  function showSkills() {
    say(`${pad('Interface', 12)}${pad('Skill', 26)}${pad('Status', 12)}Protocol`, 'c-dim');
    data.skills.forEach((g, gi) => {
      g.items.forEach((s, si) => {
        const [st, pr, cls] =
          s.status === 'up' ? ['up', 'up', 'c-ok'] : s.status === 'learning' ? ['up', 'learning', 'c-warn'] : ['admin down', 'down', 'c-dim'];
        print(`${esc(pad(`Gi${gi}/${si}`, 12))}${esc(pad(s.name, 26))}<span class="${cls}">${esc(pad(st, 12))}${esc(pr)}</span>`);
      });
    });
  }

  async function traceroute(args: string[]) {
    const target = (args[0] || 'career').toUpperCase();
    lines(['Type escape sequence to abort.', `Tracing the route to ${target}`, ''], 'c-dim');
    for (let i = 0; i < data.roadmap.length; i++) {
      const h = data.roadmap[i];
      if (!reduceMotion()) await sleep(280);
      const base = `  ${pad(String(i + 1), 3)}${pad(h.name, 18)}${pad(h.when, 10)}`;
      if (h.status === 'reached') print(`${esc(base)}<span class="c-ok">4 msec 4 msec 4 msec</span>`);
      else if (h.status === 'current') print(`${esc(base)}<span class="c-warn">8 msec 8 msec *    &lt;- you are here</span>`);
      else print(`${esc(base)}<span class="c-dim">*      *      *    (not reached yet)</span>`);
    }
    print(`\nDetails: ${link(data.pages.certifications + '#roadmap', 'roadmap')}`);
  }

  async function ping(args: string[]) {
    if (!args[0]) return say('% Incomplete command.');
    const l = findLink(args[0]);
    if (!l) {
      say(`% Unrecognized host or address, or protocol not running.`, 'c-err');
      say(`  Try: ${data.links.map((x) => x.id).join(', ')}`, 'c-dim');
      return;
    }
    lines(['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${l.label}, timeout is 2 seconds:`]);
    const row = print('', 'c-ok');
    row.textContent = '';
    for (let i = 0; i < 5; i++) {
      if (!reduceMotion()) await sleep(160);
      row.textContent += '!';
      out!.scrollTop = out!.scrollHeight;
    }
    say('Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms');
    print(`Reply from ${link(l.url, l.url.replace(/^mailto:/, ''))}`);
  }

  async function ssh(args: string[]) {
    if (!args[0]) return say('% Incomplete command.');
    const p = findPage(args[0]);
    if (!p) {
      say(`% Unknown host "${args[0]}"`, 'c-err');
      say(`  Try: ${Object.keys(data.pages).join(', ')}`, 'c-dim');
      return;
    }
    say(`Trying ${p.key}... Open`, 'c-ok');
    await sleep(reduceMotion() ? 0 : 350);
    window.location.href = p.url;
  }

  const commands: Record<string, Cmd> = {
    show: { help: 'Show running system information', sub: show },
    ping: { help: 'Reach me (linkedin, github, email...)', run: ping, args: () => data.links.map((l) => l.id), argHelp: 'Contact link' },
    traceroute: { help: 'Trace my career roadmap', run: traceroute, args: () => ['career', 'ccna'], argHelp: 'Destination' },
    ssh: { help: 'Go to a page (ssh labs)', run: ssh, args: () => Object.keys(data.pages), argHelp: 'Page name' },
    telnet: { help: 'Go to a page (insecure, use ssh)', run: ssh, args: () => Object.keys(data.pages), hidden: true },
    enable: {
      help: 'Turn on privileged commands',
      run() {
        if (priv) return;
        priv = true;
        setPrompt();
        say('% No password set. Privileged mode granted (be nice).', 'c-warn');
      },
    },
    disable: {
      help: 'Turn off privileged commands',
      priv: true,
      run() {
        priv = false;
        setPrompt();
      },
    },
    configure: {
      help: 'Enter configuration mode',
      priv: true,
      sub: {
        terminal: {
          help: 'Configure from the terminal',
          run() {
            say('Enter configuration commands, one per line.  End with CNTL/Z.');
            say(`% ${host} is read-only for visitors. The owner pushes config with git :)`, 'c-warn');
          },
        },
      },
    },
    reload: {
      help: 'Restart the router (replays the boot screen)',
      priv: true,
      async run() {
        say('Proceed with reload? [confirm]');
        await sleep(500);
        try {
          localStorage.removeItem('nf-booted');
        } catch {}
        window.location.href = data.pages.home;
      },
    },
    clear: {
      help: 'Clear the screen',
      run() {
        out!.innerHTML = '';
      },
    },
    help: {
      help: 'How to use this CLI',
      run() {
        lines([
          'Help may be requested at any point in a command by entering a question mark "?".',
          'Commands can be shortened, e.g. "sh ip int br" for "show ip interface brief".',
          'Tab completes a word. Up/Down arrows recall history. Esc closes the console.',
          '',
          'Good places to start:',
          '  show version            who I am',
          '  show certifications     certs and targets',
          '  show ip route           my roadmap',
          '  show ip interface brief skills',
          ...(data.bytequest ? ['  show bytequest          training progress'] : []),
          '  ping linkedin           contact links',
          '  ssh labs                open a page',
        ]);
      },
    },
    exit: { help: 'Close the console', run: () => close() },
    quit: { help: 'Close the console', run: () => close(), hidden: true },
    logout: { help: 'Close the console', run: () => close(), hidden: true },
    cls: { help: 'Clear the screen', run: () => void (out!.innerHTML = ''), hidden: true },
  };

  // ---------- parser ----------
  const visible = (level: Record<string, Cmd>) =>
    Object.keys(level).filter((k) => !level[k].hidden && (!level[k].priv || priv));

  function resolve(level: Record<string, Cmd>, tok: string) {
    const t = tok.toLowerCase();
    if (level[t] && (!level[t].priv || priv)) return { key: t, matches: [t] };
    const matches = visible(level).filter((k) => k.startsWith(t));
    return { key: matches.length === 1 ? matches[0] : undefined, matches };
  }

  function tokenize(s: string) {
    const toks: { t: string; i: number }[] = [];
    for (const m of s.matchAll(/\S+/g)) toks.push({ t: m[0], i: m.index ?? 0 });
    return toks;
  }

  function caret(index: number) {
    say(' '.repeat(prompt().length + index) + '^', 'c-err');
    say(`% Invalid input detected at '^' marker.`, 'c-err');
  }

  /** Walk the command tree. Returns where we ended up, or reports an error. */
  function walk(toks: { t: string; i: number }[], report = true) {
    let level: Record<string, Cmd> | undefined = commands;
    let cmd: Cmd | undefined;
    for (let i = 0; i < toks.length; i++) {
      if (!level) return { cmd, level, args: toks.slice(i).map((x) => x.t) };
      const r = resolve(level, toks[i].t);
      if (!r.key) {
        if (report) r.matches.length > 1 ? say(`% Ambiguous command:  "${toks.map((x) => x.t).join(' ')}"`, 'c-err') : caret(toks[i].i);
        return null;
      }
      cmd = level[r.key];
      level = cmd.sub;
    }
    return { cmd, level, args: [] as string[] };
  }

  function contextHelp(raw: string) {
    const body = raw.slice(0, -1);
    const partial = /\S$/.test(body);
    const toks = tokenize(body);
    const head = partial ? toks.slice(0, -1) : toks;
    const w = walk(head);
    if (!w) return;
    if (partial) {
      const last = toks[toks.length - 1].t.toLowerCase();
      const opts = w.level ? visible(w.level) : (w.cmd?.args?.() ?? []);
      const m = opts.filter((k) => k.startsWith(last));
      m.length ? say(m.join('  ')) : say('% Unrecognized command', 'c-err');
    } else if (w.level) {
      visible(w.level).forEach((k) => say(`  ${pad(k, 18)}${w.level![k].help}`));
      if (w.cmd?.run) say('  <cr>');
    } else if (w.cmd?.args && w.args.length === 0) {
      say(`  WORD              ${w.cmd.argHelp ?? 'Argument'}`);
      say(`                    (${w.cmd.args().join(', ')})`, 'c-dim');
    } else {
      say('  <cr>');
    }
    input!.value = body;
  }

  function complete() {
    const v = input!.value;
    if (!v || /\s$/.test(v)) return;
    const toks = tokenize(v);
    const w = walk(toks.slice(0, -1), false);
    if (!w) return;
    const last = toks[toks.length - 1];
    const opts = w.level ? visible(w.level) : (w.cmd?.args?.() ?? []);
    const m = opts.filter((k) => k.startsWith(last.t.toLowerCase()));
    if (m.length === 1) input!.value = v.slice(0, last.i) + m[0] + ' ';
    else if (m.length > 1) {
      echo(v);
      say(m.join('  '));
    }
  }

  function echo(text: string) {
    print(`<b>${esc(prompt())}</b>${esc(text)}`, 'c-in');
  }

  async function exec(raw: string) {
    echo(raw);
    const line = raw.trim();
    if (!line) return;
    history.push(line);
    hIdx = history.length;
    if (line.endsWith('?')) return contextHelp(raw.trimStart());

    const toks = tokenize(raw);
    let level: Record<string, Cmd> = commands;
    for (let i = 0; i < toks.length; i++) {
      const r = resolve(level, toks[i].t);
      if (!r.key) {
        if (r.matches.length > 1) say(`% Ambiguous command:  "${line}"`, 'c-err');
        else caret(toks[i].i);
        return;
      }
      const cmd: Cmd = level[r.key];
      if (cmd.sub && i < toks.length - 1) {
        level = cmd.sub;
        continue;
      }
      if (cmd.run) return cmd.run(toks.slice(i + 1).map((x) => x.t));
      return void say('% Incomplete command.', 'c-err');
    }
  }

  // ---------- open / close ----------
  function open() {
    el!.hidden = false;
    document.querySelectorAll('[data-cli-toggle]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    if (!greeted) {
      greeted = true;
      say(`${host} con0 is now available`, 'c-dim');
      say();
      say('Press RETURN to get started.', 'c-dim');
      say();
      print(
        `Type <span class="c-ok">?</span> for commands, or try <span class="c-ok">show version</span>, <span class="c-ok">show ip route</span>, <span class="c-ok">ping linkedin</span>.`,
      );
    }
    input!.focus();
  }
  function close() {
    el!.hidden = true;
    document.querySelectorAll('[data-cli-toggle]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    (lastToggle ?? document.body).focus?.();
  }
  const toggle = () => (el!.hidden ? open() : close());

  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cli-toggle]');
    if (t) {
      lastToggle = t;
      toggle();
    }
    if ((e.target as HTMLElement).closest('[data-cli-close]')) close();
  });

  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    const typing = target.matches('input, textarea, select, [contenteditable="true"]') && target !== input;
    if (e.key === '`' && !typing) {
      e.preventDefault();
      lastToggle = null;
      toggle();
    } else if (e.key === 'Escape' && !el!.hidden) {
      close();
    }
  });

  out.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('a') && !window.getSelection()?.toString()) input!.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIdx > 0) input!.value = history[--hIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hIdx = Math.min(history.length, hIdx + 1);
      input!.value = history[hIdx] ?? '';
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out!.innerHTML = '';
    } else if (e.key === 'c' && e.ctrlKey && input!.selectionStart === input!.selectionEnd) {
      // no selection: behave like ^C
      echo(input!.value + '^C');
      input!.value = '';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = input!.value;
    input!.value = '';
    busy = true;
    try {
      await exec(v);
    } finally {
      busy = false;
    }
  });

  setPrompt();
}
