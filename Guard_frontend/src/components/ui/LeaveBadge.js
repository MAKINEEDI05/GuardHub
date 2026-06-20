import React from "react";
import PropTypes from "prop-types";

const toTitleCase = (str) =>
  String(str || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

// Stable color per common leave type, default info.
const mapLeaveType = (type) => {
  const t = String(type || "").trim().toLowerCase();
  switch (t) {
    case "sick leave":
    case "sick":
    case "sl":
      return "danger";
    case "casual leave":
    case "casual":
    case "cl":
      return "warning";
    case "earned leave":
    case "privilege leave":
    case "pl":
    case "el":
      return "success";
    case "od":
    case "on duty":
      return "primary";
    case "comp off":
    case "compensatory":
      return "secondary";
    default:
      return "info";
  }
};

// Pill for leave types.
const LeaveBadge = ({ type, className, ...rest }) => {
  const color = mapLeaveType(type);
  return (
    <span
      className={`gh-badge gh-badge--${color}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {toTitleCase(type)}
    </span>
  );
};

LeaveBadge.propTypes = {
  type: PropTypes.string,
  className: PropTypes.string,
};

export default LeaveBadge;
