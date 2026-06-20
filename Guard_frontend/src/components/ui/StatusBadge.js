import React from "react";
import PropTypes from "prop-types";

const toTitleCase = (str) =>
  String(str || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

const mapStatus = (status) => {
  const s = String(status || "").trim().toLowerCase();
  switch (s) {
    case "present":
    case "active":
    case "approved":
    case "healthy":
      return "success";
    case "absent":
    case "rejected":
    case "inactive":
    case "offline":
    case "down":
      return "danger";
    case "leave":
    case "on leave":
    case "pending":
    case "warning":
    case "degraded":
      return "warning";
    case "od":
      return "info";
    case "week off":
    case "weekoff":
      return "secondary";
    default:
      return "secondary";
  }
};

// Status pill with a colored dot, color mapped case-insensitively.
const StatusBadge = ({ status, className, ...rest }) => {
  const color = mapStatus(status);
  return (
    <span
      className={`gh-badge gh-badge--${color}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      <span className="gh-badge__dot" aria-hidden="true" />
      {toTitleCase(status)}
    </span>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string,
  className: PropTypes.string,
};

export default StatusBadge;
