# Row Level Security Plan

RLS policies will be applied after the authentication schema and Supabase project are configured. The policies must use the trusted Supabase Auth identity from `auth.uid()` and must not rely on arbitrary user IDs sent by clients.

## Intended access rules

- A student can read and write only rows belonging to their own application profile.
- A student cannot access another student's sessions, activities, analyses, or outcomes.
- A parent can access only data for students connected through an active `student_parent_links` row.
- A parent cannot access unrelated students.
- Backend service-role operations are server-side only and are never exposed to the frontend.

The `students.auth_user_id` and `parents.auth_user_id` columns map Auth identities to application profiles. Policies should join through those columns and the relationship table rather than duplicating credentials or trusting a role submitted by a client. Do not enable permissive development policies as a substitute for these rules.