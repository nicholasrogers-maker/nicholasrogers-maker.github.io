// Your details live in profile.json. Edit them with the local editor (`npm run editor`)
// or by hand. The pages, boot screen and CLI all read from here.
import data from './profile.json';

export type SkillStatus = 'up' | 'learning' | 'planned';
export type Link = { id: string; label: string; url: string };

export const profile = {
  name: data.name,
  hostname: data.hostname,
  title: data.title,
  tagline: data.tagline,
  location: data.location,
  currently: data.currently,
  openTo: data.openTo,
  bio: data.bio,
  email: data.email,
  cvFile: data.cvFile,
  links: data.links as Link[],
};

// Skills render like `show ip interface brief`.
// status: 'up' = comfortable, 'learning' = working on it, 'planned' = on the roadmap.
export const skills = data.skills as { group: string; items: { name: string; status: SkillStatus }[] }[];

// Experience and education render like syslog entries (`show logging`). Newest first.
export const experience = data.experience as { date: string; facility: string; title: string; detail: string }[];

export const activeLinks = profile.links.filter((l) => l.url);
