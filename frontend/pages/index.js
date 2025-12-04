import { useState } from "react";
import { useRouter } from "next/router";
import { api, setAuthToken } from "../utils/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data?.success && data?.data?.token) {
        const { token, user } = data.data;
        setAuthToken(token);
        if (typeof window !== "undefined") {
          localStorage.setItem("nb_token", token);
          localStorage.setItem("nb_user", JSON.stringify(user));
        }
        router.push("/chat");
      } else {
        setError(data?.message || "Login failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Naibrly Socket Test</h2>
        <p className="small">Use your provider or customer credentials to sign in.</p>
        <form className="row" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <div className="row">
            <label className="small">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="row">
            <label className="small">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="????????"
            />
          </div>
          {error && <div style={{ color: "#f88", fontSize: 13 }}>{error}</div>}
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
