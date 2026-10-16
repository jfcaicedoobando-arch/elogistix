import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { VirtualizationFixture } from "./VirtualizationFixture";
import "../index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing synthetic fixture root");
createRoot(root).render(<MemoryRouter><VirtualizationFixture /></MemoryRouter>);
