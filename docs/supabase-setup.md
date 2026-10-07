# Supabase Authentication & Profile Provisioning Setup

This document details the authentication and profile provisioning architecture implemented in Task 5 for FocusSense AI.

---

## 1. Authentication Architecture Overview

Authentication and application identity are decoupled into two distinct, secure layers:

```text
Frontend (React + Vite)
    ↓
Supabase Auth (signInWithPassword / signUp)
    ↓
Access Token (JWT with verified Auth UUID)
    ↓
Axios Interceptor (Authorization: Bearer <access_token>)
    ↓
FastAPI Backend
    ↓
Supabase Token Verification (supabase.verify_access_token)
    ↓
Profile Resolution (query students & parents by auth_user_id)
    ↓
AuthenticatedUser (auth_user_id, role, student_id, parent_id, email, name)
    ↓
Role Dependencies (require_student, require_parent)
    ↓
Protected Endpoints (/api/v1/auth/me, /api/v1/auth/student-test, etc.)
```

---

## 2. Supabase Auth vs. Application Profiles

- **Supabase Auth (`auth.users`)**:
  - Owns credentials, password hashing (bcrypt), session tokens, email verification, and Auth UUIDs.
  - Plain-text passwords and password hashes are **never stored** in application profile tables (`students` or `parents`).
- **Application Profile Tables (`students`, `parents`)**:
  - Store application-domain attributes (`display_name`, `department`, `semester`, `academic_year`, `timezone`).
  - Linked to Supabase Auth strictly via unique foreign key: `students.auth_user_id` and `parents.auth_user_id`.

---

## 3. Registration & Profile Provisioning Flows

### Student Registration
1. User enters name, email, password, department, semester, and academic year.
2. Frontend calls Supabase Auth `signUp(email, password, { role: 'student', name })`.
3. If email confirmation is required, Supabase returns user without an active session. Frontend displays:
   > *"Registration successful. Please verify your email before logging in."*
4. When an active session is available (either upon signup or after email verification + login):
   - Frontend invokes `POST /api/v1/auth/provision/student` with profile fields.
   - The backend derives the `auth_user_id` from the **verified Bearer token**, never trusting client-supplied IDs.
   - The backend ensures no profile already exists for that Auth UUID (returning `409 Conflict` on duplicates).
   - The `Student` record is created and returned with `role="student"`.

### Parent Registration
1. User enters name, email, and password.
2. Frontend calls Supabase Auth `signUp(email, password, { role: 'parent', name })`.
3. If an active session is established:
   - Frontend invokes `POST /api/v1/auth/provision/parent`.
   - Backend derives `auth_user_id` from the token and creates the `Parent` record.

---

## 4. Trusted Profile & Role Resolution Rules

When an authenticated request arrives at FastAPI:
1. `get_current_auth_token_user`: Extracts the Bearer token and verifies it against Supabase Auth.
2. `resolve_application_profile`:
   - Checks `students` where `auth_user_id == token.auth_user_id`.
   - Checks `parents` where `auth_user_id == token.auth_user_id`.
   - **Exactly one profile found**: Resolves the trusted application role (`student` or `parent`).
   - **Zero profiles found**: Returns `401 Unauthorized` ("Application profile not found. Please complete profile registration.").
   - **Both profiles found**: Returns `409 Conflict` ("Ambiguous application profile: mapped to both student and parent").
3. Client-provided role claims in request bodies or query parameters are **never trusted** for authorization.

---

## 5. Protected Endpoints & Dependencies

- `get_current_user`: Resolves authenticated user and application profile.
- `require_student`: Ensures `current_user.role == UserRole.STUDENT`; returns `403 Forbidden` otherwise.
- `require_parent`: Ensures `current_user.role == UserRole.PARENT`; returns `403 Forbidden` otherwise.

### Test & Profile Endpoints:
- `GET /api/v1/auth/me`: Returns verified identity:
  ```json
  {
    "auth_user_id": "...",
    "role": "student",
    "student_id": "...",
    "parent_id": null,
    "email": "student@university.edu",
    "name": "Alice Student"
  }
  ```
- `POST /api/v1/auth/provision/student`: Provisions a Student profile.
- `POST /api/v1/auth/provision/parent`: Provisions a Parent profile.
- `GET /api/v1/auth/student-test`: Verifies Student role access.
- `GET /api/v1/auth/parent-test`: Verifies Parent role access.

---

## 6. Frontend Session & Protected Routing

- **Centralized Client (`frontend/src/lib/api.js`)**:
  - Automatically fetches the active access token via `supabase.auth.getSession()`.
  - Injects `Authorization: Bearer <access_token>` into every request.
  - Centralized response interceptor catches `401` (unauthorized) and `403` (forbidden) errors.
- **Auth Context (`frontend/src/context/AuthContext.jsx`)**:
  - Manages `user`, `session`, `profile`, `role`, and `loading` state.
  - Subscribes to `onAuthStateChange` (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`).
  - Implements `login`, `registerStudent`, `registerParent`, and `logout`.
- **Protected Route Guard (`frontend/src/components/ProtectedRoute.jsx`)**:
  - Displays loading indicator during session restoration.
  - Redirects unauthenticated users to `/login`.
  - Displays a clear notice if application profile is pending.
  - Enforces `requiredRole` (rendering `403 Access Restricted` on mismatch).

---

## 7. Security Credentials & Environment Isolation

| Variable | Environment | Security Scope |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Backend (`.env`) | Server-side API endpoint |
| `SUPABASE_ANON_KEY` | Backend (`.env`) | Client verification |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend ONLY (`.env`) | **Strictly confidential** (bypasses RLS). Never expose to frontend. |
| `DATABASE_URL` | Backend (`.env`) | Direct PostgreSQL connection string |
| `VITE_SUPABASE_URL` | Frontend (`.env.local`) | Public client endpoint |
| `VITE_SUPABASE_ANON_KEY` | Frontend (`.env.local`) | Public anonymous client key |
| `VITE_API_BASE_URL` | Frontend (`.env.local`) | Backend API base URL |

---

## 8. Verification & Test Suite

The authentication foundation can be tested without a live Supabase connection:
- **Backend Tests (`backend/tests/test_auth.py`)**:
  ```powershell
  cd backend
  .\.venv\Scripts\python -m pytest tests/ -v
  ```
  Tests:
  1. `/health` returns 200 without Supabase configuration.
  2. Missing Bearer token returns 401.
  3. Invalid Bearer token returns 401.
  4. Unprovisioned application profile returns 401.
  5. Student profile resolution returns 200 with `role="student"`.
  6. Parent profile resolution returns 200 with `role="parent"`.
  7. Ambiguous dual-profile returns 409.
  8. `require_student` permits Student and rejects Parent with 403.
  9. `require_parent` permits Parent and rejects Student with 403.
  10. Student profile provisioning creates record (201) and rejects duplicate (409).
  11. Parent profile provisioning creates record (201) and rejects duplicate (409).
  12. Student validation enforces field constraints (422).
- **Frontend Build**:
  ```powershell
  cd frontend
  npm run build
  ```