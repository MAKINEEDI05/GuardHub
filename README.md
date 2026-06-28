# 🛡️ GuardHub - Security Workforce Attendance & Management System

A comprehensive web-based workforce management platform designed to automate the attendance and operational management of approximately **150 security personnel** working across **General, A, B, and C shifts** within Aditya University.

GuardHub centralizes employee management, biometric attendance processing, security roster scheduling, leave management, overtime tracking, on-duty requests, and attendance reporting into a single platform, significantly reducing manual administrative work and improving operational efficiency.

---

# 📌 Project Overview

Managing attendance and workforce operations for a large security department manually is time-consuming and error-prone. Although attendance is captured through **Fingerprint Recognition System (FRS)** and **Biometric Thumb Authentication Devices**, the extracted logs still require processing before they become useful for administration.

GuardHub automates this entire workflow by converting biometric attendance data into structured datasets, allowing administrators to monitor attendance, manage employees, process leave requests, maintain weekly rosters, and generate reports required for payroll and workforce planning.

The system is intended for the university's Security Department and currently supports approximately **150 security guards**.

---

# 🎯 Problem Statement

Before GuardHub, the security department maintained attendance, leave records, overtime, shift schedules, and employee information manually using spreadsheets and registers. Preparing daily attendance reports, monthly summaries, and payroll sheets required significant manual effort.

The major challenges included:

- Manual processing of biometric attendance logs.
- Difficulty managing approximately 150 employees.
- Manual leave balance calculations.
- Maintaining weekly shift schedules.
- Generating attendance reports manually.
- Tracking overtime (OT) and On-Duty (OD) requests.
- Preparing payroll-related reports.

GuardHub was developed to eliminate these manual processes by providing a centralized workforce management solution.

---

# 🚀 Key Features

## 📊 Dashboard

The dashboard provides a real-time overview of the workforce including:

- Total Employees
- Active Security Rosters
- Leave Requests
- On-Duty Requests
- Overtime Requests
- Recent Activities
- Quick Actions

---

## 👥 Employee Management

Complete employee lifecycle management.

### Features

- Add Single Employee
- Bulk Employee Upload using Excel
- Edit Employee Details
- Delete Employee Records
- Search by Name, Employee ID, Mobile Number
- Filter by Department
- Filter by Designation
- Export Employee Data to CSV

### Employee Information Stored

- Employee ID
- Employee Name
- Designation
- Department
- Date of Birth
- Date of Joining
- Aadhaar Number
- PAN Number
- Bank Details
- EPF Number
- ESI Number
- Mobile Number
- Address
- Emergency Contact Details

---

## 🛡️ Security Roster Management

Security guards work in four different shifts.

- General Shift
- A Shift
- B Shift
- C Shift

The roster module allows administrators to:

- Create Weekly Rosters
- Upload Bulk Rosters
- Edit Existing Rosters
- Search Employees
- Filter by Shift
- Filter by Department
- Assign Effective Dates
- Export Roster Data

This module simplifies shift allocation for all security personnel.

---

## 📅 Attendance Management

Attendance is collected through

- Fingerprint Recognition System (FRS)
- Biometric Thumb Authentication Device

Attendance logs are extracted from biometric machines and processed into structured datasets before being imported into GuardHub.

The processed attendance data is then used for reporting and workforce monitoring.

---

## 📝 Leave Management

Employees can apply for leave through the system.

Leave requests contain

- Employee Information
- Leave Type
- Shift
- Duration
- From Date
- To Date
- Reason

After administrator approval, leave is automatically deducted from the employee's available leave balance.

### Leave Policy

Each employee receives **26 Annual Leaves**

| Leave Type | Count |
|------------|------:|
| Monthly Leave | 12 |
| Pongal Leave | 4 |
| Dussehra Leave | 4 |
| Summer Vacation | 6 |
| **Total** | **26** |

---

## 📍 On-Duty (OD) Management

Employees working outside their regular duty location can submit On-Duty requests.

The administrator records

- Location
- Shift
- Duration
- From Date
- To Date
- Purpose

Approved OD requests are reflected in attendance reports.

---

## ⏰ Overtime (OT) Management

Employees working additional shifts can submit overtime requests.

The OT module records

- Current Shift
- Additional Shift
- Working Duration
- Location
- From Date
- To Date
- Reason
- Remarks

These records are later used during payroll preparation.

---

## 📈 Day Wise Attendance Report

Administrators can generate attendance reports for any specific date.

Features include

- Employee Search
- Attendance Filters
- Shift Filter
- Department Filter
- Present Status
- Absent Status
- Leave Status
- OD Status
- OT Status
- In Time
- Out Time
- CSV Export

---

## 📊 Month Wise Attendance Report

Generates attendance summaries for selected date ranges.

The report contains

- Present Days
- Absent Days
- Leave Days
- On-Duty Days
- Overtime Days
- Week-Off Days

Reports can be exported directly to CSV for payroll processing.

---

## 📂 Report Export

The system supports exporting workforce reports in CSV format.

Generated reports include

- Employee Information
- Total Working Days
- Present Days
- Absent Days
- Leave Days
- Week-Offs
- Overtime
- On-Duty
- Leave Balance
- CCL Adjustments
- Payroll Summary

---

# ⚙️ System Workflow

1. Security guards mark attendance using FRS or biometric thumb devices.
2. Attendance logs are extracted from biometric machines.
3. Attendance data is processed into structured datasets.
4. Employee records are maintained through the Employee Management module.
5. Weekly security rosters are uploaded or created.
6. Employees submit Leave, OT, or OD requests.
7. Administrators verify and approve requests.
8. Leave balances are updated automatically.
9. Day-wise and Month-wise reports are generated.
10. Reports are exported for payroll and administrative purposes.

---

# 🏗️ Technologies Used

## Frontend

- React.js
- HTML5
- CSS3
- JavaScript

## Backend

- Node.js
- Express.js

## Database

- MongoDB

## Additional Technologies

- Excel Bulk Upload
- CSV Export
- Biometric Attendance Processing
- Search & Filtering
- Role-Based Administration

---

# 📋 Major Functionalities

- Dashboard
- Employee Management
- Bulk Employee Upload
- Security Roster
- Attendance Monitoring
- Leave Management
- On-Duty Management
- Overtime Management
- Day Wise Reports
- Month Wise Reports
- CSV Export
- Automatic Leave Balance Calculation
- Search & Filters
- Secure Admin Access

---

# 📈 Project Impact

GuardHub transformed the manual workforce management process into a centralized digital platform.

### Benefits

- Reduced manual attendance processing
- Faster report generation
- Improved attendance accuracy
- Simplified leave management
- Efficient roster planning
- Automated leave balance deduction
- Better payroll preparation
- Improved workforce monitoring
- Centralized employee database
- Increased administrative efficiency

---

# 👨‍💻 Team

**Project Type:** Real-Time Workforce Management System

**Team Size:** 3 Members

**Organization:** Aditya University

**Users:** Security Department & Administration

**Employees Managed:** ~150 Security Personnel

---

# 📌 Future Enhancements

- Automatic Biometric Device Synchronization
- Real-Time Attendance Updates
- SMS & Email Notifications
- Mobile Application
- QR Code Attendance
- Face Recognition Attendance
- Payroll Integration
- Analytics Dashboard
- Shift Optimization using AI
- Multi-Campus Support

---

## ⭐ Project Highlights

- Real-time Security Workforce Management
- Handles 150+ Security Personnel
- Four Shift Scheduling
- Automated Attendance Processing
- Leave, OD & OT Management
- Bulk Employee Upload
- CSV Report Generation
- Weekly Security Roster
- Payroll Ready Reports
- Centralized Administrative Dashboard
