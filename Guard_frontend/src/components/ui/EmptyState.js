import React from "react";
import PropTypes from "prop-types";

// Centered empty state with icon, title, message and optional action.
const EmptyState = ({ title, message, icon, action, className, ...rest }) => {
  return (
    <div className={`gh-empty${className ? ` ${className}` : ""}`} {...rest}>
      <i className={`mdi ${icon} gh-empty__icon`} aria-hidden="true" />
      <div className="gh-empty__title">{title}</div>
      {message && <div className="gh-empty__message">{message}</div>}
      {action && <div className="gh-empty__action">{action}</div>}
    </div>
  );
};

EmptyState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.node,
  icon: PropTypes.string,
  action: PropTypes.node,
  className: PropTypes.string,
};

EmptyState.defaultProps = {
  title: "No data",
  icon: "mdi-inbox-outline",
};

export default EmptyState;
