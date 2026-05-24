export type DocLink = { slug: string; title: string; description: string };
export type DocGroup = { label: string; links: DocLink[] };

export const docsNav: DocGroup[] = [
  {
    label: "Getting started",
    links: [
      { slug: "", title: "Overview", description: "What Relay is and how it fits together." },
      { slug: "quickstart", title: "Quickstart", description: "Clone, bootstrap, run your first agent in two minutes." },
      { slug: "architecture", title: "Architecture", description: "The three services, the database, and the seams between them." },
    ],
  },
  {
    label: "SDK",
    links: [
      { slug: "sdk", title: "SDK reference", description: "createAgent, builtin tools, events, options." },
      { slug: "tools", title: "Tools", description: "Built-in tools and custom function tools (with the full callback protocol)." },
      { slug: "memory", title: "Memory", description: "Semantic memory: pgvector, namespaces, retrieval pipeline." },
      { slug: "providers", title: "Providers", description: "Anthropic, OpenAI, and any OpenAI-compatible endpoint." },
    ],
  },
  {
    label: "Operating",
    links: [
      { slug: "api", title: "HTTP API", description: "Every control-plane endpoint, with curl examples." },
      { slug: "self-host", title: "Self-host", description: "Production deployment, env vars, security, scaling." },
    ],
  },
];

export function findDoc(slug: string): DocLink | null {
  for (const group of docsNav) {
    for (const link of group.links) {
      if (link.slug === slug) return link;
    }
  }
  return null;
}

export function neighborDocs(slug: string): { prev: DocLink | null; next: DocLink | null } {
  const flat = docsNav.flatMap((g) => g.links);
  const i = flat.findIndex((l) => l.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? flat[i - 1] ?? null : null,
    next: i < flat.length - 1 ? flat[i + 1] ?? null : null,
  };
}
