import React from "react";
import PropTypes from "prop-types";

// Search input with leading magnify icon and a clear button.
const SearchInput = ({
  value,
  onChange,
  placeholder,
  onClear,
  className,
  ...rest
}) => {
  const handleClear = () => {
    if (onClear) onClear();
  };

  return (
    <div className={`gh-search${className ? ` ${className}` : ""}`}>
      <i className="mdi mdi-magnify gh-search__icon" aria-hidden="true" />
      <input
        type="text"
        className="form-control gh-search__input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
      />
      {value && (
        <button
          type="button"
          className="gh-search__clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <i className="mdi mdi-close" />
        </button>
      )}
    </div>
  );
};

SearchInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  onClear: PropTypes.func,
  className: PropTypes.string,
};

SearchInput.defaultProps = {
  value: "",
  placeholder: "Search…",
};

export default SearchInput;
