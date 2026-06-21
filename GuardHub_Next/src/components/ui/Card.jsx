export default function Card({ title, actions, children, bodyClass = "", className = "" }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="card__header">
          {title && <h3 className="card__title">{title}</h3>}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`card__body ${bodyClass}`}>{children}</div>
    </div>
  );
}
