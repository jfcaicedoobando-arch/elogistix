import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FacturasMasivasToolbar } from "@/features/facturacion/components/FacturasMasivasToolbar";

export const DashboardEjecutivoFacturacion = () => null;

export function FacturacionBandejasTabs() {
  const [selected, setSelected] = useState(new Set(["factura-ficticia-1"]));
  return (
    <section className="space-y-3" aria-label="Facturas emitidas de prueba">
      <h2 className="text-lg font-semibold">Emitidas</h2>
      <FacturasMasivasToolbar selectedIds={selected} onClear={() => setSelected(new Set())} onMarked={() => setSelected(new Set())} />
      <article className="rounded-md border p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={selected.size === 1} onChange={event => setSelected(new Set(event.target.checked ? ["factura-ficticia-1"] : []))} />
          <span><strong>FICTICIA-001 · Cliente de prueba</strong><br /><span className="text-body-sm text-muted-foreground">MXN 1,160.00 · Timbrada · Datos sintéticos</span></span>
        </label>
      </article>
    </section>
  );
}

export function FacturacionDialogs({ openFacturaManual, setOpenFacturaManual }: { openFacturaManual: boolean; setOpenFacturaManual: (open: boolean) => void }) {
  return (
    <Dialog open={openFacturaManual} onOpenChange={setOpenFacturaManual}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva factura manual</DialogTitle><DialogDescription>El botón del encabezado es real. Este diálogo es una simulación local sin formulario fiscal ni guardado.</DialogDescription></DialogHeader>
        <Button onClick={() => setOpenFacturaManual(false)}>Cerrar simulación</Button>
      </DialogContent>
    </Dialog>
  );
}
