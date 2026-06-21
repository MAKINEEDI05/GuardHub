# GuardHub_Next

A lightweight, modern frontend for the **GuardHub Security Workforce Management System**, built from scratch against the existing `Guard_backend` API. It replaces the heavy CRA + Bootstrap admin template (`Guard_frontend`) with a fast Vite + React app focused on speed, maintainability, and correct backend integration.

> The legacy `Guard_frontend` is untouched and still serves as the functional reference.

---

## Tech Stack

| Concern        | Choice                          | Why |
| -------------- | ------------------------------- | --- |
| Build tool     | **Vite 6**                      | Instant dev server, tiny optimized builds |
| UI             | **React 18**                    | — |
| Routing        | **React Router 6** (lazy)       | Route-level code splitting |
| Server state   | **TanStack Query 5**            | Caching, dedup, retries, no manual loading flags |
| Client state   | **Zustand**                     | Auth / theme / toasts — minimal, no boilerplate |
| HTTP           | **Axios** (one instance)        | Centralized base URL, interceptors, friendly errors |
| CSV            | **PapaParse**                   | Import/export employee & roster CSVs |
| Styling        | **Plain CSS + design tokens**   | No UI framework; small bundle, full control |

No Bootstrap, no Redux/Saga, no chart libraries, no icon fonts (icons are inline SVG).

**Initial load ≈ 91 KB gzipped JS**; each page is split into a 1–4 KB chunk loaded on demand.

---

## Quick Start

```bash
cd GuardHub_Next
cp .env.example .env          # set VITE_API_BASE_URL if backend isn't on :9002
npm install
npm run dev                   # http://localhost:9003
```

Make sure `Guard_backend` is running (default `http://localhost:9002`).

```bash
npm run build                 # production build -> dist/
npm run preview               # preview the production build
```

### Environment

| Var                  | Default                  | Purpose |
| -------------------- | ------------------------ | ------- |
| `VITE_API_BASE_URL`  | `http://localhost:9002`  | GuardHub backend base URL |

---

## Architecture

```
src/
├── api/          # axios client, endpoint registry, React Query client + keys
├── services/     # one module per domain — the ONLY place that calls the API
├── hooks/        # React Query hooks (useEmployees, useLeaves, useRoster, ...)
├── store/        # Zustand stores (auth, ui/theme, toasts)
├── components/
│   ├── ui/       # reusable library (Button, Card, DataTable, Drawer, ...)
│   ├── employees/ roster/   # feature-specific composite components
│   └── EmployeePicker.jsx   # shared search→autofill used by Apply forms
├── layouts/      # AppLayout, Sidebar, Topbar, nav model
├── pages/        # one file per screen (all lazy-loaded)
├── routes/       # AppRouter + ProtectedRoute auth guard
├── utils/        # date, csv, empImage, constants
└── styles/       # tokens.css (design system) + global.css
```

**Data-flow rule:** `pages → hooks → services → api/client`. Pages never import axios directly. Endpoints live in one registry (`api/endpoints.js`) that mirrors the backend routers exactly.

### Authentication

The backend `/login` returns a plain `user` object (no JWT). On success the user is stored in `localStorage` (`guardhub.user`) via `authStore`; `ProtectedRoute` gates every app route on its presence. Logout clears it.

### Employee images

All photos go through `utils/empImage.js`, which builds URLs from the exact stored `empImage` filename (mixed `.jpg`/`.JPG` casing exists in production) and falls back to `0000.jpg` once — with `onerror` cleared to avoid flicker loops.

---

## Pages

| Route             | Page                | Backend source |
| ----------------- | ------------------- | -------------- |
| `/login`          | Login               | `POST /login` |
| `/dashboard`      | Dashboard (KPIs + recent activity + quick actions) | employees, rosters, leaves, ods, ot |
| `/employees`      | Employee Management (search, add/edit drawer, delete, CSV import/export) | `/emp/*` |
| `/roster`         | Security Roster (weekly grid, edit/add drawer, bulk CSV upsert) | `/roster/*` |
| `/reports/day`    | Day Wise Report     | `GET /attendance/get-attendace-bydate/:date` (biometric `secattendancelogs`) |
| `/reports/month`  | Month Wise Report   | `GET /month/monthwise-report/:empId` |
| `/leaves`         | View Leaves         | `GET /leave/get-month-wise-leaves` |
| `/od`             | View OD             | `GET /od/get-ods` |
| `/ot`             | View OT             | `GET /ot/get-ot` |
| `/apply/leave`    | Apply Leave         | `POST /leave/apply-leave` |
| `/apply/od`       | Apply OD            | `POST /od/apply-od` |
| `/apply/ot`       | Apply OT            | `POST /ot/apply-ot` |

See [`docs/`](./docs) for the **Performance Report**, **Backend Issues Found**, and the **Migration Guide**.
