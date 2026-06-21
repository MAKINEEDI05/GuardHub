import axios from "axios";

// Single axios instance for the whole app. Every service imports this — no page
// ever calls axios directly. Base URL comes from VITE_API_BASE_URL (.env).
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:9002";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

// The backend login does not issue a real JWT (the stored user doc has no
// token). We still forward whatever the stored user carries, harmlessly, in
// case the backend is later hardened. Auth gating is done client-side on the
// presence of the stored user.
apiClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("guardhub.user");
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.accessToken) {
        config.headers.Authorization = `Bearer ${user.accessToken}`;
      }
    }
  } catch {
    // ignore malformed storage
  }
  return config;
});

// Normalise errors into a friendly message that the UI/toast layer can show
// without digging through the axios error shape.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = "Something went wrong. Please try again.";
    if (error.code === "ECONNABORTED") {
      message = "The request timed out. Check your connection and retry.";
    } else if (error.response) {
      message =
        error.response.data?.message ||
        error.response.data?.error ||
        `Request failed (${error.response.status}).`;
    } else if (error.request) {
      message = "Cannot reach the server. Is the backend running?";
    }
    error.friendlyMessage = message;
    return Promise.reject(error);
  }
);

export default apiClient;
