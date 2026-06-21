import { useEffect, useMemo, useRef, useState } from "react";

// Searchable single-select bound to a CURATED master list. Options never come
// from raw DB data. A built-in search filters long lists. An "Other" entry lets
// the admin type a custom value (saved as-is, but NOT added to the master list).
//
// Controlled: the parent stores only the string `value`. If `value` is non-empty
// and not in `options` (e.g. a legacy/off-list value on an existing record), the
// control opens in "Other" mode showing that value, so it still displays and can
// be changed to a valid master-list value.
export default function MasterSelect({
  id,
  value = "",
  onChange,
  options = [],
  placeholder = "Select...",
  allowOther = true,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [otherMode, setOtherMode] = useState(value !== "" && !options.includes(value));
  const boxRef = useRef(null);

  // Re-derive mode when the value changes from outside (edit load / reset).
  useEffect(() => {
    setOtherMode(value !== "" && !options.includes(value));
  }, [value, options]);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [search, options]);

  const pick = (opt) => {
    setOtherMode(false);
    onChange(opt);
    setOpen(false);
    setSearch("");
  };
  const pickOther = () => {
    setOtherMode(true);
    onChange("");
    setOpen(false);
    setSearch("");
  };

  const triggerText = otherMode ? "Other (custom value)" : value || placeholder;
  const isPlaceholder = !value && !otherMode;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button
        type="button"
        id={id}
        className="input select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={isPlaceholder ? "muted" : ""}>{triggerText}</span>
        <span className="select-trigger__caret">▾</span>
      </button>

      {open && (
        <div className="card select-panel">
          <div className="select-panel__search">
            <input
              className="input"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
            />
          </div>
          <div className="select-panel__list">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`select-option ${opt === value ? "is-active" : ""}`}
                onClick={() => pick(opt)}
              >
                {opt}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="select-option muted">No matches</div>
            )}
            {allowOther && (
              <button
                type="button"
                className={`select-option select-option--other ${otherMode ? "is-active" : ""}`}
                onClick={pickOther}
              >
                Other (type a custom value)
              </button>
            )}
          </div>
        </div>
      )}

      {otherMode && (
        <input
          className="input mt-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom value"
        />
      )}
    </div>
  );
}
