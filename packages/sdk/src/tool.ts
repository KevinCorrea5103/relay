import type { FunctionTool, ToolContext } from "./types.js";

export function tool<I = Record<string, unknown>, O = unknown>(spec: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: I, ctx?: ToolContext) => O | Promise<O>;
}): FunctionTool {
  return {
    kind: "function",
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    handler: spec.handler as FunctionTool["handler"],
  };
}

// ─── JSON Schema input validation ──────────────────────────────────────────
//
// We do a small subset of JSON Schema validation in pure TS rather than
// pulling Ajv into every SDK install. Covers the cases that LLMs actually
// get wrong: missing required fields, wrong types, extra properties when
// additionalProperties=false, basic enum membership.
//
// Returns null on success, or a string describing what's wrong.

export function validateAgainstSchema(
  input: unknown,
  schema: Record<string, unknown>,
): string | null {
  if (schema.type === "object") {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return `expected object, got ${typeOf(input)}`;
    }
    const obj = input as Record<string, unknown>;
    const props =
      (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
    const required = (schema.required as string[] | undefined) ?? [];
    for (const key of required) {
      if (!(key in obj)) return `missing required field "${key}"`;
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in props)) return `unexpected field "${key}"`;
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in obj) {
        const err = validateAgainstSchema(obj[key], sub);
        if (err) return `field "${key}": ${err}`;
      }
    }
    return null;
  }
  if (schema.type === "array") {
    if (!Array.isArray(input)) return `expected array, got ${typeOf(input)}`;
    if (schema.items && typeof schema.items === "object") {
      for (let i = 0; i < input.length; i++) {
        const err = validateAgainstSchema(input[i], schema.items as Record<string, unknown>);
        if (err) return `item ${i}: ${err}`;
      }
    }
    return null;
  }
  if (schema.type === "string") {
    if (typeof input !== "string") return `expected string, got ${typeOf(input)}`;
    if (Array.isArray(schema.enum) && !schema.enum.includes(input)) {
      return `expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(input)}`;
    }
    return null;
  }
  if (schema.type === "number" || schema.type === "integer") {
    if (typeof input !== "number") return `expected number, got ${typeOf(input)}`;
    if (schema.type === "integer" && !Number.isInteger(input)) {
      return `expected integer, got ${input}`;
    }
    return null;
  }
  if (schema.type === "boolean") {
    if (typeof input !== "boolean") return `expected boolean, got ${typeOf(input)}`;
    return null;
  }
  return null;
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
