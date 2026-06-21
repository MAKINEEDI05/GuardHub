import apiClient from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Login posts { email, password } (the backend accepts email OR userName for
// the username field) and returns { message, user }. There is no JWT — the
// returned user object IS the session.
export const authService = {
  async login(username, password) {
    const { data } = await apiClient.post(ENDPOINTS.login, {
      email: username,
      userName: username,
      password,
    });
    return data?.user || null;
  },
};
