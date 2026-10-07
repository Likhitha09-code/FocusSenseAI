-- FocusSense AI database foundation
-- Authentication, RLS policies, and seed data are intentionally deferred.
-- students.auth_user_id and parents.auth_user_id reference Supabase Auth users.

create extension if not exists pgcrypto;

create table public.students (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users (id) on delete cascade,
    display_name text,
    department text,
    semester integer,
    academic_year integer,
    timezone text not null default 'UTC',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.parents (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users (id) on delete cascade,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.student_parent_links (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students (id) on delete cascade,
    parent_id uuid not null references public.parents (id) on delete cascade,
    consent_status text not null default 'pending'
        check (consent_status in ('pending', 'active', 'revoked')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_id, parent_id)
);

create table public.subjects (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students (id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    unique (student_id, name)
);

create table public.study_sessions (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students (id) on delete cascade,
    subject_id uuid references public.subjects (id) on delete set null,
    started_at timestamptz not null,
    ended_at timestamptz,
    status text not null default 'planned'
        check (status in ('planned', 'active', 'completed', 'cancelled')),
    created_at timestamptz not null default now(),
    check (ended_at is null or ended_at >= started_at)
);

create table public.study_activities (
    id uuid primary key default gen_random_uuid(),
    study_session_id uuid not null references public.study_sessions (id) on delete cascade,
    activity_type text not null,
    occurred_at timestamptz not null,
    numeric_value double precision,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table public.quizzes (
    id uuid primary key default gen_random_uuid(),
    subject_id uuid not null references public.subjects (id) on delete cascade,
    title text not null,
    quiz_date date,
    created_at timestamptz not null default now()
);

create table public.performance_reports (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students (id) on delete cascade,
    study_session_id uuid references public.study_sessions (id) on delete set null,
    quiz_id uuid references public.quizzes (id) on delete set null,
    score double precision,
    max_score double precision,
    performance_metric text not null,
    measured_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    check (score is null or max_score is null or (score >= 0 and max_score > 0 and score <= max_score))
);

create table public.behavioural_analyses (
    id uuid primary key default gen_random_uuid(),
    study_session_id uuid not null unique references public.study_sessions (id) on delete cascade,
    feature_snapshot jsonb not null,
    focus_score double precision,
    distraction_level text,
    performance_prediction double precision,
    shap_values jsonb,
    counterfactual_baseline jsonb,
    model_version text not null,
    analyzed_at timestamptz not null default now(),
    check (focus_score is null or (focus_score >= 0 and focus_score <= 100))
);

create table public.recommendations (
    id uuid primary key default gen_random_uuid(),
    recommendation_type text not null unique,
    title text not null,
    content text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table public.recommendation_events (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students (id) on delete cascade,
    source_session_id uuid not null references public.study_sessions (id) on delete cascade,
    recommendation_id uuid not null references public.recommendations (id) on delete restrict,
    issued_at timestamptz not null default now(),
    selection_reason text,
    selector_version text not null,
    behavioural_persona text,
    selection_context jsonb not null default '{}'::jsonb
);

create table public.recommendation_outcomes (
    id uuid primary key default gen_random_uuid(),
    recommendation_event_id uuid not null unique references public.recommendation_events (id) on delete cascade,
    recommendation_followed boolean,
    next_session_id uuid references public.study_sessions (id) on delete set null,
    measured_at timestamptz,
    next_focus_score double precision,
    delta_focus_next_session double precision,
    outcome_status text not null default 'pending'
        check (outcome_status in ('pending', 'measured', 'unavailable')),
    notes text,
    check (next_focus_score is null or (next_focus_score >= 0 and next_focus_score <= 100))
);

create index study_sessions_student_started_idx
    on public.study_sessions (student_id, started_at desc);
create index study_activities_session_occurred_idx
    on public.study_activities (study_session_id, occurred_at);
create index performance_reports_student_measured_idx
    on public.performance_reports (student_id, measured_at desc);
create index recommendation_events_student_issued_idx
    on public.recommendation_events (student_id, issued_at desc);
create index recommendation_outcomes_next_session_idx
    on public.recommendation_outcomes (next_session_id);