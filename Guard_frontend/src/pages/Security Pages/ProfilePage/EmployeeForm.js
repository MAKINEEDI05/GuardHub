import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Button,
  CardBody,
  CardTitle,
  Col,
  FormGroup,
  Row,
  Label,
  Card,
} from "reactstrap";
import { AvForm, AvField, AvGroup } from "availity-reactstrap-validation";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import Flatpickr from "react-flatpickr";
import { Spinner } from "reactstrap";
import Loader from "components/Loader";
import "react-toastify/dist/ReactToastify.css";
import "flatpickr/dist/themes/material_blue.css";

const EmployeeForm = () => {
  const { empId } = useParams();
  const baseURL = process.env.REACT_APP_API_BASE_URL;
  const [formData, setFormData] = useState({
    empName: "",
    empDesignation: "",
    empId: "",
    empMobileNo: "",
    empAadharNo: "",
    empPanNo: "",
    empDob: "",
    empDoj: "",
    empDepartment: "",
    bankAccountNo: "",
    epfNo: "",
    esiNo: "",
    address: "",
    empImage: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(empId ? true : false);
  const fileInputRef = useRef();
  const formRef = useRef(null);
  const navigate = useNavigate();

  const designations = useMemo(
    () => [
      "Security Officer ",
      "Asst.Security Officer ",
      "Shift Incharge",
      "Head Guard",
      "Security Guard",
      "AVT -Supervisor",
      "AVT - Head Guard",
      "AVT - Guard",
      "Lady - Head Guard",
      "AVT - Guard",
    ],
    []
  );

  const departments = useMemo(
    () => [
      "Security",
      "Aditya Security Shifts & General",
      "Aditya Vigilance Team",
      "Aditya Lady Security",
    ],
    []
  );

  const formTitle = empId ? `Edit Employee – ${empId}` : "Add Employee Details";

  // Unique empId
  const [existingEmpIds, setExistingEmpIds] = useState([]);

  useEffect(() => {
    fetch(`${baseURL}/emp/get-emp-details`)
      .then((res) => res.json())
      .then((data) => {
        const ids = data
          .map((emp) => parseInt(emp.empId))
          .filter((id) => !isNaN(id));
        setExistingEmpIds(ids);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to fetch existing employee IDs", {
          position: "top-right",
          autoClose: 5000,
        });
      });
  }, [baseURL]);

  // Fetch employee data in edit mode with minimum loader time
  useEffect(() => {
    if (empId) {
      setLoading(true);
      const minLoaderTime = new Promise((resolve) => setTimeout(resolve, 500)); // Minimum 500ms loader

      const fetchEmployee = axios
        .get(`${baseURL}/emp/get-emp-byid/${empId}`)
        .then((res) => {
          const emp = res.data;
          setFormData({
            empName: emp.empName || "",
            empDesignation: emp.empDesignation || "",
            empId: emp.empId ? String(emp.empId) : "",
            empMobileNo: emp.empMobileNo || "",
            empAadharNo: emp.empAadharNo || "",
            empPanNo: emp.empPanNo || "",
            empDob: emp.empDob ? emp.empDob.substring(0, 10) : "",
            empDoj: emp.empDoj ? emp.empDoj.substring(0, 10) : "",
            empDepartment: emp.empDepartment || "",
            bankAccountNo: emp.bankAccountNo || "",
            epfNo: emp.epfNo || "",
            esiNo: emp.esiNo || "",
            address: emp.address || "",
            empImage: null,
          });

          const baseImageUrl = `${baseURL}/emp/uploads/${emp.empId}`;
          const jpgUrl = `${baseImageUrl}.jpg`;
          const JPGUrl = `${baseImageUrl}.JPG`;

          const testImage = (url) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(url);
              img.onerror = () => resolve(null);
              img.src = url;
            });

          return Promise.any([testImage(jpgUrl), testImage(JPGUrl)]).then(
            (validUrl) => {
              setImagePreview(validUrl || `${baseURL}/emp/uploads/0000.jpg`);
            }
          );
        })
        .catch((error) => {
          console.error("Fetch Error:", error);
          toast.error("Failed to load employee details.", {
            position: "top-right",
            autoClose: 5000,
            toastId: "fetch-error",
          });
        });

      // Ensure loader shows for at least 500ms
      Promise.all([fetchEmployee, minLoaderTime]).then(() => {
        setLoading(false);
      });
    }
  }, [empId, baseURL]);

  // const handleImageChange = (e) => {
  //   const file = e.target.files[0];
  //   if (file && file.type.startsWith("image/")) {
  //     if (file.size > 5 * 1024 * 1024) {
  //       toast.error("Image size must be less than 5MB");
  //       return;
  //     }
  //     setFormData((prev) => ({ ...prev, empImage: file }));
  //     if (imagePreview && imagePreview.startsWith("blob:")) {
  //       URL.revokeObjectURL(imagePreview);
  //     }
  //     setImagePreview(URL.createObjectURL(file));
  //   } else {
  //     toast.error("Please select a valid image file");
  //   }
  // };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"]; // ✅ Add GIF and other formats

    if (file && allowedTypes.includes(file.type)) {
      if (file.size > 1 * 1024 * 1024) {
        toast.error("Image size must be less than 1MB");
        return;
      }
      setFormData((prev) => ({ ...prev, empImage: file }));

      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(URL.createObjectURL(file));
    } else {
      toast.error("Please select a valid image file (JPG, PNG, JPEG)");
    }
  };

  const handleImageClick = () => {
    if (!submitting) {
      fileInputRef.current.click();
    }
  };

  const resetForm = () => {
    setFormData({
      empName: "",
      empDesignation: "",
      empId: "",
      empMobileNo: "",
      empAadharNo: "",
      empPanNo: "",
      empDob: "",
      empDoj: "",
      empDepartment: "",
      bankAccountNo: "",
      epfNo: "",
      esiNo: "",
      address: "",
      empImage: null,
    });
    setImagePreview(null);
    fileInputRef.current.value = "";
    if (formRef.current) {
      formRef.current.reset();
    }
  };

  const handleInvalidSubmit = (event, errors, values) => {
    console.log("Validation errors:", errors);
    console.log("Form values:", values);
    toast.error("Please fill all required fields correctly.", {
      position: "top-right",
      autoClose: 5000,
      toastId: "invalid-submit",
    });
  };

  const handleValidSubmit = async (event, values) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (!empId && existingEmpIds.includes(parseInt(values.empId))) {
        toast.error("Employee ID already exists", {
          position: "top-right",
          autoClose: 5000,
          toastId: "empId-duplicate",
        });
        setSubmitting(false);
        return;
      }

      const postData = new FormData();

      Object.entries(values).forEach(([key, value]) => {
        // if (empId && key === "empId") return;
        postData.append(key, value);
      });

      if (formData.empImage) {
        const extension = formData.empImage.name.split(".").pop();
        const filename = `${values.empId}.${extension}`;
        postData.append("empImage", formData.empImage, filename);
      }

      for (let [key, value] of postData.entries()) {
        console.log(`${key}: ${value}`);
      }

      const endpoint = empId
        ? `${baseURL}/emp/update-emp-byid/${empId}`
        : `${baseURL}/emp/add-employee`;

      const method = empId ? axios.put : axios.post;

      console.log("Submitting to:", endpoint);
      const response = await method(endpoint, postData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Server response:", response.data);

      toast.success(
        empId
          ? "Employee updated successfully!"
          : "Employee added successfully!",
        {
          position: "top-right",
          autoClose: 5000,
          toastId: "submit-success",
        }
      );
      resetForm();
      setTimeout(() => navigate("/profilepage"), 1000);
    } catch (error) {
      console.error("Submission Error:", error);
      let errorMessage = "An error occurred while submitting the form";
      if (error.response) {
        console.log("Server error response:", error.response.data);
        errorMessage =
          error.response.data.message ||
          `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = "No response from server. Check your connection.";
      }
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        toastId: "submit-error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CardBody>
      <style>
        {`
          .form-group label {
            font-weight: 500;
            color: #495057;
            margin-bottom: 0.5rem;
          }
          .form-control, .form-select {
            border-radius: 6px;
            border: 1px solid #ced4da;
          }
          .form-control:disabled, .form-select:disabled {
            background-color: #e9ecef;
          }
          .image-upload-container {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          .submit-button {
            min-width: 120px;
          }
          .form-container {
            padding: 1.5rem;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .loader-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 300px;
          }
        `}
      </style>
      {loading ? (
        <div className="loader-container">
          <Loader message="Loading employee data..." />
        </div>
      ) : (
        <Card>
          <CardBody>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <CardTitle className="h4">{formTitle}</CardTitle>
              <Button color="primary" onClick={() => navigate("/profilepage")}>
                Back
              </Button>
            </div>

            <div className="form-container">
              <AvForm
                ref={formRef}
                onValidSubmit={handleValidSubmit}
                onInvalidSubmit={handleInvalidSubmit}
              >
                <FormGroup className="mb-4 image-upload-container">
                  <Label for="employeeImage">Employee Image (Optional)</Label>
                  <div>
                    <input
                      id="employeeImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      disabled={submitting}
                    />
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Employee preview"
                        onClick={handleImageClick}
                        onError={(e) =>
                          (e.target.src = `${baseURL}/emp/uploads/0000.jpg`)
                        }
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "50%",
                          cursor: submitting ? "not-allowed" : "pointer",
                          border: "1px solid lightgray",
                        }}
                      />
                    ) : (
                      <div
                        onClick={handleImageClick}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleImageClick()
                        }
                        role="button"
                        tabIndex={0}
                        style={{
                          border: "1px dashed lightgray",
                          width: "100px",
                          height: "100px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: submitting ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          color: "#6f42c1",
                          borderRadius: "50%",
                          backgroundColor: "#f8f9fa",
                        }}
                      >
                        <i
                          className="bi bi-cloud-upload"
                          style={{ fontSize: "24px" }}
                        ></i>
                        <div>Upload</div>
                      </div>
                    )}
                  </div>
                </FormGroup>
                <Row>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="empName"
                      label="Employee Name"
                      placeholder="Enter full name"
                      type="text"
                      value={formData.empName}
                      onChange={(e) =>
                        setFormData({ ...formData, empName: e.target.value })
                      }
                      validate={{
                        required: {
                          value: true,
                          errorMessage: "Employee Name is required",
                        },
                        minLength: {
                          value: 2,
                          errorMessage: "Minimum 2 characters required",
                        },
                        maxLength: {
                          value: 50,
                          errorMessage: "Maximum 50 characters allowed",
                        },
                      }}
                      disabled={submitting}
                    />
                  </Col>
                  <Col md={6}>
                    <AvGroup className="mb-3">
                      <Label for="empId">Employee ID</Label>
                      <AvField
                        name="empId"
                        type="text"
                        placeholder="Enter unique ID"
                        value={formData.empId}
                        onChange={(e) =>
                          setFormData({ ...formData, empId: e.target.value })
                        }
                        disabled={empId || submitting}
                        validate={{
                          required: {
                            value: true,
                            errorMessage: "Employee ID is required",
                          },
                          // pattern: {
                          //   value: "^[0-9]+$",
                          //   errorMessage: "Employee ID must be numeric",
                          // },
                          minLength: {
                            value: 3,
                            errorMessage: "Minimum 3 digits required",
                          },
                          maxLength: {
                            value: 10,
                            errorMessage: "Maximum 10 digits allowed",
                          },
                        }}
                      />
                    </AvGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="empDesignation"
                      label="Designation"
                      type="select"
                      value={formData.empDesignation}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          empDesignation: e.target.value,
                        })
                      }
                      validate={{
                        required: {
                          value: true,
                          errorMessage: "Designation is required",
                        },
                      }}
                      disabled={submitting}
                    >
                      <option value="">Select Designation</option>
                      {designations.map((d, i) => (
                        <option key={i} value={d}>
                          {d}
                        </option>
                      ))}
                    </AvField>
                  </Col>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="empDepartment"
                      label="Department"
                      type="select"
                      value={formData.empDepartment}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          empDepartment: e.target.value,
                        })
                      }
                      validate={{
                        required: {
                          value: true,
                          errorMessage: "Department is required",
                        },
                      }}
                      disabled={submitting}
                    >
                      <option value="">Select Department</option>
                      {departments.map((d, i) => (
                        <option key={i} value={d}>
                          {d}
                        </option>
                      ))}
                    </AvField>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="empMobileNo"
                      label="Mobile No"
                      placeholder="Enter mobile number"
                      type="text"
                      value={formData.empMobileNo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          empMobileNo: e.target.value,
                        })
                      }
                      validate={{
                        required: {
                          value: true,
                          errorMessage: "Mobile Number is required",
                        },
                        pattern: {
                          value: "^[0-9]{10}$",
                          errorMessage: "Enter valid 10-digit mobile number",
                        },
                      }}
                      disabled={submitting}
                    />
                  </Col>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="empAadharNo"
                      label="Aadhar No"
                      placeholder="Enter Aadhar number"
                      type="text"
                      value={formData.empAadharNo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          empAadharNo: e.target.value,
                        })
                      }
                      validate={{
                        required: {
                          value: true,
                          errorMessage: "Aadhar Number is required",
                        },
                        pattern: {
                          value: "^\\d{12}$",
                          errorMessage: "Enter valid 12-digit Aadhar number",
                        },
                      }}
                      disabled={submitting}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="empPanNo"
                      label="PAN No"
                      placeholder="Enter PAN No"
                      type="text"
                      value={formData.empPanNo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          empPanNo: e.target.value.toUpperCase(),
                        })
                      }
                      validate={{
                        required: { value: false },
                        pattern: {
                          value: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
                          errorMessage:
                            "Enter valid PAN number (e.g., ABCDE1234F)",
                        },
                      }}
                      disabled={submitting}
                    />
                  </Col>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="bankAccountNo"
                      label="Bank Account No"
                      placeholder="Enter bank account number"
                      type="text"
                      value={formData.bankAccountNo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bankAccountNo: e.target.value,
                        })
                      }
                      validate={{
                        required: {
                          value: true,
                          errorMessage: "Bank Account Number is required",
                        },
                        pattern: {
                          value: "^\\d{9,18}$",
                          errorMessage:
                            "Enter valid bank account number (9-18 digits)",
                        },
                      }}
                      disabled={submitting}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="epfNo"
                      label="EPF No"
                      placeholder="Enter EPF number"
                      type="text"
                      value={formData.epfNo}
                      onChange={(e) =>
                        setFormData({ ...formData, epfNo: e.target.value })
                      }
                      validate={{
                        required: { value: false },
                        pattern: {
                          value: "^[A-Z0-9]{0,22}$",
                          errorMessage:
                            "Enter valid EPF number (up to 22 alphanumeric characters)",
                        },
                      }}
                      disabled={submitting}
                    />
                  </Col>
                  <Col md={6}>
                    <AvField
                      className="mb-3"
                      name="esiNo"
                      label="ESI No"
                      placeholder="Enter ESI number"
                      type="text"
                      value={formData.esiNo}
                      onChange={(e) =>
                        setFormData({ ...formData, esiNo: e.target.value })
                      }
                      validate={{
                        required: { value: false },
                        pattern: {
                          value: "^[0-9]{0,17}$",
                          errorMessage:
                            "Enter valid ESI number (up to 17 digits)",
                        },
                      }}
                      disabled={submitting}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <FormGroup className="mb-3">
                      <Label>Date of Birth</Label>
                      <Flatpickr
                        className="form-control"
                        name="empDob"
                        placeholder="Select date"
                        value={formData.empDob}
                        onChange={([date]) =>
                          setFormData({
                            ...formData,
                            empDob: date.toISOString().substring(0, 10),
                          })
                        }
                        options={{
                          dateFormat: "Y-m-d",
                          maxDate: "today",
                          allowInput: false,
                        }}
                        disabled={submitting}
                      />
                      <AvField
                        type="hidden"
                        name="empDob"
                        value={formData.empDob}
                        validate={{
                          required: {
                            value: true,
                            errorMessage: "Date of Birth is required",
                          },
                        }}
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup className="mb-3">
                      <Label>Date of Joining</Label>
                      <Flatpickr
                        className="form-control"
                        name="empDoj"
                        placeholder="Select date"
                        value={formData.empDoj}
                        onChange={([date]) =>
                          setFormData({
                            ...formData,
                            empDoj: date.toISOString().substring(0, 10),
                          })
                        }
                        options={{
                          dateFormat: "Y-m-d",
                          allowInput: false,
                        }}
                        disabled={submitting}
                      />
                      <AvField
                        type="hidden"
                        name="empDoj"
                        value={formData.empDoj}
                        validate={{
                          required: {
                            value: true,
                            errorMessage: "Date of Joining is required",
                          },
                        }}
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <AvField
                  className="mb-3"
                  name="address"
                  label="Address"
                  placeholder="Enter address"
                  type="textarea"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  validate={{
                    required: {
                      value: true,
                      errorMessage: "Address is required",
                    },
                    minLength: {
                      value: 5,
                      errorMessage: "Minimum 5 characters required",
                    },
                    maxLength: {
                      value: 200,
                      errorMessage: "Maximum 200 characters allowed",
                    },
                  }}
                  disabled={submitting}
                  rows="3"
                />
                <div className="d-flex justify-content-end mt-4">
                  <Button
                    type="submit"
                    color="primary"
                    disabled={submitting || loading}
                    className="submit-button"
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Submitting...
                      </>
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </div>
              </AvForm>
            </div>

            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              style={{ zIndex: 9999 }}
            />
          </CardBody>
        </Card>
      )}
    </CardBody>
  );
};

export default EmployeeForm;
