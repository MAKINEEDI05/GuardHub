// Overlap detection shared by Leave and OD so an employee can't hold two records
// that cover the same day (which would double-count attendance / double-deduct a
// balance). The ONE intentional exception: two complementary half-days on the
// same single day (FIRST HALF + SECOND HALF = one full day) is allowed.

const dayMs = (d) => {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};

// Inclusive [aFrom,aTo] vs [bFrom,bTo] overlap on the calendar.
function rangesOverlap(aFrom, aTo, bFrom, bTo) {
  return dayMs(aFrom) <= dayMs(bTo) && dayMs(bFrom) <= dayMs(aTo);
}

const isHalf = (dayType) => /HALF/i.test(String(dayType || ""));
const halfSide = (dayType) => (/FIRST/i.test(String(dayType || "")) ? "FIRST" : "SECOND");

// True when the new record and an existing clash are the ALLOWED complementary
// half-day pair: same single day, both halves, opposite sides.
function isComplementaryHalfDay(newFrom, newTo, newDayType, exFrom, exTo, exDayType) {
  const newSingle = dayMs(newFrom) === dayMs(newTo);
  const exSingle = dayMs(exFrom) === dayMs(exTo);
  const sameDay = newSingle && exSingle && dayMs(newFrom) === dayMs(exFrom);
  return (
    sameDay &&
    isHalf(newDayType) &&
    isHalf(exDayType) &&
    halfSide(newDayType) !== halfSide(exDayType)
  );
}

// Given the candidate range/dayType and a list of existing records (each with
// {from, to, dayType}), return the first real conflict (or null). Complementary
// half-days are skipped.
function findConflict(newFrom, newTo, newDayType, existing) {
  for (const e of existing) {
    if (!rangesOverlap(newFrom, newTo, e.from, e.to)) continue;
    if (isComplementaryHalfDay(newFrom, newTo, newDayType, e.from, e.to, e.dayType)) continue;
    return e;
  }
  return null;
}

module.exports = { rangesOverlap, isComplementaryHalfDay, findConflict };
