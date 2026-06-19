import React from "react";
import PropTypes from "prop-types";

// Card with a header (title/subtitle left, actions right) and a body.
const SectionCard = ({
  title,
  subtitle,
  actions,
  children,
  noPadding,
  className,
  ...rest
}) => {
  const hasHeader = title || subtitle || actions;

  return (
    <div className={`gh-section-card${className ? ` ${className}` : ""}`} {...rest}>
      {hasHeader && (
        <div className="gh-section-card__header">
          <div className="gh-section-card__heading">
            {title && <h3 className="gh-section-card__title">{title}</h3>}
            {subtitle && (
              <div className="gh-section-card__subtitle">{subtitle}</div>
            )}
          </div>
          {actions && <div className="gh-section-card__actions">{actions}</div>}
        </div>
      )}
      <div
        className={`gh-section-card__body${
          noPadding ? " gh-section-card__body--flush" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
};

SectionCard.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
  noPadding: PropTypes.bool,
  className: PropTypes.string,
};

SectionCard.defaultProps = {
  noPadding: false,
};

export default SectionCard;
