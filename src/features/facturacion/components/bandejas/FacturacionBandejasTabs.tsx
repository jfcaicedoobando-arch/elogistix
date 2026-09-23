/**
 * Bandejas de Facturación (Tabs internos) — extraído de `Facturacion.tsx`
 * para mantenerlo por debajo de 200 líneas tras envolverlo con `CargaGuard`.
 */
import { useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { BandejaTabs, type BandejaId } from "@/features/facturacion/components/bandejas/BandejaTabs";
import { BandejaPorFacturar } from "@/features/facturacion/components/bandejas/BandejaPorFacturar";
import { BandejaProformasListas } from "@/features/facturacion/components/bandejas/BandejaProformasListas";
import { BandejaPorTimbrar } from "@/features/facturacion/components/bandejas/BandejaPorTimbrar";

import { BandejaPorCobrar } from "@/features/facturacion/components/bandejas/BandejaPorCobrar";
import { BandejaVencidas } from "@/features/facturacion/components/bandejas/BandejaVencidas";
import { BandejaRepPendientes } from "@/features/facturacion/components/bandejas/BandejaRepPendientes";
import { TabFacturasEmitidas } from "@/features/facturacion/components/TabFacturasEmitidas";
import { NotasCreditoRecientes } from "@/features/facturacion/components/NotasCreditoRecientes";
import { BandejaRepsHistorico } from "@/features/facturacion/components/bandejas/BandejaRepsHistorico";

import type {
  FacturasEmitidasAcciones, FacturasEmitidasFiltros, FacturasEmitidasTabla,
} from "@/features/facturacion/components/facturasEmitidasProps";
import { useHorizontalScrollEdges } from "@/components/shared/dataTable/useHorizontalScrollEdges";
import { HorizontalScrollFades } from "@/components/shared/dataTable/HorizontalScrollFades";

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
  const { ref, atStart, atEnd, overflowing } = useHorizontalScrollEdges<HTMLDivElement>();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = ref.current;
      const active = container?.querySelector<HTMLElement>('[data-state="active"]');
      if (!container || !active) return;
      const left = active.offsetLeft - 16;
      const right = left + active.offsetWidth + 32;
      if (left < container.scrollLeft) container.scrollTo({ left, behavior: "smooth" });
      else if (right > container.scrollLeft + container.clientWidth) {
        container.scrollTo({ left: right - container.clientWidth, behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [p.activeBandeja, ref]);
  return (
    <Tabs value={p.activeBandeja} onValueChange={p.setActiveBandeja}>
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div ref={ref} className="overflow-x-auto px-4 [scrollbar-width:thin]">
          <BandejaTabs />
        </div>
        <HorizontalScrollFades overflowing={overflowing} atStart={atStart} atEnd={atEnd} />
      </div>

      <TabsContent value="embarques-sin-factura" className="space-y-4">
        <BandejaPorFacturar />
      </TabsContent>
      <TabsContent value="proformas-listas" className="space-y-4">
        <BandejaProformasListas />
      </TabsContent>
      <TabsContent value="por-timbrar" className="space-y-4">
        <BandejaPorTimbrar />
      </TabsContent>
      <TabsContent value="por-cobrar" className="space-y-4">
        <BandejaPorCobrar />
      </TabsContent>
      <TabsContent value="vencidas" className="space-y-4">
        <BandejaVencidas />
      </TabsContent>
      <TabsContent value="rep-pendientes" className="space-y-4">
        <BandejaRepPendientes />
      </TabsContent>
      <TabsContent value="emitidas" className="space-y-4">
        <TabFacturasEmitidas {...p.emitidas} />
      </TabsContent>
      <TabsContent value="notas" className="space-y-4">
        <NotasCreditoRecientes />
      </TabsContent>
      <TabsContent value="reps" className="space-y-4">
        <BandejaRepsHistorico />
      </TabsContent>
    </Tabs>
  );
}
