import React from "react";
import PropTypes from "prop-types";
import { Spinner } from "reactstrap";

// Loading indicator: skeleton bars if `rows` is given, else a centered spinner.
const LoadingState = ({ label, rows, className, ...rest }) => {
  if (rows && rows > 0) {
    return (
      <div
        className={`gh-loading gh-loading--skeleton${className ? ` ${className}` : ""}`}
        aria-busy="true"
        aria-label={label}
        {...rest}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="gh-skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`gh-loading gh-loading--spinner${className ? ` ${className}` : ""}`}
      aria-busy="true"
      {...rest}
    >
      <Spinner className="gh-loading__spinner" style={{ color: "var(--gh-primary)" }} />
      {label && <div className="gh-loading__label">{label}</div>}
    </div>
  );
};

LoadingState.propTypes = {
  label: PropTypes.string,
  rows: PropTypes.number,
  className: PropTypes.string,
};

LoadingState.defaultProps = {
  label: "Loading…",
};

export default LoadingState;
