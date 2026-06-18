import React, { useEffect } from "react"
import { Row, Col, Card, CardBody, CardTitle, Button } from "reactstrap"

import { connect } from "react-redux";

//Import Action to copy breadcrumb items from local state to redux state
import { setBreadcrumbItems } from "../../../store/actions";


const ContactUs = (props) => {
  document.title = "Contact Us - Technical Hub";

  
  const breadcrumbItems = [
    { title: "Technical Hub", link: "#" },
    { title: "Contact Us", link: "#" },
  ]

  useEffect(() => {
    props.setBreadcrumbItems('Contact Us', breadcrumbItems)
  })

  return (
    <React.Fragment>
      <Row>
        <Col xs={12}>
          <Card>
            <CardBody>
              <CardTitle className="h4">Contact Us</CardTitle>
              <p className="card-title-desc">Get in touch with Technical Hub for any inquiries or support</p>
              
              {/* Header Section */}
              <div className="text-center mb-5">
                <h2 className="fw-bold text-dark mb-3">TECHNICAL HUB</h2>
                <p className="lead text-muted">We're here to help you succeed</p>
              </div>

              {/* Contact Cards Section */}
              <Row className="mb-4">
                <Col lg="4" md="6" className="mb-4">
                  <Card className="h-100 shadow-sm">
                    <CardBody className="text-center p-4">
                      <div className="mb-3">
                        <i className="mdi mdi-phone text-primary" style={{fontSize: '3rem'}}></i>
                      </div>
                      <CardTitle className="h5 mb-3 text-dark">Give Us a Call</CardTitle>
                      <p className="text-primary fw-bold mb-3" style={{fontSize: '1.1rem'}}>
                        + (91) 83438 18181
                      </p>
                      <p className="text-muted small mb-0">
                        Available Monday - Friday<br />
                        9:00 AM - 6:00 PM IST
                      </p>
                    </CardBody>
                  </Card>
                </Col>

                <Col lg="4" md="6" className="mb-4">
                  <Card className="h-100 shadow-sm">
                    <CardBody className="text-center p-4">
                      <div className="mb-3">
                        <i className="mdi mdi-map-marker text-primary" style={{fontSize: '3rem'}}></i>
                      </div>
                      <CardTitle className="h5 mb-3 text-dark">Visit Our Office</CardTitle>
                      <div className="text-start">
                        <p className="text-muted mb-2">
                          <strong>Technical Hub,</strong><br />
                          Aditya Global Incubation Center,<br />
                          Surampalem, Andhra Pradesh, India, 533437
                        </p>
                        <hr className="my-3" />
                        <p className="text-muted mb-0">
                          <strong>Registered Office:</strong><br />
                          Technical Hub Pvt Ltd,<br />
                          D No.86-4-12/3, G V S Apparao Street,<br />
                          Tilak Road, VL Puram, Rajahmundry,<br />
                          East Godavari, Andhra Pradesh, India, 533101
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                </Col>

                <Col lg="4" md="12" className="mb-4">
                  <Card className="h-100 shadow-sm">
                    <CardBody className="text-center p-4">
                      <div className="mb-3">
                        <i className="mdi mdi-email text-primary" style={{fontSize: '3rem'}}></i>
                      </div>
                      <CardTitle className="h5 mb-3 text-dark">Email Us</CardTitle>
                      <p className="text-primary fw-bold mb-3" style={{fontSize: '1.1rem'}}>
                        support@technicalhub.io
                      </p>
                      <p className="text-muted small mb-0">
                        We'll respond within 24 hours<br />
                        Monday - Friday
                      </p>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* Additional Information Section
              <Row className="mt-4">
                <Col xs={12}>
                  <Card className="bg-light">
                    <CardBody>
                      <Row>
                        <Col md="6">
                          <h5 className="text-dark mb-3">Business Hours</h5>
                          <div className="d-flex justify-content-between">
                            <span className="text-muted">Monday - Friday:</span>
                            <span className="fw-bold">9:00 AM - 6:00 PM IST</span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span className="text-muted">Saturday:</span>
                            <span className="fw-bold">10:00 AM - 2:00 PM IST</span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span className="text-muted">Sunday:</span>
                            <span className="fw-bold">Closed</span>
                          </div>
                        </Col>
                        <Col md="6">
                          <h5 className="text-dark mb-3">Quick Actions</h5>
                          <div className="d-flex flex-column gap-2">
                            <Button color="primary" size="sm" className="w-100">
                              <i className="mdi mdi-phone me-2"></i>
                              Call Now
                            </Button>
                            <Button color="success" size="sm" className="w-100">
                              <i className="mdi mdi-email me-2"></i>
                              Send Email
                            </Button>
                            <Button color="info" size="sm" className="w-100">
                              <i className="mdi mdi-map-marker me-2"></i>
                              Get Directions
                            </Button>
                          </div>
                        </Col>
                      </Row>
                    </CardBody>
                  </Card>
                </Col>
              </Row> */}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </React.Fragment>
  )
}

export default connect(null, { setBreadcrumbItems })(ContactUs);