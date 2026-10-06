import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { ReportFixture } from "./ReportFixture";
import "@/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<BrowserRouter><Routes>
  <Route path="/" element={<ReportFixture />} />
  <Route path="/clientes/synthetic" element={<main><h1>Cliente sintético acumulado MXN</h1></main>} />
</Routes></BrowserRouter>);
