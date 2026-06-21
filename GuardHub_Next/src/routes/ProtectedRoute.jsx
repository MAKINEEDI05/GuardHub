import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

// Gate authenticated routes on the presence of a stored user (the backend
// issues no JWT, so presence == session).
export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
