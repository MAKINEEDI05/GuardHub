# Attendance & Leave — Quick Guide

A short guide for the admin managing Leave, OT, OD, and Attendance.

---

## What each screen does

- **Apply Leave / OT / OD** — record a leave, overtime, or on-duty for one employee.
- **View Leaves / View OT / View OD** — list, search, view, edit, delete records + export.
- **Leave Management** — every employee's leave balance in one place, with filters + export.
- **Attendance Muster Roll** — day-by-day grid for a month (P, A, CL, OD, OT, WO…).
- **Day Wise / Month Wise Report** — attendance totals for a day / a date range.
- **Leave Types** — the master list of leave categories (Casual, Comp Off, etc.).

---

## How leave balances work (important)

- Every leave is paid from **Casual Leave (CL) first, then Comp Off** — automatically.
  The **Deduction Breakdown** on Apply Leave shows exactly how (CL used, Comp Off used).
- **Comp Off** is earned only from **OT entries**. Add an OT → Comp Off goes up right away.
  Delete/edit the OT → it adjusts right away. **There is no OT approval step** — recording
  an OT means it already happened.
- **Weekly off days are not counted.** A leave from Mon–Sun for a Sunday-off employee
  counts as **6 days**, not 7. The screen shows total days, days excluded, and actual days.
- **Negative balance is allowed.** If someone has no CL and no Comp Off left, the leave is
  still recorded and the shortfall shows as a **Negative Balance** — it is never blocked.

---

## "Others" leave

- Use **Leave Type → Others** for a one-off leave that isn't a standard category
  (e.g. *Marriage Leave*, *Passport Verification*). Type the name + number of days.
- It shows that custom name everywhere (View Leaves, reports, exports).
- It does **NOT** touch any balance and does **NOT** become a leave type for anyone else.

---

## Do

- Pick the employee first — their **shift** auto-fills from the roster (Leave, OD and OT).
- Read the **Deduction Breakdown** before submitting a leave.
- Use **Others** for anything that isn't a standard leave category.
- Export from any screen — the file matches what's on screen.

## Don't

- Don't create two leaves (or two ODs) that **overlap the same dates** for one employee —
  the system blocks it. (A morning + afternoon **half-day** on the same day is fine.)
- Don't expect Special/Summer/Holiday to have their own balance — all leaves draw from
  **CL then Comp Off**; the type is just the label/reason.
- Don't apply a leave/OD that falls **entirely on weekly-off days** — it will be rejected.

---

## Notes to remember

- **Comp Off must be Active** in Leave Types, or it won't appear in the Apply Leave
  dropdown. **Casual Leave and Comp Off are mandatory** and cannot be deleted.
- Employees need a **roster** (weekly shifts + week-offs) or the day counts, the shift
  auto-fill and the report cards won't work for them. Unrostered staff appear under a
  **"Not Rostered"** card on the Day Wise report — assign them a roster.
- **Day Wise needs the attendance cron running** (it stamps Present/Absent each day). If a
  date shows no records, that day was never processed.
- Deleting a leave **restores** the balance; editing a leave **recalculates** it.
- Reports only show data **up to today** (no future attendance).
- The **date is written inside every export** (muster roll columns are full dates).

---

*Questions on the numbers? The rule is always: CL first → Comp Off → negative if short,
weekly-offs excluded. Every screen uses the same calculation.*
