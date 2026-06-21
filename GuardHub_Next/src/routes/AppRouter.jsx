import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "./ProtectedRoute";

// Every page is route-split (lazy) so the initial bundle stays small and each
// screen loads on demand.
const Login = lazy(() => import("../pages/Login"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Employees = lazy(() => import("../pages/Employees"));
const Roster = lazy(() => import("../pages/Roster"));
const DayWiseReport = lazy(() => import("../pages/DayWiseReport"));
const MonthWiseReport = lazy(() => import("../pages/MonthWiseReport"));
const ViewLeaves = lazy(() => import("../pages/ViewLeaves"));
const ViewOd = lazy(() => import("../pages/ViewOd"));
const ViewOt = lazy(() => import("../pages/ViewOt"));
const ApplyLeave = lazy(() => import("../pages/ApplyLeave"));
const ApplyOd = lazy(() => import("../pages/ApplyOd"));
const ApplyOt = lazy(() => import("../pages/ApplyOt"));
const NotFound = lazy(() => import("../pages/NotFound"));

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/roster" element={<Roster />} />
        <Route path="/reports/day" element={<DayWiseReport />} />
        <Route path="/reports/month" element={<MonthWiseReport />} />
        <Route path="/leaves" element={<ViewLeaves />} />
        <Route path="/od" element={<ViewOd />} />
        <Route path="/ot" element={<ViewOt />} />
        <Route path="/apply/leave" element={<ApplyLeave />} />
        <Route path="/apply/od" element={<ApplyOd />} />
        <Route path="/apply/ot" element={<ApplyOt />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
