// ---------------------------------------------------------------
// Your details. Edit this file to personalise the whole site:
// the pages, the boot screen and the CLI all read from here.
// ---------------------------------------------------------------

export const profile = {
  name: 'Your Name',
  // Shown as the router prompt, e.g. "NET-PORTFOLIO#". Keep it short, no spaces.
  hostname: 'NET-PORTFOLIO',
  title: 'Aspiring Network Engineer',
  tagline: 'CCNA candidate · Routing, switching & cyber security',
  location: 'Your City, Country',
  currently: 'Studying for CCNA 200-301',
  openTo: 'Junior network / NOC / helpdesk roles',

  // Short paragraphs for the About page.
  bio: [
    'Write two or three sentences about your background and how you got into networking.',
    'Say what you enjoy: building labs, troubleshooting, figuring out why packets go where they go.',
    'Finish with where you are heading: CCNA next, then cyber security.',
  ],

  email: 'you@example.com',
  // Put your CV in /public (e.g. public/cv.pdf) and set this to 'cv.pdf'. Leave empty to hide the button.
  cvFile: '',

  // Leave a URL empty ('') to hide that link everywhere.
  links: [
    { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/your-profile' },
    { id: 'github', label: 'GitHub', url: 'https://github.com/your-username' },
    { id: 'credly', label: 'Credly', url: '' },
    { id: 'tryhackme', label: 'TryHackMe', url: '' },
    { id: 'hackthebox', label: 'Hack The Box', url: '' },
  ],
};

// Skills render like `show ip interface brief`.
// status: 'up' = comfortable, 'learning' = working on it, 'planned' = on the roadmap.
export type SkillStatus = 'up' | 'learning' | 'planned';
export const skills: { group: string; items: { name: string; status: SkillStatus }[] }[] = [
  {
    group: 'Routing & Switching',
    items: [
      { name: 'IPv4 subnetting', status: 'up' },
      { name: 'VLANs & trunking', status: 'learning' },
      { name: 'Inter-VLAN routing', status: 'learning' },
      { name: 'STP', status: 'learning' },
      { name: 'OSPFv2', status: 'planned' },
      { name: 'IPv6', status: 'planned' },
    ],
  },
  {
    group: 'Services & Security',
    items: [
      { name: 'DHCP / DNS', status: 'learning' },
      { name: 'NAT / PAT', status: 'learning' },
      { name: 'ACLs', status: 'learning' },
      { name: 'Port security', status: 'planned' },
      { name: 'Site-to-site VPN', status: 'planned' },
    ],
  },
  {
    group: 'Tools & Platforms',
    items: [
      { name: 'Cisco Packet Tracer', status: 'up' },
      { name: 'Wireshark', status: 'learning' },
      { name: 'Linux CLI', status: 'learning' },
      { name: 'GNS3 / CML', status: 'planned' },
      { name: 'Python / Netmiko', status: 'planned' },
    ],
  },
];

// Experience and education render like syslog entries (`show logging`).
// Newest first.
export const experience = [
  {
    date: '2026',
    facility: 'STUDY-5-START',
    title: 'Started CCNA 200-301 study',
    detail: 'Cisco Networking Academy / self-study. Replace with your own details.',
  },
  {
    date: '2025',
    facility: 'JOB-6-ROLE',
    title: 'Your current or most recent role',
    detail: 'Company · one line on what you did and any IT/network exposure.',
  },
  {
    date: '2024',
    facility: 'EDU-6-COMPLETE',
    title: 'Education or training',
    detail: 'School / course · subject.',
  },
];

export const activeLinks = profile.links.filter((l) => l.url);
