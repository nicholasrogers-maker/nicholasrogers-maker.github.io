---
title: VLANs and router-on-a-stick
summary: Sample write-up. Split a flat LAN into three VLANs and route between them with 802.1Q sub-interfaces.
date: 2026-10-01
tags: [VLAN, 802.1Q, inter-VLAN routing]
tools: [Packet Tracer]
track: networking
milestone: ccna
---

> **Sample lab.** Use this as a template for your own write-ups: objective, topology, config, verification, lessons learned. Replace or delete it when you add your first real lab.

## Objective

Separate staff, guest and management traffic into their own VLANs, then let them reach each other through a single router interface.

## Topology

| Device | Interface | VLAN | Address |
| --- | --- | --- | --- |
| R1 | Gi0/0.10 | 10 STAFF | 192.168.10.1/24 |
| R1 | Gi0/0.20 | 20 GUEST | 192.168.20.1/24 |
| R1 | Gi0/0.99 | 99 MGMT | 192.168.99.1/24 |
| SW1 | Gi0/1 | trunk | – |

## Switch configuration

```text
SW1(config)# vlan 10
SW1(config-vlan)# name STAFF
SW1(config-vlan)# vlan 20
SW1(config-vlan)# name GUEST
SW1(config)# interface range fa0/1 - 12
SW1(config-if-range)# switchport mode access
SW1(config-if-range)# switchport access vlan 10
SW1(config)# interface gi0/1
SW1(config-if)# switchport mode trunk
SW1(config-if)# switchport trunk allowed vlan 10,20,99
```

## Router configuration

```text
R1(config)# interface gi0/0.10
R1(config-subif)# encapsulation dot1Q 10
R1(config-subif)# ip address 192.168.10.1 255.255.255.0
R1(config)# interface gi0/0.20
R1(config-subif)# encapsulation dot1Q 20
R1(config-subif)# ip address 192.168.20.1 255.255.255.0
R1(config)# interface gi0/0
R1(config-if)# no shutdown
```

## Verification

```text
SW1# show interfaces trunk
Port        Mode         Encapsulation  Status        Native vlan
Gi0/1       on           802.1q         trunking      1

R1# show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     unassigned      YES unset  up                    up
GigabitEthernet0/0.10  192.168.10.1    YES manual up                    up
GigabitEthernet0/0.20  192.168.20.1    YES manual up                    up
```

## Lessons learned

- Forgetting `no shutdown` on the physical interface leaves every sub-interface down.
- The trunk's allowed VLAN list must include every VLAN the router serves.
- Next step: replace router-on-a-stick with a Layer 3 switch and SVIs.
