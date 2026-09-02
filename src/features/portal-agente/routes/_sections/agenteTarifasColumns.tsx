/**
 * Columnas + badge de estado para `AgenteTarifas` — extraídas en v13.182.0
 * (Wave 2 · Power-of-10 splits).
 */
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { MoreHorizontal } from "lucide-react";
import type { TarifaInput, TarifaRecargoInput } from "@/features/costeo/services/tarifas";
import type { AgenteTarifaRow } from "@/features/portal-agente/services";
import { formatNumber } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import { resolverEstadoVigenciaTarifa } from "@/features/costeo/utils/vigenciaTarifa";

export function EstadoBadge({ estado }: { estado: string }) {
  // Capitaliza estado ("vigente" → "Vigente") para casar con DOMAIN_STATUSES.tarifa_maritima.
  const canonical = estado.charAt(0).toUpperCase() + estado.slice(1);
  return <StatusBadge domain="tarifa_maritima" status={canonical} />;
}

/** Badge + aviso de vigencia vencida para filas de `AgenteTarifas`. */
function EstadoConVigencia({ t }: { t: AgenteTarifaRow }) {
  const { advertencia } = resolverEstadoVigenciaTarifa({
    estadoAprobacion: t.estado_aprobacion,
    estado: t.estado,
    vigenteHasta: t.vigente_hasta,
    hoy: todayLocalISO(),
  });
  if (!advertencia) return <EstadoBadge estado={t.estado_aprobacion} />;
  return (
    <div className="flex flex-col gap-0.5">
      <EstadoBadge estado={t.estado_aprobacion} />
      <span className="text-xs text-warning">{advertencia}</span>
    </div>
  );
}

export function toInitial(t: AgenteTarifaRow, recargos: TarifaRecargoInput[] = []): Partial<TarifaInput> {
  return {
    agente_id: "",
    naviera_id: t.naviera_id,
    ruta_id: t.ruta_id,
    tipo_contenedor_id: t.tipo_contenedor_id,
    flete_base: Number(t.flete_base),
    vigente_desde: t.vigente_desde,
    vigente_hasta: t.vigente_hasta,
    // B-086: la "nueva versión" debe ser fiel — antes se reseteaban los días
    // libres a 7 y se perdían TT, notas y TODOS los recargos (BAF/LSS/ISPS).
    dias_libres_demoras: t.dias_libres_demoras,
    transit_time_dias: t.transit_time_dias ?? null,
    notas: t.notas,
    recargos,
  };
}

export interface AgenteTarifasColumnsDeps {
  onEditar: (t: AgenteTarifaRow) => void;
  onDuplicar: (t: AgenteTarifaRow) => void;
}

export function buildAgenteTarifasColumns(deps: AgenteTarifasColumnsDeps): ColumnDef<AgenteTarifaRow, unknown>[] {
  const { onEditar, onDuplicar } = deps;
  return defineColumns<AgenteTarifaRow>([
    {
      id: "ruta",
      header: "Ruta",
      accessorFn: (t) => `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`,
      sortingFn: sortByString((t) => `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`),
      enableSorting: true,
      meta: { sticky: true, className: "text-sm" },
      cell: ({ row }) => (
        <div>
          <div>{row.original.puerto_origen_nombre} → {row.original.puerto_destino_nombre}</div>
          {row.original.estado_aprobacion === "rechazada" && row.original.motivo_rechazo && (
            <p className="text-xs text-destructive mt-1">
              <strong>Motivo:</strong> {row.original.motivo_rechazo}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "naviera",
      header: "Naviera",
      accessorFn: (t) => t.naviera_nombre,
      sortingFn: sortByString((t) => t.naviera_nombre),
      enableSorting: true,
      cell: ({ row }) => row.original.naviera_nombre,
    },
    {
      id: "contenedor",
      header: "Contenedor",
      accessorFn: (t) => t.tipo_contenedor_nombre,
      enableSorting: true,
      cell: ({ row }) => row.original.tipo_contenedor_nombre,
    },
    {
      id: "transito",
      header: "Tránsito",
      accessorFn: (t) => t.transit_time_dias ?? -1,
      sortingFn: sortByNumber((t) => t.transit_time_dias ?? -1),
      enableSorting: true,
      meta: { align: "right", className: "tabular-nums" },
      cell: ({ row }) => (row.original.transit_time_dias != null ? `${row.original.transit_time_dias} días` : "—"),
    },
    {
      id: "diasLibres",
      header: "Días libres",
      accessorFn: (t) => t.dias_libres_demoras,
      sortingFn: sortByNumber((t) => t.dias_libres_demoras),
      enableSorting: true,
      meta: { align: "right", className: "tabular-nums" },
      cell: ({ row }) => `${row.original.dias_libres_demoras} días`,
    },
    {
      id: "flete",
      header: "Flete base",
      accessorFn: (t) => Number(t.flete_base),
      sortingFn: sortByNumber((t) => Number(t.flete_base)),
      enableSorting: true,
      meta: { align: "right", className: "tabular-nums" },
      cell: ({ row }) =>
        `${row.original.moneda} ${formatNumber(Number(row.original.flete_base), { decimals: 2 })}`,
    },
    {
      id: "vigencia",
      header: "Vigencia",
      accessorFn: (t) => t.vigente_desde,
      sortingFn: sortByDate((t) => t.vigente_desde),
      enableSorting: true,
      meta: { className: "text-xs text-muted-foreground" },
      // UIB-14: mismo formato corto que el resto de la app (dd/MM/yy), no ISO crudo.
      cell: ({ row }) =>
        `${formatDate(row.original.vigente_desde, "dd/MM/yy")} → ${formatDate(row.original.vigente_hasta, "dd/MM/yy")}`,
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (t) => t.estado_aprobacion,
      enableSorting: true,
      cell: ({ row }) => <EstadoConVigencia t={row.original} />,
    },
    {
      id: "acciones",
      header: "",
      meta: { width: "w-12", align: "right" },
      cell: ({ row }) => {
        const t = row.original;
        const editable = t.estado_aprobacion === "borrador" || t.estado_aprobacion === "rechazada";
        const { vencida } = resolverEstadoVigenciaTarifa({
          estadoAprobacion: t.estado_aprobacion,
          estado: t.estado,
          vigenteHasta: t.vigente_hasta,
          hoy: todayLocalISO(),
        });
        const etiquetaEditar = t.estado_aprobacion === "rechazada"
          ? "Corregir y reenviar"
          : vencida
            ? "Editar (vigencia vencida — actualízala)"
            : "Editar";
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Acciones de la tarifa ${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!editable}
                  onClick={() => onEditar(t)}
                >
                  {etiquetaEditar}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicar(t)}>
                  Duplicar como nueva
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ]);
}
