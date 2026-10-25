---
title: Subnetting without a calculator
summary: Sample post. The block-size method I use to subnet in my head for the CCNA.
date: 2026-09-20
tags: [subnetting, IPv4, CCNA]
track: networking
milestone: foundations
---

> **Sample post.** Replace with your own study notes.

## The block-size trick

Take the interesting octet of the mask and subtract it from 256. That's your block size.

| Mask | CIDR | Block size | Hosts |
| --- | --- | --- | --- |
| 255.255.255.128 | /25 | 128 | 126 |
| 255.255.255.192 | /26 | 64 | 62 |
| 255.255.255.224 | /27 | 32 | 30 |
| 255.255.255.240 | /28 | 16 | 14 |

## Example

`192.168.1.77/27` → block size 32 → networks at .0, .32, .64, .96 → 77 sits in **.64**.
Broadcast is .95, usable hosts .65 – .94.
