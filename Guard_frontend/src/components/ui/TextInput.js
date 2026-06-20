import React from "react";
import PropTypes from "prop-types";

// Labeled text input with error/hint support.
const TextInput = ({
  label,
  value,
  onChange,
  name,
  type,
  placeholder,
  error,
  required,
  disabled,
  hint,
  className,
  ...rest
}) => {
  const id = name || `gh-input-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className={`gh-field${className ? ` ${className}` : ""}`}>
      {label && (
        <label className="gh-field__label" htmlFor={id}>
          {label}
          {required && <span className="gh-field__required"> *</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type={type}
        className={`form-control${error ? " is-invalid" : ""}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        {...rest}
      />
      {error ? (
        <div className="gh-field__error">{error}</div>
      ) : (
        hint && <div className="gh-field__hint">{hint}</div>
      )}
    </div>
  );
};

TextInput.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  name: PropTypes.string,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  hint: PropTypes.string,
  className: PropTypes.string,
};

TextInput.defaultProps = {
  type: "text",
  required: false,
  disabled: false,
};

export default TextInput;
