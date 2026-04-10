create table if not exists polyphony_runtime.code_change_proposals (
  proposal_id text primary key,
  request_id text not null unique,
  normalized_request_hash text not null,
  requested_by_owner text not null,
  governor_proposal_id text null,
  governor_decision_ref text null,
  owner_override_evidence_ref text null,
  branch_name text not null,
  worktree_path text not null unique,
  candidate_commit_sha text null,
  stable_snapshot_id text null,
  status text not null,
  scope_kind text not null,
  required_eval_suite text not null,
  target_paths_json jsonb not null default '[]'::jsonb,
  rollback_plan_ref text not null,
  evidence_refs_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint code_change_proposals_owner_check check (
    requested_by_owner in ('governor', 'human_override')
  ),
  constraint code_change_proposals_authority_check check (
    (
      requested_by_owner = 'governor'
      and governor_proposal_id is not null
      and governor_decision_ref is not null
      and owner_override_evidence_ref is null
    )
    or (
      requested_by_owner = 'human_override'
      and owner_override_evidence_ref is not null
      and governor_proposal_id is null
      and governor_decision_ref is null
    )
  ),
  constraint code_change_proposals_status_check check (
    status in (
      'requested',
      'worktree_ready',
      'evaluating',
      'evaluation_failed',
      'candidate_committed',
      'snapshot_ready',
      'rolled_back',
      'rejected'
    )
  ),
  constraint code_change_proposals_scope_check check (
    scope_kind in ('code', 'config', 'body_manifest')
  ),
  constraint code_change_proposals_target_paths_json_array_check check (
    jsonb_typeof(target_paths_json) = 'array'
  ),
  constraint code_change_proposals_evidence_refs_json_array_check check (
    jsonb_typeof(evidence_refs_json) = 'array'
  )
);

create table if not exists polyphony_runtime.body_change_events (
  event_id text primary key,
  proposal_id text not null references polyphony_runtime.code_change_proposals (proposal_id)
    on delete cascade,
  event_kind text not null,
  status text not null,
  evidence_refs_json jsonb not null default '[]'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint body_change_events_kind_check check (
    event_kind in ('proposal_recorded', 'boundary_checked')
  ),
  constraint body_change_events_status_check check (
    status in (
      'requested',
      'worktree_ready',
      'evaluating',
      'evaluation_failed',
      'candidate_committed',
      'snapshot_ready',
      'rolled_back',
      'rejected'
    )
  ),
  constraint body_change_events_evidence_refs_json_array_check check (
    jsonb_typeof(evidence_refs_json) = 'array'
  ),
  constraint body_change_events_payload_json_object_check check (
    jsonb_typeof(payload_json) = 'object'
  )
);

create index if not exists code_change_proposals_status_idx
  on polyphony_runtime.code_change_proposals (status, created_at desc);

create index if not exists body_change_events_proposal_idx
  on polyphony_runtime.body_change_events (proposal_id, created_at, event_id);
