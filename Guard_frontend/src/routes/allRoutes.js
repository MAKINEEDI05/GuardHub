import React from "react";
import { Navigate } from "react-router-dom";

// All route pages are code-split with React.lazy so only the page the user
// actually visits is downloaded (App.js wraps <Routes> in <Suspense>).
// Unused admin-template demo pages (charts, maps, kanban, email, tables, forms,
// ui-kit, inner-auth, etc.) were removed so their heavy libraries are no longer
// bundled.

// Authentication
const Login = React.lazy(() => import("../pages/Authentication/Login"));
const Logout = React.lazy(() => import("../pages/Authentication/Logout"));
const Register = React.lazy(() => import("../pages/Authentication/Register"));
const ForgetPwd = React.lazy(() =>
  import("../pages/Authentication/ForgetPassword")
);
const UserProfile = React.lazy(() =>
  import("../pages/Authentication/user-profile")
);
const Pages404 = React.lazy(() => import("../pages/Extra Pages/pages-404"));

// Dashboard
const Dashboard = React.lazy(() => import("../pages/Dashboard/index"));

// GuardHub (Security) modules
const Profile = React.lazy(() =>
  import("../pages/Security Pages/ProfilePage/profile")
);
const EmployeeForm = React.lazy(() =>
  import("../pages/Security Pages/ProfilePage/EmployeeForm")
);
const DayWiseReport = React.lazy(() =>
  import("../pages/Security Pages/DayWiseReportPage/daywisereport")
);
const MonthWiseReport = React.lazy(() =>
  import("../pages/Security Pages/MonthWiseReportPage/monthwisereport")
);
const MonthWiseChart = React.lazy(() =>
  import("../pages/Security Pages/Monthwisechart/monthwisechart")
);
const LeaveManagement = React.lazy(() =>
  import("../pages/Security Pages/LeaveOdManagement/LeaveManagement")
);
const ApplyLeavePage = React.lazy(() =>
  import("../pages/Security Pages/AppliedOD/ApplyLeavePage")
);
const ApplyODPage = React.lazy(() =>
  import("../pages/Security Pages/AppliedOD/ApplyODPage")
);
const ApplyOT = React.lazy(() =>
  import("../pages/Security Pages/AppliedOD/ApplyOT")
);
const SecurityRoaster = React.lazy(() =>
  import("../pages/Security Pages/SecurityRoaster/Securityroaster")
);

const userRoutes = [
  { path: "/dashboard", component: <Dashboard /> },

  // Profile (template account page kept for the header dropdown)
  { path: "/profile", component: <UserProfile /> },

  // GuardHub Security modules
  { path: "/profilepage", component: <Profile /> },
  { path: "/employee-form/:empId?", component: <EmployeeForm /> },
  { path: "/day-wise-report", component: <DayWiseReport /> },
  { path: "/month-wise-report", component: <MonthWiseReport /> },
  { path: "/month-wise-chart", component: <MonthWiseChart /> },
  { path: "/LeaveOdManagement", component: <LeaveManagement /> },
  { path: "/apply-leave", component: <ApplyLeavePage /> },
  { path: "/apply-od", component: <ApplyODPage /> },
  { path: "/apply-ot", component: <ApplyOT /> },
  { path: "/security-roaster", component: <SecurityRoaster /> },

  // default: redirect to dashboard
  {
    path: "/",
    exact: true,
    component: <Navigate to="/dashboard" />,
  },
];

const authRoutes = [
  { path: "/logout", component: <Logout /> },
  { path: "/login", component: <Login /> },
  { path: "/forgot-password", component: <ForgetPwd /> },
  { path: "/register", component: <Register /> },
  { path: "/pages-404", component: <Pages404 /> },
];

export { userRoutes, authRoutes };
