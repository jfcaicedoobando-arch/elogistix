import { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { GarantiaEditableInput } from "@/features/embarques/components/garantias/GarantiaEditableInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  ESTADO_GARANTIA_LABEL,
  type EstadoGarantia,
  type GarantiaContenedor,
} from "@/features/embarques/types/garantia";
import { VenceBadge } from "@/features/embarques/components/garantias/VenceBadge";
import { useUpdateGarantia } from "@/features/embarques/hooks/useGarantiasContenedor";
import { todayLocalISO } from "@/lib/date/today";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { resolveTipoContenedorNombre } from "@/lib/domain/tipoContenedor";

interface Row extends GarantiaContenedor {
  numero_contenedor: string;
  tipo_contenedor: string;
}

const TIPOS_VACIOS: NonNullable<ReturnType<typeof useTiposContenedor>["data"]> = [];

const ESTADOS: EstadoGarantia[] = ['pendiente', 'depositado', 'liberado', 'retenido'];

interface Params {
  embarqueId: string;
  canEdit: boolean;
  fechaLlegadaReal?: string | null;
}

export function useGarantiasColumns({ embarqueId, canEdit, fechaLlegadaReal }: Params) {
  const { mutate } = useUpdateGarantia(embarqueId);
  // VIS-CE-251-05: resuelve UUIDs de tipo de contenedor al nombre legible.
  const { data: tiposContenedor = TIPOS_VACIOS } = useTiposContenedor();

  const handleChangeEstado = useCallback((id: string, estado: EstadoGarantia) => {
    const patch: Parameters<typeof mutate>[0] = { id, estado };
    const hoy = todayLocalISO();
    if (estado === 'depositado') {
      patch.fecha_deposito = fechaLlegadaReal && fechaLlegadaReal.length > 0
        ? fechaLlegadaReal.slice(0, 10)
        : hoy;
    }
    if (estado === 'liberado') patch.fecha_liberacion = hoy;
    mutate(patch);
  }, [mutate, fechaLlegadaReal]);

  // Keep editable cell types stable even if catalog/date data arrives while typing.
  const editableColumns = useMemo<ColumnDef<Row, unknown>[]>(() => defineColumns<Row>([
    { id: 'monto', header: 'Depósito USD', meta: { align: 'right', className: 'tabular-nums font-medium' },
      cell: ({ row }) => {
        const r = row.original;
        if (canEdit && !r.tiene_carta_garantia) {
          return (
            <GarantiaEditableInput
              aria-label="Monto de depósito en USD"
              type="number"
              min={0}
              step="0.01"
              value={String(r.monto_deposito_usd ?? 0)}
              className="h-8 w-[110px] ml-auto text-right tabular-nums"
              onCommit={(value) => {
                const monto = Number(value);
                if (!Number.isFinite(monto) || monto < 0) return false;
                mutate({ id: r.id, monto_deposito_usd: monto });
                return true;
              }}
            />
          );
        }
        return formatCurrency(Number(r.monto_deposito_usd), 'USD');
      }
    },
    { id: 'ref', header: 'Referencia / Folio', cell: ({ row }) => {
      const r = row.original;
      if (canEdit && !r.tiene_carta_garantia) {
        return (
          <GarantiaEditableInput
            aria-label="Referencia o folio del depósito"
            type="text"
            value={r.referencia_deposito ?? ''}
            placeholder="Banco / folio"
            className="h-8 w-[160px]"
            onCommit={(value) => {
              mutate({ id: r.id, referencia_deposito: value.trim() || null });
              return true;
            }}
          />
        );
      }
      return r.referencia_deposito || <span className="text-muted-foreground">—</span>;
    }},
  ]), [canEdit, mutate]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => defineColumns<Row>([
    { id: 'cont', header: 'Contenedor', cell: ({ row }) => (
      <span className="font-mono">{row.original.numero_contenedor}</span>
    )},
    { id: 'tipo', header: 'Tipo', cell: ({ row }) => resolveTipoContenedorNombre(row.original.tipo_contenedor, tiposContenedor) },
    { id: 'carta', header: 'Carta Garantía', cell: ({ row }) => row.original.tiene_carta_garantia
      ? <Badge className="bg-success/15 text-success border-success/30"><ShieldCheck className="size-3.5 mr-1" />Sí</Badge>
      : <Badge variant="outline" className="text-muted-foreground"><ShieldOff className="size-3.5 mr-1" />No</Badge>
    },
    ...editableColumns,
    { id: 'estado', header: 'Estado', cell: ({ row }) => canEdit ? (
      <Select value={row.original.estado} onValueChange={(v) => handleChangeEstado(row.original.id, v as EstadoGarantia)}>
        <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {ESTADOS.map(e => <SelectItem key={e} value={e}>{ESTADO_GARANTIA_LABEL[e]}</SelectItem>)}
        </SelectContent>
      </Select>
    ) : (
      <StatusBadge domain="garantia_naviera" status={ESTADO_GARANTIA_LABEL[row.original.estado]} />
    )},
    { id: 'fDep', header: 'F. Depósito', cell: ({ row }) => row.original.fecha_deposito ? formatDate(row.original.fecha_deposito) : '—' },
    { id: 'vence', header: 'Vence', cell: ({ row }) => row.original.estado === 'liberado'
      ? <span className="text-muted-foreground">Liberado</span>
      : <VenceBadge fechaLimite={row.original.fecha_limite_devolucion} />
    },
    { id: 'fLib', header: 'F. Liberación', cell: ({ row }) => row.original.fecha_liberacion ? formatDate(row.original.fecha_liberacion) : '—' },
  ]), [canEdit, editableColumns, handleChangeEstado, tiposContenedor]);

  return { columns };
}

export type { Row as GarantiaRow };
