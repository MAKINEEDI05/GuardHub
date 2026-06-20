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
  FormGroup,
  Label,
  InputGroup,
  Table,
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
import Loader from "components/Loader";
import Flatpickr from "react-flatpickr";
import "react-toastify/dist/ReactToastify.css";
import "flatpickr/dist/themes/material_blue.css";
import "./daywisereport.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import { getEmpImageUrl, handleEmpImageError } from "helpers/empImage";

// Constants for shift and week off options, API settings
const SHIFT_OPTIONS = ["General", "Shift-A", "Shift-B", "Shift-C"];
const WEEK_OFF_OPTIONS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MODE_OPTIONS = ["Update", "Add"];
const ENTRIES_PER_PAGE = 10;
const BREADCRUMB_ITEMS = [
  { title: "Security", link: "#" },
  { title: "Reports", link: "#" },
  { title: "Day Wise Report", link: "#" },
];
const API_URL = process.env.REACT_APP_API_BASE_URL;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Attendance status is stored with inconsistent casing/synonyms across the
// biometric (cron) path ("present"/"N/A"/"On Leave") and the manual path
// ("Present"/"Absent"/"Leave"). Normalise for display so the column is reliable.
const normalizeAction = (action) => {
  if (!action) return "--";
  const a = String(action).trim().toLowerCase();
  if (a === "present") return "Present";
  if (a === "absent" || a === "n/a") return "Absent";
  if (a === "leave" || a === "on leave") return "Leave";
  if (a === "week off" || a === "weekoff") return "Week Off";
  if (a === "od") return "OD";
  return action;
};

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
      // console.log(`[INFO] ${message}`, data || '');
    }
  },
  error: (message, error = null) => {
    if (process.env.NODE_ENV === "development") {
      // console.error(`[ERROR] ${message}`, error || '');
    }
  },
  warn: (message, data = null) => {
    if (process.env.NODE_ENV === "development") {
      // console.warn(`[WARN] ${message}`, data || '');
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
  const date = new Date(cleanedDate);
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

  let dateStr;
  if (typeof dateString === "string") {
    dateStr = dateString;
  } else if (dateString instanceof Date) {
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

// AttendanceTable component to display the attendance table with employee details
const AttendanceTable = React.memo(
  ({ employees, openEmployeeModal, isLoading }) => {
    const tableData = useMemo(
      () => ({
        columns: [
          {
            label: "ID",
            field: "id",
            sort: "asc",
            width: 100,
            attributes: { className: "id", "aria-label": "Employee ID" },
          },
          {
            label: "Name",
            field: "name",
            sort: "asc",
            width: 200,
            attributes: { className: "name" },
          },
          {
            label: "Phone",
            field: "phone",
            sort: "asc",
            width: 150,
            attributes: { className: "phone" },
          },
          {
            label: "Shift",
            field: "shift",
            sort: "asc",
            width: 120,
            attributes: { className: "shift" },
          },
          // {
          //   label: "Week Off",
          //   field: "weekOff",
          //   sort: "asc",
          //   width: 120,
          //   attributes: { className: "weekOff" },
          // },
          {
            label: "In Time",
            field: "inTime",
            sort: "asc",
            width: 120,
            attributes: { className: "inTime" },
          },
          {
            label: "Out Time",
            field: "outTime",
            sort: "asc",
            width: 120,
            attributes: { className: "outTime" },
          },
          {
            label: "Action",
            field: "action",
            sort: "asc",
            width: 120,
            attributes: { className: "action" },
          },
          {
            label: "Details",
            field: "details",
            sort: "disabled",
            width: 120,
            attributes: { className: "details" },
          },
        ],
        rows: employees.map((employee) => ({
          id: employee.id || "N/A",
          name: sanitizeInput(employee.name) || "Unknown Employee",
          phone: sanitizeInput(employee.phone) || "N/A",
          shift: sanitizeInput(employee.shift) || "General",
          weekOff: sanitizeInput(employee.weekOff) || "Sunday",
          inTime: employee.inTime || "--",
          outTime: employee.outTime || "--",
          action: employee.action || "--",
          details: (
            <Button
              className="btn btn-primary btn-sm"
              onClick={() => openEmployeeModal(employee.id)}
              disabled={!employee.id || employee.id === "N/A"}
              aria-label={`View details for ${
                sanitizeInput(employee.name) || "Unknown Employee"
              }`}
            >
              View
            </Button>
          ),
        })),
      }),
      [employees, openEmployeeModal]
    );

    return (
      <div className="table-container">
        {isLoading ? (
          <div className="loading-overlay" aria-live="polite">
            <Loader />
            <span className="loading-text">Loading attendance records...</span>
          </div>
        ) : employees.length === 0 ? (
          <p className="text-center" aria-live="polite">
            No attendance records found
          </p>
        ) : (
          <div className="table-responsive">
            <MDBDataTable
              key={employees.map((e) => e.id).join("-")}
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
              aria-label="Day Wise Attendance Report Table"
            />
          </div>
        )}
      </div>
    );
  }
);

AttendanceTable.propTypes = {
  employees: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      phone: PropTypes.string,
      shift: PropTypes.string,
      weekOff: PropTypes.string,
      inTime: PropTypes.string,
      outTime: PropTypes.string,
      action: PropTypes.string,
    })
  ).isRequired,
  openEmployeeModal: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

const DayWiseReport = ({ setBreadcrumbItems }) => {
  document.title = "Day Wise Report";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState("All");
  const [modal, setModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("pdf");
  const entries = ENTRIES_PER_PAGE; // Fixed to 10 entries per page
  const [currentPage, setCurrentPage] = useState(1);
  const [employeeDetailsCache, setEmployeeDetailsCache] = useState({});
  const [formData, setFormData] = useState({
    empId: "",
    date: new Date(),
    inTime: "00:00",
    outTime: "00:00",
    shift: "General",
    empWeekOff: "Sunday",
    mode: "Update",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [employeeBasicDetails, setEmployeeBasicDetails] = useState(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [debouncedLoading, setDebouncedLoading] = useState(false);
  const debouncedLoadingTimeoutRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const inTimeRef = useRef(null);
  const outTimeRef = useRef(null);
  const navigate = useNavigate();

  const abortControllersRef = useRef(new Map());
  const lastFetchTimeRef = useRef(0);

  const debouncedSearch = useMemo(
    () => debounce((value) => setSearchQuery(sanitizeInput(value)), 300),
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

  useEffect(() => {
    setBreadcrumbItems("Day Wise Report", BREADCRUMB_ITEMS);
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
    };
  }, [setBreadcrumbItems, debouncedSearch]);

  const formatDate = (date) => {
    if (!date) return null;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
      return date;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchEmployeeDetails = useCallback(async () => {
    try {
      if (Object.keys(employeeDetailsCache).length > 0)
        return employeeDetailsCache;

      const controllerId = "fetchEmployeeDetails";
      const controller = new AbortController();
      abortControllersRef.current.set(controllerId, controller);

      const response = await retry(() =>
        axios.get(`${API_URL}/emp/get-emp-details`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
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
          dob: emp.empDob
            ? new Date(emp.empDob).toISOString().split("T")[0]
            : "N/A",
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
        const errorMessage = `Failed to fetch employee details: ${err.message}`;
        setError(errorMessage);
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 3000,
        });
      }
      return {};
    } finally {
      abortControllersRef.current.delete("fetchEmployeeDetails");
    }
  }, [employeeDetailsCache]);

  const fetchAttendanceData = useCallback(
    async (date, shift) => {
      if (!date) {
        const errorMessage = "Please select a date.";
        setError(errorMessage);
        toast.warning(errorMessage, {
          position: "top-right",
          autoClose: 3000,
        });
        setIsLoading(false);
        return [];
      }

      const now = Date.now();
      // Avoid rapid successive calls
      if (now - lastFetchTimeRef.current < 1000) {
        logger.info("Skipping fetch - too soon after last fetch");
        return [];
      }
      lastFetchTimeRef.current = now;

      setIsLoading(true);
      setDebouncedLoading(true);
      setError(null);

      const controllerId = "fetchAttendanceData";
      const controller = new AbortController();
      abortControllersRef.current.set(controllerId, controller);

      try {
        const employeeDetails = await fetchEmployeeDetails();
        const dateStr = formatDate(date);
        logger.info(
          "Fetching data for date:",
          dateStr,
          "shift:",
          shift,
          "raw date input:",
          date
        );

        const response = await retry(() =>
          axios.get(`${API_URL}/attendance/get-attendace-bydate/${dateStr}`, {
            headers: {
              Authorization: `Bearer ${
                localStorage.getItem("authToken") || ""
              }`,
            },
            signal: controller.signal,
          })
        );
        logger.info(
          "Full API response:",
          JSON.stringify(response.data, null, 2)
        );

        let attendanceRecords = response.data.data || response.data || [];
        if (!Array.isArray(attendanceRecords)) {
          logger.warn("Attendance records is not an array:", attendanceRecords);
          attendanceRecords = [];
        }

        if (shift !== "All") {
          attendanceRecords = attendanceRecords.filter(
            (record) => record.empShift === shift
          );
        }

        logger.info("Filtered attendanceRecords:", attendanceRecords);

        const employees = attendanceRecords.map((record) => {
          const empDetails = employeeDetails[record.empId] || {
            name: `Unknown Employee ${record.empId}`,
            phone: "N/A",
            designation: "N/A",
            aadharNo: "N/A",
            panNo: "N/A",
            dob: "N/A",
            doj: "N/A",
            image: "N/A",
          };

          return {
            id: record.empId,
            name: empDetails.name,
            phone: empDetails.phone,
            shift: record.empShift || "General",
            weekOff: record.empWeekOff || "Sunday",
            inTime: record.empInTime || "--",
            outTime: record.empOutTime || "--",
            action: normalizeAction(record.empAction),
          };
        });

        logger.info("Mapped employees:", employees);
        setAllEmployees(employees);
        return employees;
      } catch (err) {
        if (err.name !== "AbortError") {
          const errorMessage = err.response
            ? `Failed to fetch data for date ${formatDate(date)}: ${
                err.response.status
              } - ${err.response.data.message || err.message}`
            : `Failed to fetch data for date ${formatDate(date)}: ${
                err.message
              }`;
          setError(errorMessage);
          logger.error("Fetch Error:", err.response || err);
          toast.error(errorMessage, {
            position: "top-right",
            autoClose: 5000,
          });
          setAllEmployees([]);
        }
        return [];
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
    [fetchEmployeeDetails]
  );

  useEffect(() => {
    logger.info(
      "useEffect triggered with selectedDate:",
      formatDate(selectedDate),
      "raw selectedDate:",
      selectedDate,
      "selectedShift:",
      selectedShift
    );
    if (selectedDate) {
      const fetchData = async () => {
        const employees = await fetchAttendanceData(
          selectedDate,
          selectedShift
        );
        logger.info("Employees after fetch:", employees);
        applySearchFilter(employees);
      };
      fetchData();
    } else {
      setAllEmployees([]);
      setFilteredRows([]);
      setError(null);
    }
  }, [selectedDate, selectedShift]);

  const applySearchFilter = useCallback(
    (employees) => {
      const query = searchQuery.toLowerCase().trim();
      if (query === "") {
        setFilteredRows(employees);
      } else {
        const filtered = employees.filter(
          (emp) =>
            emp.name.toLowerCase().includes(query) ||
            emp.id.toString().includes(query)
        );
        setFilteredRows(filtered);
      }
      setCurrentPage(1); // Reset to first page when filter changes
    },
    [searchQuery]
  );

  useEffect(() => {
    applySearchFilter(allEmployees);
  }, [searchQuery, allEmployees, applySearchFilter]);

  const handleSearch = (e) => debouncedSearch(e.target.value || "");

  const handleDateChange = (date) => {
    logger.info("Date Selected:", date[0], "Formatted:", formatDate(date[0]));
    setSelectedDate(date[0]);
    setError(null);
  };

  const handleShiftChange = (e) => {
    logger.info("Shift Selected:", e.target.value);
    setSelectedShift(e.target.value);
    setError(null);
  };

  const toggleModal = useCallback(() => {
    setModal((prev) => {
      if (!prev) {
        // Opening modal - reset state
        setSelectedEmployee(null);
        setIsModalLoading(false);
      }
      return !prev;
    });
  }, []);

  const toggleAddModal = useCallback(() => {
    setAddModal((prev) => {
      if (!prev) {
        // Opening modal - reset state
        setFormData({
          empId: "",
          date: new Date(),
          inTime: "00:00",
          outTime: "00:00",
          shift: "General",
          empWeekOff: "Sunday",
          mode: "Update",
        });
        setEmployeeBasicDetails(null);
        setFormError("");
        setFormSuccess("");
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

  const fetchAttendanceForUpdate = useCallback(
    async (empId, date) => {
      try {
        const dateStr = formatDate(date);
        logger.info("Fetching attendance for update:", {
          empId,
          dateStr,
          rawDate: date,
        });

        const controllerId = `fetchAttendanceForUpdate-${empId}`;
        const controller = new AbortController();
        abortControllersRef.current.set(controllerId, controller);

        const response = await retry(() =>
          axios.get(`${API_URL}/attendance/get-attendace-bydate/${dateStr}`, {
            headers: {
              Authorization: `Bearer ${
                localStorage.getItem("authToken") || ""
              }`,
            },
            signal: controller.signal,
          })
        );
        logger.info(
          "Update API response:",
          JSON.stringify(response.data, null, 2)
        );

        let attendanceRecords = response.data.data || response.data || [];
        if (!Array.isArray(attendanceRecords)) {
          logger.warn("Attendance records is not an array:", attendanceRecords);
          attendanceRecords = [];
        }

        const records = attendanceRecords.filter(
          (rec) => rec.empId === parseInt(formData.empId)
        );
        if (records.length > 1) {
          setFormError(
            "Multiple attendance records found for this employee on the selected date. Please resolve duplicates."
          );
          setFormData((prev) => ({
            ...prev,
            inTime: records[0].empInTime || "00:00",
            outTime: records[0].empOutTime || "00:00",
            shift: records[0].empShift || "General",
          }));
          return false;
        } else if (records.length === 1) {
          setFormData((prev) => ({
            ...prev,
            inTime: records[0].empInTime || "00:00",
            outTime: records[0].empOutTime || "00:00",
            shift: records[0].empShift || "General",
          }));
          setFormError("");
          return true;
        } else {
          setFormError(
            "No attendance record found for this employee on the selected date. Please add a record first."
          );
          setFormData((prev) => ({
            ...prev,
            inTime: "00:00",
            outTime: "00:00",
            shift: "General",
          }));
          return false;
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          logger.error("Error fetching attendance for update:", err);
          setFormError(`Failed to fetch attendance data: ${err.message}`);
          setFormData((prev) => ({
            ...prev,
            inTime: "00:00",
            outTime: "00:00",
            shift: "General",
          }));
        }
        return false;
      } finally {
        abortControllersRef.current.delete(`fetchAttendanceForUpdate-${empId}`);
      }
    },
    [formData.empId]
  );

  const handleFormChange = useCallback(
    async (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: sanitizeInput(value) }));

      if (name === "empId" && value) {
        try {
          const employeeDetails = await fetchEmployeeDetails();
          const employee = employeeDetails[value];
          if (employee) {
            setEmployeeBasicDetails({
              empId: value,
              name: employee.name,
              designation: employee.designation,
              weekOff: employee.weekOff,
              image: employee.image,
            });
            setFormData((prev) => ({ ...prev, empWeekOff: employee.weekOff }));
            setFormError("");
          } else {
            setEmployeeBasicDetails(null);
            setFormError("Employee ID not found.");
          }
        } catch (err) {
          logger.error("Error fetching employee details for form:", err);
          setEmployeeBasicDetails(null);
          setFormError("Failed to fetch employee details.");
        }
      }

      if (name === "mode") {
        if (value === "Update" && formData.empId && formData.date) {
          await fetchAttendanceForUpdate(formData.empId, formData.date);
        } else if (value === "Add") {
          setFormData((prev) => ({
            ...prev,
            inTime: "00:00",
            outTime: "00:00",
            shift: "General",
          }));
          setFormError("");
        }
      }
    },
    [
      fetchEmployeeDetails,
      fetchAttendanceForUpdate,
      formData.empId,
      formData.date,
    ]
  );

  const handleTimeChange = useCallback((e, field) => {
    const { value, selectionStart } = e.target;
    let newValue = value.replace(/[^0-9]/g, "").slice(0, 4);
    let formattedValue = "";

    if (newValue.length >= 1 && parseInt(newValue[0]) > 2) {
      newValue = "2" + newValue.slice(1);
    }
    if (newValue.length >= 2) {
      const hours = parseInt(newValue.slice(0, 2));
      if (hours > 23) newValue = "23" + newValue.slice(2);
    }
    if (newValue.length >= 3 && parseInt(newValue[2]) > 5) {
      newValue = newValue.slice(0, 2) + "5" + newValue.slice(3);
    }

    if (newValue.length > 2) {
      formattedValue = newValue.slice(0, 2) + ":" + newValue.slice(2);
      if (newValue.length === 4 && selectionStart === 2) {
        e.target.selectionStart = 3;
        e.target.selectionEnd = 3;
      } else if (newValue.length === 4) {
        e.target.selectionStart = 5;
        e.target.selectionEnd = 5;
      }
    } else {
      formattedValue = newValue;
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
  }, []);

  const handleFormDateChange = useCallback(
    async (date) => {
      setFormData((prev) => ({ ...prev, date: date[0] }));
      if (formData.mode === "Update" && formData.empId) {
        await fetchAttendanceForUpdate(formData.empId, date[0]);
      }
    },
    [formData.mode, formData.empId, fetchAttendanceForUpdate]
  );

  const handleFormSubmit = useCallback(async () => {
    setFormError("");
    setFormSuccess("");

    if (!formData.empId || isNaN(formData.empId)) {
      setFormError("Employee ID must be a valid number.");
      return;
    }
    if (!formData.date) {
      setFormError("Date is required.");
      return;
    }
    if (!formData.inTime || !/^\d{2}:\d{2}$/.test(formData.inTime)) {
      setFormError("Valid In Time (HH:MM) is required.");
      return;
    }
    if (!formData.outTime || !/^\d{2}:\d{2}$/.test(formData.outTime)) {
      setFormError("Valid Out Time (HH:MM) is required.");
      return;
    }
    if (!formData.shift) {
      setFormError("Shift is required.");
      return;
    }
    if (formData.mode === "Add" && !formData.empWeekOff) {
      setFormError("Week Off is required for Add mode.");
      return;
    }

    const convertTo24Hour = (time) => {
      if (time.includes("AM") || time.includes("PM")) {
        const [timePart, period] = time.split(" ");
        let [hours, minutes] = timePart.split(":").map(Number);
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}`;
      }
      return time;
    };

    if (formData.mode === "Update") {
      const canUpdate = await fetchAttendanceForUpdate(
        formData.empId,
        formData.date
      );
      if (!canUpdate) {
        return;
      }
    }

    const payload = {
      empId: parseInt(formData.empId),
      empDate: formatDate(formData.date),
      empInTime: convertTo24Hour(formData.inTime),
      empOutTime: convertTo24Hour(formData.outTime),
      empShift: formData.shift,
      empWeekOff: formData.empWeekOff,
      empAction: "Present",
    };

    try {
      if (formData.mode === "Add") {
        logger.info("Adding attendance with payload:", payload);
        const response = await retry(() =>
          axios.post(`${API_URL}/attendance/add-attendace`, payload, {
            headers: {
              Authorization: `Bearer ${
                localStorage.getItem("authToken") || ""
              }`,
            },
          })
        );
        logger.info("Attendance added:", response.data);
        setFormSuccess("Attendance added successfully!");
        toast.success("Attendance added successfully!", {
          position: "top-right",
          autoClose: 3000,
        });
      } else {
        const updatePayload = {
          empDate: formatDate(formData.date),
          empInTime: convertTo24Hour(formData.inTime),
          empOutTime: convertTo24Hour(formData.outTime),
          empShift: formData.shift,
        };
        logger.info("Updating attendance with payload:", updatePayload);
        const response = await retry(() =>
          axios.put(
            `${API_URL}/attendance/update-attendace-byid/${formData.empId}`,
            updatePayload,
            {
              headers: {
                Authorization: `Bearer ${
                  localStorage.getItem("authToken") || ""
                }`,
              },
            }
          )
        );
        logger.info("Attendance updated:", response.data);
        setFormSuccess("Attendance updated successfully!");
        toast.success("Attendance updated successfully!", {
          position: "top-right",
          autoClose: 3000,
        });
      }

      if (formatDate(formData.date) === formatDate(selectedDate)) {
        const employees = await fetchAttendanceData(
          selectedDate,
          selectedShift
        );
        applySearchFilter(employees);
      }

      setTimeout(() => {
        toggleAddModal();
      }, 1000);
    } catch (err) {
      if (err.name !== "AbortError") {
        logger.error(
          `Error ${
            formData.mode === "Add" ? "adding" : "updating"
          } attendance:`,
          err
        );
        logger.error("Error response:", err.response);
        const errorMessage =
          err.response?.data?.message ||
          err.response?.statusText ||
          err.message ||
          "Unknown error occurred";
        const fullErrorMessage = `Failed to ${
          formData.mode === "Add" ? "add" : "update"
        } attendance: ${errorMessage} (Status: ${
          err.response?.status || "N/A"
        })`;
        setFormError(fullErrorMessage);
        toast.error(fullErrorMessage, {
          position: "top-right",
          autoClose: 5000,
        });
      }
    }
  }, [
    formData,
    fetchAttendanceForUpdate,
    selectedDate,
    selectedShift,
    fetchAttendanceData,
    applySearchFilter,
    toggleAddModal,
  ]);

  const exportToCSV = useCallback(() => {
    if (allEmployees.length === 0) {
      toast.warn("No attendance records available to export");
      return;
    }

    setIsExporting(true);

    try {
      const dataToDownload =
        filteredRows.length > 0 ? filteredRows : allEmployees;
      const data = dataToDownload.map((employee) => ({
        "Employee ID": sanitizeCSVData(employee.id),
        Name: sanitizeCSVData(employee.name),
        Phone: sanitizeCSVData(employee.phone),
        Shift: sanitizeCSVData(employee.shift),
        "Week Off": sanitizeCSVData(employee.weekOff),
        "In Time": sanitizeCSVData(employee.inTime),
        "Out Time": sanitizeCSVData(employee.outTime),
        Action: sanitizeCSVData(employee.action),
        Date: formatDate(selectedDate) || "Unknown",
      }));

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `day_wise_report_${
          formatDate(selectedDate) || new Date().toISOString().split("T")[0]
        }.csv`
      );
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
  }, [allEmployees, filteredRows, selectedDate]);

  const exportToPDF = useCallback(() => {
    if (allEmployees.length === 0) {
      toast.warn("No attendance records available to export");
      return;
    }

    setIsExporting(true);

    try {
      const dataToDownload =
        filteredRows.length > 0 ? filteredRows : allEmployees;
      const headers = [
        "ID",
        "Name",
        "Phone",
        "Shift",
        "Week Off",
        "In Time",
        "Out Time",
        "Action",
      ];
      const csvData = [
        headers,
        ...dataToDownload.map((row) => [
          sanitizeCSVData(row.id),
          sanitizeCSVData(row.name),
          sanitizeCSVData(row.phone),
          sanitizeCSVData(row.shift),
          sanitizeCSVData(row.weekOff),
          sanitizeCSVData(row.inTime),
          sanitizeCSVData(row.outTime),
          sanitizeCSVData(row.action),
        ]),
      ];

      const doc = new jsPDF();
      autoTable(doc, {
        head: [csvData[0]],
        body: csvData.slice(1),
        startY: 20,
      });
      doc.save(
        `day_wise_report_${
          formatDate(selectedDate) || new Date().toISOString().split("T")[0]
        }.pdf`
      );
      toast.success("Report exported as PDF");
    } catch (err) {
      logger.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsExporting(false);
    }
  }, [allEmployees, filteredRows, selectedDate]);

  const totalItems = filteredRows.length;
  const totalPages = Math.ceil(totalItems / entries);
  const startIndex = (currentPage - 1) * entries;
  const endIndex = Math.min(startIndex + entries, totalItems);
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <ErrorBoundary>
      <div className="day-wise-report">
        <Row>
          <Col xs={12}>
            <Card>
              <CardBody>
                <CardTitle className="h4">Day Wise Report</CardTitle>
                <p className="card-title-desc">
                  View and manage daily attendance records for security
                  personnel
                </p>

                <div className="mb-3 d-flex justify-content-between align-items-center flex-wrap">
                  <div className="d-flex align-items-center flex-wrap gap-2">
                    <Input
                      type="text"
                      placeholder="Search by Employee ID or Name"
                      onChange={handleSearch}
                      style={{ maxWidth: "300px" }}
                      aria-label="Search employees"
                      disabled={isLoading}
                    />
                    <Flatpickr
                      className="form-control"
                      value={selectedDate}
                      onChange={handleDateChange}
                      options={{
                        altInput: true,
                        altFormat: "F j, Y",
                        dateFormat: "Y-m-d",
                        allowInput: true,
                      }}
                      placeholder="Select a date"
                      style={{ maxWidth: "200px" }}
                    />
                    <select
                      className="form-select"
                      value={selectedShift}
                      onChange={handleShiftChange}
                      style={{ maxWidth: "200px" }}
                      aria-label="Filter by shift"
                      disabled={isLoading}
                      role="combobox"
                      aria-expanded="false"
                    >
                      {SHIFT_OPTIONS.concat("All").map((shift) => (
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
                      aria-label="Export report as CSV"
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
                      color="info"
                      onClick={exportToPDF}
                      aria-label="Export report as PDF"
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
                        "Export as PDF"
                      )}
                    </Button>
                    <Button
                      color="primary"
                      onClick={toggleAddModal}
                      aria-label="Add/Update attendance"
                      disabled={isLoading}
                    >
                      Add/Update
                    </Button>
                  </div>
                </div>

                <AttendanceTable
                  employees={paginatedRows}
                  openEmployeeModal={openEmployeeModal}
                  isLoading={debouncedLoading}
                />

                {filteredRows.length > 0 &&
                  totalPages > 1 &&
                  !debouncedLoading && (
                    <Pagination className="mt-3" aria-label="Report pagination">
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

                {error && (
                  <div className="text-center py-4 text-danger" role="alert">
                    {error}
                  </div>
                )}

                {!selectedDate && !isLoading && (
                  <div className="text-center py-4 text-muted">
                    Please select a date to view records.
                  </div>
                )}

                {selectedDate &&
                  allEmployees.length === 0 &&
                  !isLoading &&
                  !error && (
                    <div className="text-center py-4 text-muted">
                      No records found for {formatDate(selectedDate)}.
                    </div>
                  )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        <ErrorBoundary>
          <Modal
            isOpen={modal}
            toggle={toggleModal}
            className="custom-modal"
            centered
            size="lg"
          >
            <ModalHeader toggle={toggleModal}>
              Employee Full Details
            </ModalHeader>
            <ModalBody>
              {isModalLoading ? (
                <div className="loading-overlay" aria-live="polite">
                  <Loader />
                  <span className="loading-text">
                    Loading employee details...
                  </span>
                </div>
              ) : selectedEmployee ? (
                <>
                  <div className="employee-image-container">
                    <div className="text-center">
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
                  </div>
                  <Table className="table table-bordered">
                    <tbody>
                      <tr>
                        <td className="label">
                          <strong>ID</strong>
                        </td>
                        <td className="detail">
                          {selectedEmployee.empId || "N/A"}
                        </td>
                        <td className="label">
                          <strong>Name</strong>
                        </td>
                        <td className="detail">
                          {sanitizeInput(selectedEmployee.empName) || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">
                          <strong>Designation</strong>
                        </td>
                        <td className="detail">
                          {sanitizeInput(selectedEmployee.empDesignation) ||
                            "N/A"}
                        </td>
                        <td className="label">
                          <strong>Department</strong>
                        </td>
                        <td className="detail">
                          {sanitizeInput(selectedEmployee.empDepartment) ||
                            "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">
                          <strong>Mobile No</strong>
                        </td>
                        <td className="detail">
                          {selectedEmployee.empMobileNo || "N/A"}
                        </td>
                        <td className="label">
                          <strong>Aadhar No</strong>
                        </td>
                        <td className="detail">
                          {selectedEmployee.empAadharNo || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">
                          <strong>PAN No</strong>
                        </td>
                        <td className="detail">
                          {sanitizeInput(selectedEmployee.empPanNo) || "N/A"}
                        </td>
                        <td className="label">
                          <strong>Date of Joining</strong>
                        </td>
                        <td className="detail">
                          {selectedEmployee.empDoj !== "N/A"
                            ? new Date(
                                selectedEmployee.empDoj
                              ).toLocaleDateString()
                            : "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">
                          <strong>Date of Birth</strong>
                        </td>
                        <td className="detail">
                          {selectedEmployee.empDob !== "N/A"
                            ? new Date(
                                selectedEmployee.empDob
                              ).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="label">
                          <strong>ESI No</strong>
                        </td>
                        <td className="detail">
                          {selectedEmployee.empEsiNo || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td className="label">
                          <strong>Bank Account No</strong>
                        </td>
                        <td className="detail">
                          {selectedEmployee.empBankAccountNo || "N/A"}
                        </td>
                        <td className="label">
                          <strong>EPF No</strong>
                        </td>
                        <td className="detail">
                          {selectedEmployee.empEpfNo || "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="address">
                          <strong>Address: </strong>
                          {sanitizeInput(selectedEmployee.empAddress) || "N/A"}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </>
              ) : (
                <p className="text-center text-muted">
                  Employee details not found
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                color="secondary"
                onClick={toggleModal}
                aria-label="Close modal"
              >
                Close
              </Button>
            </ModalFooter>
          </Modal>
        </ErrorBoundary>

        <ErrorBoundary>
          <Modal
            isOpen={addModal}
            toggle={toggleAddModal}
            className="custom-modal"
            centered
          >
            <ModalHeader toggle={toggleAddModal}>
              Add/Update Attendance
            </ModalHeader>
            <ModalBody>
              {isModalLoading ? (
                <div className="loading-overlay" aria-live="polite">
                  <Loader />
                  <span className="loading-text">Loading form data...</span>
                </div>
              ) : (
                <ErrorBoundary>
                  <AvForm onValidSubmit={handleFormSubmit}>
                    <FormGroup>
                      <Label for="mode">Mode</Label>
                      <Input
                        type="select"
                        name="mode"
                        id="mode"
                        value={formData.mode}
                        onChange={handleFormChange}
                        aria-label="Select mode"
                      >
                        {MODE_OPTIONS.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                    <FormGroup>
                      <Label for="empId">Employee ID</Label>
                      <Input
                        type="text"
                        name="empId"
                        id="empId"
                        value={formData.empId}
                        onChange={handleFormChange}
                        placeholder="Enter Employee ID"
                        aria-label="Employee ID"
                        validate={{
                          required: {
                            value: true,
                            errorMessage: "Employee ID is required",
                          },
                          pattern: {
                            value: "^\\d+$",
                            errorMessage: "Employee ID must be numeric",
                          },
                        }}
                      />
                    </FormGroup>
                    {employeeBasicDetails && (
                      <div className="employee-details-container mb-3">
                        <div className="employee-details-text">
                          <p>
                            <strong>Name:</strong>{" "}
                            {sanitizeInput(employeeBasicDetails.name)}
                          </p>
                          <p>
                            <strong>Designation:</strong>{" "}
                            {sanitizeInput(employeeBasicDetails.designation)}
                          </p>
                          <p>
                            <strong>Week Off:</strong>{" "}
                            {employeeBasicDetails.weekOff}
                          </p>
                        </div>
                        <div className="employee-image-container">
                          <div className="text-center">
                            <img
                              src={getEmpImageUrl(employeeBasicDetails)}
                              alt={employeeBasicDetails.name || "Employee"}
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
                        </div>
                      </div>
                    )}
                    <FormGroup>
                      <Label for="date">Date</Label>
                      <InputGroup>
                        <Flatpickr
                          className="form-control d-block"
                          value={formData.date}
                          onChange={handleFormDateChange}
                          options={{
                            altInput: true,
                            altFormat: "F j, Y",
                            dateFormat: "Y-m-d",
                          }}
                          placeholder="Select a date"
                          aria-label="Select date"
                        />
                      </InputGroup>
                    </FormGroup>
                    <FormGroup>
                      <Label for="inTime">In Time (HH:MM)</Label>
                      <Input
                        type="text"
                        name="inTime"
                        id="inTime"
                        value={formData.inTime}
                        onChange={(e) => handleTimeChange(e, "inTime")}
                        ref={inTimeRef}
                        maxLength="5"
                        placeholder="e.g., 00:00"
                        aria-label="In time"
                        validate={{
                          required: {
                            value: true,
                            errorMessage: "In time is required",
                          },
                          pattern: {
                            value: "^\\d{2}:\\d{2}$",
                            errorMessage: "Invalid time format (HH:MM)",
                          },
                        }}
                      />
                    </FormGroup>
                    <FormGroup>
                      <Label for="outTime">Out Time (HH:MM)</Label>
                      <Input
                        type="text"
                        name="outTime"
                        id="outTime"
                        value={formData.outTime}
                        onChange={(e) => handleTimeChange(e, "outTime")}
                        ref={outTimeRef}
                        maxLength="5"
                        placeholder="e.g., 00:00"
                        aria-label="Out time"
                        validate={{
                          required: {
                            value: true,
                            errorMessage: "Out time is required",
                          },
                          pattern: {
                            value: "^\\d{2}:\\d{2}$",
                            errorMessage: "Invalid time format (HH:MM)",
                          },
                        }}
                      />
                    </FormGroup>
                    <FormGroup>
                      <Label for="shift">Shift</Label>
                      <Input
                        type="select"
                        name="shift"
                        id="shift"
                        value={formData.shift}
                        onChange={handleFormChange}
                        aria-label="Select shift"
                        validate={{
                          required: {
                            value: true,
                            errorMessage: "Shift is required",
                          },
                        }}
                      >
                        {SHIFT_OPTIONS.map((shift) => (
                          <option key={shift} value={shift}>
                            {shift}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                    <FormGroup
                      className={formData.mode === "Update" ? "d-none" : ""}
                    >
                      <Label for="empWeekOff">Week Off</Label>
                      <Input
                        type="select"
                        name="empWeekOff"
                        id="empWeekOff"
                        value={formData.empWeekOff}
                        onChange={handleFormChange}
                        disabled
                        aria-label="Week off day"
                      >
                        {WEEK_OFF_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                    <div>
                      {formError && (
                        <p className="text-danger" role="alert">
                          {formError}
                        </p>
                      )}
                      {formSuccess && (
                        <p className="text-success" role="alert">
                          {formSuccess}
                        </p>
                      )}
                    </div>
                    <FormGroup className="mb-0 mt-3">
                      <Button
                        type="submit"
                        color="primary"
                        className="me-2"
                        aria-label="Submit form"
                      >
                        Submit
                      </Button>
                      <Button
                        type="button"
                        color="secondary"
                        onClick={toggleAddModal}
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

DayWiseReport.propTypes = {
  setBreadcrumbItems: PropTypes.func.isRequired,
};

export default connect(null, { setBreadcrumbItems })(DayWiseReport);
