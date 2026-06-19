import React from "react";
import PropTypes from "prop-types";

// Presentational button using design-system tokens. No business logic.
const Button = ({
  variant,
  size,
  block,
  loading,
  icon,
  type,
  onClick,
  disabled,
  className,
  children,
  ...rest
}) => {
  const classes = [
    "gh-btn",
    `gh-btn--${variant}`,
    size ? `gh-btn--${size}` : "",
    block ? "gh-btn--block" : "",
    loading ? "gh-btn--loading" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="gh-btn__spinner" aria-hidden="true" />}
      {!loading && icon && <i className={`mdi ${icon} gh-btn__icon`} />}
      {children}
    </button>
  );
};

Button.propTypes = {
  variant: PropTypes.oneOf(["primary", "secondary", "outline", "danger"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  block: PropTypes.bool,
  loading: PropTypes.bool,
  icon: PropTypes.string,
  type: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

Button.defaultProps = {
  variant: "primary",
  size: "md",
  block: false,
  loading: false,
  type: "button",
  disabled: false,
};

export default Button;
