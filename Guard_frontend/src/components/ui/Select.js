import React from "react";
import PropTypes from "prop-types";

// Native select supporting {value,label} objects or plain strings.
const Select = ({
  label,
  value,
  onChange,
  name,
  options,
  placeholder,
  error,
  required,
  disabled,
  className,
  ...rest
}) => {
  const id = name || `gh-select-${Math.random().toString(36).slice(2, 9)}`;

  const normalized = (options || []).map((opt) =>
    typeof opt === "object" && opt !== null
      ? { value: opt.value, label: opt.label }
      : { value: opt, label: String(opt) }
  );

  return (
    <div className={`gh-field${className ? ` ${className}` : ""}`}>
      {label && (
        <label className="gh-field__label" htmlFor={id}>
          {label}
          {required && <span className="gh-field__required"> *</span>}
        </label>
      )}
      <select
        id={id}
        name={name}
        className={`form-select${error ? " is-invalid" : ""}`}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {normalized.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <div className="gh-field__error">{error}</div>}
    </div>
  );
};

Select.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  name: PropTypes.string,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

Select.defaultProps = {
  options: [],
  required: false,
  disabled: false,
};

export default Select;
