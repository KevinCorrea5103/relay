export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

const DEFAULT_OPENAI_URL = "https://api.openai.com/v1";

export async function embed(input: {
  text: string;
  apiKey: string;
  baseUrl?: string;
}): Promise<number[]> {
  const url = (input.baseUrl ?? DEFAULT_OPENAI_URL).replace(/\/$/, "") +
    "/embeddings";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: input.text,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`embed ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    data?: { embedding?: number[] }[];
  };
  const vec = data.data?.[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `embed: expected ${EMBEDDING_DIM}-dim vector, got ${vec?.length ?? "none"}`,
    );
  }
  return vec;
}
