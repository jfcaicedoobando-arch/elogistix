import { createRoot } from "react-dom/client";
import { AuditFixture } from "./AuditFixture";
import "@/index.css";

const params = new URLSearchParams(location.search);
document.documentElement.classList.toggle("dark", params.get("theme") === "dark");
document.documentElement.style.fontSize = params.get("fontPercent") === "150" ? "24px" : "16px";
const root = document.getElementById("root");
if (!root) throw new Error("Missing audit fixture root");
createRoot(root).render(<AuditFixture />);
