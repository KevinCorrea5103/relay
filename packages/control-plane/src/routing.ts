import type { ProviderName } from "@relayhq/db";

export type RoutedModel = {
  provider: ProviderName;
  model: string;
};

export function routeModel(input: string): RoutedModel | null {
  if (input.startsWith("anthropic:")) {
    return { provider: "anthropic", model: input.slice("anthropic:".length) };
  }
  if (input.startsWith("openai:")) {
    return { provider: "openai", model: input.slice("openai:".length) };
  }
  if (input.startsWith("claude-")) return { provider: "anthropic", model: input };
  if (
    input.startsWith("gpt-") ||
    input.startsWith("chatgpt-") ||
    input.startsWith("o1-") ||
    input === "o1" ||
    input.startsWith("o3-") ||
    input === "o3" ||
    input.startsWith("o4-")
  ) {
    return { provider: "openai", model: input };
  }
  return null;
}
