-- ─────────────────────────────────────────────────────────────────────────
-- 005_run_linking.sql
--
-- Lets a run be invoked by another run (sub-agent composition):
--
--   parent_run_id   the immediate caller (one hop)
--   workflow_id     the root run of the tree; all descendants share it
--
-- Together these let us:
--   1. Render run trees in the dashboard (one query: WHERE workflow_id = ?).
--   2. Aggregate cost / tokens across an entire multi-agent workflow.
--   3. Propagate cancellation (future): cancel the root, all descendants
--      get marked canceled.
--   4. Share a memory namespace for the whole workflow if the SDK opts in
--      (the namespace lives in app code, but consistent IDs make it cheap).
-- ─────────────────────────────────────────────────────────────────────────

alter table runs add column if not exists parent_run_id uuid;
alter table runs add column if not exists workflow_id   uuid;

-- workflow_id defaults to the run's own id for top-level runs. Backfill:
update runs
   set workflow_id = id
 where workflow_id is null
   and parent_run_id is null;

-- Anything with a parent gets the parent's workflow_id (single-hop is enough
-- for old rows since pre-feature there were no chains).
update runs r
   set workflow_id = p.workflow_id
  from runs p
 where r.workflow_id is null
   and r.parent_run_id = p.id;

create index if not exists runs_workflow_idx
  on runs (tenant_id, workflow_id, created_at);

create index if not exists runs_parent_idx
  on runs (parent_run_id) where parent_run_id is not null;
