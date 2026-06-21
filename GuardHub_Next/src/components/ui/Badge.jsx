import { shiftStatusClass } from "../../utils/constants";

// Generic badge. Pass `status` for a semantic color, or `tone` class directly.
export default function Badge({ children, status, tone }) {
  const cls = tone || (status ? shiftStatusClass(status) : "status--neutral");
  return <span className={`badge ${cls}`}>{children ?? status}</span>;
}
