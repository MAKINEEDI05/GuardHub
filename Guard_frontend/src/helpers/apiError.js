// Map an axios/network error to a clear, user-facing message.
// Never surfaces raw backend stack/error objects to the user.
export function friendlyApiError(error, opts = {}) {
  // Timeout (axios sets ECONNABORTED on timeout)
  if (error && error.code === "ECONNABORTED") {
    return "Request timed out. Please try again.";
  }

  // No response => network failure / backend unreachable
  if (!error || !error.response) {
    return "Unable to connect to server. Please try again.";
  }

  const status = error.response.status;
  const data = error.response.data || {};

  if (status === 404) {
    const msg = String(data.message || "").toLowerCase();
    if (msg.includes("employee")) return "Employee not found.";
    return opts.notFound || "The requested record was not found.";
  }

  if (status === 400) {
    // Our controllers return a controlled `errors` array for validation.
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors.join("\n");
    }
    return opts.badRequest || "Please check the entered details and try again.";
  }

  if (status >= 500) {
    return "Server error. Please try again later.";
  }

  return opts.fallback || "Something went wrong. Please try again.";
}
