// A titled form section (card) with an optional description. Gives every Apply
// page a consistent "Employee Information / Request Details / ..." hierarchy.
export default function FormSection({ title, description, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="card__header" style={{ display: "block" }}>
        <h3 className="card__title">{title}</h3>
        {description && <div className="page-header__subtitle">{description}</div>}
      </div>
      <div className="card__body">{children}</div>
    </section>
  );
}
