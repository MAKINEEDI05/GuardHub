import React from "react";
import { PageContainer, PageHeader } from "components/ui";
import ApplyODForm from "./ApplyODForm";

// Direct route page: opens the Apply OD form immediately. Existing form + APIs
// are untouched.
const ApplyODPage = () => (
  <div className="page-content">
    <PageContainer>
      <PageHeader
        title="Apply OD"
        subtitle="Submit an on-duty (OD) request for a security employee"
        breadcrumb={[
          { label: "Security", link: "#" },
          { label: "OD", link: "#" },
          { label: "Apply OD" },
        ]}
      />
      <ApplyODForm />
    </PageContainer>
  </div>
);

export default ApplyODPage;
