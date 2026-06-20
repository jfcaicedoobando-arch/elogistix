/**
 * Tab Garantías — control operativo de depósitos de contenedores por embarque.
 * No es facturable; los depósitos regresan a la empresa al devolver el vacío.
 *
 * v13.88.0: edición inline de monto y referencia para navieras sin carta,
 * autorrelleno de fecha de depósito desde fecha de llegada real, columna
 * "Vence" con badge calculado desde fecha_limite_devolucion y KPI de días
 * promedio de recuperación.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useGarantiasContenedor, useUpdateGarantia } from "@/features/embarques/hooks/useGarantiasContenedor";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import {
  ESTADO_GARANTIA_COLOR,
  ESTADO_GARANTIA_LABEL,
  type EstadoGarantia,
  type GarantiaContenedor,
} from "@/features/embarques/types/garantia";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  embarqueId: string;
  canEdit: boolean;
  /** Fecha de llegada real del embarque, usada para prellenar fecha_deposito. */
  fechaLlegadaReal?: string | null;
}

interface Row extends GarantiaContenedor {
  numero_contenedor: string;
  tipo_contenedor: string;
}

const ESTADOS: EstadoGarantia[] = ['pendiente', 'depositado', 'liberado', 'retenido'];

/** Diferencia en días entre dos fechas ISO (YYYY-MM-DD). */
function diffDias(desdeIso: string, hastaIso: string): number {
  const a = new Date(desdeIso + "T00:00:00").getTime();
  const b = new Date(hastaIso + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function VenceBadge({ fechaLimite }: { fechaLimite: string | null }) {
  if (!fechaLimite) return <span className="text-muted-foreground">—</span>;
  const hoyIso = new Date().toISOString().slice(0, 10);
  const dias = diffDias(hoyIso, fechaLimite);
  if (dias < 0) {
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Vencido hace {Math.abs(dias)}d</Badge>;
  }
  if (dias <= 3) {
    return <Badge className="bg-warning/15 text-warning border-warning/30">Vence en {dias}d</Badge>;
  }
  return <Badge className="bg-success/15 text-success border-success/30">{formatDate(fechaLimite)}</Badge>;
}

export function TabGarantias({ embarqueId, canEdit, fechaLlegadaReal }: Props) {
  const { data: garantias = [], isLoading } = useGarantiasContenedor(embarqueId);
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId);
  const updateMut = useUpdateGarantia(embarqueId);

  // Estado local para edición inline de monto / referencia.
  const [editing, setEditing] = useState<Record<string, { monto?: string; referencia?: string }>>({});

  const rows: Row[] = useMemo(() => {
    const cMap = new Map(contenedores.map(c => [c.id, c]));
    return garantias.map(g => {
      const c = cMap.get(g.embarque_contenedor_id);
      return {
        ...g,
        numero_contenedor: c?.numero_contenedor || '—',
        tipo_contenedor: c?.tipo_contenedor || '—',
      };
    });
  }, [garantias, contenedores]);

  const totalDeposito = rows.reduce((s, r) => s + Number(r.monto_deposito_usd), 0);
  const totalPendiente = rows.filter(r => r.estado === 'pendiente' || r.estado === 'depositado')
    .reduce((s, r) => s + Number(r.monto_deposito_usd), 0);

  // KPI: días promedio de recuperación (entre fecha_deposito y fecha_liberacion).
  const diasPromRecuperacion = useMemo(() => {
    const liberados = rows.filter(r => r.estado === 'liberado' && r.fecha_deposito && r.fecha_liberacion);
    if (liberados.length === 0) return null;
    const suma = liberados.reduce((s, r) => s + diffDias(r.fecha_deposito!, r.fecha_liberacion!), 0);
    return Math.round(suma / liberados.length);
  }, [rows]);

  const handleChangeEstado = (id: string, estado: EstadoGarantia) => {
    const patch: Parameters<typeof updateMut.mutate>[0] = { id, estado };
    const hoy = new Date().toISOString().slice(0, 10);
    if (estado === 'depositado') {
      patch.fecha_deposito = fechaLlegadaReal && fechaLlegadaReal.length > 0
        ? fechaLlegadaReal.slice(0, 10)
        : hoy;
    }
    if (estado === 'liberado') patch.fecha_liberacion = hoy;
    updateMut.mutate(patch);
  };

  const handleSaveMonto = (id: string) => {
    const draft = editing[id];
    if (!draft || draft.monto === undefined) return;
    const monto = Number(draft.monto);
    if (Number.isNaN(monto) || monto < 0) return;
    updateMut.mutate({ id, monto_deposito_usd: monto });
    setEditing(prev => { const n = { ...prev }; delete n[id].monto; return n; });
  };

  const handleSaveReferencia = (id: string) => {
    const draft = editing[id];
    if (!draft || draft.referencia === undefined) return;
    updateMut.mutate({ id, referencia_deposito: draft.referencia.trim() || null });
    setEditing(prev => { const n = { ...prev }; delete n[id].referencia; return n; });
  };

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
        // Sólo editable si la naviera NO tiene carta de garantía.
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
      <Badge className={ESTADO_GARANTIA_COLOR[row.original.estado]}>{ESTADO_GARANTIA_LABEL[row.original.estado]}</Badge>
    )},
    { id: 'fDep', header: 'F. Depósito', cell: ({ row }) => row.original.fecha_deposito ? formatDate(row.original.fecha_deposito) : '—' },
    { id: 'vence', header: 'Vence', cell: ({ row }) => row.original.estado === 'liberado'
      ? <span className="text-muted-foreground">Liberado</span>
      : <VenceBadge fechaLimite={row.original.fecha_limite_devolucion} />
    },
    { id: 'fLib', header: 'F. Liberación', cell: ({ row }) => row.original.fecha_liberacion ? formatDate(row.original.fecha_liberacion) : '—' },
  ]), [canEdit, editing, fechaLlegadaReal, updateMut.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="text-sm text-muted-foreground p-6">Cargando garantías…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-info">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Depósito total</p>
            <p className="text-lg font-bold tabular-nums mt-1">{formatCurrency(totalDeposito, 'USD')}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Por recuperar</p>
            <p className="text-lg font-bold tabular-nums mt-1">{formatCurrency(totalPendiente, 'USD')}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Contenedores</p>
            <p className="text-lg font-bold tabular-nums mt-1">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Días prom. recuperación</p>
            <p className="text-lg font-bold tabular-nums mt-1">
              {diasPromRecuperacion !== null ? `${diasPromRecuperacion} d` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-sm">Garantías por contenedor</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Los depósitos no son gasto: regresan al devolver el vacío. Si la naviera tiene carta
              de garantía vigente el monto esperado es 0; si no, captura aquí el monto USD y la
              referencia bancaria del depósito.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            density="compact"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={ShieldCheck}
                  title="Sin garantías registradas"
                  description="Las garantías se crean automáticamente al agregar contenedores al embarque."
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
