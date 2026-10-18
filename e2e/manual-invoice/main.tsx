import { Profiler, useState } from "react";
import { createRoot } from "react-dom/client";
import { DialogNuevaFacturaManual } from "@/features/facturacion/components/DialogNuevaFacturaManual";
import "../visual/index.css";

declare const __ATTRIBUTION__: boolean;
declare global {
  var __invoiceCommits: { id: string; phase: string; actualDuration: number; baseDuration: number }[] | undefined;
}

export function Demo() {
  const [open, setOpen] = useState(true);
  return <><p style={{ padding: 16 }}>Demo local sintética · Sin guardado, timbrado ni servicios</p>
    <button onClick={() => setOpen(true)}>Abrir captura</button>
    <DialogNuevaFacturaManual open={open} onOpenChange={setOpen} />
  </>;
}

// Compile-time false in final timing builds: no Profiler, counters or telemetry.
const demo = <Demo />;
createRoot(document.getElementById("root")!).render(__ATTRIBUTION__
  ? <Profiler id="manual-invoice" onRender={(id, phase, actualDuration, baseDuration) => {
    (globalThis.__invoiceCommits ??= []).push({ id, phase, actualDuration, baseDuration });
  }}>{demo}</Profiler> : demo);
