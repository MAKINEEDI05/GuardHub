import React from "react";
import { PageContainer, PageHeader } from "components/ui";
import ApplyOTForm from "./ApplyOTForm";

// Apply OT page — opens the overtime application form directly.
const ApplyOT = () => (
  <div className="page-content">
    <PageContainer>
      <PageHeader
        title="Overtime Management"
        subtitle="Apply and track overtime / double shifts"
        breadcrumb={[
          { label: "Security", link: "#" },
          { label: "Overtime", link: "#" },
          { label: "Apply OT" },
        ]}
      />
      <ApplyOTForm />
    </PageContainer>
  </div>
);

export default ApplyOT;
