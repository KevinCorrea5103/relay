import {
  insertMemory,
  resolveCredential,
  searchMemories,
  type MemoryWithScore,
} from "@relay/db";
import { embed } from "./embeddings.js";

export const DEFAULT_NAMESPACE = "default";
export const SIMILARITY_FLOOR = 0.3;
export const TOP_K = 5;

type EmbedCred = { apiKey: string; baseUrl?: string };

async function getEmbedCred(tenantId: string): Promise<EmbedCred> {
  const cred = await resolveCredential(tenantId, "openai");
  if (!cred) {
    throw new Error(
      "memory requires an OpenAI credential (used for embeddings). " +
        "PUT /v1/credentials/openai first.",
    );
  }
  return { apiKey: cred.apiKey, baseUrl: cred.baseUrl ?? undefined };
}

function formatMemoriesAsContext(memories: MemoryWithScore[]): string {
  if (memories.length === 0) return "";
  const lines = memories
    .filter((m) => m.similarity >= SIMILARITY_FLOOR)
    .map((m) => `- ${m.content}`);
  if (lines.length === 0) return "";
  return (
    "Relevant context from past interactions (use only what's relevant):\n" +
    lines.join("\n")
  );
}

export async function injectMemory(input: {
  tenantId: string;
  namespace: string;
  userInput: string;
  baseSystem: string | undefined;
}): Promise<{ system: string | undefined; retrieved: MemoryWithScore[] }> {
  const cred = await getEmbedCred(input.tenantId);
  const queryVec = await embed({
    text: input.userInput,
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
  });
  const retrieved = await searchMemories({
    tenantId: input.tenantId,
    namespace: input.namespace,
    queryEmbedding: queryVec,
    limit: TOP_K,
  });

  const block = formatMemoriesAsContext(retrieved);
  if (!block) {
    return { system: input.baseSystem, retrieved: [] };
  }
  const system = input.baseSystem
    ? `${input.baseSystem}\n\n${block}`
    : block;
  return { system, retrieved };
}

export async function storeTurn(input: {
  tenantId: string;
  namespace: string;
  runId: string;
  userInput: string;
  assistantOutput: string;
}): Promise<void> {
  if (!input.assistantOutput.trim()) return;
  const content = `User: ${input.userInput}\nAssistant: ${input.assistantOutput}`;
  const cred = await getEmbedCred(input.tenantId);
  const vec = await embed({
    text: content,
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
  });
  await insertMemory({
    tenantId: input.tenantId,
    namespace: input.namespace,
    content,
    embedding: vec,
    sourceRunId: input.runId,
    metadata: {
      input_preview: input.userInput.slice(0, 200),
      output_preview: input.assistantOutput.slice(0, 200),
    },
  });
}
