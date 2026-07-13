# Leave Management v2 — Redesign

Phase 1 of the GuardHub redesign. Reworks Leave Management into a maintainable,
extensible system with yearly allocation, per-type balances, remaining-leave
tracking, history, and monthly/yearly statistics — structured so a future Salary
module can consume it without database or code changes. **Salary itself is not
implemented in this phase.**

Branch: `feature/leave-management-v2`.

---

## 1. What was reused vs redesigned

**Reused (unchanged):**
- `utils/employeeRef.js` — active-employee resolution / soft-delete filtering.
- `securitydetails` employee master as the single id source (no employee data is
  duplicated into the new collections).
- The legacy `leave_mgmt` collection and all legacy `/leave/*` endpoints.
- Frontend house patterns: `service → hook → page`, `DataTable`, `Drawer`,
  `exportFilteredCsv`, `EmployeePicker`, query-key registry.

**Redesigned / added:** three new collections, a leave-day utility, four small
controllers, additive routes, and new/​reworked frontend screens (below).

**Compatibility bridge (why nothing else broke):** the attendance cron
(`scheduleController`), `attendanceController`, and the month-wise report read
`leave_mgmt` to flag a day as "Leave". So recording a leave **dual-writes**: it
creates the authoritative `leave_transactions` row *and* mirrors a legacy
`leave_mgmt` row (linked by `legacyLeaveId`). Deleting a leave reverses both.
Those modules were not touched.

---

## 2. Database changes

No existing schema was modified. Three new collections were added.

### `leave_types` (`models/leaveTypeScheme.js`)
Configurable categories. Adding a type needs **no code change**.
| Field | Type | Notes |
|---|---|---|
| code | String (unique, upper) | FK used by balances/transactions (e.g. `CL`) |
| name | String | Display label |
| defaultAnnualQuota | Number | Seed value when a yearly allocation runs |
| isPaid | Boolean | **Salary-facing**: unpaid = LOP |
| active | Boolean | Delete = deactivate (history preserved) |
| description, sortOrder | — | |

### `leave_balances` (`models/leaveBalanceScheme.js`)
One row per **employee × year × type**. `remaining` is a **virtual** (never
stored → never drifts).
| Field | Type | Notes |
|---|---|---|
| empId | Number | same id as `securitydetails.empId` |
| year | Number | yearly tracking |
| leaveTypeCode | String | FK → leave_types.code |
| allocated | Number | set by allocation |
| used | Number | auto-maintained by transactions |
| _remaining_ | virtual | `allocated - used` |

Unique index `{ empId, year, leaveTypeCode }` — prevents duplicate ledgers.

### `leave_transactions` (`models/leaveTransactionScheme.js`)
The redesigned leave record (immutable event).
| Field | Type | Notes |
|---|---|---|
| empId | Number | |
| leaveTypeCode | String | FK |
| leaveTypeName / isPaid | String / Boolean | **snapshot** — history & salary stay correct if policy changes later |
| fromDate, toDate | Date | |
| days | Number | supports 0.5 (half-day) |
| month, year | Number | denormalised from fromDate → indexed stats/salary group-by |
| dayType, shiftType, reason | String | |
| legacyLeaveId | ObjectId | link to mirrored `leave_mgmt` row |
| createdAt | Date | "Created Date" |

Indexes `{ empId, year, month }` and `{ year, month }`.

### Utility
`utils/leaveDays.js` — the single source of leave-day math (inclusive calendar
days, half-day aware). When a holidays/week-off master is added later, only this
file changes.

---

## 3. API changes (all additive under `/leave`)

Legacy `/leave/*` routes are unchanged. New routes:

```
GET    /leave/types?activeOnly=true          list (auto-seeds defaults once)
POST   /leave/types                          create
PUT    /leave/types/:id                      edit (code immutable)
DELETE /leave/types/:id                      deactivate

GET    /leave/balances?year&empId            per-employee balances for a year
POST   /leave/balances/allocate              { year, allocations:[{leaveTypeCode,allocated}], empIds? }

GET    /leave/transactions?empId&month&year&leaveTypeCode&fromDate&toDate
POST   /leave/transactions                   record leave (auto-debits balance + legacy mirror)
DELETE /leave/transactions/:id               delete (reverses balance + legacy mirror)

GET    /leave/reports/summary?empId&month&year&leaveTypeCode   report rows + summary
GET    /leave/summary/monthly?year&empId&month   SALARY-READY monthly roll-up
GET    /leave/summary/yearly?year&empId          yearly roll-up
```

Controllers are small and split by concern: `leaveTypeController`,
`leaveBalanceController` (owns the ledger mutation `adjustBalanceUsed`),
`leaveTransactionController`, `leaveReportController`.

Setup: `node scripts/seedLeaveTypes.js` (or just call `GET /leave/types` once —
it lazy-seeds Casual/Special/Summer/Holiday).

---

## 4. Frontend changes

New nav section **Leave Management**:
- **Leave Records** (`/leaves`) — reworked to the transaction history (day
  counts, balance-linked delete). `ViewLeaves.jsx`
- **Leave Balances** (`/leaves/balances`) — year view of Allocated / Used /
  Remaining, per-type breakdown drawer, **yearly allocation** action, CSV.
  `LeaveBalances.jsx`
- **Leave Report** (`/leaves/report`) — filter by employee / month / year /
  type, summary tiles, **CSV export** with the required columns. `LeaveReport.jsx`
- **Leave Types** (`/leaves/types`) — manage configurable categories. `LeaveTypes.jsx`
- **Apply Leave** (`/apply/leave`) — reworked to record a transaction, with a
  live day-count and a remaining-balance hint. `ApplyLeave.jsx`

Data layer: `services/leaveV2Service.js`, `hooks/useLeaveV2.js`, endpoints +
query keys, `MONTHS`/`recentYears` constants.

---

## 5. CSV report sample

`docs/leave-report-sample.csv` (columns exactly as specified):

```
Employee Name,Employee ID,Leave Taken,Leave Type,Allocated Leave,Used Leave,Remaining Leave
Anil Kumar,5122,3,Casual Leave,12,9,3
Anil Kumar,5122,1,Sick Leave,6,1,5
Ravi Teja,5157,2,Casual Leave,12,2,10
Ravi Teja,5157,4,Summer Leave,4,4,0
Suresh Babu,5297,0.5,Casual Leave,12,6.5,5.5
Lakshmi Devi,5353,2,Special Leave,6,2,4
```

---

## 6. Testing checklist

Prereq: backend on :9002 with a reachable `MONGO_URI`; `npm run dev` for the app.

**Setup**
- [ ] `GET /leave/types` returns the 4 seeded types (or run `seedLeaveTypes.js`).
- [ ] Leave Types page: create a type, edit its quota, deactivate it — it drops
      out of the Apply Leave dropdown but existing records keep their label.

**Allocation & balances**
- [ ] Leave Balances → "Allocate 2026" → apply → every active employee shows the
      allocated totals; used = 0, remaining = allocated.
- [ ] Re-running allocation changes `allocated` but never `used`.

**Record / balance auto-update**
- [ ] Apply Leave: pick employee + type → panel shows remaining and "→ after".
- [ ] Submit a 3-day CL → success; Leave Records shows 3 days; Balances `used`
      +3, `remaining` −3.
- [ ] Half-day (From=To, duration FIRST HALF) records **0.5** days.
- [ ] Reversed dates are rejected (400).

**Delete restores balance**
- [ ] Delete that leave in Leave Records → `used` −3, `remaining` +3; the row
      disappears from the legacy `leave_mgmt` too.

**Reports & stats**
- [ ] Leave Report: filter by employee / month / year / type; tiles + table
      update; **Export CSV** matches the filtered table and the column list above.
- [ ] `GET /leave/summary/monthly?year=2026` returns per-employee-per-month
      totalDays / paidDays / unpaidDays.

**Compatibility (must still work)**
- [ ] Day Wise Report still marks a leave day as "Leave" (legacy mirror).
- [ ] Month Wise Report leave counts unchanged in behaviour.
- [ ] OD / OT / Employees / Roster screens unaffected.
- [ ] `npm run build` succeeds (verified).

---

## 7. How this supports the future Salary module (no rework needed)

The salary engine's leave inputs are already produced here:
- **`leave_transactions` carries `month`, `year`, `days`, and a snapshot
  `isPaid`.** Salary is computed per employee per month; that group-by is a
  single indexed aggregation — already exposed as `GET /leave/summary/monthly`,
  which returns `totalDays / paidDays / unpaidDays` per employee per month.
- **`unpaidDays` is the LOP deduction basis.** Whether a category costs pay is a
  property of `leave_types.isPaid`, snapshotted onto each transaction, so
  historical pay stays correct even if a type's policy is edited later.
- **Balances (`allocated/used/remaining`)** give encashment / carry-forward the
  numbers they need without recomputation.

So wiring salary later means: read the existing monthly summary + balances and
apply pay rules. **No schema change, no change to how leave is recorded.**
