# FocusSense AI

FocusSense AI is an AI study behaviour analyzer designed around three connected product ideas: measurable interventions, interactive counterfactual explanations, and student-specific recommendation adaptation.

This repository currently contains the project foundation and Supabase/authentication infrastructure. Login UI, protected product routes, prediction models, dashboards, recommendation algorithms, and activity monitoring are intentionally not implemented yet.

## Project layout

- `frontend/` React + Vite + Tailwind CSS application shell
- `backend/` FastAPI service boundaries and Python environment
- `ml/` planned data, feature, model, explainability, counterfactual, and evaluation modules
- `database/` Supabase/PostgreSQL schema planning
- `docs/` architecture and implementation notes

## Local setup

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend and frontend credentials belong in environment variables. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local` when configuring a Supabase project; never commit secrets.

See [docs/architecture.md](docs/architecture.md) for the system flow, [docs/supabase-setup.md](docs/supabase-setup.md) for configuration steps, and [database/schema-plan.md](database/schema-plan.md) for the persistence and Auth identity mapping.