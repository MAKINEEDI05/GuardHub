export default function SearchBar({ value, onChange, placeholder = "Search...", className = "" }) {
  return (
    <div className={`searchbar ${className}`}>
      <span className="searchbar__icon" aria-hidden>
        {/* magnifier */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      </span>
      <input
        className="input"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
