# Database Foundation

`migrations/001_initial_schema.sql` is the initial Supabase/PostgreSQL migration. Apply it through the Supabase SQL editor or migration workflow after the Supabase project exists.

The migration intentionally does not add row-level security policies, triggers, seed data, or authentication logic. Those depend on the authentication stage. It does establish the complete persistence contract for students, sessions, behavioural analysis, recommendations, and measured intervention outcomes.