const LeaveType = require("../models/leaveTypeScheme");
const { syncLeaveTypeQuota } = require("./leaveBalanceController");

// Default categories seeded once on first use so a fresh install has something
// to work with. Mirrors the MOM examples. Admins can add/edit/deactivate more
// from the UI without any code change.
const DEFAULT_TYPES = [
  { code: "CL", name: "Casual Leave", defaultAnnualQuota: 12, isPaid: true, sortOrder: 1 },
  { code: "SPL", name: "Special Leave", defaultAnnualQuota: 6, isPaid: true, sortOrder: 2 },
  { code: "SUM", name: "Summer Leave", defaultAnnualQuota: 4, isPaid: true, sortOrder: 3 },
  { code: "HOL", name: "Holiday Leave", defaultAnnualQuota: 2, isPaid: true, sortOrder: 4 },
];

async function seedDefaultsIfEmpty() {
  const count = await LeaveType.estimatedDocumentCount();
  if (count === 0) {
    await LeaveType.insertMany(DEFAULT_TYPES, { ordered: false }).catch(() => {});
  }
}

// GET /leave/types?activeOnly=true — full master (seeded on first call).
const listTypes = async (req, res) => {
  try {
    await seedDefaultsIfEmpty();
    const filter = req.query.activeOnly === "true" ? { active: true } : {};
    const types = await LeaveType.find(filter).sort({ sortOrder: 1, name: 1 });
    return res.status(200).json({ message: "Leave types", data: types });
  } catch (error) {
    console.error("Error listing leave types:", error);
    return res.status(500).json({ message: "Failed to list leave types" });
  }
};

// POST /leave/types
const createType = async (req, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) {
      return res.status(400).json({ message: "code and name are required" });
    }
    const doc = await LeaveType.create({
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      defaultAnnualQuota: Number(req.body.defaultAnnualQuota) || 0,
      isPaid: req.body.isPaid !== false,
      description: req.body.description || "",
      sortOrder: Number(req.body.sortOrder) || 0,
      active: req.body.active !== false,
    });
    // Propagate the initial quota to every employee balance for this type.
    const synced = await syncLeaveTypeQuota(doc.code, doc.defaultAnnualQuota);
    return res.status(201).json({ message: "Leave type created", data: doc, balancesSynced: synced });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A leave type with this code already exists" });
    }
    console.error("Error creating leave type:", error);
    return res.status(500).json({ message: "Failed to create leave type" });
  }
};

// PUT /leave/types/:id — code is immutable (it is the FK); everything else edits.
const updateType = async (req, res) => {
  try {
    const update = {};
    ["name", "description"].forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });
    if (req.body.defaultAnnualQuota !== undefined)
      update.defaultAnnualQuota = Number(req.body.defaultAnnualQuota) || 0;
    if (req.body.sortOrder !== undefined)
      update.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.isPaid !== undefined) update.isPaid = !!req.body.isPaid;
    if (req.body.active !== undefined) update.active = !!req.body.active;

    const doc = await LeaveType.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: "Leave type not found" });

    // When the default quota changes, synchronize every employee balance's
    // `allocated` for this type (used/history/transactions untouched). This is
    // the fix for the reported bug and covers all update entry points (UI + API
    // both hit this controller).
    let balancesSynced;
    if (update.defaultAnnualQuota !== undefined) {
      balancesSynced = await syncLeaveTypeQuota(doc.code, doc.defaultAnnualQuota);
    }
    return res.status(200).json({ message: "Leave type updated", data: doc, balancesSynced });
  } catch (error) {
    console.error("Error updating leave type:", error);
    return res.status(500).json({ message: "Failed to update leave type" });
  }
};

// DELETE /leave/types/:id — soft delete (deactivate) so historical
// transactions/balances that reference the code stay intact.
const deleteType = async (req, res) => {
  try {
    const doc = await LeaveType.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Leave type not found" });
    return res.status(200).json({ message: "Leave type deactivated", data: doc });
  } catch (error) {
    console.error("Error deleting leave type:", error);
    return res.status(500).json({ message: "Failed to delete leave type" });
  }
};

module.exports = { listTypes, createType, updateType, deleteType, seedDefaultsIfEmpty };
