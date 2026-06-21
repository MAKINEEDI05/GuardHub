// Form field primitives. Field wraps a labelled control with optional error.
export function Field({ label, required, error, children, hint }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label">
          {label} {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <div className="text-sm muted mt-2">{hint}</div>}
      {error && <div className="field__error">{error}</div>}
    </div>
  );
}

export function Input({ className = "", ...rest }) {
  return <input className={`input ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }) {
  return <textarea className={`textarea ${className}`} {...rest} />;
}

export function Select({ options = [], placeholder, className = "", children, ...rest }) {
  return (
    <select className={`select ${className}`} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => {
        const value = typeof opt === "object" ? opt.value : opt;
        const label = typeof opt === "object" ? opt.label : opt;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
      {children}
    </select>
  );
}
