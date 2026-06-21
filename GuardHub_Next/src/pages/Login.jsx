import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import Button from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";

// Login. Posts { email/userName, password } to /login; the returned user object
// IS the session (no JWT). On success store the user and go to the dashboard.
export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, setUser } = useAuthStore();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username.trim() || !form.password) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const user = await authService.login(form.username.trim(), form.password);
      if (user) {
        setUser(user);
        toast.success("Welcome back!");
        navigate("/dashboard", { replace: true });
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } catch (err) {
      setError(err.friendlyMessage || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center-screen" style={{ background: "var(--brand-navy)", padding: 16 }}>
      <div
        className="card"
        style={{ width: "min(400px, 100%)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="card__body" style={{ padding: 32 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <img src="/shield.svg" alt="GuardHub" width="56" height="56" />
            <h1 style={{ fontSize: "1.5rem", marginTop: 12 }}>GuardHub</h1>
            <p className="muted text-sm" style={{ marginTop: 4 }}>
              Security Workforce Management
            </p>
          </div>

          <form onSubmit={onSubmit}>
            <Field label="Username">
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Enter username"
                autoFocus
                autoComplete="username"
              />
            </Field>
            <Field label="Password" error={error}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" block loading={loading}>
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
