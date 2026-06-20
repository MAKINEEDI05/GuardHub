import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  CardBody,
  FormGroup,
  Label,
  Input,
  Button,
} from "reactstrap";
import Select from "react-select";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/material_blue.css";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "components/Loader";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SHIFT_OPTIONS = ["General", "A Shift", "B Shift", "C Shift"].map((s) => ({
  value: s,
  label: s,
}));
const DURATION_OPTIONS = [
  "4 Hours (Half Day)",
  "8 Hours (Full Day)",
  "Double Shift",
].map((s) => ({ value: s, label: s }));

const EMPTY_FORM = {
  employeeId: "",
  currentShift: "",
  additionalShift: "",
  workingDuration: "",
  fromDate: "",
  toDate: "",
  location: "",
  reason: "",
  remarks: "",
};

const ApplyOTForm = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isValid, setIsValid] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${BASE_URL}/emp/get-emp-details`, {
          signal: controller.signal,
        });
        setEmployees(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          toast.error("Failed to load employees", { position: "top-right" });
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const employeeOptions = employees.map((e) => ({
    value: e.empId,
    label: `${e.empId} — ${e.empName || "Unknown"}`,
    emp: e,
  }));

  const handleChange = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const handleSelectEmployee = (option) => {
    if (!option) {
      setSelectedEmployee(null);
      handleChange("employeeId", "");
      return;
    }
    setSelectedEmployee(option.emp);
    handleChange("employeeId", option.value);
  };

  const validate = () => {
    const v = {
      employeeId: formData.employeeId !== "" && selectedEmployee !== null,
      currentShift: formData.currentShift !== "",
      additionalShift: formData.additionalShift !== "",
      workingDuration: formData.workingDuration !== "",
      fromDate: formData.fromDate !== "",
      toDate:
        formData.toDate !== "" &&
        new Date(formData.toDate) >= new Date(formData.fromDate),
      location: formData.location.trim() !== "",
      reason: formData.reason.trim() !== "",
    };
    setIsValid(v);
    return Object.values(v).every(Boolean);
  };

  const toISO = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fill all required fields correctly.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    // Only OT details are sent; employeeName/designation/department are
    // auto-filled on the backend from the employee master.
    const payload = {
      employeeId: parseInt(formData.employeeId, 10),
      currentShift: formData.currentShift,
      additionalShift: formData.additionalShift,
      workingDuration: formData.workingDuration,
      fromDate: toISO(formData.fromDate),
      toDate: toISO(formData.toDate),
      location: formData.location.trim(),
      reason: formData.reason.trim(),
      remarks: formData.remarks.trim(),
    };

    try {
      setSubmitting(true);
      await axios.post(`${BASE_URL}/ot/apply-ot`, payload);
      toast.success("OT applied successfully!", {
        position: "top-right",
        autoClose: 3000,
      });
      setFormData(EMPTY_FORM);
      setSelectedEmployee(null);
      setIsValid({});
    } catch (err) {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.message ||
        err.message ||
        "Failed to apply OT";
      toast.error(`Error: ${msg}`, { position: "top-right", autoClose: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  const invalidClass = (field) => (isValid[field] === false ? "is-invalid" : "");

  return (
    <Card>
      <CardBody>
        {loading && <Loader />}
        <form onSubmit={handleSubmit}>
          {/* Employee selection — details auto-filled from master data */}
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>
                  Employee <span className="text-danger">*</span>
                </Label>
                <Select
                  options={employeeOptions}
                  value={
                    employeeOptions.find(
                      (o) => String(o.value) === String(formData.employeeId)
                    ) || null
                  }
                  onChange={handleSelectEmployee}
                  isClearable
                  isDisabled={submitting}
                  placeholder="Search by ID or name…"
                  className={isValid.employeeId === false ? "is-invalid" : ""}
                />
                {isValid.employeeId === false && (
                  <div className="text-danger small mt-1">
                    Please select an employee
                  </div>
                )}
              </FormGroup>
            </Col>
          </Row>

          {selectedEmployee && (
            <Row className="mb-2">
              <Col md={4}>
                <FormGroup>
                  <Label>Employee Name</Label>
                  <Input value={selectedEmployee.empName || "—"} disabled />
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label>Designation</Label>
                  <Input
                    value={selectedEmployee.empDesignation || "—"}
                    disabled
                  />
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label>Department</Label>
                  <Input
                    value={selectedEmployee.empDepartment || "—"}
                    disabled
                  />
                </FormGroup>
              </Col>
            </Row>
          )}

          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>
                  Current Shift <span className="text-danger">*</span>
                </Label>
                <Select
                  options={SHIFT_OPTIONS}
                  value={
                    SHIFT_OPTIONS.find(
                      (o) => o.value === formData.currentShift
                    ) || null
                  }
                  onChange={(o) => handleChange("currentShift", o ? o.value : "")}
                  isDisabled={submitting}
                  placeholder="Select current shift"
                  className={isValid.currentShift === false ? "is-invalid" : ""}
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>
                  Additional Shift <span className="text-danger">*</span>
                </Label>
                <Select
                  options={SHIFT_OPTIONS}
                  value={
                    SHIFT_OPTIONS.find(
                      (o) => o.value === formData.additionalShift
                    ) || null
                  }
                  onChange={(o) =>
                    handleChange("additionalShift", o ? o.value : "")
                  }
                  isDisabled={submitting}
                  placeholder="Select additional shift"
                  className={
                    isValid.additionalShift === false ? "is-invalid" : ""
                  }
                />
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>
                  Working Duration <span className="text-danger">*</span>
                </Label>
                <Select
                  options={DURATION_OPTIONS}
                  value={
                    DURATION_OPTIONS.find(
                      (o) => o.value === formData.workingDuration
                    ) || null
                  }
                  onChange={(o) =>
                    handleChange("workingDuration", o ? o.value : "")
                  }
                  isDisabled={submitting}
                  placeholder="Select duration"
                  className={
                    isValid.workingDuration === false ? "is-invalid" : ""
                  }
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>
                  OT Location <span className="text-danger">*</span>
                </Label>
                <Input
                  type="text"
                  className={invalidClass("location")}
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g. Main Gate, Admin Block, Library"
                  maxLength="120"
                  disabled={submitting}
                />
                {isValid.location === false && (
                  <div className="invalid-feedback">Please enter OT location</div>
                )}
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>
                  From Date <span className="text-danger">*</span>
                </Label>
                <Flatpickr
                  className={`form-control ${invalidClass("fromDate")}`}
                  value={formData.fromDate}
                  onChange={(d) => handleChange("fromDate", d[0] || "")}
                  options={{ altInput: true, altFormat: "F j, Y", dateFormat: "Y-m-d" }}
                  placeholder="Select From Date"
                  disabled={submitting}
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>
                  To Date <span className="text-danger">*</span>
                </Label>
                <Flatpickr
                  className={`form-control ${invalidClass("toDate")}`}
                  value={formData.toDate}
                  onChange={(d) => handleChange("toDate", d[0] || "")}
                  options={{
                    altInput: true,
                    altFormat: "F j, Y",
                    dateFormat: "Y-m-d",
                    minDate: formData.fromDate,
                  }}
                  placeholder="Select To Date"
                  disabled={submitting}
                />
                {isValid.toDate === false && (
                  <div className="text-danger small mt-1">
                    To Date must be on or after From Date
                  </div>
                )}
              </FormGroup>
            </Col>
          </Row>

          <FormGroup>
            <Label>
              Reason <span className="text-danger">*</span>
            </Label>
            <Input
              type="textarea"
              rows="3"
              className={invalidClass("reason")}
              value={formData.reason}
              onChange={(e) => handleChange("reason", e.target.value)}
              maxLength="225"
              placeholder="Reason for overtime / double shift"
              disabled={submitting}
            />
            {isValid.reason === false && (
              <div className="invalid-feedback">Please enter a reason</div>
            )}
          </FormGroup>

          <FormGroup>
            <Label>Remarks (Optional)</Label>
            <Input
              type="textarea"
              rows="2"
              value={formData.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              maxLength="225"
              placeholder="Any additional remarks"
              disabled={submitting}
            />
          </FormGroup>

          <div className="d-flex justify-content-end">
            <Button type="submit" color="primary" disabled={submitting || loading}>
              {submitting ? "Submitting…" : "Submit OT Application"}
            </Button>
          </div>
        </form>
        <ToastContainer />
      </CardBody>
    </Card>
  );
};

export default ApplyOTForm;
