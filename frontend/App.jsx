import { useEffect, useState } from "react";
import Dashboard from "./src/components/Dashboard";
import AuthPage from "./src/components/AuthPage";
import {
  getCurrentUser,
  getHistory,
  getStoredAuthToken,
  loginUser,
  logoutUser,
  registerUser,
  setAuthToken,
} from "./src/services/api";

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);

  async function refreshHistory() {
    try {
      const payload = await getHistory(20);
      setHistoryItems(payload.items || []);
    } catch {
      setHistoryItems([]);
    }
  }

  useEffect(() => {
    async function bootstrapAuth() {
      const token = getStoredAuthToken();
      if (!token) {
        setCheckingAuth(false);
        return;
      }

      try {
        setAuthToken(token);
        const payload = await getCurrentUser();
        setUser(payload.user || null);
        await refreshHistory();
      } catch {
        setAuthToken("");
        setUser(null);
        setHistoryItems([]);
      } finally {
        setCheckingAuth(false);
      }
    }

    bootstrapAuth();
  }, []);

  async function handleLogin(credentials) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const payload = await loginUser(credentials);
      setAuthToken(payload.access_token);
      setUser(payload.user || null);
      await refreshHistory();
    } catch (error) {
      setAuthError(error.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(credentials) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const payload = await registerUser(credentials);
      setAuthToken(payload.access_token);
      setUser(payload.user || null);
      await refreshHistory();
    } catch (error) {
      setAuthError(error.message || "Registration failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
    } catch {
      // Ignore logout errors and clear local auth anyway.
    }

    setAuthToken("");
    setUser(null);
    setHistoryItems([]);
    setAuthError("");
  }

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Inter, sans-serif" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} onRegister={handleRegister} loading={authLoading} error={authError} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} historyItems={historyItems} refreshHistory={refreshHistory} />;
}
