export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}

export type Dict = {
  meta: { title: string; description: string };
  nav: {
    docs: string;
    login: string;
    dashboard: string;
    github: string;
    star: string;
  };
  hero: {
    badge: string;
    title: string;
    sub: string;
    primary: string;
    secondary: string;
    tertiary: string;
    codeCaption: string;
  };
  why: {
    title: string;
    body: string;
  };
  compare: {
    title: string;
    sub: string;
    withoutLabel: string;
    withoutItems: string[];
    withLabel: string;
    withCaption: string;
  };
  trace: {
    title: string;
    sub: string;
    caption: string;
  };
  cta: { title: string; sub: string; button: string };
  footer: {
    tagline: string;
    license: string;
    product: string;
    productLinks: { docs: string; github: string };
    company: string;
    companyLinks: { contact: string };
    copyright: string;
  };
  docs: {
    title: string;
    sub: string;
    sections: { title: string; body: string; code?: string }[];
  };
  login: {
    title: string;
    sub: string;
    label: string;
    placeholder: string;
    button: string;
    hint: string;
    saved: string;
  };
};

const en: Dict = {
  meta: {
    title: "Relay — the backend cloud for reliable AI agents",
    description:
      "Memory, retries, tools, traces, and durable execution — without building orchestration infrastructure yourself.",
  },
  nav: {
    docs: "Docs",
    login: "Login",
    dashboard: "Dashboard",
    github: "GitHub",
    star: "Star",
  },
  hero: {
    badge: "Open source · Apache 2.0",
    title: "The backend cloud for reliable AI agents.",
    sub: "Memory, retries, tools, traces, and durable execution — without building orchestration infrastructure yourself.",
    primary: "Start building",
    secondary: "GitHub",
    tertiary: "Documentation",
    codeCaption: "agent.ts",
  },
  why: {
    title: "AI apps fail in production because orchestration is unreliable.",
    body: "Every team building real agents ends up writing the same plumbing: queues, retries, state machines, tool dispatch, traces, memory, replay. Relay is that plumbing — already built, battle-shaped, and out of your way.",
  },
  compare: {
    title: "Stop building infrastructure.",
    sub: "Same agent. One line vs nine systems.",
    withoutLabel: "Without Relay",
    withoutItems: [
      "OpenAI / Anthropic SDK",
      "Redis",
      "Queues",
      "Retries + backoff",
      "State management",
      "Tool orchestration",
      "Tracing + replay",
      "Worker pool",
      "Memory + embeddings",
    ],
    withLabel: "With Relay",
    withCaption: "One SDK. Every provider. Memory, tools, traces, retries — built in.",
  },
  trace: {
    title: "Every run is a complete execution trace.",
    sub: "Tokens, tool calls, results, memory retrievals, errors — captured in order. Replay anything.",
    caption: "Built-in dashboard. See exactly what the model did — including the mistakes it self-corrected.",
  },
  cta: {
    title: "Start building reliable agents.",
    sub: "Open source. Apache 2.0. Self-host or join the cloud beta.",
    button: "Start building",
  },
  footer: {
    tagline: "The backend cloud for reliable AI agents.",
    license: "Apache 2.0",
    product: "Product",
    productLinks: { docs: "Docs", github: "GitHub" },
    company: "Project",
    companyLinks: { contact: "Contact" },
    copyright: "© Relay Contributors. Apache 2.0.",
  },
  docs: {
    title: "Documentation",
    sub: "Ship a streaming, traced, memory-aware agent in fifteen minutes.",
    sections: [
      {
        title: "Install",
        body: "The SDK is a single package. For self-host, the whole stack is three services and Postgres.",
        code: "pnpm add @relayhq/sdk\n# or\nnpm install @relayhq/sdk",
      },
      {
        title: "Your first agent",
        body: "Use a built-in model. Streaming events are an async iterable.",
        code: `import { createAgent, builtin } from "@relayhq/sdk";\n\nconst agent = createAgent({\n  apiKey: process.env.RELAY_API_KEY,\n  model: "claude-sonnet-4-6",\n  tools: [builtin.calculator],\n});\n\nfor await (const e of agent.run("What is 23 * 47?")) {\n  if (e.type === "token") process.stdout.write(e.text);\n}`,
      },
      {
        title: "Custom function tools",
        body: "Declare a schema and a handler. The handler runs in your process — Relay only orchestrates the call.",
        code: `import { tool } from "@relayhq/sdk";\n\nconst getUser = tool({\n  name: "get_user",\n  description: "Look up a user by id",\n  inputSchema: {\n    type: "object",\n    properties: { id: { type: "string" } },\n    required: ["id"],\n  },\n  async handler({ id }: { id: string }) {\n    return db.users.findById(id);\n  },\n});`,
      },
      {
        title: "Semantic memory",
        body: "Pass `memory: { namespace }` and the agent recalls relevant past turns automatically.",
        code: `const agent = createAgent({\n  model: "gpt-4o-mini",\n  memory: { namespace: \`user:\${userId}\` },\n});`,
      },
      {
        title: "Bring your own keys",
        body: "Upload provider credentials once. Relay encrypts them with AES-256-GCM and decrypts on demand.",
        code: `curl -X PUT $RELAY_URL/v1/credentials/openai \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -d '{"apiKey":"sk-..."}'`,
      },
      {
        title: "Self-host",
        body: "Clone, docker compose up, bootstrap. Same code in dev and prod.",
        code: "git clone https://github.com/KevinCorrea5103/relay\npnpm db:up && pnpm db:migrate\npnpm db:bootstrap\npnpm dev:runtime & pnpm dev:control-plane & pnpm dev:dashboard",
      },
    ],
  },
  login: {
    title: "Sign in",
    sub: "Enter the Relay API key you got from `pnpm db:bootstrap`.",
    label: "API key",
    placeholder: "relay_live_…",
    button: "Continue to dashboard",
    hint: "Don't have one yet? Self-host with `pnpm db:bootstrap`, or join the cloud waitlist on GitHub.",
    saved: "Stored locally. Redirecting…",
  },
};

const es: Dict = {
  meta: {
    title: "Relay — el cloud backend para agentes de IA confiables",
    description:
      "Memoria, retries, tools, traces y durable execution — sin construir vos la infraestructura de orquestación.",
  },
  nav: {
    docs: "Docs",
    login: "Login",
    dashboard: "Dashboard",
    github: "GitHub",
    star: "Star",
  },
  hero: {
    badge: "Open source · Apache 2.0",
    title: "El cloud backend para agentes de IA confiables.",
    sub: "Memoria, retries, tools, traces y durable execution — sin construir vos la infraestructura de orquestación.",
    primary: "Empezar",
    secondary: "GitHub",
    tertiary: "Documentación",
    codeCaption: "agent.ts",
  },
  why: {
    title: "Las apps de IA fallan en producción porque la orquestación no es confiable.",
    body: "Todo equipo que construye agentes reales termina escribiendo la misma plomería: queues, retries, máquinas de estado, dispatch de tools, traces, memoria, replay. Relay es esa plomería — ya construida, probada, fuera del camino.",
  },
  compare: {
    title: "Dejá de construir infraestructura.",
    sub: "El mismo agente. Una línea contra nueve sistemas.",
    withoutLabel: "Sin Relay",
    withoutItems: [
      "SDK de OpenAI / Anthropic",
      "Redis",
      "Queues",
      "Retries + backoff",
      "Manejo de estado",
      "Orquestación de tools",
      "Tracing + replay",
      "Worker pool",
      "Memoria + embeddings",
    ],
    withLabel: "Con Relay",
    withCaption: "Un SDK. Todos los providers. Memoria, tools, traces, retries — built-in.",
  },
  trace: {
    title: "Cada run es una execution trace completa.",
    sub: "Tokens, tool calls, resultados, retrievals de memoria, errores — capturados en orden. Replay de cualquier cosa.",
    caption: "Dashboard built-in. Ves exactamente lo que hizo el modelo — incluidos los errores que corrigió solo.",
  },
  cta: {
    title: "Empezá a construir agentes confiables.",
    sub: "Open source. Apache 2.0. Self-host o subite a la beta del cloud.",
    button: "Empezar a construir",
  },
  footer: {
    tagline: "El cloud backend para agentes de IA confiables.",
    license: "Apache 2.0",
    product: "Producto",
    productLinks: { docs: "Docs", github: "GitHub" },
    company: "Proyecto",
    companyLinks: { contact: "Contacto" },
    copyright: "© Relay Contributors. Apache 2.0.",
  },
  docs: {
    title: "Documentación",
    sub: "Lanzá un agente con streaming, traces y memoria en quince minutos.",
    sections: [
      {
        title: "Instalación",
        body: "El SDK es un solo paquete. Para self-host, todo el stack son tres servicios y Postgres.",
        code: "pnpm add @relayhq/sdk\n# o\nnpm install @relayhq/sdk",
      },
      {
        title: "Tu primer agente",
        body: "Usá un modelo built-in. Los eventos de streaming son un async iterable.",
        code: `import { createAgent, builtin } from "@relayhq/sdk";\n\nconst agent = createAgent({\n  apiKey: process.env.RELAY_API_KEY,\n  model: "claude-sonnet-4-6",\n  tools: [builtin.calculator],\n});\n\nfor await (const e of agent.run("¿Cuánto es 23 * 47?")) {\n  if (e.type === "token") process.stdout.write(e.text);\n}`,
      },
      {
        title: "Function tools custom",
        body: "Declarás un schema y un handler. El handler corre en tu proceso — Relay solo orquesta la llamada.",
        code: `import { tool } from "@relayhq/sdk";\n\nconst getUser = tool({\n  name: "get_user",\n  description: "Buscar un usuario por id",\n  inputSchema: {\n    type: "object",\n    properties: { id: { type: "string" } },\n    required: ["id"],\n  },\n  async handler({ id }: { id: string }) {\n    return db.users.findById(id);\n  },\n});`,
      },
      {
        title: "Memoria semántica",
        body: "Pasás `memory: { namespace }` y el agente recuerda turnos pasados relevantes automáticamente.",
        code: `const agent = createAgent({\n  model: "gpt-4o-mini",\n  memory: { namespace: \`user:\${userId}\` },\n});`,
      },
      {
        title: "Bring your own keys",
        body: "Subís credenciales de provider una sola vez. Relay las encripta con AES-256-GCM y las desencripta on demand.",
        code: `curl -X PUT $RELAY_URL/v1/credentials/openai \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -d '{"apiKey":"sk-..."}'`,
      },
      {
        title: "Self-host",
        body: "Clone, docker compose up, bootstrap. El mismo código en dev y prod.",
        code: "git clone https://github.com/KevinCorrea5103/relay\npnpm db:up && pnpm db:migrate\npnpm db:bootstrap\npnpm dev:runtime & pnpm dev:control-plane & pnpm dev:dashboard",
      },
    ],
  },
  login: {
    title: "Iniciar sesión",
    sub: "Ingresá la API key de Relay que sacaste con `pnpm db:bootstrap`.",
    label: "API key",
    placeholder: "relay_live_…",
    button: "Continuar al dashboard",
    hint: "¿Todavía no tenés una? Self-host con `pnpm db:bootstrap`, o subite a la waitlist del cloud en GitHub.",
    saved: "Guardado local. Redirigiendo…",
  },
};

export const dicts: Record<Locale, Dict> = { en, es };
