import { useState, type ReactNode } from "react";
import loginBg from "./login-bg.jpg";

// Fake login for the demo. Pick a user and you're in.
const USERS = ["Asha", "Sarah", "Shubhi"];

export default function LoginGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState("");
  if (user) return <>{children}</>;

  return (
    <main style={{ position: "relative", minHeight: "100vh", display: "grid", placeItems: "center", overflow: "hidden", fontFamily: "Manrope, system-ui, sans-serif" }}>
      <img src={loginBg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(40, 52, 36, 0.82)" }} />
      <div style={{ position: "relative", textAlign: "center", color: "#E5D9B6", padding: 24, width: "min(420px, 100%)" }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(3rem, 10vw, 6rem)", margin: 0, letterSpacing: "-0.02em" }}>
          FIN360<span style={{ color: "#E67E22" }}>+5</span>
        </h1>
        <p style={{ marginTop: 8, marginBottom: 32, fontSize: 18 }}>Your whole financial picture, in one place.</p>
        <label htmlFor="fin360-user" style={{ display: "block", textAlign: "left", fontWeight: 600, marginBottom: 8 }}>Choose an account</label>
        <select id="fin360-user" defaultValue="" onChange={(e) => e.target.value && setUser(e.target.value)}
          style={{ width: "100%", padding: "14px 16px", fontSize: 17, borderRadius: 12, border: "2px solid #628141", background: "#E5D9B6", color: "#40513B", cursor: "pointer" }}>
          <option value="" disabled>Select a user…</option>
          {USERS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </main>
  );
}
