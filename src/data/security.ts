// Security-themed content: ACL focus areas, the SOC console alerts and the site CTF.

// Security page + `show access-lists` in the CLI.
export const acl = [
  { seq: 10, action: 'permit', rule: 'packet analysis', note: 'Wireshark, tcpdump' },
  { seq: 20, action: 'permit', rule: 'hardening', note: 'ACLs, port security, SSH-only management' },
  { seq: 30, action: 'permit', rule: 'blue team practice', note: 'TryHackMe / Hack The Box labs' },
  { seq: 40, action: 'permit', rule: 'vulnerability scanning', note: 'Nmap, in my own lab only' },
  { seq: 50, action: 'deny', rule: 'any any', note: 'unauthorised testing' },
];

// SOC console on the Security page. Technique IDs are from MITRE ATT&CK.
export type Alert = {
  sev: 'high' | 'medium' | 'low';
  sig: string;
  proto: string;
  dport: number | null;
  internalSrc?: boolean;
  /** fixed traffic description for local-only attacks (ARP, DHCP); {h} becomes a random host number */
  flow?: string;
  technique: string;
  techniqueName: string;
  tactic: string;
  what: string;
  detect: string;
  respond: string;
};

export const alerts: Alert[] = [
  {
    sev: 'high',
    sig: 'SSH brute force: 40 failed logins in 60s',
    proto: 'TCP',
    dport: 22,
    technique: 'T1110',
    techniqueName: 'Brute Force',
    tactic: 'Credential Access',
    what: 'An attacker tries many passwords against SSH, hoping one account has a weak one.',
    detect: 'Count failed logins per source IP in auth logs or the SIEM; alert above a threshold.',
    respond: 'Block the source at the edge ACL, enforce key-based SSH, and use login block-for on Cisco devices.',
  },
  {
    sev: 'medium',
    sig: 'Port scan: 1,000 ports probed in 4s',
    proto: 'TCP',
    dport: null,
    technique: 'T1046',
    techniqueName: 'Network Service Discovery',
    tactic: 'Discovery',
    what: 'Reconnaissance: mapping which services are listening before choosing what to attack.',
    detect: 'IDS rules for many SYNs to different ports from one host; firewall deny-log spikes.',
    respond: 'Confirm only intended ports are exposed, and keep the scanner on a watch list.',
  },
  {
    sev: 'high',
    sig: "SQL injection attempt in web request: ' OR 1=1 --",
    proto: 'HTTP',
    dport: 443,
    technique: 'T1190',
    techniqueName: 'Exploit Public-Facing Application',
    tactic: 'Initial Access',
    what: 'Input crafted to change a database query, aiming to dump or bypass login data.',
    detect: 'WAF signatures and web server logs showing SQL keywords in parameters.',
    respond: 'Block at the WAF, check the app uses parameterised queries, review logs for success.',
  },
  {
    sev: 'medium',
    sig: 'DNS tunnelling suspected: long random subdomains',
    proto: 'UDP',
    dport: 53,
    internalSrc: true,
    technique: 'T1071.004',
    techniqueName: 'Application Layer Protocol: DNS',
    tactic: 'Command and Control',
    what: 'Malware hides command traffic inside DNS lookups because DNS is rarely blocked.',
    detect: 'Unusually long or high-entropy query names, and lots of TXT queries to one domain.',
    respond: 'Isolate the host, sinkhole the domain, force clients to use internal resolvers only.',
  },
  {
    sev: 'high',
    sig: 'ARP spoofing: gateway MAC changed on VLAN 10',
    proto: 'ARP',
    dport: null,
    internalSrc: true,
    flow: 'ARP reply from 10.10.10.{h}: 10.10.10.1 is-at 3c:52:82:aa:13:07 (expected 00:1a:2b:3c:4d:01)',
    technique: 'T1557.002',
    techniqueName: 'Adversary-in-the-Middle: ARP Cache Poisoning',
    tactic: 'Credential Access',
    what: "A host claims to be the default gateway so other devices' traffic flows through it.",
    detect: 'Dynamic ARP Inspection drops, or the gateway IP suddenly mapping to a new MAC.',
    respond: 'Enable DHCP snooping + DAI on access switches, shut the offending port.',
  },
  {
    sev: 'medium',
    sig: 'Rogue DHCP server offering leases on VLAN 20',
    proto: 'UDP',
    dport: 67,
    internalSrc: true,
    flow: 'DHCPOFFER from 10.10.20.{h}:67 → 255.255.255.255:68 on untrusted port Gi1/0/14',
    technique: 'T1557.003',
    techniqueName: 'Adversary-in-the-Middle: DHCP Spoofing',
    tactic: 'Credential Access',
    what: 'An unauthorised DHCP server hands out itself as gateway or DNS to redirect traffic.',
    detect: 'DHCP snooping violations, or offers coming from an untrusted port.',
    respond: 'Trust only uplink ports for DHCP with snooping; find and disable the rogue device.',
  },
  {
    sev: 'high',
    sig: 'SYN flood: 80k half-open connections',
    proto: 'TCP',
    dport: 443,
    technique: 'T1498',
    techniqueName: 'Network Denial of Service',
    tactic: 'Impact',
    what: 'Flooding a server with connection requests so legitimate users cannot get through.',
    detect: 'Spikes in SYN rate and half-open connections on the firewall or load balancer.',
    respond: 'SYN cookies, rate limiting, and upstream DDoS scrubbing from the provider.',
  },
  {
    sev: 'medium',
    sig: 'RDP logon from a workstation to 6 servers in 2 min',
    proto: 'TCP',
    dport: 3389,
    internalSrc: true,
    technique: 'T1021.001',
    techniqueName: 'Remote Services: Remote Desktop Protocol',
    tactic: 'Lateral Movement',
    what: 'An attacker with one foothold hops to other machines using stolen credentials.',
    detect: 'Unusual RDP source/destination pairs and logons outside normal patterns.',
    respond: 'Disable the account, isolate the source host, restrict RDP to jump hosts only.',
  },
  {
    sev: 'high',
    sig: '2.3 GB outbound to unknown host on tcp/8443',
    proto: 'TCP',
    dport: 8443,
    internalSrc: true,
    technique: 'T1048',
    techniqueName: 'Exfiltration Over Alternative Protocol',
    tactic: 'Exfiltration',
    what: 'Stolen data leaving the network over an unusual port to avoid web proxies.',
    detect: 'NetFlow showing large uploads to new destinations; egress firewall logs.',
    respond: 'Block egress to the destination, isolate the host, start incident response.',
  },
  {
    sev: 'low',
    sig: 'Phishing email with macro attachment quarantined',
    proto: 'SMTP',
    dport: 25,
    technique: 'T1566.001',
    techniqueName: 'Phishing: Spearphishing Attachment',
    tactic: 'Initial Access',
    what: 'A document with malicious macros sent to staff to get code running inside.',
    detect: 'Mail gateway sandboxing and attachment rules; user reports.',
    respond: 'Purge matching emails from all mailboxes, block the sender, remind staff.',
  },
];

// Site CTF. The flag itself never ships to the browser: only its SHA-256 hash does.
// (This repo is public, so anyone reading the source can find it. That counts as recon too.)
export const ctf = {
  flag: 'flag{type7_is_not_encryption}',
  hints: [
    'Recon first. View the page source of any page on this site.',
    'Well-behaved robots read /robots.txt before they crawl.',
    'The NOC left an encoded backup in their shift log. Try: decode base64 <text>',
    "Cisco 'type 7' passwords are reversible. Try: decrypt type7 <hash>",
  ],
};
