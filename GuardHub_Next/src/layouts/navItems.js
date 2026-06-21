// Sidebar navigation model. Icons are inline SVG path data (no icon font) to
// keep the bundle tiny. Grouped into sections.
export const NAV_SECTIONS = [
  {
    title: "Main",
    items: [{ to: "/dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "Workforce",
    items: [
      { to: "/employees", label: "Employee Management", icon: "users" },
      { to: "/roster", label: "Security Roster", icon: "shield" },
    ],
  },
  {
    title: "Reports",
    items: [
      { to: "/reports/day", label: "Day Wise Report", icon: "calendar-day" },
      { to: "/reports/month", label: "Month Wise Report", icon: "calendar-month" },
    ],
  },
  {
    title: "Records",
    items: [
      { to: "/leaves", label: "View Leaves", icon: "leave" },
      { to: "/od", label: "View OD", icon: "od" },
      { to: "/ot", label: "View OT", icon: "ot" },
    ],
  },
  {
    title: "Requests",
    items: [
      { to: "/apply/leave", label: "Apply Leave", icon: "plus" },
      { to: "/apply/od", label: "Apply OD", icon: "plus" },
      { to: "/apply/ot", label: "Apply OT", icon: "plus" },
    ],
  },
];
