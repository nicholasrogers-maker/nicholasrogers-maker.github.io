import { getCollection } from 'astro:content';

// Drafts show up while previewing locally (npm run dev / editor) but never on the live site.
const visible = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

export async function getLabs() {
  const items = await getCollection('labs', visible);
  return items.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getPosts() {
  const items = await getCollection('blog', visible);
  return items.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

const certOrder = { earned: 0, 'in-progress': 1, planned: 2 } as const;
export async function getCerts() {
  const items = await getCollection('certs');
  return items.sort(
    (a, b) => certOrder[a.data.status] - certOrder[b.data.status] || a.data.order - b.data.order,
  );
}
