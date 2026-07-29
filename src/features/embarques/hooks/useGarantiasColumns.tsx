import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { VenceBadge } from "./VenceBadge";
import { useUpdateGarantia } from "@/features/embarques/hooks/useGarantiasContenedor";
import { todayLocalISO } from "@/lib/date/today";

interface Row extends GarantiaContenedor {
  numero_contenedor: string;
  tipo_contenedor: string;
}

const ESTADOS: EstadoGarantia[] = ['pendiente', 'depositado', 'liberado', 'retenido'];

interface Params {
  embarqueId: string;
  canEdit: boolean;
  fechaLlegadaReal?: string | null;
}

export function useGarantiasColumns({ embarqueId, canEdit, fechaLlegadaReal }: Params) {
  const updateMut = useUpdateGarantia(embarqueId);
  const [editing, setEditing] = useState<Record<string, { monto?: string; referencia?: string }>>({});

  const handleChangeEstado = useCallback((id: string, estado: EstadoGarantia) => {
    const patch: Parameters<typeof updateMut.mutate>[0] = { id, estado };
    const hoy = todayLocalISO();
    if (estado === 'depositado') {
      patch.fecha_deposito = fechaLlegadaReal && fechaLlegadaReal.length > 0
        ? fechaLlegadaReal.slice(0, 10)
        : hoy;
    }
    if (estado === 'liberado') patch.fecha_liberacion = hoy;
    updateMut.mutate(patch);
  }, [updateMut, fechaLlegadaReal]);

  const handleSaveMonto = useCallback((id: string) => {
    const draft = editing[id];
    if (!draft || draft.monto === undefined) return;
    const monto = Number(draft.monto);
    if (Number.isNaN(monto) || monto < 0) return;
    updateMut.mutate({ id, monto_deposito_usd: monto });
    setEditing(prev => { const n = { ...prev }; delete n[id].monto; return n; });
  }, [editing, updateMut]);

  const handleSaveReferencia = useCallback((id: string) => {
    const draft = editing[id];
    if (!draft || draft.referencia === undefined) return;
    updateMut.mutate({ id, referencia_deposito: draft.referencia.trim() || null });
    setEditing(prev => { const n = { ...prev }; delete n[id].referencia; return n; });
  }, [editing, updateMut]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => defineColumns<Row>([
    { id: 'cont', header: 'Contenedor', cell: ({ row }) => (
      <span className="font-mono">{row.original.numero_contenedor}</span>
    )},
    { id: 'tipo', header: 'Tipo', cell: ({ row }) => row.original.tipo_contenedor },
    { id: 'carta', header: 'Carta Garantía', cell: ({ row }) => row.original.tiene_carta_garantia
      ? <Badge className="bg-success/15 text-success border-success/30"><ShieldCheck className="size-3 mr-1" />Sí</Badge>
      : <Badge variant="outline" className="text-muted-foreground"><ShieldOff className="size-3 mr-1" />No</Badge>
    },
    { id: 'monto', header: 'Depósito USD', meta: { align: 'right', className: 'tabular-nums font-medium' },
      cell: ({ row }) => {
        const r = row.original;
        if (canEdit && !r.tiene_carta_garantia) {
          const draft = editing[r.id]?.monto;
          const value = draft !== undefined ? draft : String(r.monto_deposito_usd ?? 0);
          return (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value}
              className="h-8 w-[110px] ml-auto text-right tabular-nums"
              onChange={(e) => setEditing(prev => ({ ...prev, [r.id]: { ...prev[r.id], monto: e.target.value } }))}
              onBlur={() => handleSaveMonto(r.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          );
        }
        return formatCurrency(Number(r.monto_deposito_usd), 'USD');
      }
    },
    { id: 'ref', header: 'Referencia / Folio', cell: ({ row }) => {
      const r = row.original;
      if (canEdit && !r.tiene_carta_garantia) {
        const draft = editing[r.id]?.referencia;
        const value = draft !== undefined ? draft : (r.referencia_deposito ?? '');
        return (
          <Input
            type="text"
            value={value}
            placeholder="Banco / folio"
            className="h-8 w-[160px]"
            onChange={(e) => setEditing(prev => ({ ...prev, [r.id]: { ...prev[r.id], referencia: e.target.value } }))}
            onBlur={() => handleSaveReferencia(r.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        );
      }
      return r.referencia_deposito || <span className="text-muted-foreground">—</span>;
    }},
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
  ]), [canEdit, editing, handleChangeEstado, handleSaveMonto, handleSaveReferencia]);

  return { columns };
}

export type { Row as GarantiaRow };
