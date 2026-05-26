export type RunStatus = "running" | "completed" | "failed" | "canceled";

export type Run = {
  id: string;
  tenantId: string | null;
  parentRunId: string | null;
  workflowId: string | null;
  status: RunStatus;
  model: string;
  system: string | null;
  input: string;
  tools: { name: string }[];
  output: string | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type RunTreeNode = RunSummary & {
  parentRunId: string | null;
  workflowId: string;
  depth: number;
};

export type WorkflowCost = {
  workflowId: string;
  runCount: number;
  inputTokens: number;
  outputTokens: number;
};

export type RunEvent = {
  runId: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  ts: string;
};

export type RunSummary = {
  id: string;
  status: RunStatus;
  model: string;
  inputPreview: string;
  outputPreview: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  completedAt: string | null;
  durationMs: number | null;
};
