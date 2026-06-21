# Backend Issues & Findings

Discovered while analyzing `Guard_backend` to build GuardHub_Next. Listed by severity. None of these were "fixed" in the backend (out of scope — the brief was *do not modify backend behavior*), but the frontend was built to work correctly around them, and each is flagged for the backend team.

---

## 🔴 High

### 1. `/leaves/remaining-cl/:empId` does not exist
The legacy `MonthWiseReportPage/monthwisereport.js` calls `GET /leaves/remaining-cl/:empId`. There is **no such route** in the backend — leave routes are mounted at `/leave` (singular), and no `remaining-cl` handler exists anywhere. This call has always 404'd.
**Handled:** GuardHub_Next omits "Remaining CLs" from the Month Wise report. If CL balance is wanted, the backend must add the route + aggregation.

### 2. Updating an employee photo does not update `empImage` in the DB
`profileController.updateEmp` does `findOneAndUpdate(..., req.body, ...)` and **never reads `req.file.filename`**. So when an edit includes a new image:
- the file *is* written to disk as `<empId><ext>` (multer), but
- the `empImage` field in MongoDB keeps its **old** value.

If the new upload changes the extension (e.g. `.jpg` → `.png`), the stored `empImage` points to a stale/again-correct file inconsistently.
**Handled:** the image helper falls back to `<empId>.jpg` and then `0000.jpg`, so the UI degrades gracefully, but the underlying field should be updated server-side (`updateEmp` should set `empImage = req.file.filename` when `req.file` is present).

### 3. No real authentication / authorization
`loginController` does `login.findOne({ userName, userPassword })` — **plaintext password match**, returns the raw user document, and issues **no token**. Every other route is unauthenticated and CORS is open to all origins (`app.use(cors())` is even called twice in `index.js`). Anyone who can reach the API can read/modify all data.
**Handled:** the frontend stores the returned user and gates routes on its presence, and forwards an `Authorization` header if a token ever appears — but this is a client-side gate only. The backend needs hashed passwords + JWT/session.

---

## 🟠 Medium

### 4. `today-attendance-data` has side effects and external dependencies
`GET /attendance/today-attendance-data`:
- fetches from an **external biometric HTTP API** (`ATTENDANCE_LOG_API`) that may be unreachable, and
- calls `EmpAttendance.insertMany(result)` **on every request**, duplicating rows in `empattendances` each time it's hit.
**Handled:** the Day Wise report uses `GET /attendance/get-attendace-bydate/:date` instead, which is read-only and sources the **real** biometric collection `secattendancelogs`. (Confirmed by the controller's own comments: "since empattendances is empty".)

### 5. `empattendances` is effectively empty / unreliable
Both `getMonthwiseReport` (in `attendanceController`) and `getAttendanceByShift` read from `empattendances`, which the codebase comments describe as empty. The authoritative month summary is `GET /month/monthwise-report/:empId` (reads `secattendancelogs` + leave/od/roster).
**Handled:** Month Wise report uses `/month/monthwise-report/:empId` exclusively.

### 6. `empId` type is inconsistent across collections
- `securitydetails` (profile), `leave_mgmt`, `od_mgmt`: **Number**
- `ot_mgmt`: **`employeeId` Number** (different field name)
- `roster_mgmt`, `secattendancelogs` (`EmployeeCode`), `empattendances`: **String**

Cross-collection joins must coerce types. Apply Leave/OD send `parseInt(empId)`; Apply OT sends `employeeId`; roster sends `String(empId)`.
**Handled:** services/forms coerce per-collection; name-resolution maps are keyed by `String(empId)`.

### 7. Single roster add (`POST /roster/add-emp-shift`) can create duplicates
Unlike `bulk-upload` (which upserts on `empId`), `addEmployeShift` does a plain `save()` with no duplicate check and no unique index on `empId`. Adding the same employee twice creates two roster rows.
**Handled:** the Add Roster drawer is intended for employees not yet rostered; the UI relies on `bulk-upload` for safe upserts. A unique index on `roster_mgmt.empId` is recommended.

### 8. `add-emp-shift` throws if `weeklyShifts` is omitted
The controller destructures all seven weekday keys out of `req.body.weeklyShifts`; a missing `weeklyShifts` object throws a 500.
**Handled:** the frontend always sends a complete `weeklyShifts` object (defaults to `General`).

---

## 🟡 Low / cosmetic

9. **Delete responses** (`deleteLeaveById`, `deleteOdById`) return `deletedCount` off a `findByIdAndDelete` result that doesn't carry that field — it's `undefined`. Harmless; the UI relies on HTTP status, not the body.
10. **404 on "no records"** — `get-leave-byid`, `get-od-byid`, `get-emp-byid` return **404** when an employee simply has no records. The services treat 404 as "empty" rather than an error.
11. **Duplicated `app.use(cors())`** in `index.js`.
12. **No pagination** on any list endpoint — fine at < 500 employees; the frontend paginates client-side.
13. **Mixed image extension casing** in `uploads/` (`5297.JPG` vs `1402.jpg`). Always build image URLs from the stored `empImage` filename, never by guessing the extension. (Already a documented data convention.)

---

## Endpoints verified in use

All routes below were read directly from the controllers and are exercised by GuardHub_Next exactly as the backend implements them:

```
POST   /login
GET    /emp/get-emp-details
GET    /emp/get-emp-byid/:empId
POST   /emp/add-employee            (multipart, field: empImage)
PUT    /emp/update-emp-byid/:empId  (multipart, field: empImage)
DELETE /emp/delete-emp-byid/:empId
GET    /attendance/get-attendace-bydate/:date     -> { data: [...] }
GET    /month/monthwise-report/:empId?startDate&endDate -> { summary }
POST   /leave/apply-leave           { empId(Number), empLeaveType, empFromDate, empToDate, empShiftType, empOdType, empReason }
GET    /leave/get-month-wise-leaves?fromDate&toDate -> { data }
DELETE /leave/delete-leave-byid/:id
POST   /od/apply-od                 { empId(Number), empShiftType, empOdType, empFromDate, empToDate, empPurpose, odLocation }
GET    /od/get-ods?fromDate&toDate  -> { data }
DELETE /od/delete-od-byid/:id
POST   /ot/apply-ot                 { employeeId(Number), currentShift, additionalShift, workingDuration, fromDate, toDate, location, reason, remarks }
GET    /ot/get-ot                   -> { data }
PUT    /ot/update-ot/:id            { status, ... }
DELETE /ot/delete-ot/:id
GET    /roster/get-emp-data
POST   /roster/add-emp-shift        { empId(String), empName, ..., weeklyShifts{sun..sat} }
PUT    /roster/update-emp-roster/:empId
DELETE /roster/guard-delete-byid/:empId
POST   /roster/bulk-upload          { rows:[...], uploadedBy } -> { addedCount, updatedCount, invalidCount, failedCount, invalidRecords, failedRecords }
```
