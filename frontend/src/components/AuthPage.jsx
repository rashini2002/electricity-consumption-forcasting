import { useState } from "react";

export default function AuthPage({ onLogin, onRegister, loading, error }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isRegister = mode === "register";

  async function handleSubmit(event) {
    event.preventDefault();
    if (isRegister) {
      await onRegister({ username, email, password });
      return;
    }
    await onLogin({ email, password });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(2, 6, 23, 0.9) 100%), url('/images/login_page.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        color: "#e2e8f0",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(420px, 100%)",
          background: "rgba(20, 20, 30, 0.4)",
          border: "1px solid rgba(226, 232, 240, 0.2)",
          borderRadius: 18,
          backdropFilter: "blur(20px)",
          padding: 24,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>GridPulse</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 18 }}>
          {isRegister ? "Create an account to save forecast history" : "Sign in to continue"}
        </p>

        {isRegister && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#cbd5e1" }}>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              placeholder="Enter username"
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: "#cbd5e1" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: "#cbd5e1" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 12,
            padding: "12px 14px",
            background: "linear-gradient(135deg, #0891b2, #16a34a)",
            color: "#f8fafc",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
        </button>

        <button
          type="button"
          onClick={() => setMode(isRegister ? "login" : "register")}
          style={{
            marginTop: 12,
            width: "100%",
            border: "1px solid rgba(226,232,240,0.2)",
            borderRadius: 10,
            padding: "10px 12px",
            background: "transparent",
            color: "#cbd5e1",
            cursor: "pointer",
          }}
        >
          {isRegister ? "Already have an account? Sign In" : "New user? Create Account"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  marginTop: 6,
  width: "100%",
  borderRadius: 10,
  border: "1px solid rgba(226,232,240,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "#e2e8f0",
  padding: "10px 12px",
  outline: "none",
};
