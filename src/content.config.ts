import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One Markdown file per certification.
const certs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/certs' }),
  schema: z.object({
    name: z.string(),
    code: z.string().optional(),
    issuer: z.string(),
    status: z.enum(['earned', 'in-progress', 'planned']),
    earned: z.coerce.date().optional(),
    target: z.string().optional(),
    verifyUrl: z.string().url().optional(),
    order: z.number().default(99),
  }),
});

const post = z.object({
  title: z.string(),
  summary: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  // 'security' items also appear on the Security page.
  track: z.enum(['networking', 'security']).default('networking'),
  // Optional roadmap hop id from src/data/roadmap.ts
  milestone: z.string().optional(),
  draft: z.boolean().default(false),
});

// Lab write-ups and projects.
const labs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/labs' }),
  schema: post.extend({ tools: z.array(z.string()).default([]) }),
});

// Study notes, CTF write-ups, blog posts.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: post,
});

export const collections = { certs, labs, blog };
