import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="center-screen">
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem" }}>404</h1>
        <p className="muted mb-4">This page could not be found.</p>
        <Link to="/dashboard" className="btn btn--primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
