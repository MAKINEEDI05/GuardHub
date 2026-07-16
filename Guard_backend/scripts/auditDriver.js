// Live end-to-end audit driver — hits the running backend (port 9002) against
// the local audit DB. Exercises the exact §4 deduction cases, weekly-off
// exclusion, Others, Comp-Off-from-all-OT, edit/delete rebalance, and
// single-source-of-truth consistency. Prints PASS/FAIL per assertion.
const BASE = "http://127.0.0.1:9002";
const YEAR = 2026;
let pass = 0, fail = 0;
const results = [];
const ok = (name, cond, detail = "") => {
  (cond ? pass++ : fail++);
  results.push(`${cond ? "PASS" : "FAIL ***"} | ${name}${detail ? "  :: " + detail : ""}`);
};

const api = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
};

// CL / COMP balance for an employee (byType from the single balance source).
async function bal(empId) {
  const { json } = await api("GET", `/leave/balances?year=${YEAR}&empId=${empId}`);
  const row = json?.data?.[0];
  const pick = (c) => row?.byType?.find((b) => b.leaveTypeCode === c) || { allocated: 0, used: 0, remaining: 0 };
  return { cl: pick("CL"), comp: pick("COMP") };
}
const allocateCL = (empId, n) => api("POST", "/leave/balances/allocate", { year: YEAR, allocations: [{ leaveTypeCode: "CL", allocated: n }], empIds: [empId] });
// OT of a given duration on a 2026 date (earns Comp Off immediately, no approval).
const addOT = (empId, dur, from = "2026-06-01", to = "2026-06-01") =>
  api("POST", "/ot/apply-ot", { employeeId: empId, currentShift: "General", additionalShift: "A Shift", workingDuration: dur, fromDate: from, toDate: to, location: "Main Gate", reason: "audit ot" });
const addLeave = (empId, extra) => api("POST", "/leave/transactions", { empId, leaveTypeCode: "CL", shiftType: "General", dayType: "FULL DAY", reason: "audit leave", ...extra });
const listLeaves = async (empId) => (await api("GET", `/leave/transactions?empId=${empId}`)).json?.data || [];

(async () => {
  // ---------- §4 CL -> Comp Off deduction (live) ----------
  // Case 1: enough CL (CL5, Comp3, req 2) -> CL2 Comp0
  await allocateCL(90001, 5); await addOT(90001, "Double Shift"); await addOT(90001, "8 Hours (Full Day)"); // comp 3
  let b = await bal(90001);
  ok("Case1 setup CL=5 Comp=3", b.cl.remaining === 5 && b.comp.remaining === 3, `CL${b.cl.remaining} CO${b.comp.remaining}`);
  let r = await addLeave(90001, { fromDate: "2026-07-13", toDate: "2026-07-14" }); // Mon-Tue = 2 wd
  let t = (await listLeaves(90001))[0];
  ok("Case1 CL2/Comp0/neg0 (req2, CL5)", t.clUsed === 2 && t.compUsed === 0 && t.lopDays === 0, `cl${t?.clUsed} co${t?.compUsed} lop${t?.lopDays} days${t?.days}`);

  // Case 2: partial CL (CL2, Comp5, req 4) -> CL2 Comp2
  await allocateCL(90002, 2); for (let i = 0; i < 5; i++) await addOT(90002, "8 Hours (Full Day)"); // comp 5
  b = await bal(90002);
  ok("Case2 setup CL=2 Comp=5", b.cl.remaining === 2 && b.comp.remaining === 5, `CL${b.cl.remaining} CO${b.comp.remaining}`);
  await addLeave(90002, { fromDate: "2026-07-13", toDate: "2026-07-16" }); // Mon-Thu = 4 wd
  t = (await listLeaves(90002))[0];
  ok("Case2 CL2/Comp2/neg0 (req4)", t.clUsed === 2 && t.compUsed === 2 && t.lopDays === 0, `cl${t?.clUsed} co${t?.compUsed} lop${t?.lopDays}`);

  // Case 3: only Comp Off (CL0, Comp4, req 2) -> Comp2
  await allocateCL(90003, 0); for (let i = 0; i < 2; i++) await addOT(90003, "Double Shift"); // comp 4
  b = await bal(90003);
  ok("Case3 setup CL=0 Comp=4", b.cl.remaining === 0 && b.comp.remaining === 4, `CL${b.cl.remaining} CO${b.comp.remaining}`);
  await addLeave(90003, { fromDate: "2026-07-13", toDate: "2026-07-14" }); // Sat+Sun off -> Mon,Tue = 2 wd
  t = (await listLeaves(90003))[0];
  ok("Case3 CL0/Comp2/neg0", t.clUsed === 0 && t.compUsed === 2 && t.lopDays === 0, `cl${t?.clUsed} co${t?.compUsed} lop${t?.lopDays}`);

  // Case 4: negative (CL1, Comp2, req 5) -> CL1 Comp2 neg2
  await allocateCL(90009, 1); await addOT(90009, "Double Shift"); // comp 2
  b = await bal(90009);
  ok("Case4 setup CL=1 Comp=2", b.cl.remaining === 1 && b.comp.remaining === 2, `CL${b.cl.remaining} CO${b.comp.remaining}`);
  await addLeave(90009, { fromDate: "2026-07-13", toDate: "2026-07-17" }); // Mon-Fri = 5 wd (Sun off)
  t = (await listLeaves(90009))[0];
  ok("Case4 CL1/Comp2/neg2 (req5)", t.clUsed === 1 && t.compUsed === 2 && t.lopDays === 2, `cl${t?.clUsed} co${t?.compUsed} lop${t?.lopDays}`);
  b = await bal(90009);
  ok("Case4 balances CL rem0 Comp rem0", b.cl.remaining === 0 && b.comp.remaining === 0, `CL${b.cl.remaining} CO${b.comp.remaining}`);

  // ---------- Weekly-off exclusion (§ working days) ----------
  await allocateCL(90005, 12);
  let r5 = await addLeave(90005, { fromDate: "2026-07-13", toDate: "2026-07-19" }); // Mon-Sun, Sun off -> 6 wd
  ok("Weekly-off: Mon-Sun charges 6 (not 7)", r5.status === 201 && r5.json?.data?.days === 6, `days=${r5.json?.data?.days}`);
  // Block: single Friday for a Friday-off employee with no existing leave there.
  let rBlock = await addLeave(90004, { fromDate: "2026-07-17", toDate: "2026-07-17" });
  ok("Weekly-off: all-off range blocked (400)", rBlock.status === 400, `status=${rBlock.status} msg=${rBlock.json?.message?.slice(0, 40)}`);

  // ---------- Overlap detection (§15) ----------
  await allocateCL(90006, 20);
  let oa = await addLeave(90006, { fromDate: "2026-07-06", toDate: "2026-07-08" }); // Mon-Wed
  let obl = await api("POST", "/leave/transactions", { empId: 90006, leaveTypeCode: "SPL", shiftType: "General", dayType: "FULL DAY", fromDate: "2026-07-07", toDate: "2026-07-09", reason: "overlap B" });
  ok("Overlap: 2nd overlapping leave blocked (409)", oa.status === 201 && obl.status === 409, `A=${oa.status} B=${obl.status}`);
  // Complementary half-days on the same single day (2026-07-20 = Mon) -> allowed
  let h1 = await addLeave(90006, { fromDate: "2026-07-20", toDate: "2026-07-20", dayType: "FIRST HALF" });
  let h2 = await addLeave(90006, { fromDate: "2026-07-20", toDate: "2026-07-20", dayType: "SECOND HALF" });
  ok("Overlap: complementary FIRST+SECOND half allowed", h1.status === 201 && h2.status === 201, `h1=${h1.status} h2=${h2.status}`);
  // Same half again on that day -> blocked
  let h3 = await addLeave(90006, { fromDate: "2026-07-20", toDate: "2026-07-20", dayType: "FIRST HALF" });
  ok("Overlap: duplicate FIRST half blocked (409)", h3.status === 409, `h3=${h3.status}`);
  // Editing a leave to its own (unchanged) dates must NOT self-conflict
  const own = (await listLeaves(90006)).find((l) => l.reason === "audit leave" && l.dayType === "FULL DAY");
  let ed = await api("PUT", `/leave/transactions/${own._id}`, { fromDate: "2026-07-06", toDate: "2026-07-08" });
  ok("Overlap: editing a leave to its own dates is allowed", ed.status === 200, `edit=${ed.status}`);

  // ---------- Others leave (§2/§3) ----------
  const before = await bal(90005);
  let rO = await api("POST", "/leave/transactions", { empId: 90005, leaveTypeCode: "OTHERS", customLeaveName: "  marriage   leave ", shiftType: "General", dayType: "FULL DAY", fromDate: "2026-08-03", toDate: "2026-08-03", days: 1.5, reason: "audit others" });
  const after = await bal(90005);
  ok("Others: stored, no balance impact", rO.status === 201 && before.cl.used === after.cl.used && before.comp.used === after.comp.used, `days=${rO.json?.data?.days} name=${rO.json?.data?.customLeaveName}`);
  ok("Others: name title-cased, days honored", rO.json?.data?.customLeaveName === "Marriage Leave" && rO.json?.data?.days === 1.5 && rO.json?.data?.clUsed === 0 && rO.json?.data?.compUsed === 0);
  ok("Others: not a global leave type", !(await api("GET", "/leave/types")).json.data.some((x) => x.code === "OTHERS"));

  // ---------- Comp-Off from ALL OT + delete updates balance (§5) ----------
  await allocateCL(90007, 12);
  await addOT(90007, "Double Shift"); await addOT(90007, "4 Hours (Half Day)"); // 2 + 0.5 = 2.5
  let b7 = await bal(90007);
  ok("Comp Off = sum of ALL OT (no approval)", b7.comp.allocated === 2.5, `earned=${b7.comp.allocated}`);
  const ots = (await api("GET", `/ot/get-ot-by-empid/90007`)).json?.data || [];
  const dbl = ots.find((o) => o.workingDuration === "Double Shift");
  await api("DELETE", `/ot/delete-ot/${dbl._id}`); // remove the Double Shift (2) -> earned 0.5
  b7 = await bal(90007);
  ok("Deleting OT lowers Comp Off immediately (2.5->0.5)", b7.comp.allocated === 0.5, `earned=${b7.comp.allocated}`);

  // ---------- Edit + Delete leave rebalances (§) ----------
  // 90002 currently CL used 2, comp used 2 (Case2). Edit its leave to 2 wd -> CL2 comp0.
  const l2 = (await listLeaves(90002))[0];
  await api("PUT", `/leave/transactions/${l2._id}`, { fromDate: "2026-07-13", toDate: "2026-07-14" }); // 2 wd
  let b2 = await bal(90002);
  ok("Edit leave rebalances (4->2 wd: CL2 Comp0)", b2.cl.used === 2 && b2.comp.used === 0, `cl.used${b2.cl.used} co.used${b2.comp.used}`);
  await api("DELETE", `/leave/transactions/${l2._id}`);
  b2 = await bal(90002);
  ok("Delete leave restores balance (CL used 0)", b2.cl.used === 0 && b2.comp.used === 0, `cl.used${b2.cl.used} co.used${b2.comp.used}`);

  // ---------- Single source of truth: /leave/manage == /leave/balances ----------
  const mng = (await api("GET", `/leave/manage?year=${YEAR}&empId=90001`)).json?.data?.[0];
  const b1 = await bal(90001);
  const mCL = mng?.byType?.find((x) => x.leaveTypeCode === "CL");
  const mCO = mng?.byType?.find((x) => x.leaveTypeCode === "COMP");
  ok("Manage view matches balances (CL)", mCL && mCL.allocated === b1.cl.allocated && mCL.used === b1.cl.used, `manage cl ${mCL?.allocated}/${mCL?.used} vs bal ${b1.cl.allocated}/${b1.cl.used}`);
  ok("Manage view matches balances (Comp)", mCO && mCO.allocated === b1.comp.allocated && mCO.used === b1.comp.used, `manage co ${mCO?.allocated}/${mCO?.used} vs bal ${b1.comp.allocated}/${b1.comp.used}`);

  // ---------- OD create with weekly-off + days stored ----------
  let rod = await api("POST", "/od/apply-od", { empId: 90008, empShiftType: "A Shift", additionalShift: "General", workingDuration: "8 Hours (Full Day)", empFromDate: "2026-07-13", empToDate: "2026-07-19", odLocation: "Gate 2", empPurpose: "audit od duty" });
  ok("OD stores weekly-off-excluded days (Sat+Sun off: 5)", rod.status === 201 && rod.json?.data?.days === 5, `days=${rod.json?.data?.days}`);
  let rodBlock = await api("POST", "/od/apply-od", { empId: 90008, empShiftType: "A", additionalShift: "General", workingDuration: "8 Hours (Full Day)", empFromDate: "2026-07-18", empToDate: "2026-07-19", odLocation: "Gate 2", empPurpose: "audit od weekoff" });
  ok("OD all-weekly-off range blocked (400)", rodBlock.status === 400, `status=${rodBlock.status}`);

  // ---------- Reports don't error and reflect data (range must be <= today) ----------
  const ms = await api("GET", `/month/monthwise-summary?startDate=2026-07-01&endDate=2026-07-16`);
  ok("Month-wise summary OK", ms.status === 200 && Array.isArray(ms.json?.data), `status=${ms.status}`);
  const mr = await api("GET", `/attendance/muster-roll?year=2026&month=7`);
  ok("Muster roll OK", mr.status === 200 && Array.isArray(mr.json?.data));
  // 90009 leave = CL 07-13..07-17 (Sun off); calendar days covered within 01..16 = 13,14,15,16 = 4.
  const e9 = ms.json?.data?.find((x) => x.empId === 90009);
  ok("Month-wise reflects leave (90009 = 4 days in range)", e9?.leaveDays === 4, `leaveDays=${e9?.leaveDays}`);
  // Muster roll marks the Others leave cell as OTH for 90005 on 2026-08-03? (Aug not this month) — check CL cell instead.
  const m9 = mr.json?.data?.find((x) => x.empId === 90009);
  ok("Muster roll marks leave days (90009 has CL cells)", m9 && Object.values(m9.days || {}).some((v) => String(v).includes("CL")), `sample=${JSON.stringify(Object.entries(m9?.days || {}).slice(12, 17))}`);

  console.log(results.join("\n"));
  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("DRIVER ERROR", e); process.exit(2); });
