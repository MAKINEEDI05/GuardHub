import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Row,
  Col,
  Card,
  CardBody,
  CardTitle,
  Input,
  Pagination,
  PaginationItem,
  PaginationLink,
  Modal,
  ModalHeader,
  ModalBody,
  Button,
  FormGroup,
  Label,
  InputGroup,
} from "reactstrap";
import { connect } from "react-redux";
import { MDBDataTable } from "mdbreact";
import { AvForm, AvField } from "availity-reactstrap-validation";
import { setBreadcrumbItems } from "../../../store/actions";
import { toast, ToastContainer } from "react-toastify";
import axios from "axios";
import PropTypes from "prop-types";
import { debounce } from "lodash";
import Papa from "papaparse";
import DOMPurify from "dompurify";
import BulkUploadRoster from "./BulkUploadRoster";
import Loader from "components/Loader";
import Flatpickr from "react-flatpickr";
import "react-toastify/dist/ReactToastify.css";
import "flatpickr/dist/themes/material_blue.css";
import "./SecurityRoaster.css";
import guardImage from "./guard.png";
import { getEmpImageUrl, handleEmpImageError } from "helpers/empImage";

// Constants for shift and day options, API settings, and default image
const SHIFT_OPTIONS = ["General", "A Shift", "B Shift", "C Shift", "WEEK OFF"];
const DAY_OPTIONS = [
  "All Days",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const GUARDS_PER_PAGE = 10;
const BREADCRUMB_ITEMS = [
  { title: "Security", link: "#" },
  { title: "Profile", link: "#" },
  { title: "Security Profile", link: "#" },
];
const API_URL = process.env.REACT_APP_API_BASE_URL || "";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const GUARD_IMAGE = guardImage;

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  UNAUTHORIZED: 401,
  TOO_MANY_REQUESTS: 429,
};

// Logging utility
const logger = {
  info: (message, data = null) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[INFO] ${message}`, data || "");
    }
  },
  error: (message, error = null) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[ERROR] ${message}`, error || "");
    }
  },
  warn: (message, data = null) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[WARN] ${message}`, data || "");
    }
  },
};

// Utility function to sanitize input to prevent XSS attacks
const sanitizeInput = (input) => {
  if (input == null) return "";
  if (typeof input !== "string") return String(input);
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

// Utility function to sanitize CSV data to prevent formula injection
const sanitizeCSVData = (value) => {
  if (typeof value !== "string") return String(value || "");
  if (
    value.startsWith("=") ||
    value.startsWith("+") ||
    value.startsWith("-") ||
    value.startsWith("@")
  ) {
    return `\t${value}`;
  }
  return value;
};

// Utility function to validate date strings (YYYY-MM-DD or ISO format)
const isValidDate = (dateString) => {
  if (!dateString || typeof dateString !== "string") return false;
  const cleanedDate = dateString.split("T")[0];
  const date = new Date(cleanedDate); // Use cleaned date for consistency
  const isValid =
    !isNaN(date.getTime()) && cleanedDate.match(/^\d{4}-\d{2}-\d{2}$/);
  logger.info(
    `isValidDate: ${dateString} -> cleaned: ${cleanedDate}, valid: ${isValid}`
  );
  return isValid;
};

// Utility function to create a date in local timezone to avoid timezone issues
const createLocalDate = (dateString) => {
  if (!dateString) return null;

  // Handle different input types
  let dateStr;
  if (typeof dateString === "string") {
    dateStr = dateString;
  } else if (dateString instanceof Date) {
    // If it's already a Date object, return it as is
    return dateString;
  } else {
    logger.warn("createLocalDate received invalid input:", dateString);
    return null;
  }

  try {
    const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      logger.warn("createLocalDate failed to parse date:", dateStr);
      return null;
    }
    return new Date(year, month - 1, day);
  } catch (error) {
    logger.error("createLocalDate error:", error);
    return null;
  }
};

// Utility function to format date as YYYY-MM-DD in local timezone
const formatDateForAPI = (date) => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Utility function to validate employee ID (numeric and non-empty)
const isValidEmpId = (empId) => {
  return empId && /^\d+$/.test(empId.trim());
};

// ErrorBoundary component to catch and display errors in child components
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("ErrorBoundary caught an error:", { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="alert alert-danger">
          An error occurred: {this.state.error?.message || "Unknown error"}.
          Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

// GuardTable component to display the roster table with guard details and shifts
const GuardTable = React.memo(({ guards, openShiftChangeModal, isLoading }) => {
  const tableData = useMemo(
    () => ({
      columns: [
        {
          label: "Image",
          field: "image",
          sort: "disabled",
          width: 80,
          attributes: { className: "image", "aria-label": "Guard image" },
        },
        { label: "Employee Name", field: "name", sort: "asc", width: 120 },
        { label: "Employee ID", field: "id", sort: "asc", width: 100 },
        { label: "Designation", field: "designation", sort: "asc", width: 100 },
        {
          label: "Monday",
          field: "monday",
          sort: "asc",
          width: 80,
          attributes: { className: "monday" },
        },
        {
          label: "Tuesday",
          field: "tuesday",
          sort: "asc",
          width: 80,
          attributes: { className: "tuesday" },
        },
        {
          label: "Wednesday",
          field: "wednesday",
          sort: "asc",
          width: 80,
          attributes: { className: "wednesday" },
        },
        {
          label: "Thursday",
          field: "thursday",
          sort: "asc",
          width: 80,
          attributes: { className: "thursday" },
        },
        {
          label: "Friday",
          field: "friday",
          sort: "asc",
          width: 80,
          attributes: { className: "friday" },
        },
        {
          label: "Saturday",
          field: "saturday",
          sort: "asc",
          width: 80,
          attributes: { className: "saturday" },
        },
        {
          label: "Sunday",
          field: "sunday",
          sort: "asc",
          width: 80,
          attributes: { className: "sunday" },
        },
        {
          label: "Actions",
          field: "actions",
          sort: "disabled",
          width: 80,
          attributes: { className: "actions" },
        },
      ],
      rows: guards.map((guard) => ({
        image: (
          <img
            src={guard.image || GUARD_IMAGE}
            alt={`Profile of ${sanitizeInput(guard.name) || "Unknown Guard"}`}
            className="guard-image"
            onError={(e) => handleEmpImageError(e, GUARD_IMAGE)}
            loading="lazy"
          />
        ),
        name: sanitizeInput(guard.name) || "Unknown Guard",
        id: guard.id || "N/A",
        designation: sanitizeInput(guard.designation) || "N/A",
        monday: guard.weeklyShifts?.monday || "Not Assigned",
        tuesday: guard.weeklyShifts?.tuesday || "Not Assigned",
        wednesday: guard.weeklyShifts?.wednesday || "Not Assigned",
        thursday: guard.weeklyShifts?.thursday || "Not Assigned",
        friday: guard.weeklyShifts?.friday || "Not Assigned",
        saturday: guard.weeklyShifts?.saturday || "Not Assigned",
        sunday: guard.weeklyShifts?.sunday || "Not Assigned",
        actions: (
          <Button
            className="btn btn-primary btn-sm"
            onClick={() => openShiftChangeModal(guard)}
            disabled={!guard.id || guard.id === "N/A"}
            aria-label={`Edit roster for ${
              sanitizeInput(guard.name) || "Unknown Guard"
            }`}
          >
            Edit
          </Button>
        ),
      })),
    }),
    [guards, openShiftChangeModal]
  );

  return (
    <div className="table-container">
      {isLoading ? (
        <div className="loading-overlay" aria-live="polite">
          <Loader />
          <span className="loading-text">Loading guards...</span>
        </div>
      ) : guards.length === 0 ? (
        <p className="text-center" aria-live="polite">
          No guards found
        </p>
      ) : (
        <div className="table-responsive">
          <MDBDataTable
            key={guards.map((g) => g.id).join("-")}
            responsive
            striped
            bordered
            data={tableData}
            paging={false}
            searching={false}
            noBottomColumns
            hover
            displayEntries={false}
            className="md-table"
            role="grid"
            aria-label="Security Guard Roster Table"
          />
        </div>
      )}
    </div>
  );
});

GuardTable.propTypes = {
  guards: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      designation: PropTypes.string,
      weeklyShifts: PropTypes.shape({
        sunday: PropTypes.string,
        monday: PropTypes.string,
        tuesday: PropTypes.string,
        wednesday: PropTypes.string,
        thursday: PropTypes.string,
        friday: PropTypes.string,
        saturday: PropTypes.string,
      }),
      image: PropTypes.string,
    })
  ).isRequired,
  openShiftChangeModal: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

// ShiftEditModal component for editing an existing guard's shift schedule
const ShiftEditModal = React.memo(
  ({
    isOpen,
    toggle,
    selectedGuard,
    shiftFromDate,
    shiftToDate,
    setShiftFromDate,
    setShiftToDate,
    handleShiftSubmit,
    isModalLoading,
  }) => {
    logger.info("ShiftEditModal props:", {
      selectedGuard: selectedGuard?.id,
      shiftFromDate: shiftFromDate?.toISOString(),
      shiftToDate: shiftToDate?.toISOString(),
    });

    const defaultFromDate = shiftFromDate || new Date();
    const defaultToDate =
      shiftToDate ||
      new Date(defaultFromDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const formModel = useMemo(
      () => ({
        sunday: selectedGuard?.weeklyShifts?.sunday || SHIFT_OPTIONS[0],
        monday: selectedGuard?.weeklyShifts?.monday || SHIFT_OPTIONS[0],
        tuesday: selectedGuard?.weeklyShifts?.tuesday || SHIFT_OPTIONS[0],
        wednesday: selectedGuard?.weeklyShifts?.wednesday || SHIFT_OPTIONS[0],
        thursday: selectedGuard?.weeklyShifts?.thursday || SHIFT_OPTIONS[0],
        friday: selectedGuard?.weeklyShifts?.friday || SHIFT_OPTIONS[0],
        saturday: selectedGuard?.weeklyShifts?.saturday || SHIFT_OPTIONS[0],
        fromDate: formatDateForAPI(shiftFromDate || defaultFromDate),
        toDate: formatDateForAPI(shiftToDate || defaultToDate),
      }),
      [
        selectedGuard?.weeklyShifts,
        shiftFromDate,
        shiftToDate,
        defaultFromDate,
        defaultToDate,
      ]
    );

    logger.info("ShiftEditModal form model:", formModel);

    if (!selectedGuard) return null;

    return (
      <Modal isOpen={isOpen} toggle={toggle} className="custom-modal" centered>
        <ModalHeader toggle={toggle}>
          Edit Roster for {sanitizeInput(selectedGuard.name) || "Unknown Guard"}
        </ModalHeader>
        <ModalBody>
          {isModalLoading ? (
            <div className="loading-overlay" aria-live="polite">
              <Loader />
              <span className="loading-text">Loading guard details...</span>
            </div>
          ) : (
            <ErrorBoundary>
              <AvForm onValidSubmit={handleShiftSubmit} model={formModel}>
                <Row className="mb-3">
                  <Col xs={12} className="text-center">
                    <img
                      src={selectedGuard.image || GUARD_IMAGE}
                      alt={`Profile of ${
                        sanitizeInput(selectedGuard.name) || "Unknown Guard"
                      }`}
                      className="guard-image"
                      style={{
                        width: "100px",
                        height: "100px",
                        borderRadius: "50%",
                      }}
                      onError={(e) => handleEmpImageError(e, GUARD_IMAGE)}
                      loading="lazy"
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Employee ID</Label>
                      <Input
                        type="text"
                        value={selectedGuard.id || "N/A"}
                        disabled
                        aria-label="Employee ID"
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Employee Name</Label>
                      <Input
                        type="text"
                        value={
                          sanitizeInput(selectedGuard.name) || "Unknown Guard"
                        }
                        disabled
                        aria-label="Employee Name"
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Mobile No</Label>
                      <Input
                        type="text"
                        value={selectedGuard.mobileNo || "N/A"}
                        disabled
                        aria-label="Mobile Number"
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Department</Label>
                      <Input
                        type="text"
                        value={
                          sanitizeInput(selectedGuard.department) ||
                          "Unknown Department"
                        }
                        disabled
                        aria-label="Department"
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Designation</Label>
                      <Input
                        type="text"
                        value={
                          sanitizeInput(selectedGuard.designation) ||
                          "Unknown Designation"
                        }
                        disabled
                        aria-label="Designation"
                      />
                    </FormGroup>
                  </Col>
                </Row>

                <h5 className="mt-3">Edit Weekly Shifts</h5>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>From Date</Label>
                      <InputGroup>
                        <Flatpickr
                          className="form-control d-block"
                          placeholder="Select From Date"
                          options={{
                            altInput: true,
                            altFormat: "F j, Y",
                            dateFormat: "Y-m-d",
                            onError: (error) => {
                              logger.error("Flatpickr from date error:", error);
                              toast.error("Invalid date selected");
                            },
                          }}
                          value={shiftFromDate || defaultFromDate}
                          onChange={([date]) => {
                            try {
                              if (
                                date &&
                                date instanceof Date &&
                                !isNaN(date.getTime())
                              ) {
                                setShiftFromDate(date);
                              } else {
                                logger.warn(
                                  "Invalid date selected for from date"
                                );
                                toast.warn("Please select a valid date");
                              }
                            } catch (error) {
                              logger.error("Error setting from date:", error);
                              toast.error("Error setting date");
                            }
                          }}
                          aria-label="Shift start date"
                        />
                        <AvField
                          name="fromDate"
                          type="hidden"
                          value={formatDateForAPI(
                            shiftFromDate || defaultFromDate
                          )}
                          validate={{
                            required: {
                              value: true,
                              errorMessage: "Please select a from date",
                            },
                            date: {
                              value: true,
                              errorMessage: "Invalid from date",
                              format: "YYYY-MM-DD",
                            },
                          }}
                        />
                      </InputGroup>
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>To Date</Label>
                      <InputGroup>
                        <Flatpickr
                          className="form-control d-block"
                          placeholder="Select To Date"
                          options={{
                            altInput: true,
                            altFormat: "F j, Y",
                            dateFormat: "Y-m-d",
                            minDate: shiftFromDate || defaultFromDate,
                            onError: (error) => {
                              logger.error("Flatpickr to date error:", error);
                              toast.error("Invalid date selected");
                            },
                          }}
                          value={shiftToDate || defaultToDate}
                          onChange={([date]) => {
                            try {
                              if (
                                date &&
                                date instanceof Date &&
                                !isNaN(date.getTime())
                              ) {
                                setShiftToDate(date);
                              } else {
                                logger.warn(
                                  "Invalid date selected for to date"
                                );
                                toast.warn("Please select a valid date");
                              }
                            } catch (error) {
                              logger.error("Error setting to date:", error);
                              toast.error("Error setting date");
                            }
                          }}
                          aria-label="Shift end date"
                        />
                        <AvField
                          name="toDate"
                          type="hidden"
                          value={formatDateForAPI(shiftToDate || defaultToDate)}
                          validate={{
                            required: {
                              value: true,
                              errorMessage: "Please select a to date",
                            },
                            date: {
                              value: true,
                              errorMessage: "Invalid to date",
                              format: "YYYY-MM-DD",
                            },
                            custom: (value, ctx) => {
                              if (
                                value &&
                                ctx.fromDate &&
                                new Date(value) < new Date(ctx.fromDate)
                              ) {
                                return "Please select a valid to date (after from date)";
                              }
                              return true;
                            },
                          }}
                        />
                      </InputGroup>
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <ShiftDropdown
                      name="sunday"
                      label="Sunday"
                      value={
                        selectedGuard.weeklyShifts?.sunday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                  <Col md={6}>
                    <ShiftDropdown
                      name="monday"
                      label="Monday"
                      value={
                        selectedGuard.weeklyShifts?.monday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <ShiftDropdown
                      name="tuesday"
                      label="Tuesday"
                      value={
                        selectedGuard.weeklyShifts?.tuesday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                  <Col md={6}>
                    <ShiftDropdown
                      name="wednesday"
                      label="Wednesday"
                      value={
                        selectedGuard.weeklyShifts?.wednesday ||
                        SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <ShiftDropdown
                      name="thursday"
                      label="Thursday"
                      value={
                        selectedGuard.weeklyShifts?.thursday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                  <Col md={6}>
                    <ShiftDropdown
                      name="friday"
                      label="Friday"
                      value={
                        selectedGuard.weeklyShifts?.friday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <ShiftDropdown
                      name="saturday"
                      label="Saturday"
                      value={
                        selectedGuard.weeklyShifts?.saturday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                </Row>

                <FormGroup className="mb-0 mt-3">
                  <Button
                    type="submit"
                    color="primary"
                    className="me-2"
                    aria-label="Submit changes"
                  >
                    Submit
                  </Button>
                  <Button
                    type="button"
                    color="secondary"
                    onClick={toggle}
                    aria-label="Cancel"
                  >
                    Cancel
                  </Button>
                </FormGroup>
              </AvForm>
            </ErrorBoundary>
          )}
        </ModalBody>
      </Modal>
    );
  }
);

ShiftEditModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  selectedGuard: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    mobileNo: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    department: PropTypes.string,
    designation: PropTypes.string,
    image: PropTypes.string,
    weeklyShifts: PropTypes.shape({
      sunday: PropTypes.string,
      monday: PropTypes.string,
      tuesday: PropTypes.string,
      wednesday: PropTypes.string,
      thursday: PropTypes.string,
      friday: PropTypes.string,
      saturday: PropTypes.string,
    }),
  }),
  shiftFromDate: PropTypes.instanceOf(Date),
  shiftToDate: PropTypes.instanceOf(Date),
  setShiftFromDate: PropTypes.func.isRequired,
  setShiftToDate: PropTypes.func.isRequired,
  handleShiftSubmit: PropTypes.func.isRequired,
  isModalLoading: PropTypes.bool.isRequired,
};

// AddShiftModal component for adding a new employee's shift schedule
const AddShiftModal = React.memo(
  ({
    isOpen,
    toggle,
    newEmployee,
    setNewEmployee,
    empIdInput,
    setEmpIdInput,
    newShiftFromDate,
    newShiftToDate,
    setNewShiftFromDate,
    setNewShiftToDate,
    handleEmpIdSubmit,
    handleAddShiftSubmit,
    isModalLoading,
  }) => {
    const handleClose = () => {
      toggle();
      setEmpIdInput("");
      setNewEmployee(null);
      setNewShiftFromDate(null);
      setNewShiftToDate(null);
    };

    return (
      <Modal
        isOpen={isOpen}
        toggle={handleClose}
        className="custom-modal"
        centered
      >
        <ModalHeader toggle={handleClose}>Add Employee Shift</ModalHeader>
        <ModalBody>
          {isModalLoading ? (
            <div className="loading-overlay" aria-live="polite">
              <Loader />
              <span className="loading-text">Fetching employee details...</span>
            </div>
          ) : !newEmployee ? (
            <AvForm onValidSubmit={handleEmpIdSubmit}>
              <Row className="mb-3">
                <Col md={6} className="pe-md-1">
                  <FormGroup className="mb-0">
                    <Label>Employee ID</Label>
                    <Input
                      type="text"
                      value={empIdInput}
                      onChange={(e) =>
                        setEmpIdInput(sanitizeInput(e.target.value))
                      }
                      placeholder="Enter Employee ID"
                      aria-label="Employee ID"
                      validate={{
                        required: {
                          value: true,
                          errorMessage: "Please enter an Employee ID",
                        },
                        pattern: {
                          value: "^\\d+$",
                          errorMessage: "Employee ID must be numeric",
                        },
                      }}
                      className="employee-id-input"
                    />
                  </FormGroup>
                </Col>
                <Col md={6} className="ps-md-1">
                  <FormGroup className="mb-0">
                    <Label className="d-none d-md-block"> </Label>
                    <Button
                      type="submit"
                      color="primary"
                      aria-label="Fetch employee details"
                      className="fetch-details-btn w-100"
                    >
                      Fetch Details
                    </Button>
                  </FormGroup>
                </Col>
              </Row>
            </AvForm>
          ) : (
            <ErrorBoundary>
              <AvForm
                onValidSubmit={handleAddShiftSubmit}
                model={{
                  sunday: newEmployee.weeklyShifts?.sunday || SHIFT_OPTIONS[0],
                  monday: newEmployee.weeklyShifts?.monday || SHIFT_OPTIONS[0],
                  tuesday:
                    newEmployee.weeklyShifts?.tuesday || SHIFT_OPTIONS[0],
                  wednesday:
                    newEmployee.weeklyShifts?.wednesday || SHIFT_OPTIONS[0],
                  thursday:
                    newEmployee.weeklyShifts?.thursday || SHIFT_OPTIONS[0],
                  friday: newEmployee.weeklyShifts?.friday || SHIFT_OPTIONS[0],
                  saturday:
                    newEmployee.weeklyShifts?.saturday || SHIFT_OPTIONS[0],
                  fromDate: formatDateForAPI(newShiftFromDate) || "",
                  toDate: formatDateForAPI(newShiftToDate) || "",
                }}
              >
                <Row className="mb-3">
                  <Col xs={12} className="text-center">
                    <img
                      src={newEmployee.image || GUARD_IMAGE}
                      alt={`Profile of ${
                        sanitizeInput(newEmployee.name) || "Unknown Employee"
                      }`}
                      className="guard-image"
                      style={{
                        width: "100px",
                        height: "100px",
                        borderRadius: "50%",
                      }}
                      onError={(e) => handleEmpImageError(e, GUARD_IMAGE)}
                      loading="lazy"
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Employee ID</Label>
                      <Input
                        type="text"
                        value={newEmployee.id || "N/A"}
                        disabled
                        aria-label="Employee ID"
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Employee Name</Label>
                      <Input
                        type="text"
                        value={
                          sanitizeInput(newEmployee.name) || "Unknown Employee"
                        }
                        disabled
                        aria-label="Employee Name"
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Mobile No</Label>
                      <Input
                        type="text"
                        value={newEmployee.mobileNo || "N/A"}
                        disabled
                        aria-label="Mobile Number"
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Department</Label>
                      <Input
                        type="text"
                        value={
                          sanitizeInput(newEmployee.department) ||
                          "Unknown Department"
                        }
                        disabled
                        aria-label="Department"
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Designation</Label>
                      <Input
                        type="text"
                        value={
                          sanitizeInput(newEmployee.designation) ||
                          "Unknown Designation"
                        }
                        disabled
                        aria-label="Designation"
                      />
                    </FormGroup>
                  </Col>
                </Row>

                <h5 className="mt-3">Set Weekly Shifts</h5>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>From Date</Label>
                      <InputGroup>
                        <Flatpickr
                          className="form-control d-block"
                          placeholder="Select From Date"
                          options={{
                            altInput: true,
                            altFormat: "F j, Y",
                            dateFormat: "Y-m-d",
                            onError: (error) => {
                              logger.error(
                                "Flatpickr new from date error:",
                                error
                              );
                              toast.error("Invalid date selected");
                            },
                          }}
                          value={newShiftFromDate || ""}
                          onChange={([date]) => {
                            try {
                              if (
                                date &&
                                date instanceof Date &&
                                !isNaN(date.getTime())
                              ) {
                                setNewShiftFromDate(date);
                              } else {
                                logger.warn(
                                  "Invalid date selected for new from date"
                                );
                                toast.warn("Please select a valid date");
                              }
                            } catch (error) {
                              logger.error(
                                "Error setting new from date:",
                                error
                              );
                              toast.error("Error setting date");
                            }
                          }}
                          aria-label="Shift start date"
                        />
                        <AvField
                          name="fromDate"
                          type="hidden"
                          value={formatDateForAPI(newShiftFromDate) || ""}
                          validate={{
                            required: {
                              value: true,
                              errorMessage: "Please select a from date",
                            },
                            date: {
                              value: true,
                              errorMessage: "Invalid from date",
                              format: "YYYY-MM-DD",
                            },
                          }}
                        />
                      </InputGroup>
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>To Date</Label>
                      <InputGroup>
                        <Flatpickr
                          className="form-control d-block"
                          placeholder="Select To Date"
                          options={{
                            altInput: true,
                            altFormat: "F j, Y",
                            dateFormat: "Y-m-d",
                            minDate: newShiftFromDate || undefined,
                            onError: (error) => {
                              logger.error(
                                "Flatpickr new to date error:",
                                error
                              );
                              toast.error("Invalid date selected");
                            },
                          }}
                          value={newShiftToDate || ""}
                          onChange={([date]) => {
                            try {
                              if (
                                date &&
                                date instanceof Date &&
                                !isNaN(date.getTime())
                              ) {
                                setNewShiftToDate(date);
                              } else {
                                logger.warn(
                                  "Invalid date selected for new to date"
                                );
                                toast.warn("Please select a valid date");
                              }
                            } catch (error) {
                              logger.error("Error setting new to date:", error);
                              toast.error("Error setting date");
                            }
                          }}
                          aria-label="Shift end date"
                        />
                        <AvField
                          name="toDate"
                          type="hidden"
                          value={formatDateForAPI(newShiftToDate) || ""}
                          validate={{
                            required: {
                              value: true,
                              errorMessage: "Please select a to date",
                            },
                            date: {
                              value: true,
                              errorMessage: "Invalid to date",
                              format: "YYYY-MM-DD",
                            },
                            custom: (value, ctx) => {
                              if (
                                value &&
                                ctx.fromDate &&
                                new Date(value) < new Date(ctx.fromDate)
                              ) {
                                return "Please select a valid to date (after from date)";
                              }
                              return true;
                            },
                          }}
                        />
                      </InputGroup>
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <ShiftDropdown
                      name="sunday"
                      label="Sunday"
                      value={
                        newEmployee.weeklyShifts?.sunday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                  <Col md={6}>
                    <ShiftDropdown
                      name="monday"
                      label="Monday"
                      value={
                        newEmployee.weeklyShifts?.monday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <ShiftDropdown
                      name="tuesday"
                      label="Tuesday"
                      value={
                        newEmployee.weeklyShifts?.tuesday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                  <Col md={6}>
                    <ShiftDropdown
                      name="wednesday"
                      label="Wednesday"
                      value={
                        newEmployee.weeklyShifts?.wednesday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <ShiftDropdown
                      name="thursday"
                      label="Thursday"
                      value={
                        newEmployee.weeklyShifts?.thursday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                  <Col md={6}>
                    <ShiftDropdown
                      name="friday"
                      label="Friday"
                      value={
                        newEmployee.weeklyShifts?.friday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <ShiftDropdown
                      name="saturday"
                      label="Saturday"
                      value={
                        newEmployee.weeklyShifts?.saturday || SHIFT_OPTIONS[0]
                      }
                    />
                  </Col>
                </Row>

                <FormGroup className="mb-0 mt-3">
                  <Button
                    type="submit"
                    color="primary"
                    className="me-2"
                    aria-label="Submit new shift"
                  >
                    Submit
                  </Button>
                  <Button
                    type="button"
                    color="secondary"
                    onClick={handleClose}
                    aria-label="Cancel"
                  >
                    Cancel
                  </Button>
                </FormGroup>
              </AvForm>
            </ErrorBoundary>
          )}
        </ModalBody>
      </Modal>
    );
  }
);

AddShiftModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  newEmployee: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    mobileNo: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    department: PropTypes.string,
    designation: PropTypes.string,
    image: PropTypes.string,
    weeklyShifts: PropTypes.shape({
      sunday: PropTypes.string,
      monday: PropTypes.string,
      tuesday: PropTypes.string,
      wednesday: PropTypes.string,
      thursday: PropTypes.string,
      friday: PropTypes.string,
      saturday: PropTypes.string,
    }),
  }),
  setNewEmployee: PropTypes.func.isRequired,
  empIdInput: PropTypes.string.isRequired,
  setEmpIdInput: PropTypes.func.isRequired,
  newShiftFromDate: PropTypes.instanceOf(Date),
  newShiftToDate: PropTypes.instanceOf(Date),
  setNewShiftFromDate: PropTypes.func.isRequired,
  setNewShiftToDate: PropTypes.func.isRequired,
  handleEmpIdSubmit: PropTypes.func.isRequired,
  handleAddShiftSubmit: PropTypes.func.isRequired,
  isModalLoading: PropTypes.bool.isRequired,
};

// ShiftDropdown component for selecting shifts for each day
const ShiftDropdown = React.memo(({ name, label, value }) => (
  <AvField
    name={name}
    label={label}
    type="select"
    value={value || SHIFT_OPTIONS[0]}
    validate={{
      required: { value: true, errorMessage: `Select a shift for ${label}` },
      pattern: {
        value: `^(${SHIFT_OPTIONS.join("|")})$`,
        errorMessage: `Invalid shift for ${label}`,
      },
    }}
    aria-label={`Shift for ${label}`}
  >
    <option value="">Select Shift</option>
    {SHIFT_OPTIONS.map((shift) => (
      <option key={shift} value={shift}>
        {shift}
      </option>
    ))}
  </AvField>
));

ShiftDropdown.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

// Cache for guard data to avoid repeated API calls
const guardCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache invalidation utility
const invalidateCache = (key = null) => {
  if (key) {
    guardCache.delete(key);
  } else {
    guardCache.clear();
  }
  logger.info(`Cache invalidated for key: ${key || "all"}`);
};

// Main SecurityRoaster component to manage the guard roster
const SecurityRoaster = ({ setBreadcrumbItems }) => {
  const [guards, setGuards] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("All Days");
  const [modal, setModal] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState(null);
  const [shiftFromDate, setShiftFromDateState] = useState(null);
  const [shiftToDate, setShiftToDateState] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState(null);
  const [empIdInput, setEmpIdInput] = useState("");
  const [newShiftFromDate, setNewShiftFromDate] = useState(null);
  const [newShiftToDate, setNewShiftToDate] = useState(null);
  const [debouncedLoading, setDebouncedLoading] = useState(false);
  const debouncedLoadingTimeoutRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  const abortControllersRef = useRef(new Map());
  const lastFetchTimeRef = useRef(0);

  const setShiftFromDate = useCallback((date) => {
    if (date === null || date === undefined) {
      // Allow null/undefined to clear the date
      setShiftFromDateState(null);
      return;
    }
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      logger.warn("Invalid date provided to setShiftFromDate:", date);
      return;
    }
    setShiftFromDateState((prev) => {
      if (!prev || prev.getTime() !== date.getTime()) {
        return date;
      }
      return prev;
    });
  }, []);

  const setShiftToDate = useCallback((date) => {
    if (date === null || date === undefined) {
      // Allow null/undefined to clear the date
      setShiftToDateState(null);
      return;
    }
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      logger.warn("Invalid date provided to setShiftToDate:", date);
      return;
    }
    setShiftToDateState((prev) => {
      if (!prev || prev.getTime() !== date.getTime()) {
        return date;
      }
      return prev;
    });
  }, []);

  const normalizeShift = useCallback((shift) => {
    if (!shift || !SHIFT_OPTIONS.includes(shift)) return SHIFT_OPTIONS[0];
    return shift;
  }, []);

  const debouncedSearch = useMemo(
    () => debounce((value) => setSearchTerm(sanitizeInput(value)), 300),
    []
  );

  const retry = async (fn, retries = MAX_RETRIES, delay = RETRY_DELAY) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (error.name === "AbortError") {
          throw error;
        }
        if (error.response?.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
          await new Promise((resolve) => setTimeout(resolve, delay * 2));
        } else if (error.response?.status === HTTP_STATUS.UNAUTHORIZED) {
          toast.error("Unauthorized: Please log in again");
          throw error;
        } else if (!error.response) {
          toast.error("Network error: Please check your connection");
          throw error;
        }
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };

  const fetchGuards = useCallback(
    async (forceRefresh = false) => {
      const now = Date.now();
      const cacheKey = "allGuards";

      // Check cache first (unless force refresh)
      if (!forceRefresh && guardCache.has(cacheKey)) {
        const cached = guardCache.get(cacheKey);
        if (now - cached.timestamp < CACHE_DURATION) {
          logger.info("Using cached guards data");
          setGuards(cached.data);
          return;
        } else {
          // Show cached data immediately while fetching fresh data
          logger.info("Showing stale cached data while fetching fresh data");
          setGuards(cached.data);
        }
      }

      // Avoid rapid successive calls
      if (now - lastFetchTimeRef.current < 1000) {
        logger.info("Skipping fetch - too soon after last fetch");
        return;
      }
      lastFetchTimeRef.current = now;

      setIsLoading(true);
      setDebouncedLoading(true);
      const controller = new AbortController();
      const controllerId = "fetchGuards";
      abortControllersRef.current.set(controllerId, controller);

      try {
        const response = await retry(() =>
          axios.get(`${API_URL}/roster/get-emp-data`, {
            headers: {
              Authorization: `Bearer ${
                localStorage.getItem("authToken") || ""
              }`,
            },
            signal: controller.signal,
          })
        );
        if (
          response.status !== HTTP_STATUS.OK ||
          !Array.isArray(response.data)
        ) {
          throw new Error("Invalid response format");
        }
        if (response.data.length === 0) {
          toast.warn("No guards found in the roster");
          setGuards([]);
          guardCache.set(cacheKey, { data: [], timestamp: now });
          return;
        }

        // Process data more efficiently
        const formattedGuards = response.data.map((guard) => {
          const shiftFromDate =
            guard.shiftFromDate && isValidDate(guard.shiftFromDate)
              ? createLocalDate(guard.shiftFromDate)
              : null;
          const shiftToDate =
            guard.shiftToDate && isValidDate(guard.shiftToDate)
              ? createLocalDate(guard.shiftToDate)
              : null;

          return {
            id: String(guard.empId || guard._id || "N/A"),
            image: guard.empImage ? getEmpImageUrl(guard) : GUARD_IMAGE,
            name: sanitizeInput(guard.empName) || "Unknown Guard",
            mobileNo: guard.mobileNo || "N/A",
            department: sanitizeInput(guard.department) || "Unknown Department",
            designation:
              sanitizeInput(guard.designation) || "Unknown Designation",
            weeklyShifts: {
              sunday: normalizeShift(guard.weeklyShifts?.sunday),
              monday: normalizeShift(guard.weeklyShifts?.monday),
              tuesday: normalizeShift(guard.weeklyShifts?.tuesday),
              wednesday: normalizeShift(guard.weeklyShifts?.wednesday),
              thursday: normalizeShift(guard.weeklyShifts?.thursday),
              friday: normalizeShift(guard.weeklyShifts?.friday),
              saturday: normalizeShift(guard.weeklyShifts?.saturday),
            },
            shiftFromDate,
            shiftToDate,
          };
        });

        // Cache the formatted data
        guardCache.set(cacheKey, { data: formattedGuards, timestamp: now });
        setGuards(formattedGuards);
      } catch (error) {
        if (error.name !== "AbortError") {
          toast.error(
            error.response?.data?.message || "Failed to fetch guards"
          );
          setGuards([]);
        }
      } finally {
        setIsLoading(false);
        abortControllersRef.current.delete(controllerId);

        // Clear any existing timeout and set new one
        if (debouncedLoadingTimeoutRef.current) {
          clearTimeout(debouncedLoadingTimeoutRef.current);
        }
        debouncedLoadingTimeoutRef.current = setTimeout(
          () => setDebouncedLoading(false),
          300
        );
      }
    },
    [normalizeShift]
  );

  const fetchGuardById = useCallback(
    async (empId, forceFetch = false) => {
      if (!empId || empId === "N/A") return null;

      const cacheKey = `guard-${empId}`;

      // Check cache first (unless force fetch)
      if (!forceFetch && guardCache.has(cacheKey)) {
        const cached = guardCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
          logger.info("Using cached guard data for empId", empId);
          return cached.data;
        }
      }

      // Try to find guard in current guards list first
      const existingGuard = guards.find((g) => g.id === String(empId));
      if (existingGuard && !forceFetch) {
        logger.info("Using existing guard data for empId", empId);
        return existingGuard;
      }

      const controllerId = `fetchGuardById-${empId}`;
      try {
        setIsModalLoading(true);
        const controller = new AbortController();
        abortControllersRef.current.set(controllerId, controller);
        const response = await retry(() =>
          axios.get(`${API_URL}/roster/get-guard-shift/${empId}`, {
            headers: {
              Authorization: `Bearer ${
                localStorage.getItem("authToken") || ""
              }`,
            },
            signal: controller.signal,
          })
        );
        if (response.status !== HTTP_STATUS.OK) {
          throw new Error("Failed to fetch guard");
        }
        const guard = Array.isArray(response.data)
          ? response.data[0]
          : response.data;
        if (!guard) {
          throw new Error("No guard data found");
        }

        const shiftFromDate =
          guard.shiftFromDate && isValidDate(guard.shiftFromDate)
            ? createLocalDate(guard.shiftFromDate)
            : null;
        const shiftToDate =
          guard.shiftToDate && isValidDate(guard.shiftToDate)
            ? createLocalDate(guard.shiftToDate)
            : null;
        const guardData = {
          id: String(guard.empId || guard._id || empId),
          image: guard.empImage ? getEmpImageUrl(guard) : GUARD_IMAGE,
          name: sanitizeInput(guard.empName) || "Unknown Guard",
          mobileNo: guard.mobileNo || "N/A",
          department: sanitizeInput(guard.department) || "Unknown Department",
          designation:
            sanitizeInput(guard.designation) || "Unknown Designation",
          weeklyShifts: {
            sunday: normalizeShift(guard.weeklyShifts?.sunday),
            monday: normalizeShift(guard.weeklyShifts?.monday),
            tuesday: normalizeShift(guard.weeklyShifts?.tuesday),
            wednesday: normalizeShift(guard.weeklyShifts?.wednesday),
            thursday: normalizeShift(guard.weeklyShifts?.thursday),
            friday: normalizeShift(guard.weeklyShifts?.friday),
            saturday: normalizeShift(guard.weeklyShifts?.saturday),
          },
          shiftFromDate,
          shiftToDate,
        };

        // Cache the guard data
        guardCache.set(cacheKey, { data: guardData, timestamp: Date.now() });
        return guardData;
      } catch (error) {
        if (error.name !== "AbortError") {
          toast.error(
            error.response?.data?.message ||
              `Failed to fetch guard with ID ${empId}`
          );
        }
        return null;
      } finally {
        setIsModalLoading(false);
        abortControllersRef.current.delete(controllerId);
      }
    },
    [normalizeShift, guards]
  );

  const fetchEmployeeById = useCallback(async (empId) => {
    if (!isValidEmpId(empId)) {
      toast.error("Please enter a valid numeric Employee ID");
      return null;
    }
    const controllerId = `fetchEmployeeById-${empId}`;
    try {
      setIsModalLoading(true);
      const controller = new AbortController();
      abortControllersRef.current.set(controllerId, controller);
      const response = await retry(() =>
        axios.get(`${API_URL}/emp/get-emp-byid/${empId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
          signal: controller.signal,
        })
      );
      if (response.status !== HTTP_STATUS.OK) {
        throw new Error("Failed to fetch employee");
      }
      const employeeData = response.data;
      logger.info(
        "fetchEmployeeById raw response for empId",
        empId,
        ":",
        employeeData
      );
      if (!employeeData) {
        throw new Error("No employee data found");
      }
      const employee = {
        id: String(employeeData.empId || empId),
        image: employeeData.empImage ? getEmpImageUrl(employeeData) : GUARD_IMAGE,
        name: sanitizeInput(employeeData.empName) || "Unknown Employee",
        mobileNo: String(
          employeeData.empMobileNo || employeeData.mobileNo || "N/A"
        ),
        department:
          sanitizeInput(employeeData.empDepartment) || "Unknown Department",
        designation:
          sanitizeInput(employeeData.empDesignation) || "Unknown Designation",
        weeklyShifts: {
          sunday: SHIFT_OPTIONS[0],
          monday: SHIFT_OPTIONS[0],
          tuesday: SHIFT_OPTIONS[0],
          wednesday: SHIFT_OPTIONS[0],
          thursday: SHIFT_OPTIONS[0],
          friday: SHIFT_OPTIONS[0],
          saturday: SHIFT_OPTIONS[0],
        },
        shiftFromDate: null,
        shiftToDate: null,
      };
      logger.info(
        "fetchEmployeeById parsed employee data for empId",
        empId,
        ":",
        employee
      );
      return employee;
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(
          error.response?.data?.message ||
            `Employee with ID ${empId} not found. Please verify the ID.`
        );
      }
      return null;
    } finally {
      setIsModalLoading(false);
      abortControllersRef.current.delete(controllerId);
    }
  }, []);

  useEffect(() => {
    // Load guards with cache check
    fetchGuards(false);
    setBreadcrumbItems("Security Profile", BREADCRUMB_ITEMS);

    return () => {
      debouncedSearch.cancel();
      // Clear debounced loading timeout
      if (debouncedLoadingTimeoutRef.current) {
        clearTimeout(debouncedLoadingTimeoutRef.current);
      }
      // Abort all pending requests
      abortControllersRef.current.forEach((controller) => {
        if (controller && !controller.signal.aborted) {
          controller.abort();
        }
      });
      abortControllersRef.current.clear();
      // Clear cache on unmount to prevent memory leaks
      invalidateCache();
    };
  }, [fetchGuards, setBreadcrumbItems, debouncedSearch]);

  const toggleModal = useCallback(() => {
    setModal((prev) => {
      if (!prev) {
        // Opening modal - reset state
        setSelectedGuard(null);
        setShiftFromDate(null);
        setShiftToDate(null);
        setIsModalLoading(false);
      }
      return !prev;
    });
  }, []);

  const toggleAddModal = useCallback(() => {
    setAddModal((prev) => {
      if (!prev) {
        // Opening modal - reset state
        setNewEmployee(null);
        setEmpIdInput("");
        setNewShiftFromDate(null);
        setNewShiftToDate(null);
        setIsModalLoading(false);
      }
      return !prev;
    });
  }, []);

  const openShiftChangeModal = useCallback(
    async (guard) => {
      if (!guard?.id || guard.id === "N/A") {
        toast.error("Invalid guard ID");
        return;
      }

      // Use existing guard data first (faster)
      let latestGuard = guard;

      // Only fetch if we need fresh data or don't have complete data
      if (!guard.shiftFromDate || !guard.shiftToDate) {
        latestGuard = await fetchGuardById(guard.id, false);
      }

      if (latestGuard) {
        // Set all state at once to prevent race conditions
        setSelectedGuard(latestGuard);
        const fromDate = latestGuard.shiftFromDate || null;
        const toDate = latestGuard.shiftToDate || null;

        // Use a single state update to ensure consistency
        setShiftFromDate(fromDate);
        setShiftToDate(toDate);

        setModal(true);
      } else {
        toast.error("Failed to load guard data for editing");
      }
    },
    [fetchGuardById]
  );

  const handleEmpIdSubmit = useCallback(
    async (event, values) => {
      const sanitizedEmpId = sanitizeInput(empIdInput.trim());
      if (!isValidEmpId(sanitizedEmpId)) {
        toast.error("Please enter a valid numeric Employee ID");
        return;
      }
      const employeeData = await fetchEmployeeById(sanitizedEmpId);
      if (employeeData) {
        setNewEmployee(employeeData);
        setNewShiftFromDate(null);
        setNewShiftToDate(null);
      }
    },
    [empIdInput, fetchEmployeeById]
  );

  const handleShiftSubmit = useCallback(
    async (event, values) => {
      // Remove redundant validation since AvField already validates
      const fromDate = new Date(values.fromDate);
      const toDate = new Date(values.toDate);
      if (toDate < fromDate) {
        toast.error("To Date must be after From Date.");
        return;
      }

      const updatedGuard = { empId: String(selectedGuard.id) };
      const updatedShifts = {};
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      days.forEach((day) => {
        const submittedShift = values[day] || SHIFT_OPTIONS[0];
        const currentShift =
          selectedGuard.weeklyShifts[day] || SHIFT_OPTIONS[0];
        if (submittedShift !== currentShift) {
          updatedShifts[day] = submittedShift;
        }
      });

      if (Object.keys(updatedShifts).length > 0) {
        updatedGuard.weeklyShifts = {
          sunday: updatedShifts.sunday ?? selectedGuard.weeklyShifts.sunday,
          monday: updatedShifts.monday ?? selectedGuard.weeklyShifts.monday,
          tuesday: updatedShifts.tuesday ?? selectedGuard.weeklyShifts.tuesday,
          wednesday:
            updatedShifts.wednesday ?? selectedGuard.weeklyShifts.wednesday,
          thursday:
            updatedShifts.thursday ?? selectedGuard.weeklyShifts.thursday,
          friday: updatedShifts.friday ?? selectedGuard.weeklyShifts.friday,
          saturday:
            updatedShifts.saturday ?? selectedGuard.weeklyShifts.saturday,
        };
      }

      const currentFromDate = selectedGuard.shiftFromDate
        ? new Date(selectedGuard.shiftFromDate)
        : null;
      const currentToDate = selectedGuard.shiftToDate
        ? new Date(selectedGuard.shiftToDate)
        : null;

      logger.info(
        "handleShiftSubmit date comparison for empId",
        selectedGuard.id,
        ":",
        {
          submittedFromDate: values.fromDate,
          submittedToDate: values.toDate,
          currentFromDate: currentFromDate?.toISOString(),
          currentToDate: currentToDate?.toISOString(),
        }
      );

      const fromDateChanged =
        !currentFromDate || fromDate.getTime() !== currentFromDate.getTime();
      const toDateChanged =
        !currentToDate || toDate.getTime() !== currentToDate.getTime();

      if (fromDateChanged) {
        updatedGuard.shiftFromDate = formatDateForAPI(fromDate);
      }
      if (toDateChanged) {
        updatedGuard.shiftToDate = formatDateForAPI(toDate);
      }

      if (
        Object.keys(updatedShifts).length === 0 &&
        !fromDateChanged &&
        !toDateChanged
      ) {
        toast.info("No changes detected");
        toggleModal();
        return;
      }

      logger.info(
        "handleShiftSubmit payload for empId",
        selectedGuard.id,
        ":",
        updatedGuard
      );
      try {
        const response = await retry(() =>
          axios.put(
            `${API_URL}/roster/update-emp-roster/${selectedGuard.id}`,
            updatedGuard,
            {
              headers: {
                Authorization: `Bearer ${
                  localStorage.getItem("authToken") || ""
                }`,
              },
            }
          )
        );
        logger.info(
          "handleShiftSubmit response for empId",
          selectedGuard.id,
          ":",
          response.data
        );
        logger.info(
          `handleShiftSubmit raw response data for empId ${selectedGuard.id}:`,
          JSON.stringify(response.data, null, 2)
        );
        logger.info(
          `handleShiftSubmit response alternative date fields for empId ${selectedGuard.id}:`,
          {
            fromDate: response.data.updated?.fromDate,
            toDate: response.data.updated?.toDate,
            shiftFromDate: response.data.updated?.shiftFromDate,
            shiftToDate: response.data.updated?.shiftToDate,
          }
        );
        if (response.status !== HTTP_STATUS.OK) {
          throw new Error("Failed to update shift");
        }

        // Check if component is still mounted before updating state
        if (abortControllersRef.current) {
          // Invalidate cache for this specific guard and all guards
          invalidateCache(`guard-${selectedGuard.id}`);
          invalidateCache("allGuards");
          await fetchGuards(true); // Force refresh to get latest data
          toast.success(
            `Shift updated for ${sanitizeInput(selectedGuard.name)}`
          );
          toggleModal();
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          toast.error(
            error.response?.data?.message || "Failed to update shift"
          );
        }
      }
    },
    [selectedGuard, fetchGuards, toggleModal, retry]
  );

  const handleAddShiftSubmit = async (event, values) => {
    // Remove redundant validation since AvField already validates
    const fromDate = new Date(values.fromDate);
    const toDate = new Date(values.toDate);
    if (toDate < fromDate) {
      toast.error("To Date must be after From Date.");
      return;
    }

    const newEmployeeShift = {
      empId: String(newEmployee.id),
      empName: sanitizeInput(newEmployee.name),
      mobileNo: String(newEmployee.mobileNo),
      department: sanitizeInput(newEmployee.department),
      designation: sanitizeInput(newEmployee.designation),
      weeklyShifts: {
        sunday: values.sunday || SHIFT_OPTIONS[0],
        monday: values.monday || SHIFT_OPTIONS[0],
        tuesday: values.tuesday || SHIFT_OPTIONS[0],
        wednesday: values.wednesday || SHIFT_OPTIONS[0],
        thursday: values.thursday || SHIFT_OPTIONS[0],
        friday: values.friday || SHIFT_OPTIONS[0],
        saturday: values.saturday || SHIFT_OPTIONS[0],
      },
      shiftFromDate: formatDateForAPI(fromDate),
      shiftToDate: formatDateForAPI(toDate),
    };

    logger.info(
      "handleAddShiftSubmit payload for empId",
      newEmployee.id,
      ":",
      newEmployeeShift
    );
    try {
      const response = await retry(() =>
        axios.post(`${API_URL}/roster/add-emp-shift`, newEmployeeShift, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
        })
      );
      logger.info(
        "handleAddShiftSubmit response for empId",
        newEmployee.id,
        ":",
        response.data
      );
      logger.info(
        `handleAddShiftSubmit raw response data for empId ${newEmployee.id}:`,
        JSON.stringify(response.data, null, 2)
      );
      logger.info(
        `handleAddShiftSubmit response alternative date fields for empId ${newEmployee.id}:`,
        {
          fromDate: response.data.newEmployeeShift?.fromDate,
          toDate: response.data.newEmployeeShift?.toDate,
          shiftFromDate: response.data.newEmployeeShift?.shiftFromDate,
          shiftToDate: response.data.newEmployeeShift?.shiftToDate,
        }
      );
      if (response.status !== HTTP_STATUS.CREATED) {
        throw new Error("Failed to add employee shift");
      }

      // Check if component is still mounted before updating state
      if (abortControllersRef.current) {
        // Invalidate cache for this specific guard and all guards
        invalidateCache(`guard-${newEmployee.id}`);
        invalidateCache("allGuards");
        await fetchGuards(true); // Force refresh to get latest data
        toast.success(`Shift added for ${sanitizeInput(newEmployee.name)}`);
        toggleAddModal();
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(
          error.response?.data?.message || "Failed to add employee shift"
        );
      }
    }
  };

  const handleSearch = (e) => debouncedSearch(e.target.value || "");

  const handleShiftFilter = (e) => {
    setShiftFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleDayFilter = (e) => {
    setDayFilter(e.target.value);
    setCurrentPage(1);
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const exportToCSV = useCallback(() => {
    if (guards.length === 0) {
      toast.warn("No guards available to export");
      return;
    }

    setIsExporting(true);

    try {
      const data = guards.map((guard) => ({
        "Employee ID": sanitizeCSVData(guard.id),
        Name: sanitizeCSVData(guard.name),
        "Mobile No": sanitizeCSVData(guard.mobileNo),
        Department: sanitizeCSVData(guard.department),
        Designation: sanitizeCSVData(guard.designation),
        Sunday: sanitizeCSVData(guard.weeklyShifts?.sunday),
        Monday: sanitizeCSVData(guard.weeklyShifts?.monday),
        Tuesday: sanitizeCSVData(guard.weeklyShifts?.tuesday),
        Wednesday: sanitizeCSVData(guard.weeklyShifts?.wednesday),
        Thursday: sanitizeCSVData(guard.weeklyShifts?.thursday),
        Friday: sanitizeCSVData(guard.weeklyShifts?.friday),
        Saturday: sanitizeCSVData(guard.weeklyShifts?.saturday),
        "Shift From Date": guard.shiftFromDate
          ? formatDateForAPI(guard.shiftFromDate)
          : "",
        "Shift To Date": guard.shiftToDate
          ? formatDateForAPI(guard.shiftToDate)
          : "",
      }));

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `security_roster_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Roster exported as CSV");
    } catch (error) {
      logger.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  }, [guards]);

  const filteredGuards = useMemo(() => {
    if (!guards.length) return [];

    const sanitizedSearchTerm = sanitizeInput(searchTerm).toLowerCase();
    const hasSearchTerm = sanitizedSearchTerm.length > 0;
    const hasShiftFilter = shiftFilter.length > 0;
    const isAllDays = dayFilter === "All Days";

    return guards.filter((guard) => {
      // Search filter
      if (hasSearchTerm) {
        const matchesSearch =
          guard.id?.toLowerCase()?.includes(sanitizedSearchTerm) ||
          guard.name?.toLowerCase()?.includes(sanitizedSearchTerm) ||
          guard.designation?.toLowerCase()?.includes(sanitizedSearchTerm);
        if (!matchesSearch) return false;
      }

      // Shift filter
      if (hasShiftFilter && guard.weeklyShifts) {
        if (isAllDays) {
          const matchesShift = Object.values(guard.weeklyShifts).some(
            (shift) => shift === shiftFilter
          );
          if (!matchesShift) return false;
        } else {
          const dayKey = dayFilter.toLowerCase();
          const matchesShift = guard.weeklyShifts[dayKey] === shiftFilter;
          if (!matchesShift) return false;
        }
      }

      return true;
    });
  }, [guards, searchTerm, shiftFilter, dayFilter]);

  const indexOfLastGuard = currentPage * GUARDS_PER_PAGE;
  const indexOfFirstGuard = indexOfLastGuard - GUARDS_PER_PAGE;
  const currentGuards = filteredGuards.slice(
    indexOfFirstGuard,
    indexOfLastGuard
  );
  const totalPages = Math.ceil(filteredGuards.length / GUARDS_PER_PAGE);

  return (
    <ErrorBoundary>
      <div className="security-roaster">
        <Row>
          <Col xs={12}>
            <Card>
              <CardBody>
                <CardTitle className="h4">Security Guard Roster</CardTitle>
                <p className="card-title-desc">
                  Manage security guard schedules and attendance
                </p>

                <div className="mb-3 d-flex justify-content-between align-items-center flex-wrap">
                  <div className="d-flex align-items-center flex-wrap gap-2">
                    <Input
                      type="text"
                      placeholder="Search by Employee ID, Name, or Designation"
                      onChange={handleSearch}
                      style={{ maxWidth: "300px" }}
                      aria-label="Search guards"
                      disabled={isLoading}
                    />
                    <select
                      value={dayFilter}
                      onChange={handleDayFilter}
                      className="form-select"
                      style={{ maxWidth: "200px" }}
                      aria-label="Filter by day"
                      disabled={isLoading}
                      role="combobox"
                      aria-expanded="false"
                    >
                      {DAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <select
                      value={shiftFilter}
                      onChange={handleShiftFilter}
                      className="form-select"
                      style={{ maxWidth: "200px" }}
                      aria-label="Filter by shift"
                      disabled={isLoading}
                      role="combobox"
                      aria-expanded="false"
                    >
                      <option value="">All Shifts</option>
                      {SHIFT_OPTIONS.map((shift) => (
                        <option key={shift} value={shift}>
                          {shift}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      color="success"
                      onClick={exportToCSV}
                      aria-label="Export roster as CSV"
                      disabled={isLoading || isExporting}
                    >
                      {isExporting ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          Exporting...
                        </>
                      ) : (
                        "Export as CSV"
                      )}
                    </Button>
                    <Button
                      color="primary"
                      onClick={toggleAddModal}
                      aria-label="Add new shift"
                      disabled={isLoading}
                    >
                      Add New Shift
                    </Button>
                    <BulkUploadRoster
                      apiUrl={API_URL}
                      existingEmpIds={guards.map((g) => g.id)}
                      disabled={isLoading}
                      onUploaded={() => {
                        // Refresh data; current filters/search/pagination state
                        // is preserved (it is applied on top of `guards`).
                        invalidateCache("allGuards");
                        fetchGuards(true);
                      }}
                    />
                  </div>
                </div>

                <GuardTable
                  guards={currentGuards}
                  openShiftChangeModal={openShiftChangeModal}
                  isLoading={debouncedLoading}
                />

                {filteredGuards.length > 0 &&
                  totalPages > 1 &&
                  !debouncedLoading && (
                    <Pagination className="mt-3" aria-label="Roster pagination">
                      <PaginationItem disabled={currentPage === 1}>
                        <PaginationLink
                          previous
                          onClick={() => paginate(currentPage - 1)}
                          aria-label="Previous page"
                          aria-disabled={currentPage === 1}
                        >
                          Previous
                        </PaginationLink>
                      </PaginationItem>
                      {[...Array(totalPages)].map((_, index) => (
                        <PaginationItem
                          key={index}
                          active={index + 1 === currentPage}
                        >
                          <PaginationLink
                            onClick={() => paginate(index + 1)}
                            aria-label={`Page ${index + 1}`}
                            aria-current={
                              index + 1 === currentPage ? "page" : undefined
                            }
                          >
                            {index + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem disabled={currentPage === totalPages}>
                        <PaginationLink
                          next
                          onClick={() => paginate(currentPage + 1)}
                          aria-label="Next page"
                          aria-disabled={currentPage === totalPages}
                        >
                          Next
                        </PaginationLink>
                      </PaginationItem>
                    </Pagination>
                  )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        <ErrorBoundary>
          <ShiftEditModal
            isOpen={modal}
            toggle={toggleModal}
            selectedGuard={selectedGuard}
            shiftFromDate={shiftFromDate}
            shiftToDate={shiftToDate}
            setShiftFromDate={setShiftFromDate}
            setShiftToDate={setShiftToDate}
            handleShiftSubmit={handleShiftSubmit}
            isModalLoading={isModalLoading}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <AddShiftModal
            isOpen={addModal}
            toggle={toggleAddModal}
            newEmployee={newEmployee}
            setNewEmployee={setNewEmployee}
            empIdInput={empIdInput}
            setEmpIdInput={setEmpIdInput}
            newShiftFromDate={newShiftFromDate}
            newShiftToDate={newShiftToDate}
            setNewShiftFromDate={setNewShiftFromDate}
            setNewShiftToDate={setNewShiftToDate}
            handleEmpIdSubmit={handleEmpIdSubmit}
            handleAddShiftSubmit={handleAddShiftSubmit}
            isModalLoading={isModalLoading}
          />
        </ErrorBoundary>

        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </ErrorBoundary>
  );
};

SecurityRoaster.propTypes = {
  setBreadcrumbItems: PropTypes.func.isRequired,
};

export default connect(null, { setBreadcrumbItems })(SecurityRoaster);
