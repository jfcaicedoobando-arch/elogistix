import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { VisualFixture } from "./VisualFixture";
import "@/index.css";

document.documentElement.classList.toggle("dark", matchMedia("(prefers-color-scheme: dark)").matches);
createRoot(document.getElementById("root")!).render(<BrowserRouter><VisualFixture /></BrowserRouter>);
