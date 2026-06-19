import React from "react";
import PropTypes from "prop-types";

// Top-of-page header with optional breadcrumb and actions.
const PageHeader = ({ title, subtitle, breadcrumb, actions, className, ...rest }) => {
  return (
    <div className={`gh-page-header${className ? ` ${className}` : ""}`} {...rest}>
      <div className="gh-page-header__main">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="gh-page-header__breadcrumb" aria-label="breadcrumb">
            {breadcrumb.map((crumb, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span key={`${crumb.label}-${i}`} className="gh-breadcrumb__item">
                  {crumb.link && !isLast ? (
                    <a href={crumb.link} className="gh-breadcrumb__link">
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="gh-breadcrumb__current">{crumb.label}</span>
                  )}
                  {!isLast && (
                    <i
                      className="mdi mdi-chevron-right gh-breadcrumb__sep"
                      aria-hidden="true"
                    />
                  )}
                </span>
              );
            })}
          </nav>
        )}
        <h1 className="gh-page-header__title">{title}</h1>
        {subtitle && <div className="gh-page-header__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="gh-page-header__actions">{actions}</div>}
    </div>
  );
};

PageHeader.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  breadcrumb: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.node,
      link: PropTypes.string,
    })
  ),
  actions: PropTypes.node,
  className: PropTypes.string,
};

export default PageHeader;
