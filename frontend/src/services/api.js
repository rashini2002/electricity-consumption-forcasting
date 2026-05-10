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

export function setApiBase(baseUrl) {
  API_BASE = (baseUrl || "").trim().replace(/\/$/, "") || FALLBACK_API_BASE;
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