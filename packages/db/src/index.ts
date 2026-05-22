export { getPool } from "./client.js";
export type { DB } from "./client.js";
export { createRun, completeRun, failRun, getRun, listRuns } from "./runs.js";
export { appendEvent, listEvents } from "./events.js";
export type { Run, RunEvent, RunStatus, RunSummary } from "./types.js";
export { createTenant, findTenantByName, getTenant } from "./tenants.js";
export type { Tenant } from "./tenants.js";
export {
  mintApiKey,
  authenticateApiKey,
  listApiKeys,
  revokeApiKey,
} from "./api-keys.js";
export type { ApiKeyDescriptor, MintedApiKey } from "./api-keys.js";
export {
  upsertCredential,
  listCredentials,
  resolveCredential,
  deleteCredential,
} from "./credentials.js";
export type {
  CredentialDescriptor,
  ResolvedCredential,
  ProviderName,
} from "./credentials.js";
export { seal, open, generateMasterKey } from "./encryption.js";
export type { SealedSecret } from "./encryption.js";
export {
  insertMemory,
  searchMemories,
  listMemories,
  deleteMemory,
  deleteNamespace,
} from "./memories.js";
export type { Memory, MemoryWithScore } from "./memories.js";
