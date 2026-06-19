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
  ModalFooter,
  Button,
  Table,
} from "reactstrap";
import { connect } from "react-redux";
import { MDBDataTable } from "mdbreact";
import { setBreadcrumbItems } from "../../../store/actions";
import { toast, ToastContainer } from "react-toastify";
import axios from "axios";
import PropTypes from "prop-types";
import { debounce } from "lodash";
import Papa from "papaparse";
import DOMPurify from "dompurify";
import Loader from "components/Loader";
import { getEmpImageUrl, handleEmpImageError } from "helpers/empImage";
import Flatpickr from "react-flatpickr";
import "react-toastify/dist/ReactToastify.css";
import "flatpickr/dist/themes/material_blue.css";
import "./monthwisereport.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";

// Constants
const ENTRIES_PER_PAGE = 10;
const BREADCRUMB_ITEMS = [
  { title: "Security", link: "#" },
  { title: "Reports", link: "#" },
  { title: "Month Wise Report", link: "#" },
];
const API_URL = process.env.REACT_APP_API_BASE_URL;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  UNAUTHORIZED: 401,
  TOO_MANY_REQUESTS: 429,
};

// Utilities
const logger = {
  info: (message, data = null) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[INFO] ${message}`, data || '');
    }
  },
  error: (message, error = null) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[ERROR] ${message}`, error || '');
    }
  },
  warn: (message, data = null) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[WARN] ${message}`, data || '');
    }
  },
};

const sanitizeInput = (input) => {
  if (input == null) return "";
  if (typeof input !== "string") return String(input);
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

const sanitizeCSVData = (value) => {
  if (typeof value !== "string") return String(value || "");
  if (value.startsWith("=") || value.startsWith("+") || value.startsWith("-") || value.startsWith("@")) {
    return `\t${value}`;
  }
  return value;
};

const formatDateForAPI = (date) => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (date) => {
  if (!date) return null;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return formatDateForAPI(new Date(date));
};

const deduplicateEmployees = (employees) => {
  if (!Array.isArray(employees)) return [];
  const seen = new Set();
  return employees.filter((emp) => {
    const idStr = String(emp?.id ?? "");
    if (seen.has(idStr)) {
      logger.warn(`Duplicate employee ID found: ${idStr}, Name: ${emp?.name ?? "Unknown"}`);
      return false;
    }
    seen.add(idStr);
    return true;
  });
};

const countWeekOffDays = (startDate, endDate, weekOffDay) => {
  if (!weekOffDay) return 0;
  let count = 0;
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    if (currentDate.toLocaleString("en-US", { weekday: "long" }) === weekOffDay) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return count;
};

// Error Boundary
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

// MonthWiseTable Component
const MonthWiseTable = React.memo(({ employees, isLoading, navigateToChart }) => {
  const tableData = useMemo(
    () => ({
      columns: [
        { label: "ID", field: "id", sort: "asc", width: 100 },
        { label: "Name", field: "name", sort: "asc", width: 200 },
        { label: "Present Days", field: "present", sort: "asc", width: 120 },
        { label: "Absent Days", field: "absent", sort: "asc", width: 120 },
        { label: "Leave Days", field: "leaveDays", sort: "asc", width: 120 },
        { label: "Week Off", field: "weekOff", sort: "asc", width: 120 },
        { label: "Remaining CLs", field: "remainingCL", sort: "asc", width: 140 },
        { label: "OD", field: "od", sort: "asc", width: 100 },
        { label: "Actions", field: "actions", sort: "disabled", width: 120 },
      ],
      rows: (employees || []).map((employee) => ({
        id: employee.id || "N/A",
        name: sanitizeInput(employee.name) || "Unknown Employee",
        present: employee.present || 0,
        absent: employee.absent || 0,
        leaveDays: employee.leaveDays || 0,
        weekOff: employee.weekOff || 0,
        remainingCL: employee.remainingCL || 0,
        od: employee.od || 0,
        actions: (
          <Button
            className="btn btn-primary btn-sm"
            onClick={() => navigateToChart(employee.id, employee.name)}
            disabled={!employee.id || employee.id === "N/A"}
            aria-label={`View chart for ${sanitizeInput(employee.name) || "Unknown Employee"}`}
          >
            View Chart
          </Button>
        ),
      })),
    }),
    [employees, navigateToChart]
  );

  if (isLoading) {
    return (
      <div className="loading-overlay" aria-live="polite">
        <Loader />
        <span className="loading-text">Loading month-wise report...</span>
      </div>
    );
  }

  if ((employees || []).length === 0) {
    return <p className="text-center" aria-live="polite">No month-wise report data found</p>;
  }

  return (
    <div className="table-responsive">
      <MDBDataTable
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
      />
    </div>
  );
});

MonthWiseTable.propTypes = {
  employees: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
  navigateToChart: PropTypes.func.isRequired,
};

// Main Component
const MonthWiseReport = ({ setBreadcrumbItems }) => {
  document.title = "Month Wise Report";
  const navigate = useNavigate();
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState(currentMonthStart);
  const [toDate, setToDate] = useState(currentMonthEnd);
  const [modal, setModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [employeeDetailsCache, setEmployeeDetailsCache] = useState({});
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const abortControllersRef = useRef(new Map());
  const lastFetchTimeRef = useRef(0);

  // API retry logic
  const retry = async (fn, retries = MAX_RETRIES, delay = RETRY_DELAY) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (error.name === "AbortError") throw error;
        
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

  // Fetch employee details
  const fetchEmployeeDetails = useCallback(async () => {
    if (Object.keys(employeeDetailsCache).length > 0) return employeeDetailsCache;

    try {
      const controller = new AbortController();
      abortControllersRef.current.set("fetchEmployeeDetails", controller);

      const response = await retry(() =>
        axios.get(`${API_URL}/emp/get-emp-details`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
          signal: controller.signal,
        })
      );

      const employees = response.data.reduce((acc, emp) => {
        acc[emp.empId] = {
          name: sanitizeInput(emp.empName) || "N/A",
          phone: emp.empMobileNo ? String(emp.empMobileNo) : "N/A",
          designation: sanitizeInput(emp.empDesignation) || "N/A",
          aadharNo: emp.empAadharNo ? String(emp.empAadharNo) : "N/A",
          panNo: sanitizeInput(emp.empPanNo) || "N/A",
          dob: emp.empDob ? new Date(emp.empDob).toISOString().split("T")[0] : "N/A",
          doj: emp.empDoj || "N/A",
          image: emp.empImage || "N/A",
          department: sanitizeInput(emp.empDepartment) || "N/A",
          address: sanitizeInput(emp.address) || "N/A",
          bankAccountNo: emp.bankAccountNo ? String(emp.bankAccountNo) : "N/A",
          epfNo: emp.epfNo || "N/A",
          esiNo: emp.esiNo || "N/A",
          weekOff: emp.empWeekOff || "Sunday",
        };
        return acc;
      }, {});
      
      setEmployeeDetailsCache(employees);
      return employees;
    } catch (err) {
      if (err.name !== "AbortError") {
        logger.error("Error fetching employee details:", err);
        toast.error(`Failed to fetch employee details: ${err.message}`);
      }
      return {};
    } finally {
      abortControllersRef.current.delete("fetchEmployeeDetails");
    }
  }, [employeeDetailsCache]);

  // Fetch remaining CLs
  const fetchRemainingCLs = async (empId) => {
    try {
      const response = await axios.get(`${API_URL}/leaves/remaining-cl/${empId}`, {
        params: {
          startDate: formatDateForAPI(fromDate),
          endDate: formatDateForAPI(toDate),
        },
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
      });
      return response.data.remainingCL || 0;
    } catch (err) {
      logger.error(`Error fetching remaining CLs for empId ${empId}:`, err);
      return 0;
    }
  };

  // Fetch month-wise report
  const fetchMonthWiseReport = async (empId, startDate, endDate) => {
    try {
      const response = await axios.get(`${API_URL}/month/monthwise-report/${empId}`, {
        params: {
          startDate: formatDateForAPI(startDate),
          endDate: formatDateForAPI(endDate),
        },
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
      });

      const { combinedReport } = response.data;
      if (!combinedReport || typeof combinedReport !== "object") {
        return { present: 0, absent: 0, leaveDays: 0, od: 0 };
      }

      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;

      const isInRange = (year, month) =>
        (year > startYear || (year === startYear && month >= startMonth)) &&
        (year < endYear || (year === endYear && month <= endMonth));

      const sumByRange = (arr, field) =>
        (arr || []).reduce((sum, entry) => {
          if (isInRange(entry._id.year, entry._id.month)) {
            return sum + (entry[field] || 0);
          }
          return sum;
        }, 0);

      return {
        present: sumByRange(combinedReport.attendance, "present"),
        absent: sumByRange(combinedReport.attendance, "absent"),
        leaveDays: sumByRange(combinedReport.leaves, "totalLeaves"),
        od: sumByRange(combinedReport.ods, "totalOds"),
      };
    } catch (err) {
      logger.error(`Error in fetchMonthWiseReport for empId ${empId}:`, err);
      return { present: 0, absent: 0, leaveDays: 0, od: 0 };
    }
  };

  // Fetch employee data
  const fetchEmployeeData = useCallback(async () => {
    if (fromDate && toDate && fromDate > toDate) {
      setError("Invalid date range. 'From Date' cannot be after 'To Date'.");
      setAllEmployees([]);
      setFilteredRows([]);
      return;
    }

    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) {
      logger.info("Skipping fetch - too soon after last fetch");
      return;
    }
    lastFetchTimeRef.current = now;

    setIsLoading(true);
    setError(null);

    try {
      const employeeDetails = await fetchEmployeeDetails();
      const empIds = Object.keys(employeeDetails);
      
      if (empIds.length === 0) {
        setError("No employee data available.");
        setAllEmployees([]);
        setFilteredRows([]);
        return;
      }

      const employees = await Promise.all(
        empIds.map(async (empId) => {
          const [report, remainingCL] = await Promise.all([
            fetchMonthWiseReport(empId, fromDate, toDate),
            fetchRemainingCLs(empId),
          ]);
          
          const empDetails = employeeDetails[empId];
          return {
            id: empId,
            name: empDetails.name,
            present: report.present,
            absent: report.absent,
            leaveDays: report.leaveDays,
            weekOff: countWeekOffDays(fromDate, toDate, empDetails.weekOff),
            remainingCL,
            od: report.od,
          };
        })
      );
      
      const deduplicatedEmployees = deduplicateEmployees(employees);
      setAllEmployees(deduplicatedEmployees);
      setFilteredRows(deduplicatedEmployees);
    } catch (err) {
      if (err.name !== "AbortError") {
        logger.error("Error in fetchEmployeeData:", err);
        toast.error(`Failed to fetch employee data: ${err.message}`);
        setAllEmployees([]);
        setFilteredRows([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, fetchEmployeeDetails]);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((value) => setSearchQuery(sanitizeInput(value)), 300),
    []
  );

  // Apply search filter
  const applySearchFilter = useCallback(() => {
    const query = searchQuery.toLowerCase().trim();
    if (query === "") {
      setFilteredRows(allEmployees);
    } else {
      const filtered = allEmployees.filter(
        (emp) =>
          emp.name.toLowerCase().includes(query) ||
          emp.id.toString().includes(query)
      );
      setFilteredRows(filtered);
    }
    setCurrentPage(1);
  }, [searchQuery, allEmployees]);

  // Effects
  useEffect(() => {
    setBreadcrumbItems("Month Wise Report", BREADCRUMB_ITEMS);
    return () => {
      debouncedSearch.cancel();
      abortControllersRef.current.forEach((controller) => {
        if (controller && !controller.signal.aborted) {
          controller.abort();
        }
      });
      abortControllersRef.current.clear();
    };
  }, [setBreadcrumbItems, debouncedSearch]);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchEmployeeData();
    } else {
      setAllEmployees([]);
      setFilteredRows([]);
      setError(null);
    }
  }, [fromDate, toDate, fetchEmployeeData]);

  useEffect(() => {
    applySearchFilter();
  }, [searchQuery, allEmployees, applySearchFilter]);

  // Handlers
  const handleSearch = (e) => debouncedSearch(e.target.value || "");

  const handleFromDateChange = (date) => {
    setFromDate(date[0]);
    setError(null);
  };

  const handleToDateChange = (date) => {
    setToDate(date[0]);
    setError(null);
  };

  const toggleModal = useCallback(() => {
    setModal((prev) => {
      if (!prev) {
        setSelectedEmployee(null);
        setIsModalLoading(false);
      }
      return !prev;
    });
  }, []);

  const openEmployeeModal = useCallback(
    async (empId) => {
      if (!empId || empId === "N/A") {
        toast.error("Invalid employee ID");
        return;
      }

      try {
        setIsModalLoading(true);
        const employeeDetails = await fetchEmployeeDetails();
        const employee = employeeDetails[empId];
        
        if (employee) {
          setSelectedEmployee({
            empId,
            empName: employee.name,
            empDesignation: employee.designation,
            empMobileNo: employee.phone,
            empAadharNo: employee.aadharNo,
            empPanNo: employee.panNo,
            empDob: employee.dob,
            empDoj: employee.doj,
            empImage: employee.image,
            empDepartment: employee.department,
            empAddress: employee.address,
            empBankAccountNo: employee.bankAccountNo,
            empEpfNo: employee.epfNo,
            empEsiNo: employee.esiNo,
          });
        } else {
          setSelectedEmployee(null);
        }
        setModal(true);
      } catch (err) {
        logger.error("Modal Fetch Error:", err);
        setSelectedEmployee(null);
        setModal(true);
      } finally {
        setIsModalLoading(false);
      }
    },
    [fetchEmployeeDetails]
  );

  const navigateToChart = useCallback(
    (empId, empName) => {
      navigate("/month-wise-chart", {
        state: { empId, empName, fromDate, toDate, searchQuery, allEmployees, filteredRows },
      });
    },
    [navigate, fromDate, toDate, searchQuery, allEmployees, filteredRows]
  );

  const exportToCSV = useCallback(() => {
    if (allEmployees.length === 0) {
      toast.warn("No month-wise report data available to export");
      return;
    }

    setIsExporting(true);

    try {
      const dataToDownload = filteredRows.length > 0 ? filteredRows : allEmployees;
      const data = dataToDownload.map((employee) => ({
        "Employee ID": sanitizeCSVData(employee.id),
        Name: sanitizeCSVData(employee.name),
        "Present Days": sanitizeCSVData(employee.present),
        "Absent Days": sanitizeCSVData(employee.absent),
        "Leave Days": sanitizeCSVData(employee.leaveDays),
        "Week Off": sanitizeCSVData(employee.weekOff),
        "Remaining CLs": sanitizeCSVData(employee.remainingCL),
        OD: sanitizeCSVData(employee.od),
        "From Date": formatDate(fromDate) || "Unknown",
        "To Date": formatDate(toDate) || "Unknown",
      }));

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `month_wise_report_${formatDate(fromDate)}_to_${formatDate(toDate)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Report exported as CSV");
    } catch (error) {
      logger.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  }, [allEmployees, filteredRows, fromDate, toDate]);

  const exportToPDF = useCallback(() => {
    if (allEmployees.length === 0) {
      toast.warn("No month-wise report data available to export");
      return;
    }

    setIsExporting(true);

    try {
      const dataToDownload = filteredRows.length > 0 ? filteredRows : allEmployees;
      const headers = ["ID", "Name", "Present Days", "Absent Days", "Leave Days", "Week Off", "Remaining CLs", "OD"];
      const csvData = [
        headers,
        ...dataToDownload.map((row) => [
          sanitizeCSVData(row.id),
          sanitizeCSVData(row.name),
          sanitizeCSVData(row.present),
          sanitizeCSVData(row.absent),
          sanitizeCSVData(row.leaveDays),
          sanitizeCSVData(row.weekOff),
          sanitizeCSVData(row.remainingCL),
          sanitizeCSVData(row.od),
        ]),
      ];

      const doc = new jsPDF();
      autoTable(doc, {
        head: [csvData[0]],
        body: csvData.slice(1),
        startY: 20,
      });
      doc.save(`month_wise_report_${formatDate(fromDate)}_to_${formatDate(toDate)}.pdf`);
      toast.success("Report exported as PDF");
    } catch (err) {
      logger.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsExporting(false);
    }
  }, [allEmployees, filteredRows, fromDate, toDate]);

  // Pagination
  const isInvalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  const totalItems = filteredRows.length;
  const totalPages = Math.ceil(totalItems / ENTRIES_PER_PAGE);
  const startIndex = (currentPage - 1) * ENTRIES_PER_PAGE;
  const endIndex = Math.min(startIndex + ENTRIES_PER_PAGE, totalItems);
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <ErrorBoundary>
      <div className="month-wise-report">
        <Row>
          <Col xs={12}>
            <Card>
              <CardBody>
                <CardTitle className="h4">Month Wise Reportuuu</CardTitle>
                <p className="card-title-desc">
                  View attendance summary for employees within a date range
                </p>

                <div className="mb-3 d-flex justify-content-between align-items-center flex-wrap">
                  <div className="d-flex align-items-center flex-wrap gap-2">
                    <Input
                      type="text"
                      placeholder="Search by Employee ID or Name"
                      onChange={handleSearch}
                      style={{ maxWidth: "300px" }}
                      disabled={isLoading}
                    />
                    <Flatpickr
                      className="form-control"
                      value={fromDate}
                      onChange={handleFromDateChange}
                      options={{
                        altInput: true,
                        altFormat: "F j, Y",
                        dateFormat: "Y-m-d",
                        allowInput: true,
                      }}
                      placeholder="From Date"
                      style={{ maxWidth: "200px" }}
                    />
                    <Flatpickr
                      className="form-control"
                      value={toDate}
                      onChange={handleToDateChange}
                      options={{
                        altInput: true,
                        altFormat: "F j, Y",
                        dateFormat: "Y-m-d",
                        allowInput: true,
                      }}
                      placeholder="To Date"
                      style={{ maxWidth: "200px" }}
                    />
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      color="success"
                      onClick={exportToCSV}
                      disabled={isLoading || isExporting}
                    >
                      {isExporting ? "Exporting..." : "Export as CSV"}
                    </Button>
                    <Button
                      color="info"
                      onClick={exportToPDF}
                      disabled={isLoading || isExporting}
                    >
                      {isExporting ? "Exporting..." : "Export as PDF"}
                    </Button>
                  </div>
                </div>

                {isInvalidRange && (
                  <div className="text-danger small mb-2">
                    From Date cannot be after To Date.
                  </div>
                )}

                <MonthWiseTable
                  employees={paginatedRows}
                  isLoading={isLoading}
                  navigateToChart={navigateToChart}
                />

                {filteredRows.length > 0 && totalPages > 1 && !isLoading && (
                  <Pagination className="mt-3">
                    <PaginationItem disabled={currentPage === 1}>
                      <PaginationLink previous onClick={() => paginate(currentPage - 1)} />
                    </PaginationItem>
                    {[...Array(totalPages)].map((_, index) => (
                      <PaginationItem key={index} active={index + 1 === currentPage}>
                        <PaginationLink onClick={() => paginate(index + 1)}>
                          {index + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem disabled={currentPage === totalPages}>
                      <PaginationLink next onClick={() => paginate(currentPage + 1)} />
                    </PaginationItem>
                  </Pagination>
                )}

                {error && (
                  <div className="text-center py-4 text-danger" role="alert">
                    {error}
                  </div>
                )}

                {!fromDate && !isLoading && (
                  <div className="text-center py-4 text-muted">
                    Please select a date range to view records.
                  </div>
                )}

                {fromDate && toDate && allEmployees.length === 0 && !isLoading && !error && (
                  <div className="text-center py-4 text-muted">
                    No records found for the selected date range.
                  </div>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        <Modal isOpen={modal} toggle={toggleModal} centered size="lg">
          <ModalHeader toggle={toggleModal}>Employee Full Details</ModalHeader>
          <ModalBody>
            {isModalLoading ? (
              <div className="loading-overlay">
                <Loader />
                <span className="loading-text">Loading employee details...</span>
              </div>
            ) : selectedEmployee ? (
              <>
                <div className="text-center mb-3">
                  <img
                    src={getEmpImageUrl(selectedEmployee)}
                    alt={selectedEmployee.empName || "Employee"}
                    style={{
                      width: "85px",
                      height: "85px",
                      objectFit: "contain",
                      borderRadius: "40px",
                      border: "1px solid #ccc",
                      backgroundColor: "#fff",
                      padding: "5px",
                    }}
                    onError={(e) => handleEmpImageError(e)}
                  />
                </div>
                <Table className="table table-bordered">
                  <tbody>
                    <tr>
                      <td><strong>ID</strong></td>
                      <td>{selectedEmployee.empId || "N/A"}</td>
                      <td><strong>Name</strong></td>
                      <td>{sanitizeInput(selectedEmployee.empName) || "N/A"}</td>
                    </tr>
                    <tr>
                      <td><strong>Designation</strong></td>
                      <td>{sanitizeInput(selectedEmployee.empDesignation) || "N/A"}</td>
                      <td><strong>Department</strong></td>
                      <td>{sanitizeInput(selectedEmployee.empDepartment) || "N/A"}</td>
                    </tr>
                    <tr>
                      <td><strong>Mobile No</strong></td>
                      <td>{selectedEmployee.empMobileNo || "N/A"}</td>
                      <td><strong>Aadhar No</strong></td>
                      <td>{selectedEmployee.empAadharNo || "N/A"}</td>
                    </tr>
                    <tr>
                      <td><strong>PAN No</strong></td>
                      <td>{sanitizeInput(selectedEmployee.empPanNo) || "N/A"}</td>
                      <td><strong>Date of Joining</strong></td>
                      <td>
                        {selectedEmployee.empDoj !== "N/A"
                          ? new Date(selectedEmployee.empDoj).toLocaleDateString()
                          : "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Date of Birth</strong></td>
                      <td>
                        {selectedEmployee.empDob !== "N/A"
                          ? new Date(selectedEmployee.empDob).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td><strong>ESI No</strong></td>
                      <td>{selectedEmployee.empEsiNo || "N/A"}</td>
                    </tr>
                    <tr>
                      <td><strong>Bank Account No</strong></td>
                      <td>{selectedEmployee.empBankAccountNo || "N/A"}</td>
                      <td><strong>EPF No</strong></td>
                      <td>{selectedEmployee.empEpfNo || "N/A"}</td>
                    </tr>
                    <tr>
                      <td colSpan={4}>
                        <strong>Address: </strong>
                        {sanitizeInput(selectedEmployee.empAddress) || "N/A"}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </>
            ) : (
              <p className="text-center text-muted">Employee details not found</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={toggleModal}>
              Close
            </Button>
          </ModalFooter>
        </Modal>

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

MonthWiseReport.propTypes = {
  setBreadcrumbItems: PropTypes.func.isRequired,
};

export default connect(null, { setBreadcrumbItems })(MonthWiseReport);