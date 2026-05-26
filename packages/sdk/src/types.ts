export type AnthropicModel =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

export type OpenAIModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
  | "o3"
  | "o3-mini"
  | "o4-mini";

export type ModelId = AnthropicModel | OpenAIModel | (string & {});

export type BuiltinToolName = "calculator";

export type BuiltinTool = {
  kind: "builtin";
  name: BuiltinToolName;
};

// Context passed to a tool handler. The runId is the run that decided to
// call the tool — for a subagent, this becomes the parent of the
// sub-run. Handlers can ignore it entirely if they don't need it.
export type ToolContext = {
  runId: string;
  workflowId: string | null;
  signal?: AbortSignal;
};

export type FunctionTool = {
  kind: "function";
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown, ctx?: ToolContext) => unknown | Promise<unknown>;
};

export type Tool = BuiltinTool | FunctionTool;

export type MemoryConfig = boolean | { namespace?: string };

export type AgentConfig = {
  model: ModelId;
  system?: string;
  tools?: Tool[];
  memory?: MemoryConfig;
  baseUrl?: string;
  apiKey?: string;
};

export type RunOptions = {
  signal?: AbortSignal;
  // When this run is a child of another, the server links them so the
  // dashboard can render the workflow tree and `getWorkflowCost` adds
  // both. Usually set automatically by the `subagent()` primitive.
  parentRunId?: string;
  workflowId?: string;
};

export type TokenEvent = { type: "token"; text: string };
export type ToolCallEvent = {
  type: "tool_call";
  id: string;
  name: string;
  input: unknown;
};
export type ToolResultEvent = {
  type: "tool_result";
  id: string;
  output: unknown;
};
export type DoneEvent = {
  type: "done";
  output: string;
  usage?: { input_tokens: number; output_tokens: number };
};
export type ErrorEvent = { type: "error"; message: string };

export type AgentEvent =
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | DoneEvent
  | ErrorEvent;

export type WireTool =
  | { name: string; kind: "builtin" }
  | {
      name: string;
      kind: "function";
      description: string;
      inputSchema: Record<string, unknown>;
    };

export type WireMemory = boolean | { namespace?: string };

export type RunRequest = {
  model: ModelId;
  system?: string;
  input: string;
  tools: WireTool[];
  memory?: WireMemory;
  parentRunId?: string;
  workflowId?: string;
};
