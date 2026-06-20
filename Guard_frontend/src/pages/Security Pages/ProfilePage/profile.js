import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
} from "reactstrap";
import { ToastContainer, toast } from "react-toastify";
import { MDBDataTable } from "mdbreact";
import { Row, Col, Card, CardBody, CardTitle } from "reactstrap";
import { connect } from "react-redux";
import { setBreadcrumbItems } from "../../../store/actions";
import Papa from "papaparse";
import axios from "axios";
import { parse, format, isValid } from "date-fns";
import Loader from "components/Loader"; // Adjust the import path if necessary
import img from "./0000.jpg";
import { getEmpImageUrl, handleEmpImageError } from "helpers/empImage";

// Utility function to parse and format dates
const parseAndFormatDate = (dateStr, outputFormat = "dd-MM-yyyy") => {
  if (!dateStr || typeof dateStr !== "string") {
    console.warn(`Invalid date input: ${JSON.stringify(dateStr)}`);
    return "N/A";
  }

  const cleanedDateStr = dateStr.trim(); // Remove leading/trailing whitespace
  const formats = [
    "dd-MM-yyyy",
    "MM-dd-yyyy",
    "yyyy-MM-dd",
    "dd/MM/yyyy",
    "MM/dd/yyyy",
    "DD-MM-YYYY",
    "YYYY/MM/DD",
  ];

  for (const formatStr of formats) {
    try {
      const parsed = parse(cleanedDateStr, formatStr, new Date());
      if (isValid(parsed)) {
        console.debug(
          `Parsed "${cleanedDateStr}" with format "${formatStr}" to ${parsed}`
        );
        return format(parsed, outputFormat);
      }
    } catch (error) {
      console.debug(
        `Failed to parse "${cleanedDateStr}" with format "${formatStr}": ${error.message}`
      );
    }
  }

  // Fallback: Try parsing with new Date for ISO-like formats or other valid strings
  try {
    const parsed = new Date(cleanedDateStr);
    if (isValid(parsed)) {
      console.debug(`Parsed "${cleanedDateStr}" with new Date to ${parsed}`);
      return format(parsed, outputFormat);
    }
  } catch (error) {
    console.debug(
      `Failed to parse "${cleanedDateStr}" with new Date: ${error.message}`
    );
  }

  console.warn(
    `Failed to parse date: "${cleanedDateStr}" with formats: ${formats.join(
      ", "
    )}`
  );
  return "N/A";
};

// Test parseAndFormatDate with known input
console.log(
  `Test parseAndFormatDate("01-02-1974"): ${parseAndFormatDate("01-02-1974")}`
);

const Profile = (props) => {
  document.title = "Security Profile";

  const navigate = useNavigate();
  const [tableData, setTableData] = useState({ columns: [], rows: [] });
  const [filteredRows, setFilteredRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [existingEmpIds, setExistingEmpIds] = useState([]);
  const [viewModal, setViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [rawEmployees, setRawEmployees] = useState([]);

  const breadcrumbItems = useMemo(
    () => [
      { title: "Security", link: "#" },
      { title: "Profile", link: "#" },
      { title: "Security Profile", link: "#" },
    ],
    []
  );

  const baseURL = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    props.setBreadcrumbItems("Security Profile", breadcrumbItems);
  }, [breadcrumbItems, props]);

  useEffect(() => {
    const fetchExistingEmpIds = async () => {
      try {
        const res = await axios.get(`${baseURL}/emp/get-emp-details`);
        const ids = res.data
          .map((emp) => parseInt(emp.empId))
          .filter((id) => !isNaN(id));
        setExistingEmpIds(ids);
      } catch (err) {
        console.error("Error fetching existing empIds:", err);
        toast.error("Failed to fetch existing employee IDs", {
          position: "top-right",
          autoClose: 5000,
        });
      }
    };
    fetchExistingEmpIds();
  }, [baseURL]);

  const parseCSVDate = (dateStr) => {
    try {
      const formats = ["dd-MM-yyyy", "MM-dd-yyyy", "yyyy-MM-dd"];
      for (const formatStr of formats) {
        const parsed = parse(dateStr, formatStr, new Date());
        if (!isNaN(parsed)) return format(parsed, "yyyy-MM-dd");
      }
      return null;
    } catch {
      return null;
    }
  };

  const fetchEmployees = async (signal) => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}/emp/get-emp-details`, { signal });
      const employees = res.data;
      setRawEmployees(Array.isArray(employees) ? employees : []);

      // Log raw empDob and empDoj for debugging
      employees.forEach((emp) => {
        console.log(
          `Employee ID: ${emp.empId}, empDob: "${emp.empDob}", empDoj: "${emp.empDoj}"`
        );
      });

      const rows = employees.map((emp) => ({
        image: (
          <div className="text-center">
            <img
              src={getEmpImageUrl(emp)}
              alt={emp.empName || "Employee"}
              style={{
                width: "85px",
                height: "85px",
                objectFit: "contain",
                borderRadius: "50%",
                border: "1px solid #ccc",
                backgroundColor: "#fff",
                padding: "1px",
              }}
              onError={(e) => handleEmpImageError(e, img)}
            />
          </div>
        ),
        empId: emp.empId || "N/A",
        name: emp.empName || "N/A",
        department: emp.empDepartment || "N/A",
        designation: emp.empDesignation || "N/A",
        mobileNo: emp.empMobileNo || "N/A",
        dob: parseAndFormatDate(emp.empDob),
        doj: parseAndFormatDate(emp.empDoj),
        actions: (
          <div className="text-center">
            <Button
              color="primary"
              size="sm"
              className="me-1"
              onClick={() => navigate(`/employee-form/${emp.empId}`)}
              aria-label={`Edit employee ${emp.empName || "employee"}`}
            >
              Edit
            </Button>
            <Button
              color="danger"
              size="sm"
              onClick={() => {
                setSelectedEmpId(emp.empId);
                setDeleteModal(true);
              }}
              aria-label={`Delete employee ${emp.empName || "employee"}`}
            >
              Delete
            </Button>
          </div>
        ),
        viewDetails: (
          <div className="text-center">
            <Button
              color="info"
              size="sm"
              onClick={async () => {
                try {
                  const response = await axios.get(
                    `${baseURL}/emp/get-emp-byid/${emp.empId}`
                  );
                  // Log raw empDob and empDoj from the single employee endpoint
                  console.log(
                    `View Details for Emp ID: ${emp.empId}, ` +
                      `empDob: "${
                        response.data.empDob
                      }" (Parsed: ${parseAndFormatDate(
                        response.data.empDob
                      )}), ` +
                      `empDoj: "${
                        response.data.empDoj
                      }" (Parsed: ${parseAndFormatDate(response.data.empDoj)})`
                  );
                  setSelectedEmployee({
                    empId: response.data.empId || "N/A",
                    empName: response.data.empName || "N/A",
                    empDesignation: response.data.empDesignation || "N/A",
                    empDepartment: response.data.empDepartment || "N/A",
                    empMobileNo: response.data.empMobileNo || "N/A",
                    empAadharNo: response.data.empAadharNo || "N/A",
                    empPanNo: response.data.empPanNo || "N/A",
                    empDob: parseAndFormatDate(response.data.empDob),
                    empDoj: parseAndFormatDate(response.data.empDoj),
                    bankAccountNo: response.data.bankAccountNo || "N/A",
                    epfNo: response.data.epfNo || "N/A",
                    esiNo: response.data.esiNo || "N/A",
                    address: response.data.address || "N/A",
                  });
                  setViewModal(true);
                } catch (err) {
                  console.error("Error fetching employee details:", err);
                  toast.error("Failed to load employee details", {
                    position: "top-right",
                    autoClose: 3000,
                  });
                }
              }}
              aria-label={`View employee ${emp.empName || "employee"}`}
            >
              View
            </Button>
          </div>
        ),
      }));

      const columns = [
        { label: "Image", field: "image", sort: "asc" },
        { label: "Employee ID", field: "empId", sort: "asc" },
        { label: "Name", field: "name", sort: "asc" },
        { label: "Department", field: "department", sort: "asc" },
        { label: "Designation", field: "designation", sort: "asc" },
        { label: "Mobile", field: "mobileNo", sort: "asc" },
        { label: "DOJ", field: "doj", sort: "asc" },
        { label: "Actions", field: "actions", sort: "disabled" },
        { label: "View Details", field: "viewDetails", sort: "disabled" },
      ];

      setTableData({ columns, rows });
      setFilteredRows(rows);
      setCurrentPage(1);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Fetch Error:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch employee data.",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchEmployees(controller.signal);
    return () => controller.abort();
  }, [baseURL]);

  const validateCsvRow = (row, index) => {
    const errors = [];
    if (!row.empName || row.empName.length < 2 || row.empName.length > 50) {
      errors.push(`Row ${index + 1}: Employee Name must be 2-50 characters`);
    }
    if (
      !row.empDesignation ||
      row.empDesignation.length < 3 ||
      row.empDesignation.length > 50
    ) {
      errors.push(`Row ${index + 1}: Designation must be 3-50 characters`);
    }
    if (
      !row.empDepartment ||
      row.empDepartment.length < 2 ||
      row.empDepartment.length > 50
    ) {
      errors.push(`Row ${index + 1}: Department must be 2-50 characters`);
    }
    if (!row.empId || row.empId.length < 3 || row.empId.length > 10) {
      errors.push(`Row ${index + 1}: Employee ID must be 3-10 digits`);
    }
    if (!/^[0-9]+$/.test(row.empId)) {
      errors.push(`Row ${index + 1}: Employee ID must be numeric`);
    }
    if (existingEmpIds.includes(parseInt(row.empId))) {
      errors.push(`Row ${index + 1}: Employee ID ${row.empId} already exists`);
    }
    if (!row.empMobileNo || !/^[0-9]{10}$/.test(row.empMobileNo)) {
      errors.push(`Row ${index + 1}: Mobile No must be 10 digits`);
    }
    if (!row.empAadharNo || !/^\d{12}$/.test(row.empAadharNo)) {
      errors.push(`Row ${index + 1}: Aadhar No must be 12 digits`);
    }
    if (row.empPanNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(row.empPanNo)) {
      errors.push(
        `Row ${index + 1}: PAN No must be 5 letters, 4 digits, 1 letter`
      );
    }
    const dob = parseCSVDate(row.empDob);
    if (!dob) {
      errors.push(
        `Row ${
          index + 1
        }: Date of Birth must be a valid date (e.g., DD-MM-YYYY)`
      );
    }
    const doj = parseCSVDate(row.empDoj);
    if (!doj) {
      errors.push(
        `Row ${
          index + 1
        }: Date of Joining must be a valid date (e.g., DD-MM-YYYY)`
      );
    }
    if (!row.bankAccountNo || !/^\d{9,18}$/.test(row.bankAccountNo)) {
      errors.push(`Row ${index + 1}: Bank Account No must be 9-18 digits`);
    }
    if (row.epfNo && !/^[A-Z0-9]{0,22}$/.test(row.epfNo)) {
      errors.push(
        `Row ${index + 1}: EPF No must be up to 22 alphanumeric characters`
      );
    }
    if (row.esiNo && !/^[0-9]{0,17}$/.test(row.esiNo)) {
      errors.push(`Row ${index + 1}: ESI No must be up to 17 digits`);
    }
    if (!row.address || row.address.length < 5 || row.address.length > 200) {
      errors.push(`Row ${index + 1}: Address must be 5-200 characters`);
    }
    return { errors, parsedData: { ...row, empDob: dob, empDoj: doj } };
  };

  const handleCSVUpload = async (fileInput) => {
    const file = fileInput.files[0];
    if (!file) {
      toast.error("No file selected.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a valid CSV file.", {
        position: "top-right",
        autoClose: 3000,
      });
      fileInput.value = "";
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const employees = results.data;
        if (!Array.isArray(employees) || employees.length === 0) {
          toast.error("No valid employee data found in the CSV.", {
            position: "top-right",
            autoClose: 3000,
          });
          fileInput.value = "";
          return;
        }

        const requiredHeaders = [
          "empName",
          "empDesignation",
          "empDepartment",
          "empId",
          "empMobileNo",
          "empAadharNo",
          "empDob",
          "empDoj",
          "bankAccountNo",
          "address",
        ];
        const headers = Object.keys(employees[0] || {});
        const missingHeaders = requiredHeaders.filter(
          (h) => !headers.includes(h)
        );
        if (missingHeaders.length > 0) {
          toast.error(
            `Missing required headers: ${missingHeaders.join(", ")}`,
            {
              position: "top-right",
              autoClose: 3000,
            }
          );
          fileInput.value = "";
          return;
        }

        const errors = [];
        const validEmployees = [];

        employees.forEach((emp, index) => {
          const { errors: rowErrors, parsedData } = validateCsvRow(emp, index);
          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
          } else {
            validEmployees.push(parsedData);
          }
        });

        if (errors.length > 0) {
          errors.forEach((error) =>
            toast.error(error, {
              position: "top-right",
              autoClose: 5000,
            })
          );
          fileInput.value = "";
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        toast.info(`Processing ${validEmployees.length} employee(s)...`, {
          autoClose: false,
          toastId: "csv-upload",
        });

        try {
          for (const emp of validEmployees) {
            const formData = new FormData();
            formData.append("empName", emp.empName);
            formData.append("empDesignation", emp.empDesignation);
            formData.append("empDepartment", emp.empDepartment);
            formData.append("empId", String(emp.empId));
            formData.append("empMobileNo", emp.empMobileNo);
            formData.append("empAadharNo", emp.empAadharNo);
            formData.append("empPanNo", emp.empPanNo || "");
            formData.append("empDob", emp.empDob);
            formData.append("empDoj", emp.empDoj);
            formData.append("bankAccountNo", emp.bankAccountNo);
            formData.append("epfNo", emp.epfNo || "");
            formData.append("esiNo", emp.esiNo || "");
            formData.append("address", emp.address);

            try {
              console.log(`Sending employee: ${emp.empId}`);
              const response = await axios.post(
                `${baseURL}/emp/add-employee`,
                formData,
                {
                  headers: { "Content-Type": "multipart/form-data" },
                }
              );
              if (response.status === 201) {
                successCount++;
              } else {
                throw new Error("Unexpected response status");
              }
            } catch (error) {
              console.error(`Upload error for ID ${emp.empId}:`, error);
              toast.error(
                `Failed to upload ID ${emp.empId}: ${
                  error.response?.data?.message || error.message
                }`,
                {
                  position: "top-right",
                  autoClose: 5000,
                }
              );
              errorCount++;
            }
          }

          toast.update("csv-upload", {
            render: `CSV upload complete: ${successCount} succeeded, ${errorCount} failed.`,
            type: successCount > 0 ? "success" : "error",
            autoClose: 5000,
          });
          await fetchEmployees();
        } catch (error) {
          console.error("CSV Upload Error:", error);
          toast.update("csv-upload", {
            render: `Failed to process CSV: ${error.message}`,
            type: "error",
            autoClose: 5000,
          });
        } finally {
          fileInput.value = "";
        }
      },
      error: (error) => {
        toast.error("Failed to parse CSV file.", {
          position: "top-right",
          autoClose: 3000,
        });
        console.error("CSV Parse Error:", error);
        fileInput.value = "";
      },
    });
  };

  const downloadSampleCsv = () => {
    const sampleData = [
      {
        empName: "John Doe",
        empDesignation: "Security Officer",
        empDepartment: "Security",
        empId: "12345",
        empMobileNo: "1234567890",
        empAadharNo: "123456789012",
        empPanNo: "",
        empDob: "01-01-1990",
        empDoj: "01-01-2023",
        bankAccountNo: "123456789012",
        epfNo: "",
        esiNo: "",
        address: "123 Main Street, City, Country",
      },
    ];
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sample_employee.csv";
    link.click();
  };

  // Export the employee list to CSV. Respects the current search filter and
  // uses the same column layout as the sample CSV so it can be re-imported.
  const exportToCSV = () => {
    const term = searchTerm.trim().toLowerCase();
    const source = term
      ? rawEmployees.filter((e) =>
          [
            e.empId,
            e.empName,
            e.empDepartment,
            e.empDesignation,
            e.empMobileNo,
          ].some((v) => String(v ?? "").toLowerCase().includes(term))
        )
      : rawEmployees;

    if (!source.length) {
      toast.info("No employee data to export", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    const data = source.map((e) => ({
      empId: e.empId ?? "",
      empName: e.empName ?? "",
      empDepartment: e.empDepartment ?? "",
      empDesignation: e.empDesignation ?? "",
      empMobileNo: e.empMobileNo != null ? String(e.empMobileNo).split(".")[0] : "",
      empAadharNo: e.empAadharNo != null ? String(e.empAadharNo).split(".")[0] : "",
      empPanNo: e.empPanNo ?? "",
      empDob: parseAndFormatDate(e.empDob),
      empDoj: parseAndFormatDate(e.empDoj),
      bankAccountNo:
        e.bankAccountNo != null ? String(e.bankAccountNo).split(".")[0] : "",
      epfNo: e.epfNo ?? "",
      esiNo: e.esiNo ?? "",
      address: e.address ?? "",
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `employees_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`Exported ${data.length} employee record(s)`, {
      position: "top-right",
      autoClose: 3000,
    });
  };

  const filteredRowsMemo = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return tableData.rows.filter(
      (row) =>
        String(row.name).toLowerCase().includes(lowerSearch) ||
        String(row.empId).toLowerCase().includes(lowerSearch) ||
        String(row.department).toLowerCase().includes(lowerSearch) ||
        String(row.designation).toLowerCase().includes(lowerSearch) ||
        String(row.mobileNo).toLowerCase().includes(lowerSearch)
    );
  }, [searchTerm, tableData.rows]);

  useEffect(() => {
    setFilteredRows(filteredRowsMemo);
    setCurrentPage(1);
  }, [filteredRowsMemo]);

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredRows.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const totalEntries = filteredRows.length;

  const showingFrom = indexOfFirstRow + 1;
  const showingTo = Math.min(indexOfLastRow, totalEntries);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const pageNumbers = [];
  const maxPagesToShow = 8;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const confirmDelete = async () => {
    try {
      await axios.delete(`${baseURL}/emp/delete-emp-byid/${selectedEmpId}`);
      toast.success("Employee deleted successfully.", {
        position: "top-right",
        autoClose: 3000,
      });
      setDeleteModal(false);
      await fetchEmployees();
    } catch (err) {
      console.error("Delete Error:", err);
      toast.error(err.response?.data?.message || "Failed to delete employee.", {
        position: "top-right",
        autoClose: 3000,
      });
      setDeleteModal(false);
    }
  };

  return (
    <React.Fragment>
      <style>
        {`
          .table th, .table td {
            text-align: center;
            vertical-align: middle;
          }
          .employee-details-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .detail-item {
            display: flex;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .detail-item:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #343a40;
            width: 150px;
            flex-shrink: 0;
          }
          .detail-value {
            color: #495057;
            flex: 1;
            text-align: left;
            word-break: break-word;
          }
          .loader-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
        `}
      </style>
      {loading && (
        <div className="loader-overlay">
          <Loader />
        </div>
      )}
      <div className="d-flex justify-content-between align-items-center mb-3 w-100">
        <div className="d-flex gap-2">
          <Button
            color="primary"
            onClick={() => navigate("/employee-form")}
            disabled={loading}
          >
            Add Employee
          </Button>
          <Button
            color="success"
            onClick={() => document.getElementById("csvUpload").click()}
            disabled={loading}
          >
            Upload CSV
          </Button>
          <Button color="info" onClick={downloadSampleCsv} disabled={loading}>
            Download Sample CSV
          </Button>
          <Button
            color="secondary"
            onClick={exportToCSV}
            disabled={loading || rawEmployees.length === 0}
            aria-label="Export employee data as CSV"
          >
            <i className="mdi mdi-download me-1" />
            Export Data
          </Button>
          <input
            type="file"
            id="csvUpload"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => handleCSVUpload(e.target)}
            disabled={loading}
          />
        </div>
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by Name, ID, Department"
          style={{ width: "250px" }}
          aria-label="Search employees by name, ID, department, designation, or mobile"
          disabled={loading}
        />
      </div>

      <Row>
        <Col className="col-12">
          <Card>
            <CardBody>
              <CardTitle className="h4">Employee Details</CardTitle>
              {filteredRows.length === 0 && !loading ? (
                <p className="text-center text-muted">No employees found.</p>
              ) : (
                !loading && (
                  <>
                    <MDBDataTable
                      responsive
                      bordered
                      striped
                      noBottomColumns
                      searching={false}
                      paging={false}
                      data={{
                        columns: tableData.columns,
                        rows: currentRows,
                      }}
                    />
                    {totalEntries > 0 && (
                      <div className="d-flex justify-content-between align-items-center mt-3">
                        <div>
                          Showing {showingFrom} to {showingTo} of {totalEntries}{" "}
                          entries
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <span
                            onClick={() => paginate(1)}
                            style={{
                              cursor:
                                currentPage === 1 ? "not-allowed" : "pointer",
                              color: currentPage === 1 ? "#ccc" : "#000",
                              padding: "6px 12px",
                              borderRight: "1px solid #ddd",
                              borderRadius: "4px 0 0 4px",
                              backgroundColor:
                                currentPage === 1 ? "transparent" : "",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor =
                                currentPage === 1 ? "transparent" : "#f8f9fa")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor =
                                currentPage === 1 ? "transparent" : "")
                            }
                            aria-label="First page"
                          >
                            ≪
                          </span>
                          <span
                            onClick={() => paginate(currentPage - 1)}
                            style={{
                              cursor:
                                currentPage === 1 ? "not-allowed" : "pointer",
                              color: currentPage === 1 ? "#ccc" : "#000",
                              padding: "6px 12px",
                              borderRight: "1px solid #ddd",
                              backgroundColor:
                                currentPage === 1 ? "transparent" : "",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor =
                                currentPage === 1 ? "transparent" : "#f8f9fa")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor =
                                currentPage === 1 ? "transparent" : "")
                            }
                            aria-label="Previous page"
                          >
                            {"<"}
                          </span>
                          {pageNumbers.map((number) => (
                            <span
                              key={number}
                              onClick={() => paginate(number)}
                              style={{
                                cursor: "pointer",
                                padding: "6px 12px",
                                borderRight: "1px solid #ddd",
                                backgroundColor:
                                  currentPage === number
                                    ? "#6f42c1"
                                    : "transparent",
                                color: currentPage === number ? "#fff" : "#000",
                              }}
                              onMouseEnter={(e) =>
                                (e.target.style.backgroundColor =
                                  currentPage === number
                                    ? "#6f42c1"
                                    : "#f8f9fa")
                              }
                              onMouseLeave={(e) =>
                                (e.target.style.backgroundColor =
                                  currentPage === number
                                    ? "#6f42c1"
                                    : "transparent")
                              }
                              aria-label={`Page ${number}`}
                              aria-current={
                                currentPage === number ? "page" : undefined
                              }
                            >
                              {number}
                            </span>
                          ))}
                          <span
                            onClick={() => paginate(currentPage + 1)}
                            style={{
                              cursor:
                                currentPage === totalPages
                                  ? "not-allowed"
                                  : "pointer",
                              color:
                                currentPage === totalPages ? "#ccc" : "#000",
                              padding: "6px 12px",
                              borderRight: "1px solid #ddd",
                              backgroundColor:
                                currentPage === totalPages ? "transparent" : "",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor =
                                currentPage === totalPages
                                  ? "transparent"
                                  : "#f8f9fa")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor =
                                currentPage === totalPages ? "transparent" : "")
                            }
                            aria-label="Next page"
                          >
                            {">"}
                          </span>
                          <span
                            onClick={() => paginate(totalPages)}
                            style={{
                              cursor:
                                currentPage === totalPages
                                  ? "not-allowed"
                                  : "pointer",
                              color:
                                currentPage === totalPages ? "#ccc" : "#000",
                              padding: "6px 12px",
                              borderRadius: "0 4px 4px 0",
                              backgroundColor:
                                currentPage === totalPages ? "transparent" : "",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor =
                                currentPage === totalPages
                                  ? "transparent"
                                  : "#f8f9fa")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor =
                                currentPage === totalPages ? "transparent" : "")
                            }
                            aria-label="Last page"
                          >
                            ≫
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )
              )}
              <ToastContainer />
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Modal
        isOpen={deleteModal}
        toggle={() => setDeleteModal(false)}
        fade={true}
        centered
      >
        <ModalHeader
          toggle={() => setDeleteModal(false)}
          className="bg-danger text-white"
        >
          Confirm Deletion
        </ModalHeader>
        <ModalBody className="text-center">
          <div className="py-3">
            <i
              className="bi bi-exclamation-circle display-4 text-danger mb-3"
              style={{ animation: "bounce 0.6s infinite alternate" }}
            />
            <p className="fs-5">
              Are you sure you want to delete this employee?
            </p>
            <h5 className="text-danger mt-2">
              Employee ID: <span className="fw-bold">{selectedEmpId}</span>
            </h5>
            <p className="text-muted mt-2">This action cannot be undone.</p>
          </div>
        </ModalBody>
        <ModalFooter className="justify-content-center">
          <Button
            color="danger"
            onClick={confirmDelete}
            className="px-4"
            aria-label="Confirm delete"
          >
            Yes, Delete
          </Button>
          <Button
            color="secondary"
            onClick={() => setDeleteModal(false)}
            className="px-4"
            aria-label="Cancel delete"
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={viewModal}
        toggle={() => setViewModal(false)}
        fade={true}
        centered
        size="lg"
      >
        <ModalHeader
          toggle={() => setViewModal(false)}
          className="bg-info text-white"
        >
          Employee Details
        </ModalHeader>
        <ModalBody className="p-4">
          {selectedEmployee ? (
            <div className="employee-details-card">
              <div className="text-center mb-4">
                <img
                  src={getEmpImageUrl(selectedEmployee)}
                  alt={selectedEmployee.empName}
                  style={{
                    width: "120px",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "50%",
                    border: "2px solid skyblue",
                    marginBottom: "10px",
                  }}
                  onError={(e) => handleEmpImageError(e, img)}
                />
                <h4 className="mb-1">{selectedEmployee.empName}</h4>
                <p className="text-muted">{selectedEmployee.empDesignation}</p>
              </div>
              <Row className="gx-4">
                <Col md={6}>
                  <div className="detail-item">
                    <span className="detail-label">Employee ID:</span>
                    <span className="detail-value">
                      {selectedEmployee.empId}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Department:</span>
                    <span className="detail-value">
                      {selectedEmployee.empDepartment}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Mobile Number:</span>
                    <span className="detail-value">
                      {selectedEmployee.empMobileNo}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Aadhar Number:</span>
                    <span className="detail-value">
                      {selectedEmployee.empAadharNo}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">PAN Number:</span>
                    <span className="detail-value">
                      {selectedEmployee.empPanNo}
                    </span>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="detail-item">
                    <span className="detail-label">Date of Birth:</span>
                    <span className="detail-value">
                      {selectedEmployee.empDob}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Date of Joining:</span>
                    <span className="detail-value">
                      {selectedEmployee.empDoj}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Bank Account No:</span>
                    <span className="detail-value">
                      {selectedEmployee.bankAccountNo}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">EPF No:</span>
                    <span className="detail-value">
                      {selectedEmployee.epfNo}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">ESI No:</span>
                    <span className="detail-value">
                      {selectedEmployee.esiNo}
                    </span>
                  </div>
                </Col>
              </Row>
              <div className="detail-item mt-3">
                <span className="detail-label">Address:</span>
                <span className="detail-value">{selectedEmployee.address}</span>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted">
              Loading employee details...
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="secondary"
            onClick={() => setViewModal(false)}
            aria-label="Close modal"
          >
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};
export default connect(null, { setBreadcrumbItems })(Profile);
