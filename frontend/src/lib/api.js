import axios from "axios";

// Keep local development working without requiring a frontend .env file.
const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const api = axios.create({
  baseURL,
  timeout: 60000,
});

export function getUploadUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseURL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export default api;
