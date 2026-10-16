import { useState } from "react";
import { createRoot } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRadixPointerEventsRescue } from "../../../src/hooks/shared/useRadixPointerEventsRescue";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";
import { exchangeRates } from "@/features/catalogos/queryKeys";
import { queryClient } from "@/lib/query/queryClient";
import { bootstrapQueryPersister } from "@/lib/query/persistBootstrap";
import { fetchCount, storedSnapshot } from "./no-backend";
import "./style.css";

const operationalKey = ["demo-operation"] as const;
export function Rates() {
  const result = useExchangeRates();
  return <p role="status">USD/MXN sintético: {result.data?.usdMxn ?? "Cargando"} · consultas: {fetchCount}</p>;
}
export function Demo() {
  useRadixPointerEventsRescue();
  const [rates, setRates] = useState(false);
  const [snapshot, setSnapshot] = useState("");
  return <main>
    <p>DEMO INTERNA · DATOS SINTÉTICOS</p><h1>Dependencias: cierre y caché</h1>
    <section><h2>Overlay Radix real</h2>
      <Dialog.Root><Dialog.Trigger>Abrir diálogo</Dialog.Trigger><Dialog.Portal>
        <Dialog.Overlay className="shade" /><Dialog.Content className="dialog">
          <Dialog.Title>Overlay legítimo</Dialog.Title>
          <Dialog.Description>Escape y Cerrar devuelven el control. Reabrir mantiene el bloqueo del fondo.</Dialog.Description>
          <Dialog.Close>Cerrar</Dialog.Close> <Link to="/away">Navegar y desmontar</Link>
        </Dialog.Content>
      </Dialog.Portal></Dialog.Root>
    </section>
    <section><h2>Retención y frescura</h2>
      <p>Tipos de cambio: 24 h de retención y 1 h de frescura. Consultas operativas: 5 min.</p>
      <button onClick={() => {
        queryClient.setQueryData(exchangeRates.all, { usdMxn: 10, eurMxn: 12 }, { updatedAt: Date.now() - 2 * 60 * 60_000 });
        queryClient.setQueryData(operationalKey, "OPERACION_SINTETICA_NO_PERSISTIR");
      }}>Preparar tasa de hace 2 h</button>{" "}
      <button onClick={() => setRates(!rates)}>{rates ? "Desmontar tasas" : "Montar tasas"}</button>
      {rates && <Rates />}
      <button onClick={() => setSnapshot(storedSnapshot())}>Ver snapshot en memoria</button>
      <pre data-testid="snapshot">{snapshot}</pre>
    </section>
    <p>Sin servicios externos. Cerrar esta pestaña descarta la demo.</p>
  </main>;
}
async function start() {
  await bootstrapQueryPersister(queryClient);
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing demo root");
  createRoot(root).render(<QueryClientProvider client={queryClient}><BrowserRouter><Routes>
    <Route path="/" element={<Demo />} />
    <Route path="/away" element={<main><h1>Ruta de destino</h1><Link to="/">Volver a la demo</Link></main>} />
  </Routes></BrowserRouter></QueryClientProvider>);
}
void start();
