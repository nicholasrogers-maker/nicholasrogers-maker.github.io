# Networking portfolio

Personal career site styled like a Cisco IOS console, built with [Astro](https://astro.build) and GSAP.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Editing content (the easy way)

```bash
npm run editor
```

Opens a local editor at http://127.0.0.1:4400 and a live site preview. From there you can edit your
profile, links, CV, skills, experience, roadmap and certifications; write labs and posts with templates,
live preview and image upload (or paste a screenshot); and press **Publish** to push to GitHub.
New labs and posts start as **drafts**: they show in the local preview but not on the live site until
you untick "Draft". The editor only runs on your computer and is never deployed.

## Where to edit (by hand)

| What | File |
| --- | --- |
| Name, hostname, bio, links, CV, skills, experience | `src/data/profile.json` |
| Growth path / roadmap | `src/data/roadmap.json` |
| Certifications (one file each) | `src/content/certs/*.md` |
| Lab write-ups | `src/content/labs/*.md` |
| Blog posts, notes, CTF write-ups | `src/content/blog/*.md` |
| Colours and fonts | `src/styles/global.css` (`:root`) |

### Adding a lab or post

Copy an existing file in `src/content/labs/` or `src/content/blog/` and change the front matter:

```yaml
title: OSPF single-area lab
summary: One line shown on the card.
date: 2026-11-02
tags: [OSPF, routing]
tools: [Packet Tracer]   # labs only
track: networking        # or: security (also lists it on the Security page)
milestone: ccna          # links it to a roadmap hop (ids in roadmap.ts)
draft: false             # true hides it
```

It appears on the Labs/Blog page, on the home page, under its roadmap hop, and in the CLI (`show labs`).

### Byte Quest progress

The Training log (home page, Certifications page, `show bytequest` in the CLI) comes from
`src/data/bytequest.json`, a snapshot of Byte Quest progress. Ask Claude to "sync Byte Quest",
or see [scripts/bytequest/README.md](scripts/bytequest/README.md). Settings live in `src/data/bytequest.ts`.

### CV

Put `cv.pdf` in `public/` and set `cvFile: 'cv.pdf'` in `profile.ts`.

## Deploy (GitHub Pages)

1. Create a GitHub repo and push this folder to `main`.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.
   Naming the repo `<username>.github.io` serves it at the root URL.

## CLI cheatsheet

Press <kbd>`</kbd> or the `>_` button. Abbreviations work like IOS (`sh ip int br`), `?` shows help, Tab completes.

Security: `nmap nick` · `show access-lists` · `show crypto key` · `hash sha256 <text>` · `decode base64 <text>` · `decrypt type7 <hash>` · `ctf` / `hint` / `submit flag{...}`

### Site CTF

A flag is hidden on the site. The clue trail: a comment in every page's source → `public/robots.txt`
→ the unlinked `/noc/` page → a base64 "backup" → a Cisco type 7 password → the flag. The flag and hints live in
`src/data/security.ts` (only its SHA-256 hash is sent to browsers). Change the flag there to reset the puzzle.

General: `show version` · `show bytequest [detail|badges]` · `show running-config` · `show certifications` · `show labs` · `show blog` · `show ip route` · `show ip interface brief` · `show interfaces` · `show logging` · `traceroute career` · `ping linkedin` · `ssh labs` · `enable` · `configure terminal` · `reload` · `clear` · `exit`
