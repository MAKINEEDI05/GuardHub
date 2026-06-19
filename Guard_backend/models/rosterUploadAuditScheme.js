const mongoose = require("mongoose");

// Lightweight audit trail for bulk roster uploads (additive — does not touch
// the roster schema). One document per bulk upload.
const rosterUploadAuditSchema = new mongoose.Schema(
  {
    uploadedBy: { type: String, default: "admin" },
    uploadedAt: { type: Date, default: Date.now },
    totalRows: { type: Number, default: 0 },
    recordsAdded: { type: Number, default: 0 },
    recordsUpdated: { type: Number, default: 0 },
    invalidCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.model(
  "rosterUploadAudit",
  rosterUploadAuditSchema,
  "roster_upload_audits"
);
