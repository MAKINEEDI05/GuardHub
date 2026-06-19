import React from "react";
import PropTypes from "prop-types";

// Card listing label/value rows with an optional footer node.
const SummaryCard = ({ title, items, footer, className, ...rest }) => {
  return (
    <div className={`gh-summary-card${className ? ` ${className}` : ""}`} {...rest}>
      {title && <div className="gh-summary-card__title">{title}</div>}
      <div className="gh-summary-card__list">
        {(items || []).map((item, i) => (
          <div className="gh-summary-card__row" key={`${item.label}-${i}`}>
            <span className="gh-summary-card__label">{item.label}</span>
            <span className="gh-summary-card__value">{item.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="gh-summary-card__footer">{footer}</div>}
    </div>
  );
};

SummaryCard.propTypes = {
  title: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.node,
      value: PropTypes.node,
    })
  ),
  footer: PropTypes.node,
  className: PropTypes.string,
};

SummaryCard.defaultProps = {
  items: [],
};

export default SummaryCard;
