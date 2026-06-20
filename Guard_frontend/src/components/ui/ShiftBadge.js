import React from "react";
import PropTypes from "prop-types";

const toTitleCase = (str) =>
  String(str || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

// Neutral/info pill for shift labels; week off uses the muted secondary style.
const ShiftBadge = ({ shift, className, ...rest }) => {
  const s = String(shift || "").trim().toLowerCase();
  const isWeekOff = s === "week off" || s === "weekoff";
  const color = isWeekOff ? "secondary" : "info";

  return (
    <span
      className={`gh-badge gh-badge--${color}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {toTitleCase(shift)}
    </span>
  );
};

ShiftBadge.propTypes = {
  shift: PropTypes.string,
  className: PropTypes.string,
};

export default ShiftBadge;
