import type { FunctionTool } from "./types.js";

export function tool<I = Record<string, unknown>, O = unknown>(spec: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: I) => O | Promise<O>;
}): FunctionTool {
  return {
    kind: "function",
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    handler: spec.handler as (input: unknown) => unknown | Promise<unknown>,
  };
}
