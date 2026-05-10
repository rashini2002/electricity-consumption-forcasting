const FALLBACK_API_BASE = "http://127.0.0.1:8000";

function resolveInitialApiBase() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
      return String(import.meta.env.VITE_API_BASE).replace(/\/$/, "");
    }
  } catch {
    // ignore env detection issues and use runtime fallback
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }
    return origin;
  }

  return FALLBACK_API_BASE;
}

let API_BASE = resolveInitialApiBase();
let AUTH_TOKEN = "";

export function setApiBase(baseUrl) {
  API_BASE = (baseUrl || "").trim().replace(/\/$/, "") || FALLBACK_API_BASE;
}

export function getStoredAuthToken() {
  try {
    return localStorage.getItem("gridpulse_auth_token") || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token) {
  AUTH_TOKEN = (token || "").trim();
  try {
    if (AUTH_TOKEN) {
      localStorage.setItem("gridpulse_auth_token", AUTH_TOKEN);
    } else {
      localStorage.removeItem("gridpulse_auth_token");
    }
  } catch {
    // Ignore storage errors in non-browser contexts.
  }
}

function buildUrl(path) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  let payload;

  try {
    response = await fetch(buildUrl(path), {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
        ...(options.headers || {}),
      },
    });
    payload = await response.json().catch(() => ({}));
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("API request timed out. Check backend server and network.");
    }
    throw new Error(`Cannot connect to API at ${API_BASE}. Is backend running?`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = payload?.detail || payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export function getModelInfo() {
  return request("/model-info");
}

export function pingApi() {
  return getModelInfo();
}

export function predict(data) {
  return request("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function predictWhatIf(base, overrides) {
  return request("/predict/what-if", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base, overrides }),
  });
}

export function registerUser({ username, email, password }) {
  return request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
}

export function loginUser({ email, password }) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function logoutUser() {
  return request("/auth/logout", { method: "POST" });
}

export function getCurrentUser() {
  return request("/auth/me");
}

export function getHistory(limit = 20) {
  return request(`/history?limit=${encodeURIComponent(limit)}`);
}