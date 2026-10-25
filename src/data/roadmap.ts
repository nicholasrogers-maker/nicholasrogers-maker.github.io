// Your growth path lives in roadmap.json (edit with `npm run editor`).
// Shown as a traceroute on the Certifications page and as `show ip route` in the CLI.
// Labs and posts link to a hop by setting `milestone: '<id>'` in their front matter.
import data from './roadmap.json';

export type HopStatus = 'reached' | 'current' | 'planned';

export const roadmap = data as {
  id: string;
  name: string;
  status: HopStatus;
  when: string;
  summary: string;
  goals: string[];
}[];
