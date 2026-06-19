import React from "react";
import { PageContainer, PageHeader, SectionCard } from "components/ui";

const PLANNED = [
  "OT Request Submission",
  "OT Approval Workflow",
  "Extra Hours Tracking",
  "Monthly OT Reports",
  "OT Analytics Dashboard",
];

// Placeholder page for the upcoming Overtime module.
const ApplyOT = () => (
  <div className="page-content">
    <PageContainer>
      <PageHeader
        title="Overtime Management"
        subtitle="Apply and track overtime"
        breadcrumb={[
          { label: "Security", link: "#" },
          { label: "Overtime", link: "#" },
          { label: "Apply OT" },
        ]}
      />
      <SectionCard>
        <div className="text-center py-5">
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>🚧</div>
          <h4 className="mt-3 mb-2">Feature Under Development</h4>
          <p className="text-muted mb-4">
            Overtime (OT) Management will be available in an upcoming release.
          </p>

          <div
            className="mx-auto text-start"
            style={{ maxWidth: 360 }}
            aria-label="Planned overtime features"
          >
            <h6
              className="text-uppercase"
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.06em",
                color: "var(--gh-text-subtle, #94a3b8)",
              }}
            >
              Planned Features
            </h6>
            <ul className="list-unstyled mb-0">
              {PLANNED.map((f) => (
                <li
                  key={f}
                  className="d-flex align-items-center py-2"
                  style={{ borderBottom: "1px solid var(--gh-border, #e2e8f0)" }}
                >
                  <i className="mdi mdi-check-circle-outline me-2 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-muted mt-4 mb-0 fst-italic">Coming Soon…</p>
        </div>
      </SectionCard>
    </PageContainer>
  </div>
);

export default ApplyOT;
