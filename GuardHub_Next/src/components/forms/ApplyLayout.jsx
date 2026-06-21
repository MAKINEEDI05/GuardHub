// Two-column workflow shell for the Apply pages. Left: a sticky employee panel
// (selection + verification). Right: the request sections + submit. Centered
// with a sensible max width so wide screens are used without stretching fields.
// Collapses to a single column on tablet/mobile.
export default function ApplyLayout({ aside, children, onSubmit }) {
  return (
    <form className="apply-layout" onSubmit={onSubmit}>
      <aside className="apply-layout__aside">{aside}</aside>
      <div className="apply-layout__main">{children}</div>
    </form>
  );
}
