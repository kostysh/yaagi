alter table if exists polyphony_runtime.body_change_events
  drop constraint if exists body_change_events_kind_check;

alter table if exists polyphony_runtime.body_change_events
  add constraint body_change_events_kind_check check (
    event_kind in (
      'proposal_recorded',
      'boundary_checked',
      'worktree_prepared',
      'evaluation_started',
      'evaluation_failed',
      'candidate_committed',
      'stable_snapshot_published',
      'rollback_evidence_recorded'
    )
  );

create table if not exists polyphony_runtime.stable_snapshots (
  snapshot_id text primary key,
  proposal_id text not null unique references polyphony_runtime.code_change_proposals (proposal_id)
    on delete cascade,
  git_tag text not null unique,
  schema_version text not null,
  model_profile_map_json jsonb not null default '{}'::jsonb,
  critical_config_hash text not null,
  eval_summary_json jsonb not null default '{}'::jsonb,
  manifest_hash text not null,
  manifest_path text not null,
  created_at timestamptz not null default now(),
  constraint stable_snapshots_model_profile_map_json_object_check check (
    jsonb_typeof(model_profile_map_json) = 'object'
  ),
  constraint stable_snapshots_eval_summary_json_object_check check (
    jsonb_typeof(eval_summary_json) = 'object'
  )
);

create index if not exists stable_snapshots_created_at_idx
  on polyphony_runtime.stable_snapshots (created_at desc, snapshot_id desc);
