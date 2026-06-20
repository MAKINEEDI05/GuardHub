import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Col, Row, Card, CardBody, Button, Table, CardTitle, Pagination, PaginationItem, PaginationLink } from "reactstrap";
import axios from "axios";
import DonutChart from "./donutchart";
import "./monthwisechart.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Loader from "components/Loader";
import { getEmpImageUrl, handleEmpImageError } from "helpers/empImage";

const getStatusColor = (status) => {
  switch (status) {
    case "Present":
      return "text-success";
    case "Absent":
      return "text-danger";
    case "Leave":
      return "text-warning";
    case "Week Off":
      return "text-secondary";
    default:
      return "text-muted";
  }
};

const MonthWiseChart = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const baseURL = process.env.REACT_APP_API_BASE_URL ;

  const empId = location.state?.empId || "N/A";
  const empName = location.state?.empName || "Unknown";
  const fromDate = location.state?.fromDate || null;
  const toDate = location.state?.toDate || null;
  const searchTerm = location.state?.searchTerm || "";
  const allEmployees = location.state?.allEmployees || [];
  const filteredRows = location.state?.filteredRows || [];

  const [stats, setStats] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("pdf");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const effectiveFromDate = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const effectiveToDate = toDate ? new Date(toDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  const formattedFromDate = effectiveFromDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedToDate = effectiveToDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchWithRetry = async (url, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        return response;
      } catch (err) {
        console.error(`Attempt ${i + 1} failed for ${url}:`, err.message);
        if (i === retries - 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, delay * 2 ** i));
      }
    }
  };

  const fetchDailyAttendance = async (date) => {
    const dateStr = formatDate(date);
    try {
      console.log(`Fetching attendance for date: ${dateStr}`);
      const response = await fetchWithRetry(
        `${baseURL}/attendance/get-attendace-bydate/${dateStr}`
      );
      let attendanceRecords = Array.isArray(response.data.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
      console.log(`Attendance records for ${dateStr}:`, attendanceRecords);
      return attendanceRecords;
    } catch (err) {
      console.error(`Error fetching attendance for ${dateStr}:`, {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      return [];
    }
  };

  useEffect(() => {
    document.title = `Attendance Chart - ${empName}`;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        let weekOffDay = "Sunday";
        try {
          const empDetailsResponse = await fetchWithRetry(
            `${baseURL}/emp/get-emp-details`
          );
          const empDetails = empDetailsResponse.data.find((emp) => String(emp.empId) === String(empId));
          weekOffDay = empDetails?.empWeekOff || "Sunday";
          console.log(`Week Off Day for empId ${empId}:`, weekOffDay);
        } catch (err) {
          console.error(`Error fetching employee details for empId ${empId}:`, err);
        }

        let startDate = new Date(effectiveFromDate);
        let endDate = new Date(effectiveToDate);
        const dailyAttendancePromises = [];

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          dailyAttendancePromises.push(fetchDailyAttendance(date));
        }

        const dailyAttendanceResponses = await Promise.all(dailyAttendancePromises);
        const attendanceRecords = dailyAttendanceResponses.flat().filter((r) => String(r.empId) === String(empId));
        console.log(`Filtered Attendance for empId ${empId}:`, attendanceRecords);

        if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

        const daily = [];
        let presentCount = 0;
        let absentCount = 0;
        let leaveCount = 0;
        let odCount = 0;

        for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
          const dateStr = formatDate(currentDate);
          const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" });

          const record = attendanceRecords.find((r) => new Date(r.empDate).toISOString().split("T")[0] === dateStr);
          let status = record ? record.empAction : null;
          let shift = record ? record.empShift || "N/A" : "N/A";

          if (!status && dayName === weekOffDay) {
            status = "Week Off";
            shift = "N/A";
            leaveCount += 1;
          } else if (!status) {
            status = "Absent";
            shift = "N/A";
            absentCount += 1;
          } else if (status === "Present") {
            presentCount += 1;
          } else if (status === "Absent") {
            absentCount += 1;
          } else if (status === "Leave" && record.leaveType === "CL") {
            leaveCount += 1;
          } else if (status === "OD") {
            odCount += 1;
          }

          daily.push({
            date: dateStr,
            day: dayName,
            shift,
            inTime: record?.empInTime || (status === "Present" ? "09:00 AM" : "--"),
            outTime: record?.empOutTime || (status === "Present" ? "06:00 PM" : "--"),
            status,
          });
        }

        setStats({ present: presentCount, absent: absentCount, leaves: leaveCount, od: odCount });
        setDailyData(daily);
        setCurrentPage(1);
      } catch (err) {
        console.error(`Error processing data for empId ${empId}:`, err);
        setError(`Failed to fetch attendance data for ${empName} (ID: ${empId}). Check API connectivity or data availability.`);
        setStats({ present: 0, absent: 0, leaves: 0, od: 0 });
        setDailyData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [empId, fromDate, toDate, empName]);

  const handleSegmentClick = useCallback((category) => {
    setSelectedCategory((prev) => (prev === category ? null : category));
    setCurrentPage(1);
  }, []);

  const downloadData = useCallback(() => {
    const headers = ["Date", "Day", "Shift", "In Time", "Out Time", "Status"];
    const data = dailyData.map((row) => [row.date, row.day, row.shift, row.inTime, row.outTime, row.status]);
    if (downloadFormat === "pdf") {
      try {
        const doc = new jsPDF();
        autoTable(doc, {
          head: [headers],
          body: data,
          startY: 20,
          styles: { fontSize: 10 },
          headStyles: { fillColor: [0, 123, 255] },
        });
        doc.save(`month_wise_chart_${empId}_${formatDate(effectiveFromDate)}_to_${formatDate(effectiveToDate)}.pdf`);
      } catch (err) {
        console.error("PDF generation error:", err);
        alert("Failed to generate PDF. Check console for details.");
      }
    } else if (downloadFormat === "excel") {
      try {
        const worksheetData = dailyData.map((row) => ({
          Date: row.date,
          Day: row.day,
          Shift: row.shift,
          "In Time": row.inTime,
          "Out Time": row.outTime,
          Status: row.status,
        }));
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "MonthWiseChart");
        XLSX.writeFile(workbook, `month_wise_chart_${empId}_${formatDate(effectiveFromDate)}_to_${formatDate(effectiveToDate)}.xlsx`);
      } catch (err) {
        console.error("Excel generation error:", err);
        alert("Failed to generate Excel file. Check console for details.");
      }
    }
  }, [dailyData, downloadFormat, empId, effectiveFromDate, effectiveToDate]);

  if (loading) {
    return (
      <div style={{ position: "relative", minHeight: "200px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Loader size={20} color="#076fe5" withOverlay={true} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-4 text-danger">
        {error}
        <div className="mt-3">
          <Button
            color="secondary"
            onClick={() =>
              navigate("/month-wise-report", {
                state: { searchTerm, fromDate, toDate, allEmployees, filteredRows },
              })
            }
            size="sm"
          >
            ← Back
          </Button>
        </div>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="text-center py-4 text-muted">
        No attendance data available for {empName} (ID: {empId}).
        <div className="mt-3">
          <Button
            color="secondary"
            onClick={() =>
              navigate("/month-wise-report", {
                state: { searchTerm, fromDate, toDate, allEmployees, filteredRows },
              })
            }
            size="sm"
          >
            ← Back
          </Button>
        </div>
      </div>
    );
  }

  const labels = ["Present", "Absent", "Leaves", "OD"];
  const series = [stats.present || 0, stats.absent || 0, stats.leaves || 0, stats.od || 0];
  const colors = ["#34c38f", "#f46a6a", "#f1b44c", "#556ee6"];

  // Pagination calculations
  const totalRows = dailyData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfLast = safeCurrentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentRows = dailyData.slice(indexOfFirst, indexOfLast);

  const changePage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPageNumbers = () => {
    const maxButtons = 5;
    let start = Math.max(1, safeCurrentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(
        <PaginationItem key={i} active={i === safeCurrentPage}>
          <PaginationLink onClick={() => changePage(i)} aria-label={`Page ${i}`} aria-current={i === safeCurrentPage ? "page" : undefined}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    return pages;
  };

  return (
    <Row>
      <Col xs="12">
        <Card>
          <CardBody>
            <CardTitle className="h4">Attendance Chart</CardTitle>
            <p className="card-title-desc">Breakdown and day-wise details for {empName}</p>

            <Row className="align-items-center mb-3 g-3">
              <Col md="4">
                <div className="d-flex align-items-center">
                  <div className="text-center">
                    <img
                      src={getEmpImageUrl({ empId })}
                      alt={empName || "Employee"}
                      className="emp-photo"
                      style={{
                        width: "85px",
                        height: "85px",
                        objectFit: "cover",
                        borderRadius: "50%",
                        border: "1px solid #ccc",
                        backgroundColor: "#fff",
                        padding: "5px",
                      }}
                      onError={(e) => handleEmpImageError(e)}
                    />
                  </div>
                  <div className="ms-3">
                    <h4 className="mb-1">{empName}</h4>
                    <p className="text-muted mb-0">ID: {empId}</p>
                    <p className="text-muted mb-0">
                      From: <strong>{formattedFromDate}</strong> | To: <strong>{formattedToDate}</strong>
                    </p>
                  </div>
                </div>
              </Col>
              <Col md="8">
                <div className="text-center">
                  <h5 className="mb-3">Attendance Breakdown</h5>
                  <DonutChart
                    labels={labels}
                    series={series}
                    colors={colors}
                    onSegmentClick={handleSegmentClick}
                  />
                </div>
              </Col>
            </Row>

            <div className="d-flex justify-content-between align-items-end flex-wrap gap-2 mt-2 mb-2">
              <h5 className="mb-0">Day-wise Attendance Details</h5>
              <div className="d-flex align-items-end gap-2">
                <div>
                  <label htmlFor="rowsPerPage" className="form-label mb-1">Rows</label>
                  <select
                    id="rowsPerPage"
                    className="form-select form-select-sm"
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    style={{ maxWidth: "100px" }}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="downloadFormat" className="form-label mb-1">Format</label>
                  <select
                    id="downloadFormat"
                    className="form-select form-select-sm"
                    value={downloadFormat}
                    onChange={(e) => setDownloadFormat(e.target.value)}
                    style={{ maxWidth: "140px" }}
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>
                <div>
                  <Button color="success" size="sm" onClick={downloadData} disabled={dailyData.length === 0}>
                    Download
                  </Button>
                </div>
              </div>
            </div>

            {currentRows.length > 0 ? (
              <Table bordered responsive className="table-sm md-table">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Shift</th>
                    <th>In Time</th>
                    <th>Out Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map((day, index) => (
                    <tr
                      key={`${day.date}-${index}`}
                      style={{
                        backgroundColor:
                          selectedCategory === day.status
                            ? colors[labels.indexOf(day.status)] + "33"
                            : "transparent",
                        transition: "background-color 0.3s",
                        height: "50px",
                      }}
                    >
                      <td>{day.date}</td>
                      <td>{day.day}</td>
                      <td>{day.shift}</td>
                      <td>{day.inTime}</td>
                      <td>{day.outTime}</td>
                      <td className={getStatusColor(day.status)}>
                        <strong>{day.status}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-center py-4 text-muted">
                No attendance records found for the specified date range.
              </div>
            )}

            {totalPages > 1 && (
              <div className="d-flex justify-content-between align-items-center mt-2">
                <small className="text-muted">Showing {indexOfFirst + 1}-{Math.min(indexOfLast, totalRows)} of {totalRows}</small>
                <Pagination className="mb-0">
                  <PaginationItem disabled={safeCurrentPage === 1}>
                    <PaginationLink previous onClick={() => changePage(safeCurrentPage - 1)} aria-label="Previous page" aria-disabled={safeCurrentPage === 1}>
                      Previous
                    </PaginationLink>
                  </PaginationItem>
                  {renderPageNumbers()}
                  <PaginationItem disabled={safeCurrentPage === totalPages}>
                    <PaginationLink next onClick={() => changePage(safeCurrentPage + 1)} aria-label="Next page" aria-disabled={safeCurrentPage === totalPages}>
                      Next
                    </PaginationLink>
                  </PaginationItem>
                </Pagination>
              </div>
            )}

            <div className="d-flex justify-content-end mt-3">
              <Button
                color="secondary"
                onClick={() =>
                  navigate("/month-wise-report", {
                    state: { searchTerm, fromDate, toDate, allEmployees, filteredRows },
                  })
                }
                size="sm"
              >
                ← Back
              </Button>
            </div>
          </CardBody>
        </Card>
      </Col>
    </Row>
  );
};

export default MonthWiseChart;