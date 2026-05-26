import { postToolResult, startRun } from "./client.js";
import { validateAgainstSchema } from "./tool.js";
import type {
  AgentConfig,
  AgentEvent,
  BuiltinTool,
  BuiltinToolName,
  FunctionTool,
  RunOptions,
  ToolContext,
  WireTool,
} from "./types.js";

declare const process: { env?: Record<string, string | undefined> } | undefined;

const DEFAULT_BASE_URL = "http://localhost:4000";

export type Agent = {
  run(input: string, options?: RunOptions): AsyncIterable<AgentEvent>;
};

export function createAgent(config: AgentConfig): Agent {
  const baseUrl =
    config.baseUrl ??
    (typeof process !== "undefined" ? process.env?.RELAY_URL : undefined) ??
    DEFAULT_BASE_URL;
  const apiKey =
    config.apiKey ??
    (typeof process !== "undefined" ? process.env?.RELAY_API_KEY : undefined);

  const handlers = new Map<string, FunctionTool["handler"]>();
  const schemas = new Map<string, Record<string, unknown>>();
  const wireTools: WireTool[] = [];
  for (const tool of config.tools ?? []) {
    if (tool.kind === "builtin") {
      wireTools.push({ name: tool.name, kind: "builtin" });
    } else {
      wireTools.push({
        name: tool.name,
        kind: "function",
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
      handlers.set(tool.name, tool.handler);
      schemas.set(tool.name, tool.inputSchema);
    }
  }

  return {
    run(input, options) {
      if (!apiKey) {
        throw new Error(
          "relay: apiKey is required. Pass `apiKey` to createAgent or set RELAY_API_KEY in env. " +
            "Run `pnpm db:bootstrap` to mint one.",
        );
      }
      return runWithLocalTools(
        baseUrl,
        apiKey,
        {
          model: config.model,
          system: config.system,
          input,
          tools: wireTools,
          memory: config.memory,
          parentRunId: options?.parentRunId,
          workflowId: options?.workflowId,
        },
        handlers,
        schemas,
        options?.signal,
      );
    },
  };
}

async function* runWithLocalTools(
  baseUrl: string,
  apiKey: string,
  body: Parameters<typeof startRun>[2],
  handlers: Map<string, FunctionTool["handler"]>,
  schemas: Map<string, Record<string, unknown>>,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent, void, void> {
  const { runId, workflowId, events } = await startRun(
    baseUrl,
    apiKey,
    body,
    signal,
  );
  const inFlight: Promise<void>[] = [];
  const ctx: ToolContext = {
    runId,
    workflowId: workflowId ?? body.workflowId ?? runId,
    signal,
  };

  for await (const event of events) {
    if (event.type === "tool_call" && handlers.has(event.name)) {
      const handler = handlers.get(event.name)!;
      const schema = schemas.get(event.name);
      inFlight.push(
        executeAndReport(
          baseUrl,
          apiKey,
          runId,
          event.id,
          event.input,
          handler,
          schema,
          ctx,
        ),
      );
    }
    yield event;
  }

  await Promise.allSettled(inFlight);
}

async function executeAndReport(
  baseUrl: string,
  apiKey: string,
  runId: string,
  toolUseId: string,
  input: unknown,
  handler: FunctionTool["handler"],
  schema: Record<string, unknown> | undefined,
  ctx: ToolContext,
): Promise<void> {
  let output: unknown;
  if (schema) {
    const err = validateAgainstSchema(input, schema);
    if (err) {
      output = { error: `invalid tool input: ${err}` };
      try {
        await postToolResult(baseUrl, apiKey, runId, toolUseId, output);
      } catch (err) {
        console.error(
          `[relay sdk] failed to post tool result (run=${runId} tool=${toolUseId}):`,
          err,
        );
      }
      return;
    }
  }
  try {
    output = await handler(input, ctx);
  } catch (err) {
    output = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  try {
    await postToolResult(baseUrl, apiKey, runId, toolUseId, output);
  } catch (err) {
    console.error(
      `[relay sdk] failed to post tool result (run=${runId} tool=${toolUseId}):`,
      err,
    );
  }
}

export const builtin: Record<BuiltinToolName, BuiltinTool> = {
  calculator: { kind: "builtin", name: "calculator" },
};
