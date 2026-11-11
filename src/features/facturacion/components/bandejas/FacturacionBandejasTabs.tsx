/**
 * Bandejas de Facturación (Tabs internos) — extraído de `Facturacion.tsx`
 * para mantenerlo por debajo de 200 líneas tras envolverlo con `CargaGuard`.
 */
import { lazy, Suspense } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { BandejaTabs, type BandejaId } from "@/features/facturacion/components/bandejas/BandejaTabs";

import type {
  FacturasEmitidasAcciones, FacturasEmitidasFiltros, FacturasEmitidasTabla,
} from "@/features/facturacion/components/facturasEmitidasProps";

const BANDEJAS = {
  "embarques-sin-factura": lazy(() => import("./BandejaPorFacturar").then((m) => ({ default: m.BandejaPorFacturar }))),
  "proformas-listas": lazy(() => import("./BandejaProformasListas").then((m) => ({ default: m.BandejaProformasListas }))),
  "por-timbrar": lazy(() => import("./BandejaPorTimbrar").then((m) => ({ default: m.BandejaPorTimbrar }))),
  "por-cobrar": lazy(() => import("./BandejaPorCobrar").then((m) => ({ default: m.BandejaPorCobrar }))),
  vencidas: lazy(() => import("./BandejaVencidas").then((m) => ({ default: m.BandejaVencidas }))),
  "rep-pendientes": lazy(() => import("./BandejaRepPendientes").then((m) => ({ default: m.BandejaRepPendientes }))),
  notas: lazy(() => import("../NotasCreditoRecientes").then((m) => ({ default: m.NotasCreditoRecientes }))),
  reps: lazy(() => import("./BandejaRepsHistorico").then((m) => ({ default: m.BandejaRepsHistorico }))),
};
const TabFacturasEmitidas = lazy(() => import("../TabFacturasEmitidas").then((m) => ({ default: m.TabFacturasEmitidas })));

interface Props {
  activeBandeja: BandejaId;
  setActiveBandeja: (next: string) => void;
  /** Props agrupadas de la bandeja "Emitidas" (auditoría punto 7). */
  emitidas: {
    filtros: FacturasEmitidasFiltros;
    tabla: FacturasEmitidasTabla;
    acciones: FacturasEmitidasAcciones;
  };
}

export function FacturacionBandejasTabs(p: Props) {
  const Bandeja = p.activeBandeja === "emitidas" ? null : BANDEJAS[p.activeBandeja];
  return (
    <Tabs value={p.activeBandeja} onValueChange={p.setActiveBandeja}>
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70">
        <div className="px-4">
          <BandejaTabs activeBandeja={p.activeBandeja} onSelect={p.setActiveBandeja} />
        </div>
      </div>

      <TabsContent key={p.activeBandeja} value={p.activeBandeja} className="space-y-4">
        <Suspense fallback={<ListSkeleton />}>
          {Bandeja ? <Bandeja /> : <TabFacturasEmitidas {...p.emitidas} />}
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
