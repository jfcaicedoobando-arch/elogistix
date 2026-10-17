import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/contexts/ThemeContext";
import { CorreoFixture } from "./CorreoFixture";
import { CrmFixture } from "./CrmFixture";
import { XmlFixture } from "./XmlFixture";
import "../index.css";

const current = new URLSearchParams(location.search).get("case");
const Fixture = current === "correo" ? CorreoFixture : current === "crm" ? CrmFixture : current === "xml" ? XmlFixture : null;
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<ThemeProvider><main className="min-h-screen p-4"><p className="mb-4 text-xs text-muted-foreground">Elogistix · pruebas aisladas · datos ficticios</p>{Fixture ? <Fixture /> : <p>Seleccione correo, crm o xml.</p>}</main><Toaster /></ThemeProvider>);
