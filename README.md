# Networking portfolio

Personal career site styled like a Cisco IOS console, built with [Astro](https://astro.build) and GSAP.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Where to edit

| What | File |
| --- | --- |
| Name, hostname, bio, links, CV, skills, experience | `src/data/profile.ts` |
| Growth path / roadmap | `src/data/roadmap.ts` |
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

`show version` · `show bytequest [detail|badges]` · `show running-config` · `show certifications` · `show labs` · `show blog` · `show ip route` · `show ip interface brief` · `show interfaces` · `show logging` · `traceroute career` · `ping linkedin` · `ssh labs` · `enable` · `configure terminal` · `reload` · `clear` · `exit`
