/**
 * R6-N2 — Bitácora de tesorería de una factura de proveedor.
 *
 * Muestra, en lenguaje de negocio, cada movimiento de tesorería generado al
 * registrar o eliminar un pago: quién lo hizo, cuándo, monto, cuenta bancaria
 * y si el movimiento bancario quedó creado o dado de baja.
 * Incluye filtros por fecha, tipo de movimiento y usuario/operador, además de
 * ordenamiento por fecha.
 */
import { useMemo, useState } from "react";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { useBitacora } from "@/features/auditoria/hooks/useBitacora";
import { useCuentasBancarias } from "@/features/tesoreria";
import { BitacoraTesoreriaFila } from "./BitacoraTesoreriaSection.fila";
import { BitacoraTesoreriaToolbar } from "./BitacoraTesoreriaToolbar";
import { BitacoraTesoreriaExportButtons } from "./BitacoraTesoreriaExportButtons";
import { filasBitacoraExport } from "@/features/cxp/services/bitacoraTesoreriaExport";
import {
  FILTROS_BITACORA_TESORERIA_INICIALES,
  descripcionFiltrosBitacora,
  filtrarOrdenarBitacoraTesoreria,
  hayFiltrosBitacoraActivos,
  usuariosBitacora,
  type FiltrosBitacoraTesoreria,
} from "@/features/cxp/services/bitacoraTesoreriaFiltros";

const ACCIONES = ["pagar", "editar_pago", "eliminar_pago"] as const;

interface Props {
  facturaId: string;
  monedaFactura: string;
  /** Folio mostrado en el archivo exportado. */
  folio?: string;
  proveedor?: string;
}

export function BitacoraTesoreriaSection({
  facturaId, monedaFactura, folio, proveedor,
}: Props) {
  const { data, isLoading } = useBitacora({
    entidadId: facturaId,
    acciones: [...ACCIONES],
    limite: 50,
  });
  const { data: cuentas = [] } = useCuentasBancarias(false);
  const [filtros, setFiltros] = useState<FiltrosBitacoraTesoreria>(
    FILTROS_BITACORA_TESORERIA_INICIALES,
  );

  const nombreCuenta = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of cuentas) mapa.set(c.id, `${c.banco} · ${c.alias ?? "Cuenta"} (${c.moneda})`);
    return mapa;
  }, [cuentas]);

  const entradas = data?.datos ?? [];
  const usuarios = useMemo(() => usuariosBitacora(entradas), [entradas]);
  const visibles = useMemo(
    () => filtrarOrdenarBitacoraTesoreria(entradas, filtros),
    [entradas, filtros],
  );
  const filasExport = useMemo(
    () =>
      filasBitacoraExport(
        visibles.map((e) => ({
          accion: e.accion,
          created_at: e.created_at,
          usuario_email: e.usuario_email,
          // SAFE-CAST: `detalles` es jsonb; las lecturas son defensivas por clave.
          detalles: (e.detalles ?? {}) as Record<string, unknown>,
        })),
        { monedaFactura, nombreCuenta },
      ),
    [visibles, monedaFactura, nombreCuenta],
  );

  if (isLoading) return <ListSkeleton rows={3} />;

  const vacioPorFiltros = entradas.length > 0 && visibles.length === 0;

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">Bitácora de tesorería</h3>
          <p className="text-xs text-muted-foreground">
            Movimientos bancarios generados al registrar o eliminar pagos de esta factura.
          </p>
        </div>
        <BitacoraTesoreriaExportButtons
          filas={filasExport}
          folio={folio ?? facturaId}
          proveedor={proveedor}
          filtrosAplicados={descripcionFiltrosBitacora(filtros)}
        />
      </header>

      {entradas.length > 0 && (
        <BitacoraTesoreriaToolbar filtros={filtros} onChange={setFiltros} usuarios={usuarios} />
      )}

      {entradas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {visibles.length} de {entradas.length} movimiento{entradas.length === 1 ? "" : "s"}
          {hayFiltrosBitacoraActivos(filtros) ? " (con filtros aplicados)" : ""}
        </p>
      )}

      {entradas.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center">
          Aún no hay movimientos de tesorería para esta factura.
        </p>
      ) : vacioPorFiltros ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center">
          Ningún movimiento coincide con los filtros seleccionados.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {visibles.map((e) => (
            <BitacoraTesoreriaFila
              key={e.id}
              accion={e.accion}
              createdAt={e.created_at}
              usuarioEmail={e.usuario_email}
              detalles={(e.detalles ?? {}) as Record<string, unknown>}
              monedaFactura={monedaFactura}
              nombreCuenta={nombreCuenta}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
