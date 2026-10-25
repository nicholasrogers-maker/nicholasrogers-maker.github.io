---
title: Reading my first Wireshark capture
summary: Sample security post. Following a TCP three-way handshake and an HTTP request packet by packet.
date: 2026-10-10
tags: [Wireshark, TCP, packet analysis]
track: security
milestone: security
---

> **Sample post.** Swap this for your own TryHackMe, Hack The Box or Wireshark write-ups.

## The handshake

1. **SYN**: client picks a random sequence number.
2. **SYN-ACK**: server acknowledges it and sends its own.
3. **ACK**: connection established.

Filter used: `tcp.flags.syn == 1`

## What I learned

- Display filters vs capture filters.
- How to follow a TCP stream to see the full conversation.
