export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}

type Step = { title: string; body: string };
type Feature = { title: string; body: string };
type FAQ = { q: string; a: string };

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
    install: string;
  };
  builtOn: {
    title: string;
  };
  why: {
    eyebrow: string;
    title: string;
    body: string;
  };
  compare: {
    eyebrow: string;
    title: string;
    sub: string;
    withoutLabel: string;
    withoutItems: string[];
    withLabel: string;
    withCaption: string;
  };
  how: {
    eyebrow: string;
    title: string;
    sub: string;
    steps: Step[];
  };
  features: {
    eyebrow: string;
    title: string;
    sub: string;
    items: Feature[];
  };
  trace: {
    eyebrow: string;
    title: string;
    sub: string;
    caption: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: FAQ[];
  };
  cta: {
    eyebrow: string;
    title: string;
    sub: string;
    waitlistPlaceholder: string;
    waitlistButton: string;
    waitlistFootnote: string;
  };
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
    secondary: "View on GitHub",
    tertiary: "Documentation",
    codeCaption: "agent.ts",
    install: "npm i @relayhq/sdk",
  },
  builtOn: {
    title: "Built on boring, battle-tested infra",
  },
  why: {
    eyebrow: "The problem",
    title: "AI apps fail in production because orchestration is unreliable.",
    body: "Every team building real agents ends up writing the same plumbing: queues, retries, state machines, tool dispatch, traces, memory, replay. Relay is that plumbing — already built, battle-shaped, and out of your way.",
  },
  compare: {
    eyebrow: "The change",
    title: "Stop building infrastructure.",
    sub: "Same agent. One SDK call vs nine systems wired by hand.",
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
  how: {
    eyebrow: "How it works",
    title: "Three steps from `npm install` to a streaming, traced, memory-aware agent.",
    sub: "Self-host with Docker Compose, or use the hosted cloud (beta).",
    steps: [
      {
        title: "Define the agent",
        body: "Declare your model, tools (built-in or your own functions), and whether you want memory. That's the whole config.",
      },
      {
        title: "Bring your own keys",
        body: "Upload Anthropic / OpenAI / OpenAI-compatible credentials once. Encrypted with AES-256-GCM and resolved per request.",
      },
      {
        title: "Run and observe",
        body: "Every token, tool call, and memory hit is persisted as an ordered event log. Replay any run in the dashboard.",
      },
    ],
  },
  features: {
    eyebrow: "What you get",
    title: "Production-grade primitives, not a demo.",
    sub: "Everything an agent needs in production, exposed through a single SDK.",
    items: [
      {
        title: "Multi-provider routing",
        body: "Anthropic, OpenAI, and any OpenAI-compatible endpoint (Ollama, vLLM, Groq, Together, OpenRouter). Switch with one string.",
      },
      {
        title: "Custom function tools",
        body: "Tools run in your process, not ours. SDK ships the schema, runtime pauses on tool calls, you fulfill them locally over the same stream.",
      },
      {
        title: "Semantic memory",
        body: "pgvector + automatic indexing. Agents recall past interactions without you ever touching embeddings.",
      },
      {
        title: "Persistent execution traces",
        body: "Every run is an ordered event log: tokens, tool calls, memory retrievals, errors. Full replay for debugging.",
      },
      {
        title: "BYOK encryption",
        body: "AES-256-GCM per tenant. The runtime never sees a Relay key and has no database access. Costs flow direct to providers.",
      },
      {
        title: "Streaming + tool calling",
        body: "Native SSE end to end. Tokens stream as they're generated. Tool calls dispatch in parallel without breaking iteration.",
      },
      {
        title: "Per-tenant isolation",
        body: "API keys scope every read. Runs, memories, credentials — all tagged with their tenant. Multi-tenancy from day one.",
      },
      {
        title: "Self-host or cloud",
        body: "Three services and one Postgres. Run it on your laptop with Docker, on your infra, or use the managed cloud.",
      },
    ],
  },
  trace: {
    eyebrow: "Observability",
    title: "Every run is a complete execution trace.",
    sub: "Tokens, tool calls, results, memory retrievals, errors — captured in order. Replay anything.",
    caption: "Built-in dashboard. See exactly what the model did — including the mistakes it self-corrected.",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions",
    items: [
      {
        q: "Is this another LangChain wrapper?",
        a: "No. Relay is the runtime under your agent, not a chain abstraction. You write plain functions; Relay handles state, retries, providers, tools, and traces.",
      },
      {
        q: "Do you take a cut of my tokens?",
        a: "No. Relay is BYOK by design — you upload your own Anthropic / OpenAI keys and pay providers directly. We never proxy billing.",
      },
      {
        q: "Can I self-host?",
        a: "Yes. The whole stack is three services and Postgres. Docker Compose locally; the same Go binary and Node service in production.",
      },
      {
        q: "What's the lock-in?",
        a: "Almost none. Your tools are TypeScript functions. Your prompts are strings. Your memory is a Postgres table you can export. The SDK protocol is plain HTTP + SSE.",
      },
      {
        q: "What's coming next?",
        a: "Durable execution (resumable agents across crashes), human-in-the-loop checkpoints, voice agents, and a managed cloud with usage-based billing on top of BYOK.",
      },
    ],
  },
  cta: {
    eyebrow: "Get early access",
    title: "Build the agent. Skip the plumbing.",
    sub: "Self-host today, or join the cloud beta — we'll email you when it opens.",
    waitlistPlaceholder: "you@startup.com",
    waitlistButton: "Join the waitlist",
    waitlistFootnote: "No spam. One email when the cloud is live.",
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
    sub: "Enter the Relay API key you got from `pnpm db:bootstrap` when self-hosting.",
    label: "API key",
    placeholder: "relay_live_…",
    button: "Continue to dashboard",
    hint: "Don't have one yet? Self-host the stack to mint a key, or join the cloud waitlist on the home page.",
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
    secondary: "Ver en GitHub",
    tertiary: "Documentación",
    codeCaption: "agent.ts",
    install: "npm i @relayhq/sdk",
  },
  builtOn: {
    title: "Construido sobre infra aburrida y probada",
  },
  why: {
    eyebrow: "El problema",
    title: "Las apps de IA fallan en producción porque la orquestación no es confiable.",
    body: "Todo equipo que construye agentes reales termina escribiendo la misma plomería: queues, retries, máquinas de estado, dispatch de tools, traces, memoria, replay. Relay es esa plomería — ya construida, probada, fuera del camino.",
  },
  compare: {
    eyebrow: "El cambio",
    title: "Dejá de construir infraestructura.",
    sub: "El mismo agente. Una llamada al SDK contra nueve sistemas cableados a mano.",
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
  how: {
    eyebrow: "Cómo funciona",
    title: "Tres pasos desde `npm install` hasta un agente con streaming, traces y memoria.",
    sub: "Self-host con Docker Compose, o usá el cloud managed (beta).",
    steps: [
      {
        title: "Definí el agente",
        body: "Declarás modelo, tools (builtins o funciones tuyas), y si querés memoria. Esa es toda la config.",
      },
      {
        title: "Traé tus propias keys",
        body: "Subís credenciales de Anthropic / OpenAI / OpenAI-compatible una sola vez. Encriptadas con AES-256-GCM y resueltas por request.",
      },
      {
        title: "Corré y observá",
        body: "Cada token, tool call y hit de memoria queda persistido como event log ordenado. Replay completo de cualquier run en el dashboard.",
      },
    ],
  },
  features: {
    eyebrow: "Qué viene en la caja",
    title: "Primitivas de producción, no un demo.",
    sub: "Todo lo que un agente necesita en producción, expuesto por un solo SDK.",
    items: [
      {
        title: "Routing multi-provider",
        body: "Anthropic, OpenAI, y cualquier endpoint OpenAI-compatible (Ollama, vLLM, Groq, Together, OpenRouter). Cambiás con un string.",
      },
      {
        title: "Function tools custom",
        body: "Las tools corren en tu proceso, no en el nuestro. El SDK envía el schema, el runtime pausa en cada tool call, vos resolvés localmente por el mismo stream.",
      },
      {
        title: "Memoria semántica",
        body: "pgvector + indexación automática. Los agentes recuerdan interacciones pasadas sin que toques un embedding.",
      },
      {
        title: "Traces de ejecución persistentes",
        body: "Cada run es un event log ordenado: tokens, tool calls, retrievals de memoria, errores. Replay completo para debuggear.",
      },
      {
        title: "Encriptación BYOK",
        body: "AES-256-GCM por tenant. El runtime nunca ve una Relay key y no tiene acceso a la base. Los costos van directo a los providers.",
      },
      {
        title: "Streaming + tool calling",
        body: "SSE nativo end-to-end. Tokens stream mientras se generan. Tool calls se despachan en paralelo sin romper la iteración.",
      },
      {
        title: "Aislamiento por tenant",
        body: "Las API keys scopean cada lectura. Runs, memorias, credenciales — todo etiquetado con su tenant. Multi-tenancy desde día uno.",
      },
      {
        title: "Self-host o cloud",
        body: "Tres servicios y un Postgres. Corré en tu laptop con Docker, en tu infra, o usá el cloud managed.",
      },
    ],
  },
  trace: {
    eyebrow: "Observabilidad",
    title: "Cada run es una execution trace completa.",
    sub: "Tokens, tool calls, resultados, retrievals de memoria, errores — capturados en orden. Replay de cualquier cosa.",
    caption: "Dashboard built-in. Ves exactamente lo que hizo el modelo — incluidos los errores que corrigió solo.",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Preguntas",
    items: [
      {
        q: "¿Es otro wrapper de LangChain?",
        a: "No. Relay es el runtime debajo del agente, no una abstracción de chains. Vos escribís funciones planas; Relay maneja estado, retries, providers, tools y traces.",
      },
      {
        q: "¿Se quedan con un porcentaje de mis tokens?",
        a: "No. Relay es BYOK por diseño — subís tus propias keys de Anthropic / OpenAI y le pagás a los providers directo. Nunca proxeamos billing.",
      },
      {
        q: "¿Puedo self-hostear?",
        a: "Sí. Todo el stack son tres servicios y Postgres. Docker Compose en local; el mismo binario de Go y servicio de Node en producción.",
      },
      {
        q: "¿Qué lock-in hay?",
        a: "Casi ninguno. Tus tools son funciones de TypeScript. Tus prompts son strings. Tu memoria es una tabla de Postgres exportable. El protocolo del SDK es HTTP + SSE plano.",
      },
      {
        q: "¿Qué viene?",
        a: "Durable execution (agentes resumibles ante crashes), checkpoints de human-in-the-loop, voice agents, y una cloud managed con billing usage-based sobre BYOK.",
      },
    ],
  },
  cta: {
    eyebrow: "Early access",
    title: "Construí el agente. Saltate la plomería.",
    sub: "Self-host hoy, o subite a la beta del cloud — te avisamos por email cuando abra.",
    waitlistPlaceholder: "vos@startup.com",
    waitlistButton: "Sumarme a la waitlist",
    waitlistFootnote: "Cero spam. Un email cuando el cloud esté listo.",
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
    sub: "Ingresá la API key de Relay que sacaste con `pnpm db:bootstrap` al self-hostear.",
    label: "API key",
    placeholder: "relay_live_…",
    button: "Continuar al dashboard",
    hint: "¿Todavía no tenés una? Self-host para mintar una key, o subite a la waitlist del cloud en la home.",
    saved: "Guardado local. Redirigiendo…",
  },
};

export const dicts: Record<Locale, Dict> = { en, es };
