import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DialogNotaCreditoProveedor } from "@/features/cxp/components/DialogNotaCreditoProveedor";
import { XML_FACTURA, xmlEvidence } from "./xml-backend";

export function XmlFixture() {
  const [open, setOpen] = useState(false);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } }));
  return (
    <QueryClientProvider client={client}>
    <main style={{ padding: 20, maxWidth: 760, margin: "0 auto" }}>
      <h1>XML 96 · Nota de crédito ficticia</h1>
      <p>Diálogo y carga reales. Parser, registro y adjuntos simulados sólo en memoria.</p>
      <p>Escenario: {xmlEvidence.scenario}. Sin SAT, timbrado, subida ni registro reales.</p>
      <button data-testid="open-xml" onClick={() => setOpen(true)} className="rounded-md border px-4 py-3 mt-4">
        Abrir nota de crédito
      </button>
      <DialogNotaCreditoProveedor open={open} onOpenChange={setOpen} facturaId={XML_FACTURA} monedaFactura="MXN" saldoFactura={100} />
    </main>
    </QueryClientProvider>
  );
}
