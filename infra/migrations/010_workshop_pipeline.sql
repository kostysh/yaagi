create table if not exists polyphony_runtime.datasets (
  dataset_id text primary key,
  dataset_kind text not null check (dataset_kind in ('sft', 'eval', 'specialist')),
  source_manifest_json jsonb not null default '{}'::jsonb,
  source_episode_ids_json jsonb not null default '[]'::jsonb,
  split_manifest_json jsonb not null default '{}'::jsonb,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists polyphony_runtime.training_runs (
  run_id text primary key,
  target_kind text not null check (target_kind in ('shared_adapter', 'specialist_candidate')),
  target_profile_id text null,
  dataset_id text null references polyphony_runtime.datasets(dataset_id) on delete restrict,
  method text not null check (method in ('lora', 'qlora', 'other_bounded_method')),
  hyperparams_json jsonb not null default '{}'::jsonb,
  metrics_json jsonb not null default '{}'::jsonb,
  artifact_uri text not null,
  status text not null,
  started_at timestamptz not null,
  ended_at timestamptz null
);

create table if not exists polyphony_runtime.eval_runs (
  eval_run_id text primary key,
  subject_kind text not null check (subject_kind in ('adapter_candidate', 'specialist_candidate')),
  subject_ref text not null,
  suite_name text not null,
  metrics_json jsonb not null default '{}'::jsonb,
  pass boolean not null,
  report_uri text not null,
  created_at timestamptz not null default now()
);

create table if not exists polyphony_runtime.model_candidates (
  candidate_id text primary key,
  candidate_kind text not null check (candidate_kind in ('shared_adapter', 'specialist_candidate')),
  target_profile_id text null,
  dataset_id text not null references polyphony_runtime.datasets(dataset_id) on delete restrict,
  training_run_id text not null references polyphony_runtime.training_runs(run_id) on delete restrict,
  latest_eval_run_id text not null references polyphony_runtime.eval_runs(eval_run_id) on delete restrict,
  artifact_uri text not null,
  stage text not null check (stage in ('candidate', 'shadow', 'limited-active', 'active', 'stable', 'rollback')),
  predecessor_profile_id text null,
  rollback_target text null,
  required_eval_suite text not null,
  last_known_good_eval_report_uri text null,
  status_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists polyphony_runtime.candidate_stage_events (
  event_id text primary key,
  candidate_id text not null references polyphony_runtime.model_candidates(candidate_id) on delete cascade,
  from_stage text null check (from_stage in ('candidate', 'shadow', 'limited-active', 'active', 'stable', 'rollback')),
  to_stage text not null check (to_stage in ('candidate', 'shadow', 'limited-active', 'active', 'stable', 'rollback')),
  trigger_kind text not null check (trigger_kind in ('workshop_eval_passed', 'approval_granted', 'activation_confirmed', 'rollback_requested')),
  evidence_json jsonb not null default '{}'::jsonb,
  requested_by_owner text not null check (requested_by_owner in ('F-0015', 'CF-016', 'F-0008', 'F-0014', 'CF-019', 'CF-018')),
  created_at timestamptz not null default now()
);

create index if not exists idx_training_runs_dataset_id
  on polyphony_runtime.training_runs (dataset_id);

create index if not exists idx_model_candidates_dataset_id
  on polyphony_runtime.model_candidates (dataset_id);

create index if not exists idx_model_candidates_training_run_id
  on polyphony_runtime.model_candidates (training_run_id);

create index if not exists idx_model_candidates_latest_eval_run_id
  on polyphony_runtime.model_candidates (latest_eval_run_id);

create index if not exists idx_candidate_stage_events_candidate_id_created_at
  on polyphony_runtime.candidate_stage_events (candidate_id, created_at, event_id);
