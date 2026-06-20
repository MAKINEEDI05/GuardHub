import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormGroup,
  Label,
  Row,
  Col,
  Card,
  CardBody,
  CardTitle,
  Input,
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

const LeaveManagement = () => {
  const today = new Date();
  const currentMonthEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ); // Last day of current month

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchEmpId, setSearchEmpId] = useState("");
  const [sortType, setSortType] = useState("all"); // "all", "Leave", "OD"
  const [dateRange, setDateRange] = useState({
    from: new Date(today.getFullYear(), today.getMonth(), 1), // First day of current month
    to: currentMonthEnd, // End of current month
  });
  const [dateRangeError, setDateRangeError] = useState("");
  const [reasonModal, setReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;

  // State for edit modal
  const [editModal, setEditModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editFormData, setEditFormData] = useState({
    empId: "",
    type: "",
    empLeaveType: "",
    empFromDate: null,
    empToDate: null,
    empShiftType: "",
    empOdType: "",
    empReason: "",
    odLocation: "",
  });

  // State for delete confirmation modal
  const [deleteModal, setDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState("");
  const [deleteEmpId, setDeleteEmpId] = useState("");

  // Static options for dropdowns
  const leaveOptions = [
    { label: "Casual Leave", value: "Casual Leave" },
    { label: "Sick Leave", value: "Sick Leave" },
    { label: "Earned Leave", value: "Earned Leave" },
  ];
  const shiftOptions = [
    { label: "Shift A", value: "Shift A" },
    { label: "Shift B", value: "Shift B" },
    { label: "Shift C", value: "Shift C" },
    { label: "general", value: "general" },
  ];
  const odTypeOptions = [
    { label: "FULL DAY", value: "FULL DAY" },
    { label: "FIRST HALF", value: "FIRST HALF" },
    { label: "SECOND HALF", value: "SECOND HALF" },
  ];

  // Format date to YYYY-MM-DD
  const formatDate = (date) => {
    if (!date) return "";
    const parsedDate = date instanceof Date ? date : new Date(date);
    return isNaN(parsedDate) ? "" : parsedDate.toISOString().split("T")[0];
  };

  // Fetch Leave and OD data
  const fetchEntries = async (from = dateRange.from, to = dateRange.to) => {
    try {
      setLoading(true);
      const fromDate = formatDate(from);
      const toDate = formatDate(to);

      const [leaveResponse, odResponse] = await Promise.all([
        axios.get(
          `${BASE_URL}/leave/get-month-wise-leaves?fromDate=${fromDate}&toDate=${toDate}`
        ),
        axios.get(
          `${BASE_URL}/od/get-ods?fromDate=${fromDate}&toDate=${toDate}`
        ),
      ]);

      // Handle leave response
      const leaves = Array.isArray(leaveResponse.data.data)
        ? leaveResponse.data.data
        : [];
      const mappedLeaves = leaves.map((item) => ({
        _id: item._id,
        empId: item.empId,
        type: "Leave",
        empLeaveType: item.empLeaveType || "",
        empFromDate: item.empFromDate,
        empToDate: item.empToDate,
        empShiftType: item.empShiftType || "",
        empOdType: item.empOdType || "",
        empReason: item.empReason || "",
        odLocation: "",
      }));

      // Handle OD response
      const ods = Array.isArray(odResponse.data.data)
        ? odResponse.data.data
        : [];
      const mappedOds = ods.map((item) => ({
        _id: item._id,
        empId: item.empId,
        type: "OD",
        empLeaveType: "",
        empFromDate: item.empFromDate,
        empToDate: item.empToDate,
        empShiftType: item.empShiftType || "",
        empOdType: item.empOdType || "",
        empReason: item.empPurpose || "",
        odLocation: item.odLocation || "Not Specified",
      }));

      const allEntries = [...mappedLeaves, ...mappedOds];
      setEntries(allEntries);
    } catch (error) {
      console.error("Error fetching data:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to fetch leave or OD details. Please try again later.";
      setError(errorMessage);
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Handle date range change
  const handleDateRangeChange = (name, date) => {
    setDateRange((prev) => {
      const newRange = { ...prev, [name]: date ? date[0] : null };

      // Validate date range
      if (newRange.from && newRange.to && newRange.to < newRange.from) {
        setDateRangeError("To Date must be on or after From Date");
      } else {
        setDateRangeError("");
        if (newRange.from && newRange.to) {
          fetchEntries(newRange.from, newRange.to);
        }
      }

      return newRange;
    });
  };

  // Clear date range
  const clearDateRange = () => {
    const defaultRange = {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0), // End of current month
    };
    setDateRange(defaultRange);
    setDateRangeError("");
    fetchEntries(defaultRange.from, defaultRange.to);
  };

  // Filter entries
  const filteredEntries = () => {
    let result = [...entries];

    // Filter by searchEmpId
    if (searchEmpId) {
      result = result.filter((entry) =>
        String(entry.empId).toLowerCase().includes(searchEmpId.toLowerCase())
      );
    }

    // Filter by type
    if (sortType !== "all") {
      result = result.filter((entry) => entry.type === sortType);
    }

    return result;
  };

  // Pagination
  const displayedEntries = filteredEntries();
  const totalEntries = displayedEntries.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage);
  const paginatedEntries = displayedEntries.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  // Open reason modal
  const handleViewReason = (reason) => {
    setSelectedReason(reason || "-");
    setReasonModal(true);
  };

  // Open edit modal
  const handleEdit = (entry) => {
    try {
      setSelectedEntry(entry);
      setEditFormData({
        empId: String(entry.empId || ""),
        type: entry.type || "",
        empLeaveType: entry.empLeaveType || "",
        empFromDate: entry.empFromDate ? new Date(entry.empFromDate) : null,
        empToDate: entry.empToDate ? new Date(entry.empToDate) : null,
        empShiftType: entry.empShiftType || "",
        empOdType: entry.empOdType || "",
        empReason: entry.empReason || "",
        odLocation: entry.odLocation || "",
      });
      setEditModal(true);
    } catch (error) {
      console.error("Error opening edit modal:", error);
      toast.error("Failed to open edit modal. Please try again.", {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  // Handle form changes
  const handleEditChange = (name, value) => {
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Validate edit form
  const validateEditForm = () => {
    const validation = {
      empId: editFormData.empId.trim() !== "",
      empLeaveType:
        editFormData.type === "Leave" ? editFormData.empLeaveType !== "" : true,
      empShiftType: editFormData.empShiftType !== "",
      empOdType: editFormData.empOdType !== "",
      empFromDate: editFormData.empFromDate !== null,
      empToDate:
        editFormData.empToDate !== null &&
        new Date(editFormData.empToDate) >= new Date(editFormData.empFromDate),
      odLocation:
        editFormData.type === "OD"
          ? (editFormData.odLocation || "").trim() !== ""
          : true,
      empReason: editFormData.empReason.trim().length >= 10,
    };
    return Object.values(validation).every((value) => value === true);
  };

  // Save edited entry
  const handleSaveEdit = async () => {
    if (!validateEditForm()) {
      toast.error("Please fill all required fields correctly.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    try {
      const payload = {
        empId: parseInt(editFormData.empId),
        empShiftType: editFormData.empShiftType,
        empOdType: editFormData.empOdType,
        empFromDate: formatDate(editFormData.empFromDate),
        empToDate: formatDate(editFormData.empToDate),
        ...(editFormData.type === "Leave"
          ? {
              empLeaveType: editFormData.empLeaveType,
              empReason: editFormData.empReason,
            }
          : {
              empPurpose: editFormData.empReason,
              odLocation: editFormData.odLocation,
            }),
      };

      const endpoint =
        editFormData.type === "Leave"
          ? `/leave/update-leave-byid/${selectedEntry._id}`
          : `/od/update-od-byid/${selectedEntry._id}`;
      const response = await axios.put(`${BASE_URL}${endpoint}`, payload);

      setEntries((prev) =>
        prev.map((entry) =>
          entry._id === selectedEntry._id
            ? {
                ...entry,
                ...payload,
                empReason: payload.empReason || payload.empPurpose,
                empLeaveType: payload.empLeaveType || "",
              }
            : entry
        )
      );

      toast.success(`${editFormData.type} updated successfully!`, {
        position: "top-right",
        autoClose: 3000,
      });
      setEditModal(false);
      await fetchEntries(); // Refresh data to ensure consistency
    } catch (error) {
      console.error("Error updating entry:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to update entry. Please try again.";
      toast.error(`Error: ${errorMessage}`, {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  // Confirm delete action
  const handleConfirmDelete = async () => {
    try {
      const endpoint =
        deleteType === "Leave"
          ? `/leave/delete-leave-byid/${entryToDelete}`
          : `/od/delete-od-byid/${entryToDelete}`;
      await axios.delete(`${BASE_URL}${endpoint}`);

      setEntries((prev) => prev.filter((entry) => entry._id !== entryToDelete));
      toast.success(`${deleteType} deleted successfully!`, {
        position: "top-right",
        autoClose: 3000,
      });
      setDeleteModal(false);
      setEntryToDelete(null);
      setDeleteType("");
      setDeleteEmpId("");
      await fetchEntries(); // Refresh data to ensure consistency
    } catch (error) {
      console.error("Error deleting entry:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to delete entry. Please try again.";
      toast.error(`Error: ${errorMessage}`, {
        position: "top-right",
        autoClose: 5000,
      });
    }
  };

  // Switch symbols as proper React components
  const OffSymbol = () => {
    return (
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
  };

  const OnSymbol = () => {
    return (
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
  };

  // Custom styles for react-select
  const selectStyles = (isValidField = true) => ({
    control: (provided) => ({
      ...provided,
      minHeight: "38px",
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

  return (
    <div>
      <ToastContainer />

      <Card>
        <StyledCardBody>
          <CardTitle className="h5">Leave and OD Management</CardTitle>

          {/* Search and Filter Controls */}
          <Row className="mb-3">
            <Col md={4}>
              <FormGroup>
                <Label>Search by Employee ID</Label>
                <Input
                  type="text"
                  value={searchEmpId}
                  onChange={(e) => setSearchEmpId(e.target.value)}
                  placeholder="Enter Employee ID"
                />
              </FormGroup>
            </Col>
            <Col md={3}>
              <FormGroup>
                <Label>Filter by Type</Label>
                <Select
                  value={[
                    { label: "All", value: "all" },
                    { label: "Leave", value: "Leave" },
                    { label: "OD", value: "OD" },
                  ].find((opt) => opt.value === sortType)}
                  onChange={(opt) => setSortType(opt.value)}
                  options={[
                    { label: "All", value: "all" },
                    { label: "Leave", value: "Leave" },
                    { label: "OD", value: "OD" },
                  ]}
                  styles={selectStyles()}
                />
              </FormGroup>
            </Col>
            <Col md={3}>
              <FormGroup>
                <Label>From Date</Label>
                <Flatpickr
                  value={dateRange.from}
                  onChange={(date) => handleDateRangeChange("from", date)}
                  options={{
                    altInput: true,
                    altFormat: "F j, Y",
                    dateFormat: "Y-m-d",
                    maxDate: dateRange.to || undefined,
                  }}
                  className={`form-control ${
                    dateRangeError ? "is-invalid" : ""
                  }`}
                  placeholder="Select From Date"
                />
                {dateRangeError && (
                  <div className="invalid-feedback">{dateRangeError}</div>
                )}
              </FormGroup>
            </Col>
            <Col md={2}>
              <FormGroup>
                <Label>To Date</Label>
                <Flatpickr
                  value={dateRange.to}
                  onChange={(date) => handleDateRangeChange("to", date)}
                  options={{
                    altInput: true,
                    altFormat: "F j, Y",
                    dateFormat: "Y-m-d",
                    minDate: dateRange.from || undefined,
                  }}
                  className={`form-control ${
                    dateRangeError ? "is-invalid" : ""
                  }`}
                  placeholder="Select To Date"
                />
              </FormGroup>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={12}>
              <Button
                color="secondary"
                size="sm"
                onClick={clearDateRange}
                disabled={!dateRange.from && !dateRange.to}
              >
                Clear Date Range
              </Button>
            </Col>
          </Row>

          {/* Showing X of X Entries */}
          {!loading && !error && (
            <p className="text-muted mb-2">
              Showing {paginatedEntries.length} of {totalEntries} entries
            </p>
          )}

          {/* Custom Loader */}
          {loading && (
            <div
              style={{
                position: "relative",
                minHeight: "200px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Loader size={20} color="#076fe5" withOverlay={true} />
            </div>
          )}

          {error && <p className="text-danger">{error}</p>}
          {!loading && !error && (
            <>
              <Table striped responsive>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Employee ID</th>
                    <th>Type</th>
                    <th>Leave Type</th>
                    <th>Reason</th>
                    <th>From Date</th>
                    <th>To Date</th>
                    <th>Shift Type</th>
                    <th>Duration</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.length > 0 ? (
                    paginatedEntries.map((entry) => (
                      <tr key={`${entry._id}-${entry.type}`}>
                        <td>
                          <img
                            src={getEmpImageUrl(entry)}
                            alt={`Employee ${entry.empId}`}
                            style={{
                              width: "50px",
                              height: "50px",
                              objectFit: "cover",
                              borderRadius: "50%",
                            }}
                            onError={(e) => handleEmpImageError(e)}
                          />
                        </td>
                        <td>{entry.empId}</td>
                        <td>{entry.type}</td>
                        <td>{entry.empLeaveType || "-"}</td>
                        <td>
                          <Button
                            color="primary"
                            size="sm"
                            onClick={() => handleViewReason(entry.empReason)}
                          >
                            View
                          </Button>
                        </td>
                        <td>{formatDate(entry.empFromDate)}</td>
                        <td>{formatDate(entry.empToDate)}</td>
                        <td>{entry.empShiftType || "-"}</td>
                        <td>{entry.empOdType || "-"}</td>
                        <td>
                          {entry.type === "OD"
                            ? entry.odLocation || "Not Specified"
                            : "—"}
                        </td>
                        <td>
                          <Button
                            color="warning"
                            size="sm"
                            onClick={() => handleEdit(entry)}
                            className="me-2"
                          >
                            Edit
                          </Button>
                          <Button
                            color="danger"
                            size="sm"
                            onClick={() => {
                              setEntryToDelete(entry._id);
                              setDeleteType(entry.type);
                              setDeleteEmpId(entry.empId);
                              setDeleteModal(true);
                            }}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="11" className="text-center">
                        No entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-3">
                  <Button
                    color="primary"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                    className="me-2"
                  >
                    Previous
                  </Button>
                  <span className="align-self-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    color="primary"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    className="ms-2"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </StyledCardBody>
      </Card>

      {/* Reason Modal */}
      <Modal isOpen={reasonModal} toggle={() => setReasonModal(false)}>
        <ModalHeader toggle={() => setReasonModal(false)}>Reason</ModalHeader>
        <ModalBody>
          <p>{selectedReason || "No reason provided."}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setReasonModal(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal} toggle={() => setEditModal(false)}>
        <ModalHeader toggle={() => setEditModal(false)}>
          Edit {editFormData.type} Entry
        </ModalHeader>
        <ModalBody>
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>Employee ID</Label>
                <Input type="text" value={editFormData.empId} disabled />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>Type</Label>
                <Input type="text" value={editFormData.type} disabled />
              </FormGroup>
            </Col>
          </Row>
          {editFormData.type === "Leave" && (
            <Row>
              <Col md={12}>
                <FormGroup>
                  <Label>Leave Type</Label>
                  <Select
                    value={leaveOptions.find(
                      (opt) => opt.value === editFormData.empLeaveType
                    )}
                    onChange={(opt) =>
                      handleEditChange("empLeaveType", opt ? opt.value : "")
                    }
                    options={leaveOptions}
                    placeholder="Select Leave Type"
                    styles={selectStyles(
                      editFormData.empLeaveType !== "" ||
                        editFormData.type !== "Leave"
                    )}
                    isClearable
                  />
                </FormGroup>
              </Col>
            </Row>
          )}
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>Shift Type</Label>
                <Select
                  value={shiftOptions.find(
                    (opt) => opt.value === editFormData.empShiftType
                  )}
                  onChange={(opt) =>
                    handleEditChange("empShiftType", opt ? opt.value : "")
                  }
                  options={shiftOptions}
                  placeholder="Select Shift"
                  styles={selectStyles(editFormData.empShiftType !== "")}
                  isClearable
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>Duration</Label>
                <Select
                  value={odTypeOptions.find(
                    (opt) => opt.value === editFormData.empOdType
                  )}
                  onChange={(opt) =>
                    handleEditChange("empOdType", opt ? opt.value : "")
                  }
                  options={odTypeOptions}
                  placeholder="Select Duration"
                  styles={selectStyles(editFormData.empOdType !== "")}
                  isClearable
                />
              </FormGroup>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>From Date</Label>
                <Flatpickr
                  value={editFormData.empFromDate}
                  onChange={(date) => handleEditChange("empFromDate", date[0])}
                  options={{
                    altInput: true,
                    altFormat: "F j, Y",
                    dateFormat: "Y-m-d",
                  }}
                  className={`form-control ${
                    editFormData.empFromDate ? "" : "is-invalid"
                  }`}
                  placeholder="Select From Date"
                />
                {!editFormData.empFromDate && (
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
                  value={editFormData.empToDate}
                  onChange={(date) => handleEditChange("empToDate", date[0])}
                  options={{
                    altInput: true,
                    altFormat: "F j, Y",
                    dateFormat: "Y-m-d",
                    minDate: editFormData.empFromDate,
                  }}
                  className={`form-control ${
                    editFormData.empToDate &&
                    new Date(editFormData.empToDate) >=
                      new Date(editFormData.empFromDate)
                      ? ""
                      : "is-invalid"
                  }`}
                  placeholder="Select To Date"
                />
                {!(
                  editFormData.empToDate &&
                  new Date(editFormData.empToDate) >=
                    new Date(editFormData.empFromDate)
                ) && (
                  <div className="invalid-feedback">
                    Please select a valid to date
                  </div>
                )}
              </FormGroup>
            </Col>
          </Row>
          {editFormData.type === "OD" && (
            <Row>
              <Col md={12}>
                <FormGroup>
                  <Label>
                    OD Location <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={editFormData.odLocation || ""}
                    onChange={(e) =>
                      handleEditChange("odLocation", e.target.value)
                    }
                    placeholder="Enter OD work location"
                    maxLength="120"
                    invalid={
                      editFormData.type === "OD" &&
                      (editFormData.odLocation || "").trim() === ""
                    }
                  />
                  <div className="invalid-feedback">
                    Please enter OD location
                  </div>
                </FormGroup>
              </Col>
            </Row>
          )}
          <FormGroup>
            <Label>Reason</Label>
            <Input
              type="textarea"
              value={editFormData.empReason}
              onChange={(e) => handleEditChange("empReason", e.target.value)}
              maxLength="225"
              placeholder="Enter reason (min 10 chars)"
              rows="3"
              className={
                editFormData.empReason.length >= 10 ? "" : "is-invalid"
              }
            />
            {editFormData.empReason.length < 10 && (
              <div className="invalid-feedback">
                Please provide a reason (minimum 10 characters)
              </div>
            )}
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={handleSaveEdit}>
            Save Changes
          </Button>{" "}
          <Button color="secondary" onClick={() => setEditModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModal} toggle={() => setDeleteModal(false)}>
        <ModalHeader toggle={() => setDeleteModal(false)}>
          Confirm Delete
        </ModalHeader>
        <ModalBody>
          <p>
            Are you sure you want to delete the entry with Employee ID:{" "}
            {deleteEmpId}? This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" onClick={handleConfirmDelete}>
            Confirm Delete
          </Button>{" "}
          <Button color="secondary" onClick={() => setDeleteModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

// Styled component for positioning
const StyledCardBody = styled(CardBody)`
  position: relative;
  minheight: 200px; /* Prevent layout shift */
`;

export default LeaveManagement;
