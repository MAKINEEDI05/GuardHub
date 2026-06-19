import React from "react";
import PropTypes from "prop-types";

// Labeled textarea with error/maxLength support.
const Textarea = ({
  label,
  value,
  onChange,
  name,
  rows,
  placeholder,
  error,
  required,
  maxLength,
  disabled,
  className,
  ...rest
}) => {
  const id = name || `gh-textarea-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className={`gh-field${className ? ` ${className}` : ""}`}>
      {label && (
        <label className="gh-field__label" htmlFor={id}>
          {label}
          {required && <span className="gh-field__required"> *</span>}
        </label>
      )}
      <textarea
        id={id}
        name={name}
        className={`form-control${error ? " is-invalid" : ""}`}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        {...rest}
      />
      {maxLength && (
        <div className="gh-field__hint gh-field__count">
          {(value ? String(value).length : 0)}/{maxLength}
        </div>
      )}
      {error && <div className="gh-field__error">{error}</div>}
    </div>
  );
};

Textarea.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  name: PropTypes.string,
  rows: PropTypes.number,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  maxLength: PropTypes.number,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

Textarea.defaultProps = {
  rows: 3,
  required: false,
  disabled: false,
};

export default Textarea;
