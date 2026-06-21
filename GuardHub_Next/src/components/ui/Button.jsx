// Button with variants: primary | secondary | outline | ghost | danger.
// `loading` shows a spinner and disables the button.
export default function Button({
  variant = "primary",
  size,
  block,
  loading,
  disabled,
  children,
  className = "",
  ...rest
}) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size === "sm" ? "btn--sm" : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}
