import React from "react";
import { PageContainer, PageHeader } from "components/ui";
import ApplyLeaveForm from "./ApplyLeaveForm";

// Direct route page: opens the Apply Leave form immediately (no intermediate
// "Apply Leave/OD" landing step). Existing form + APIs are untouched.
const ApplyLeavePage = () => (
  <div className="page-content">
    <PageContainer>
      <PageHeader
        title="Apply Leave"
        subtitle="Submit a leave request for a security employee"
        breadcrumb={[
          { label: "Security", link: "#" },
          { label: "Leave", link: "#" },
          { label: "Apply Leave" },
        ]}
      />
      <ApplyLeaveForm />
    </PageContainer>
  </div>
);

export default ApplyLeavePage;
