import { useState } from "react";
import { CerrarFacturaSinPagoDialog } from "@/features/cxp/components/CerrarFacturaSinPagoDialog";
import { FacturaPagosMobileCard } from "@/features/facturacion/components/detalle/FacturaPagosMobileCard";
import { factura, pagos } from "./fixture-data";
import { forbiddenBackendAccess } from "./no-backend";

export function AuditFixture() {
  const [open, setOpen] = useState(false);
  const [confirms, setConfirms] = useState(0);
  const [closes, setCloses] = useState(0);
  return (
    <main style={{ padding: 16, maxWidth: 740, margin: "0 auto" }}>
      <h1>Auditoría 119/126: datos ficticios</h1>
      <p>Sin conexión al backend. Ningún dato financiero real.</p>
      <button id="open" onClick={() => setOpen(true)} style={{ padding: 12, border: "1px solid gray" }}>
        Abrir cierre sin pago
      </button>
      <p id="fixture-state">Confirmaciones: {confirms}; cierres: {closes}</p>
      <section style={{ maxWidth: 420 }}>
        {pagos.map((row, index) => (
          <div key={row.id}>
            <h2>{index === 0 ? "Pago activo: MXN 20 recibidos, USD 1 aplicado" : "Pago anulado: MXN 20 histórico, USD 0 aplicado"}</h2>
            <article
              data-testid={index === 0 ? "active-card" : "cancelled-card"}
              style={{ padding: 16, border: "1px solid gray", borderRadius: 8, marginBottom: 16 }}
            >
              <FacturaPagosMobileCard
                row={row} facturaId={factura.id} monedaFactura="USD" canEdit={false}
                onEliminar={forbiddenBackendAccess} onCancelarRep={forbiddenBackendAccess}
                onPreviewRep={forbiddenBackendAccess}
              />
            </article>
          </div>
        ))}
      </section>
      <CerrarFacturaSinPagoDialog
        factura={factura} open={open} isPending={false}
        onOpenChange={value => {
          setOpen(value);
          if (!value) setCloses(count => count + 1);
        }}
        // This counter is deliberately the only possible effect of confirming.
        onConfirm={() => setConfirms(count => count + 1)}
      />
    </main>
  );
}
