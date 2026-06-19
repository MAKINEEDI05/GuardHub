import React from "react";
import PropTypes from "prop-types";

// KPI metric card with a colored icon chip and optional trend text.
const KpiCard = ({ label, value, icon, trend, color, loading, className, ...rest }) => {
  return (
    <div className={`gh-kpi-card${className ? ` ${className}` : ""}`} {...rest}>
      {icon && (
        <div className={`gh-kpi-card__chip gh-kpi-card__chip--${color}`}>
          <i className={`mdi ${icon}`} aria-hidden="true" />
        </div>
      )}
      <div className="gh-kpi-card__body">
        {loading ? (
          <div className="gh-skeleton gh-kpi-card__skeleton" />
        ) : (
          <div className="gh-kpi-card__value">{value}</div>
        )}
        <div className="gh-kpi-card__label">{label}</div>
        {!loading && trend && <div className="gh-kpi-card__trend">{trend}</div>}
      </div>
    </div>
  );
};

KpiCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  icon: PropTypes.string,
  trend: PropTypes.string,
  color: PropTypes.string,
  loading: PropTypes.bool,
  className: PropTypes.string,
};

KpiCard.defaultProps = {
  color: "primary",
  loading: false,
};

export default KpiCard;
