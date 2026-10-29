# Expense Tracker

Full-stack personal finance app: income/expense tracking, categories, monthly dashboard,
analytics charts, budgets, report exports and AI-generated spending insights.

| Layer    | Stack |
|----------|-------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios, TanStack Query, Chart.js |
| Backend  | FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2, JWT (access + refresh) |
| Data     | PostgreSQL 16, Redis 7 (cache, rate limits, job queue) |
| Jobs     | ARQ worker (exports, AI insights, budget alerts) |

## Quick start

```bash
cp .env.example .env          # then edit secrets
make up                       # builds and starts db, redis, backend, worker, frontend
make migrate                  # apply database migrations
```

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/v1
- API docs (dev only): http://localhost:8000/docs

### Without Docker

```bash
# backend (needs a running Postgres; see backend/.env.example)
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env              # point DATABASE_URL at your Postgres
alembic upgrade head && python -m app.seed
uvicorn app.main:app --reload
pytest                            # uses a separate <db>_test database

# frontend
cd frontend && npm install && npm run dev
```

## Common commands

| Command | Description |
|---------|-------------|
| `make up` / `make down` | Start / stop all services |
| `make migrate` | Apply Alembic migrations |
| `make revision m="msg"` | Autogenerate a new migration |
| `make test` | Run backend (pytest) and frontend (vitest) tests |
| `make lint` / `make format` | Ruff + ESLint / Prettier |

## Project structure

```
Expense-Tracker/
├── .github/workflows/ci.yml   # CI: lint, test, build for both apps
├── docs/                      # Architecture notes, API docs, ADRs, diagrams
├── scripts/                   # Dev/ops helper scripts (seed data, backups)
├── docker-compose.yml         # Local stack: db, redis, backend, worker, frontend
├── Makefile                   # Shortcuts for common dev tasks
├── .env.example               # Template of every environment variable
├── .editorconfig              # Shared editor formatting rules
├── .gitignore
├── backend/
└── frontend/
```

### Backend (`backend/`)

```
backend/
├── app/
│   ├── main.py                # App factory: CORS, request-ID/security-header middleware,
│   │                          #   error handlers, router mounting, /health endpoints
│   ├── config.py              # Typed settings loaded from environment / .env
│   ├── database.py            # Async engine, session factory, declarative Base, get_db
│   ├── exceptions.py          # AppError hierarchy + uniform JSON error responses
│   ├── seed.py                # Idempotent seeding of system default categories
│   ├── models/                # SQLAlchemy ORM models: users, refresh_tokens, categories,
│   │                          #   transactions, budgets (+ shared mixins and enums)
│   ├── schemas/               # Pydantic request/response models (the API contract)
│   ├── routes/                # Thin HTTP handlers, one module per resource
│   ├── authentication/        # Password hashing, JWT, refresh-cookie helpers,
│   │                          #   get_current_user dependency
│   ├── services/              # Business logic, always scoped to the current user
│   ├── utils/                 # Pure helpers: month math, money rounding/percentages
│   ├── workers/               # (later phase) background jobs
│   └── templates/reports/     # (later phase) PDF export templates
├── alembic/                   # Migration environment
│   └── versions/              # Migration scripts
├── tests/
│   ├── unit/                  # Pure-function tests
│   └── integration/           # API tests against a real Postgres "<db>_test" database
├── alembic.ini
├── pyproject.toml             # Ruff, pytest, coverage, mypy config
├── requirements.txt / requirements-dev.txt
├── .env.example
└── Dockerfile
```

Request flow: **route → service → model**. Routes handle HTTP only; services hold business
rules and every query is filtered by the authenticated user's id.

### Frontend (`frontend/`)

```
frontend/src/
├── main.jsx, App.jsx          # Entry; App = ErrorBoundary → Router → AuthProvider → routes
├── routes/
│   ├── AppRouter.jsx          # All routes; pages are lazy-loaded (one chunk each)
│   ├── ProtectedRoute.jsx     # Logged-in only; otherwise → /login (remembers where you were)
│   └── PublicOnlyRoute.jsx    # /login, /register; logged-in users are sent on
├── layouts/                   # AppLayout (sidebar + mobile drawer), AuthLayout (centered card)
├── pages/                     # One file per route: Home, Login, Register, Dashboard,
│                              #   Transactions, Profile, NotFound
├── components/
│   ├── ui/                    # Design-system pieces: Button, Input/Select/Textarea, Modal,
│   │                          #   Card, Alert, Spinner, EmptyState, Icon
│   ├── layout/                # Sidebar, Logo
│   ├── common/                # PageHeader, ConfirmDialog, ErrorBoundary, FullPageSpinner
│   ├── auth/                  # LoginForm, RegisterForm
│   ├── dashboard/             # StatCard, MonthlyChart, CategoryChart (Chart.js)
│   ├── transactions/          # TransactionList, TransactionForm, TransactionFilters, Pagination
│   └── profile/               # ProfileForm, PasswordForm
├── services/                  # All HTTP: apiClient (Axios + token refresh), tokenStore, and one
│                              #   service per resource (auth, user, transaction, category, dashboard)
├── context/                   # AuthContext + AuthProvider (user, status, login/register/logout)
├── hooks/                     # useAuth, useAsync, useForm, useCategories, useDebounce, useDocumentTitle
├── utils/                     # format (currency/date), dates, errors (API envelope), validators, cn
├── constants/                 # Route paths, app constants (types, payment methods, currencies)
├── styles/index.css           # Tailwind entry
└── tests/                     # Vitest + Testing Library
```

| Route | Access | Page |
|---|---|---|
| `/` | public | Landing page |
| `/login`, `/register` | logged-out only | Auth forms |
| `/dashboard` | logged-in | Balance, totals, monthly chart, category chart |
| `/transactions` | logged-in | List, filter, search, add / edit / delete |
| `/budgets` | logged-in | Monthly budget (limit / spent / remaining, pacing) and category budgets |
| `/profile` | logged-in | Name, currency, timezone, change password |

**Auth in the browser:** the access token is kept in memory only; the refresh token is an
HttpOnly cookie. On a 401 the Axios client refreshes once (shared across parallel requests)
and retries. On page load the app restores the session from the cookie.

In development Vite proxies `/api` to the backend (`VITE_PROXY_TARGET`, default
`http://localhost:8000`), so the app and API share an origin.

## Environment variables

See [`.env.example`](.env.example). Never commit `.env`.
