import React, { useState } from "react";
import { Row, Col, Card, CardBody, CardTitle, Button } from "reactstrap";
import styled from "styled-components";
import Loader from "components/Loader";
import ApplyLeaveForm from "./ApplyLeaveForm";
import ApplyODForm from "./ApplyODForm";

const AppliedOD = () => {
  const [selectedForm, setSelectedForm] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleApplyLeaveClick = () => {
    setSelectedForm("leave");
  };

  const handleApplyODClick = () => {
    setSelectedForm("od");
  };

  return (
    <div>
      <Row>
        <Col className="col-12">
          <Card>
            <StyledCardBody>
              {isLoading && <Loader />}
              <CardTitle className="h4 mb-3">
                {selectedForm
                  ? selectedForm === "leave"
                    ? "Apply Leave"
                    : "Apply OD"
                  : "Apply Leave/OD"}
              </CardTitle>

              {selectedForm && (
                <div className="mb-3">
                  <Button
                    color="secondary"
                    onClick={() => setSelectedForm(null)}
                    disabled={isLoading}
                  >
                    Back to Options
                  </Button>
                </div>
              )}

              {!selectedForm && !isLoading && (
                <Row className="justify-content-center">
                  <Col md={4} className="text-center">
                    <Button
                      color="primary"
                      className="py-2 mx-2"
                      style={{ maxWidth: "200px", width: "100%" }}
                      onClick={handleApplyLeaveClick}
                    >
                      Apply Leave
                    </Button>
                  </Col>
                  <Col md={4} className="text-center">
                    <Button
                      color="primary"
                      className="py-2 mx-2"
                      style={{ maxWidth: "200px", width: "100%" }}
                      onClick={handleApplyODClick}
                    >
                      Apply OD
                    </Button>
                  </Col>
                </Row>
              )}

              {selectedForm === "leave" && !isLoading && <ApplyLeaveForm />}
              {selectedForm === "od" && !isLoading && <ApplyODForm />}
            </StyledCardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const StyledCardBody = styled(CardBody)`
  position: relative;
  min-height: 150px; /* Reduced to decrease vertical whitespace */
  padding: 1.5rem; /* Adjusted padding for a tighter layout */
`;

export default AppliedOD;