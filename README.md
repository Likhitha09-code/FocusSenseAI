# FocusSense AI — Intelligent Study Behaviour Analyzer & Adaptive Interventions

FocusSense AI is an end-to-end, machine-learning-powered web platform designed to analyze student study behaviour, detect burnout and distraction patterns, deliver interpretable feature attributions, provide interactive counterfactual what-if simulations, and recommend personalized, adaptive study interventions with Bayesian outcome feedback.

---

## 🌟 Key Capabilities

1. **Active Telemetry & Study Session Tracking:**
   - Real-time logging of study duration, break frequencies, active vs. idle screen time, typing cadence variance, and ambient distractions.
   - Session completion and automated ML feature extraction.

2. **Dual-Model ML Behavioural Inference:**
   - **Persona Classifier (Random Forest):** Classifies student study habits into actionable behavioral archetypes (*Focused Deep Worker*, *Fragmented Multi-Tasker*, *Fatigued Overachiever*, *Late-Night Crammer*, *Consistent Pacer*).
   - **Focus Score Regressor (Gradient Boosting):** Accurately predicts quantitative session focus scores ($0.0 - 100.0$) from 13 behavioral telemetry signals.

3. **Explainable AI (XAI) & Attribution:**
   - Dual-engine feature attribution architecture.
   - Computes local feature attributions using SHAP TreeExplainer when compiled wheels are available, with an exact, native tree decision-path attribution engine fallback ($\text{Base Value} + \sum \phi_i = \text{Prediction}$ held within $< 10^{-14}$) ensuring zero C-extension compile errors on Python 3.14.

4. **Interactive Counterfactual "What-If" Explorer:**
   - Real-time client-side counterfactual simulation allowing students to manipulate parameters (e.g., reduce break frequency, extend sleep, cut night study) and observe predicted focus shifts without triggering server mutations.

5. **Adaptive Recommendation Feedback Loop:**
   - Delivers targeted habit interventions tailored to the student's behavioural persona.
   - Tracks intervention outcomes (`delta_focus_next_session`).
   - Dynamically re-ranks future interventions using Bayesian shrinkage toward the global prior to prevent premature convergence on small sample sizes.

6. **Parent & Educator Portal:**
   - Privacy-preserving aggregate visibility for parents and guardians.
   - Secure student linking via pairing tokens, weekly summary trends, subject focus distributions, and behavioral insights without intrusive surveillance (no screen recording, no raw keylogging).

---

## 🏗️ System Architecture

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons, Recharts.
- **Backend:** Python 3.14, FastAPI, SQLAlchemy 2.0 ORM, Pydantic v2 schemas.
- **Machine Learning:** Scikit-Learn 1.6, NumPy, Joblib, SHAP / Native Decision Tree Path Attribution Engine.
- **Database & Authentication:** Supabase (PostgreSQL 15), Supabase Auth with JWT bearer token verification, Row-Level Security & tenant isolation.

---

## 📂 Repository Layout

```text
FocusSenseAI/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routes (auth, student, study_session, parent)
│   │   ├── core/           # Config, database engine, security, Supabase client
│   │   ├── models/         # SQLAlchemy ORM models (12 tables)
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   └── services/       # ML inference, XAI, recommendation engine, telemetry
│   ├── tests/              # 63 pytest unit, integration, and E2E tests
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components & layouts
│   │   ├── pages/          # Dashboard, StudySession, Behaviour, Recommendations, Parent
│   │   └── services/       # API client & Supabase auth integration
│   └── package.json        # Frontend dependencies & scripts
├── ml/                     # ML training pipelines, feature processors, synthetic datasets
├── docs/                   # System design, demonstration, and presentation docs
│   ├── demo-walkthrough.md # Step-by-step college viva demo script & verification
│   ├── project-presentation.md # 15-slide comprehensive viva presentation guide
│   ├── architecture.md     # Architectural patterns & data flow
│   └── supabase-setup.md   # Supabase configuration & migrations
└── README.md               # Project overview & quickstart
```

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- **Node.js:** v18+ or v20+
- **Python:** v3.11+ (Python 3.14 fully supported)
- **Supabase Account:** Configured project with Auth enabled

### 1. Backend Setup

```powershell
cd backend

# Create and activate virtual environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example to .env and provide your Supabase URL, Anon Key, and Database URL
cp .env.example .env

# Run FastAPI server
uvicorn app.main:app --reload --port 8000
```
Backend will be available at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.

### 2. Frontend Setup

```powershell
cd frontend

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
cp .env.example .env.local

# Start Vite dev server
npm run dev
```
Frontend application will be accessible at `http://localhost:5173`.

---

## 🧪 Testing & Verification

The backend includes a comprehensive, isolated test suite that verifies authentication, ML inference, XAI attribution math, adaptive recommendations, student-session workflows, and parent portal security without mutating production data.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -v
```

**Test Suite Coverage (63 Tests Total):**
- `test_auth.py` (18 tests): JWT authentication, token decoding, student/parent role isolation.
- `test_ml_pipeline.py` (13 tests): Model loading, inference schemas, SHAP & exact tree-path attribution mathematical closure ($\sum \phi_i = \hat{y} - \mathbb{E}[y]$).
- `test_recommendations.py` (13 tests): Archetype targeting, outcome tracking, Bayesian score shrinkage, and tie-breaking.
- `test_student_api.py` (10 tests): Study session lifecycle, telemetry ingest, and history aggregation.
- `test_study_workflow_e2e.py` (5 tests): End-to-end telemetry $\rightarrow$ feature computation $\rightarrow$ inference $\rightarrow$ attribution $\rightarrow$ recommendation flow.
- `test_parent_portal.py` (4 tests): Parent linking token exchange, weekly summary aggregation, and tenant security.

Frontend validation:
```powershell
cd frontend
npm run lint
npm run build
```

---

## 📚 Presentation & Walkthrough Guides

For full college demonstration scripts, viva defense outlines, and presentation slides:
- **[docs/demo-walkthrough.md](docs/demo-walkthrough.md):** Complete live demonstration walkthrough covering student login, real-time study tracking, ML persona classification, feature attributions, counterfactual exploration, adaptive feedback loops, and parent portal review.
- **[docs/project-presentation.md](docs/project-presentation.md):** 15-slide comprehensive presentation script detailing problem statement, technical architecture, ML pipeline, explainability fallbacks, ethics & privacy safeguards, test results, and future directions.
