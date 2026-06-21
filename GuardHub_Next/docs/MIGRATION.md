# Migration Guide — `Guard_frontend` → `GuardHub_Next`

How to move from the legacy CRA/Bootstrap admin template to the new Vite app. The two can run side by side during the transition; the backend is shared and unchanged.

---

## 1. Run them side by side

| App              | Stack            | Dev port | Start |
| ---------------- | ---------------- | -------- | ----- |
| `Guard_backend`  | Express + Mongo  | 9002     | `npm start` |
| `Guard_frontend` | CRA (legacy)     | 9001     | `npm start` |
| `GuardHub_Next`  | Vite (new)       | 9003     | `npm run dev` |

Both frontends talk to the same backend on 9002, so you can verify screen-for-screen before cutting over. No data migration is required — **the database and API are untouched**.

### Environment variable change
| Legacy (CRA)                    | New (Vite)             |
| ------------------------------- | ---------------------- |
| `REACT_APP_API_BASE_URL`        | `VITE_API_BASE_URL`    |

Copy the same value (`http://localhost:9002` in dev) into `GuardHub_Next/.env`.

---

## 2. Route map (old → new)

| Legacy route            | New route        | Notes |
| ----------------------- | ---------------- | ----- |
| `/login`                | `/login`         | Same `POST /login`; user stored in `localStorage` |
| `/dashboard`            | `/dashboard`     | Real KPIs only (no fabricated health widgets) |
| `/profilepage`          | `/employees`     | Renamed; add/edit now in a slide-over drawer |
| `/day-wise-report`      | `/reports/day`   | |
| `/month-wise-report`    | `/reports/month` | "Remaining CLs" dropped (route never existed — see BACKEND_ISSUES #1) |
| `/LeaveOdManagement`    | `/leaves` + `/od`| Split into two focused pages; `/ot` added |
| `/apply-leave`          | `/apply/leave`   | |
| `/apply-od`             | `/apply/od`      | |
| `/apply-ot`             | `/apply/ot`      | |
| `/security-roaster`     | `/roster`        | Spelling normalized to "roster" |

Update any bookmarks / deep links accordingly.

---

## 3. Auth storage change

| | Legacy | New |
| - | ------ | --- |
| localStorage key | `authUser` | `guardhub.user` |
| Theme key | (template-managed) | `guardhub.theme` |
| Sidebar key | (template-managed) | `guardhub.sidebar` |

Because the storage key changed, **users will be asked to log in once** after switching. No other state carries over (none is needed — all data lives in the backend).

---

## 4. Behavioral parity checklist

Verify each against the legacy app before cutover:

- [ ] **Login** with the same credentials reaches the dashboard.
- [ ] **Employees**: search, add (with photo), edit, delete, CSV export, bulk CSV upload.
  - Bulk upload posts each row to `POST /emp/add-employee` (no bulk endpoint exists — same as legacy).
- [ ] **Day Wise Report**: pick a date → rows from `secattendancelogs` with in/out/punches.
- [ ] **Month Wise Report**: pick employee + range → Present/Absent/Leave/OD/Week-Off tiles.
- [ ] **Apply Leave / OD / OT**: search employee → autofill → submit; record appears in the matching View page.
- [ ] **View Leaves / OD / OT**: list, search, export, delete; OT status can be changed inline.
- [ ] **Roster**: weekly grid renders, edit shifts, add entry, bulk CSV upsert shows added/updated/invalid/failed counts.

---

## 5. Field & payload compatibility

The new app sends **exactly the same field names and types** the backend expects (verified against the controllers):

- Leave/OD: `empId` as a **Number**, dates as `yyyy-mm-dd`.
- OT: `employeeId` as a **Number** (name/designation/department are derived server-side — never sent).
- Roster: `empId` as a **String**, full `weeklyShifts { sunday..saturday }`.
- Employee image: multipart field **`empImage`**; `empId` must be present for the backend to name the file.

CSV templates are downloadable in-app (Employees and Roster pages) and use the same column headers as the legacy importers, so existing spreadsheets keep working.

---

## 6. Decommissioning the legacy app

Once parity is confirmed in production:

1. Point your reverse proxy / static host at `GuardHub_Next/dist` (output of `npm run build`).
2. Keep `Guard_frontend` available read-only for one release cycle as a rollback.
3. Recommended backend hardening before/after cutover (see `BACKEND_ISSUES.md`): password hashing + JWT, fix `updateEmp` to persist `empImage`, add a unique index on `roster_mgmt.empId`, and make `today-attendance-data` read-only.

---

## 7. What intentionally changed

- **No Redux/Saga** — server state is TanStack Query, the little client state is Zustand.
- **No Bootstrap/Reactstrap/MDB** — a small in-house component library + CSS tokens.
- **No charts / ApexCharts** — the dashboard is operational (KPIs + recent activity), per the design brief.
- **Drawers instead of large modals** for add/edit.
- **Dark mode** via the topbar toggle (token-based, persisted).

Everything users *do* is preserved; only the implementation underneath is lighter.
