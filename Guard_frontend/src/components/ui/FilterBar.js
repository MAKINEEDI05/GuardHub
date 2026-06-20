import React from "react";
import PropTypes from "prop-types";

// Horizontal, wrapping responsive toolbar for filters/search. Stacks on mobile.
const FilterBar = ({ children, actions, className, ...rest }) => {
  return (
    <div className={`gh-filter-bar${className ? ` ${className}` : ""}`} {...rest}>
      <div className="gh-filter-bar__filters">{children}</div>
      {actions && <div className="gh-filter-bar__actions">{actions}</div>}
    </div>
  );
};

FilterBar.propTypes = {
  children: PropTypes.node,
  actions: PropTypes.node,
  className: PropTypes.string,
};

export default FilterBar;
