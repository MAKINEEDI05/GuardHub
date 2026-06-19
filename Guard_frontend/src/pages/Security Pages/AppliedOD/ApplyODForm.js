import React, { useState, useEffect } from "react";
import {
  FormGroup,
  Label,
  Button,
  Row,
  Col,
  Card,
  CardBody,
  CardTitle,
} from "reactstrap";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/material_blue.css";
import Select from "react-select";
import Switch from "react-switch";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styled from "styled-components";
import Loader from "components/Loader";
import { getEmpImageUrl, handleEmpImageError } from "helpers/empImage";

// Base URL for API endpoints
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const ApplyODForm = () => {
  const [formData, setFormData] = useState({
    empId: "",
    shiftType: "",
    odType: "",
    fromDate: "",
    toDate: "",
    reason: "",
    reasonCount: 0,
    emergency: false,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isValid, setIsValid] = useState({
    empId: null,
    shiftType: null,
    odType: null,
    fromDate: null,
    toDate: null,
    reason: null,
  });

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${BASE_URL}/emp/get-emp-details`, {
          signal: controller.signal,
        });
        console.log("Fetched employees:", response.data);
        setEmployees(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Error fetching employees:", error);
        const errorMessage =
          error.response?.data?.message ||
          "Failed to fetch employees. Please try again later.";
        setError(errorMessage);
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
    return () => controller.abort();
  }, []);

  const shiftOptions = [
    { label: "General", value: "General" },
    { label: "Shift A", value: "Shift A" },
    { label: "Shift B", value: "Shift B" },
    { label: "Shift C", value: "Shift C" },
    { label: "Summer Vacation", value: "Summer Vacation" },
  ];
  const odTypeOptions = [
    { label: "FULL DAY", value: "FULL DAY" },
    { label: "FIRST HALF", value: "FIRST HALF" },
    { label: "SECOND HALF", value: "SECOND HALF" },
  ];

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
    validateField(name, value);
  };

  const validateField = (name, value) => {
    let isFieldValid;
    switch (name) {
      case "empId":
        isFieldValid =
          value.trim() !== "" &&
          employees.some((emp) => String(emp.empId) === value);
        break;
      case "shiftType":
      case "odType":
        isFieldValid = value !== "" && value !== null;
        break;
      case "fromDate":
      case "toDate":
        isFieldValid = value !== "" && value !== null;
        break;
      case "reason":
        isFieldValid = value.trim().length >= 10;
        break;
      default:
        isFieldValid = true;
    }
    setIsValid((prev) => ({ ...prev, [name]: isFieldValid }));
  };

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    setFormData({ ...formData, empId: term });
    validateField("empId", term);
    setShowSuggestions(true);
  };

  useEffect(() => {
    const id = setTimeout(() => {
      const term = searchTerm.trim().toLowerCase();
      if (term === "") {
        setFilteredEmployees([]);
        setSelectedEmployee(null);
        setHighlightIndex(-1);
        return;
      }
      const filtered = employees.filter((emp) => {
        const empId = emp.empId != null ? String(emp.empId) : "";
        const empName = emp.empName || "";
        const empDesignation = emp.empDesignation || "";
        const empMobileNo =
          emp.empMobileNo != null ? String(emp.empMobileNo) : "";
        return (
          empId.toLowerCase().includes(term) ||
          empName.toLowerCase().includes(term) ||
          empDesignation.toLowerCase().includes(term) ||
          empMobileNo.toLowerCase().includes(term)
        );
      });
      setFilteredEmployees(filtered);
      setHighlightIndex(filtered.length > 0 ? 0 : -1);

      const exactMatch = employees.find((emp) => {
        const empId = emp.empId != null ? String(emp.empId) : "";
        return empId.toLowerCase() === term;
      });
      setSelectedEmployee(exactMatch || null);
    }, 200);
    return () => clearTimeout(id);
  }, [searchTerm, employees]);

  const handleSelectEmployee = (empId) => {
    const empIdStr = String(empId);
    setSearchTerm(empIdStr);
    setFormData({ ...formData, empId: empIdStr });
    validateField("empId", empIdStr);
    const employee = employees.find((emp) => String(emp.empId) === empIdStr);
    setSelectedEmployee(employee);
    setFilteredEmployees([]);
    setShowSuggestions(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredEmployees.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % filteredEmployees.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(
        (prev) =>
          (prev - 1 + filteredEmployees.length) % filteredEmployees.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const emp = filteredEmployees[highlightIndex];
      if (emp) handleSelectEmployee(emp.empId);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleReasonChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, reason: value, reasonCount: value.length });
    validateField("reason", value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = {
      empId: formData.empId.trim() !== "" && selectedEmployee !== null,
      shiftType: formData.shiftType !== "",
      odType: formData.odType !== "",
      fromDate: formData.fromDate !== "",
      toDate:
        formData.toDate !== "" &&
        new Date(formData.toDate) >= new Date(formData.fromDate),
      reason: formData.reason.trim().length >= 10,
    };

    setIsValid(validation);
    const isFormValid = Object.values(validation).every(
      (value) => value === true
    );

    if (!isFormValid) {
      console.log(
        "OD Form submission failed due to invalid fields:",
        validation
      );
      toast.error("Please fill all required fields correctly.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    const payload = {
      empId: parseInt(formData.empId),
      empShiftType: formData.shiftType,
      empOdType: formData.odType,
      empFromDate: formData.fromDate.toISOString().split("T")[0],
      empToDate: formData.toDate.toISOString().split("T")[0],
      empPurpose: formData.reason,
    };

    try {
      setSubmitting(true);
      const response = await axios.post(`${BASE_URL}/od/apply-od`, payload);
      console.log("Server response:", response.data);

      toast.success("OD applied successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      setFormData({
        empId: "",
        shiftType: "",
        odType: "",
        fromDate: "",
        toDate: "",
        reason: "",
        reasonCount: 0,
        emergency: false,
      });
      setSelectedEmployee(null);
      setSearchTerm("");
    } catch (error) {
      console.error("Error submitting OD:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Failed to apply OD";
      toast.error(`Error: ${errorMessage}`, {
        position: "top-right",
        autoClose: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const Offsymbol = () => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        fontSize: 12,
        color: "#fff",
        paddingRight: 2,
      }}
    >
      No
    </div>
  );

  const OnSymbol = () => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        fontSize: 12,
        color: "#fff",
        paddingRight: 2,
      }}
    >
      Yes
    </div>
  );

  const selectStyles = (isValidField) => ({
    control: (provided) => ({
      ...provided,
      borderColor: isValidField === false ? "#dc3545" : provided.borderColor,
      "&:hover": {
        borderColor: isValidField === false ? "#dc3545" : provided.borderColor,
      },
      boxShadow:
        isValidField === false
          ? "0 0 0 0.2rem rgba(220, 53, 69, 0.25)"
          : "none",
    }),
  });

  const getImageSrc = (emp) => {
    return getEmpImageUrl(emp);
  };

  return (
    <div>
      <ToastContainer />
      <Card className="mb-4">
        <StyledCardBody>
          <CardTitle className="h5 text-center">Employee Search</CardTitle>
          {loading && <Loader />}
          {error && <p className="text-danger text-center">{error}</p>}
          {!loading && (
            <Row className="justify-content-center">
              <Col md={6}>
                <FormGroup>
                  <Label>Employee ID</Label>
                  <div className="position-relative">
                    <input
                      type="text"
                      className={`form-control ${
                        isValid.empId === false ? "is-invalid" : ""
                      }`}
                      value={searchTerm}
                      onChange={handleSearch}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Enter Employee ID, Name, Designation, or Mobile"
                      disabled={loading || submitting}
                    />
                    {isValid.empId === false && (
                      <div className="invalid-feedback">
                        Please enter a valid Employee ID
                      </div>
                    )}
                    {showSuggestions &&
                      filteredEmployees.length > 0 &&
                      !loading && (
                        <ul
                          className="list-group position-absolute w-100"
                          style={{
                            zIndex: 1000,
                            maxHeight: "200px",
                            overflowY: "auto",
                          }}
                        >
                          {filteredEmployees.map((emp, idx) => (
                            <li
                              key={emp.empId}
                              className={`list-group-item list-group-item-action ${
                                idx === highlightIndex ? "active" : ""
                              }`}
                              onClick={() => handleSelectEmployee(emp.empId)}
                              style={{ cursor: "pointer" }}
                            >
                              {String(emp.empId)} - {emp.empName} (
                              {emp.empDesignation})
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                </FormGroup>
                {selectedEmployee && (
                  <div className="mt-3 text-center">
                    <p>
                      <strong>Name:</strong> {selectedEmployee.empName}
                    </p>
                    <p>
                      <strong>Phone:</strong> {selectedEmployee.empMobileNo}
                    </p>
                    <p>
                      <strong>Designation:</strong>{" "}
                      {selectedEmployee.empDesignation}
                    </p>
                  </div>
                )}
              </Col>
            </Row>
          )}
        </StyledCardBody>
      </Card>

      {selectedEmployee && (
        <Card>
          <StyledCardBody>
            <CardTitle className="h5">Apply OD</CardTitle>
            <Row className="mb-4">
              <Col md={12} className="text-center">
                <img
                  src={getImageSrc(selectedEmployee)}
                  alt={selectedEmployee.empName}
                  className="rounded-circle mb-2"
                  style={{
                    width: "100px",
                    height: "100px",
                    objectFit: "cover",
                  }}
                  onError={(e) => handleEmpImageError(e)}
                />
                <p>
                  <strong>Emp ID:</strong> {selectedEmployee.empId} |{" "}
                  <strong>Name:</strong> {selectedEmployee.empName}
                </p>
              </Col>
            </Row>
            <form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label>Employee Shift Type</Label>
                    <Select
                      value={
                        shiftOptions.find(
                          (option) => option.value === formData.shiftType
                        ) || ""
                      }
                      onChange={(option) =>
                        handleChange("shiftType", option ? option.value : "")
                      }
                      options={shiftOptions}
                      placeholder="Select Shift"
                      styles={selectStyles(isValid.shiftType)}
                      isDisabled={submitting}
                    />
                    {isValid.shiftType === false && (
                      <div className="invalid-feedback d-block">
                        Please select a shift type
                      </div>
                    )}
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup>
                    <Label>OD Duration</Label>
                    <Select
                      value={
                        odTypeOptions.find(
                          (option) => option.value === formData.odType
                        ) || ""
                      }
                      onChange={(option) =>
                        handleChange("odType", option ? option.value : "")
                      }
                      options={odTypeOptions}
                      placeholder="Select Duration"
                      styles={selectStyles(isValid.odType)}
                      isDisabled={submitting}
                    />
                    {isValid.odType === false && (
                      <div className="invalid-feedback d-block">
                        Please select a duration
                      </div>
                    )}
                  </FormGroup>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label>From Date</Label>
                    <Flatpickr
                      value={formData.fromDate}
                      onChange={(date) =>
                        handleChange("fromDate", date[0] || "")
                      }
                      options={{
                        altInput: true,
                        altFormat: "F j, Y",
                        dateFormat: "Y-m-d",
                      }}
                      className={`form-control ${
                        isValid.fromDate === false ? "is-invalid" : ""
                      }`}
                      placeholder="Select From Date"
                      disabled={submitting}
                    />
                    {isValid.fromDate === false && (
                      <div className="invalid-feedback">
                        Please select a from date
                      </div>
                    )}
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup>
                    <Label>To Date</Label>
                    <Flatpickr
                      value={formData.toDate}
                      onChange={(date) => handleChange("toDate", date[0] || "")}
                      options={{
                        altInput: true,
                        altFormat: "F j, Y",
                        dateFormat: "Y-m-d",
                        minDate: formData.fromDate,
                      }}
                      className={`form-control ${
                        isValid.toDate === false ? "is-invalid" : ""
                      }`}
                      placeholder="Select To Date"
                      disabled={submitting}
                    />
                    {isValid.toDate === false && (
                      <div className="invalid-feedback">
                        Please select a valid to date (after from date)
                      </div>
                    )}
                  </FormGroup>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label>Emergency OD?</Label>
                    <div>
                      <Switch
                        uncheckedIcon={<Offsymbol />}
                        checkedIcon={<OnSymbol />}
                        onColor="#02a499"
                        onChange={() =>
                          handleChange("emergency", !formData.emergency)
                        }
                        checked={formData.emergency}
                        disabled={submitting}
                      />
                    </div>
                  </FormGroup>
                </Col>
              </Row>
              <FormGroup>
                <Label>Reason</Label>
                <textarea
                  className={`form-control ${
                    isValid.reason === false ? "is-invalid" : ""
                  }`}
                  rows="3"
                  value={formData.reason}
                  onChange={handleReasonChange}
                  maxLength="225"
                  placeholder="Enter reason for OD (min 10 chars)"
                  disabled={submitting}
                />
                {isValid.reason === false && (
                  <div className="invalid-feedback">
                    Please provide a reason (minimum 10 characters)
                  </div>
                )}
                {formData.reasonCount > 0 && (
                  <span className="badge badge-success">
                    {formData.reasonCount} / 225
                  </span>
                )}
              </FormGroup>
              {submitting && <Loader />}
              <Button type="submit" color="primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          </StyledCardBody>
        </Card>
      )}
    </div>
  );
};

// Styled component for positioning
const StyledCardBody = styled(CardBody)`
  position: relative;
  min-height: 200px; /* Prevent layout shift */
`;

export default ApplyODForm;
