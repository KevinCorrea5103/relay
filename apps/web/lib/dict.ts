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
    github: string;
    star: string;
    dashboard: string;
    signin: string;
    signup: string;
  };
  hero: {
    badge: string;
    title: string;
    sub: string;
    primary: string;
    secondary: string;
    codeCaption: string;
    installNpm: string;
    installPip: string;
  };
  builtOn: { title: string };
  languages: {
    eyebrow: string;
    title: string;
    sub: string;
    tabs: {
      typescript: string;
      python: string;
      nextjs: string;
      curl: string;
      go: string;
    };
    footer: string;
  };
  why: { eyebrow: string; title: string; body: string };
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
    primary: string;
    secondary: string;
  };
  footer: {
    tagline: string;
    license: string;
    productLinks: { docs: string; github: string };
    copyright: string;
  };
};

const en: Dict = {
  meta: {
    title: "Relay — the backend cloud for reliable AI agents",
    description:
      "Memory, retries, tools, traces, and durable execution — without building orchestration infrastructure yourself. Open source under Apache 2.0.",
  },
  nav: {
    docs: "Docs",
    github: "GitHub",
    star: "Star",
    dashboard: "Dashboard",
    signin: "Sign in",
    signup: "Get API key",
  },
  hero: {
    badge: "Open source · Apache 2.0",
    title: "The backend cloud for reliable AI agents.",
    sub: "Memory, retries, tools, traces, and durable execution — without building orchestration infrastructure yourself. Sign up free or self-host in three commands.",
    primary: "Get a free API key",
    secondary: "View on GitHub",
    codeCaption: "agent.ts",
    installNpm: "npm i @relayhq/sdk",
    installPip: "pip install relayhq",
  },
  builtOn: { title: "Built on boring, battle-tested infra" },
  languages: {
    eyebrow: "Use it from anywhere",
    title: "TypeScript today. Python today. Anything else over plain HTTP.",
    sub: "Two official SDKs and a documented HTTP + SSE protocol — wire it into any stack.",
    tabs: {
      typescript: "TypeScript",
      python: "Python",
      nextjs: "Next.js",
      curl: "cURL",
      go: "Go",
    },
    footer: "No SDK for your language? The protocol is plain HTTP + SSE — ~30 lines in any language. See /docs/api.",
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
    title: "Three steps from `git clone` to a streaming, traced, memory-aware agent.",
    sub: "Self-host with Docker Compose. The whole stack on your laptop in two minutes.",
    steps: [
      {
        title: "Clone and bootstrap",
        body: "git clone, pnpm bootstrap. Idempotent — generates keys, brings up Postgres, applies migrations, mints your API key.",
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
        title: "100% self-host",
        body: "Three services and one Postgres. Run it on your laptop with Docker, or in your own cloud. No vendor in the loop.",
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
        q: "Is there a hosted version?",
        a: "Yes — free during beta, no credit card. Sign up with your email and an OpenAI/Anthropic key, you get a `relay_live_…` back, point the SDK at it. The hosted cloud and self-host run the exact same code; you can switch by changing one env var.",
      },
      {
        q: "Do you take a cut of my tokens?",
        a: "No. Relay is BYOK by design — you upload your own Anthropic / OpenAI keys (encrypted with AES-256-GCM the moment they arrive) and your tokens flow straight to the providers. We never proxy billing.",
      },
      {
        q: "Is this another LangChain wrapper?",
        a: "No. Relay is the runtime under your agent, not a chain abstraction. You write plain functions; Relay handles state, retries, providers, tools, memory, and traces.",
      },
      {
        q: "Where does my data live?",
        a: "On the cloud: a per-tenant slice of Postgres on Supabase, credentials encrypted at rest. On self-host: wherever you run your Postgres. Either way, your tool handlers execute in your process — Relay never sees your business logic.",
      },
      {
        q: "What's the lock-in?",
        a: "Almost none. Your tools are TypeScript functions in your repo. Your prompts are strings. Your memory is a Postgres table you can export. The SDK protocol is plain HTTP + SSE. Moving cloud ↔ self-host is one `baseUrl` change.",
      },
      {
        q: "What's coming next?",
        a: "Durable execution (resumable agents across crashes), human-in-the-loop checkpoints, multi-agent orchestration, voice agents. Track the roadmap on GitHub.",
      },
    ],
  },
  cta: {
    eyebrow: "Get started",
    title: "Get an API key. Ship an agent today.",
    sub: "Free cloud beta — no credit card. Or self-host the whole stack in three commands.",
    primary: "Get a free API key",
    secondary: "Read the quickstart",
  },
  footer: {
    tagline: "The backend cloud for reliable AI agents.",
    license: "Apache 2.0",
    productLinks: { docs: "Docs", github: "GitHub" },
    copyright: "© Relay Contributors. Apache 2.0.",
  },
};

const es: Dict = {
  meta: {
    title: "Relay — el cloud backend para agentes de IA confiables",
    description:
      "Memoria, retries, tools, traces y durable execution — sin construir vos la infraestructura de orquestación. Open source bajo Apache 2.0.",
  },
  nav: {
    docs: "Docs",
    github: "GitHub",
    star: "Star",
    dashboard: "Dashboard",
    signin: "Iniciar sesión",
    signup: "Conseguir API key",
  },
  hero: {
    badge: "Open source · Apache 2.0",
    title: "El cloud backend para agentes de IA confiables.",
    sub: "Memoria, retries, tools, traces y durable execution — sin construir vos la infraestructura de orquestación. Registrate gratis o self-host en tres comandos.",
    primary: "Conseguir API key gratis",
    secondary: "Ver en GitHub",
    codeCaption: "agent.ts",
    installNpm: "npm i @relayhq/sdk",
    installPip: "pip install relayhq",
  },
  builtOn: { title: "Construido sobre infra aburrida y probada" },
  languages: {
    eyebrow: "Usalo desde donde quieras",
    title: "TypeScript hoy. Python hoy. Cualquier otro stack sobre HTTP plano.",
    sub: "Dos SDKs oficiales y un protocolo HTTP + SSE documentado — lo metés en cualquier stack.",
    tabs: {
      typescript: "TypeScript",
      python: "Python",
      nextjs: "Next.js",
      curl: "cURL",
      go: "Go",
    },
    footer: "¿No hay SDK para tu lenguaje? El protocolo es HTTP + SSE plano — ~30 líneas en cualquier lenguaje. Mirá /docs/api.",
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
    title: "Tres pasos desde `git clone` hasta un agente con streaming, traces y memoria.",
    sub: "Self-host con Docker Compose. Todo el stack en tu laptop en dos minutos.",
    steps: [
      {
        title: "Cloná y bootstrappeá",
        body: "git clone, pnpm bootstrap. Idempotente — genera keys, levanta Postgres, aplica migrations, mintea tu API key.",
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
        title: "100% self-host",
        body: "Tres servicios y un Postgres. Corré en tu laptop con Docker, o en tu propia cloud. Sin vendor en el medio.",
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
        q: "¿Hay versión hosteada?",
        a: "Sí — gratis durante la beta, sin tarjeta. Te registrás con tu email + una key de OpenAI/Anthropic, recibís un `relay_live_…` y apuntás el SDK ahí. El cloud y el self-host corren exactamente el mismo código; cambiás de uno a otro con un solo env var.",
      },
      {
        q: "¿Se quedan con un porcentaje de mis tokens?",
        a: "No. Relay es BYOK por diseño — subís tus propias keys de Anthropic / OpenAI (encriptadas con AES-256-GCM apenas llegan) y tus tokens van directo a los providers. Nunca proxeamos billing.",
      },
      {
        q: "¿Es otro wrapper de LangChain?",
        a: "No. Relay es el runtime debajo del agente, no una abstracción de chains. Vos escribís funciones planas; Relay maneja estado, retries, providers, tools, memoria y traces.",
      },
      {
        q: "¿Dónde vive mi data?",
        a: "En el cloud: una porción aislada de Postgres en Supabase por tenant, credenciales encriptadas at rest. En self-host: donde tengas tu Postgres. En cualquier caso, tus tool handlers corren en tu proceso — Relay nunca ve tu lógica de negocio.",
      },
      {
        q: "¿Qué lock-in hay?",
        a: "Casi ninguno. Tus tools son funciones de TypeScript en tu repo. Tus prompts son strings. Tu memoria es una tabla de Postgres exportable. El protocolo del SDK es HTTP + SSE plano. Pasar de cloud a self-host (o al revés) es cambiar un `baseUrl`.",
      },
      {
        q: "¿Qué viene?",
        a: "Durable execution (agentes resumibles ante crashes), checkpoints de human-in-the-loop, multi-agent orchestration, voice agents. El roadmap completo está en GitHub.",
      },
    ],
  },
  cta: {
    eyebrow: "Empezá",
    title: "Conseguí una API key. Lanzá un agente hoy.",
    sub: "Cloud beta gratis — sin tarjeta. O self-host del stack completo en tres comandos.",
    primary: "Conseguir API key gratis",
    secondary: "Leer el quickstart",
  },
  footer: {
    tagline: "El cloud backend para agentes de IA confiables.",
    license: "Apache 2.0",
    productLinks: { docs: "Docs", github: "GitHub" },
    copyright: "© Relay Contributors. Apache 2.0.",
  },
};

export const dicts: Record<Locale, Dict> = { en, es };
