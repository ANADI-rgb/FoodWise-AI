import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Check whether the Flask backend is running.
export const checkBackendHealth = async () => {
  const response = await api.get("/api/health");
  return response.data;
};

export default api;