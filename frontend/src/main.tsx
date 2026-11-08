import LoginGate from "./LoginGate";
import { createRoot } from "react-dom/client";
import Dashboard from "./Dashboard";
import ThemeToggle from "./ThemeToggle";
import "./index.css";

createRoot(document.getElementById("app")!).render(
  <>
    <LoginGate>
      <Dashboard />
    </LoginGate>
    <ThemeToggle />
  </>
);
