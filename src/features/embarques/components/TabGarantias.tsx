/**
 * Tab Garantías — control operativo de depósitos de contenedores por embarque.
 * No es facturable; los depósitos regresan a la empresa al devolver el vacío.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}

interface Row extends GarantiaContenedor {
  numero_contenedor: string;
  tipo_contenedor: string;
}

const ESTADOS: EstadoGarantia[] = ['pendiente', 'depositado', 'liberado', 'retenido'];

export function TabGarantias({ embarqueId, canEdit }: Props) {
  const { data: garantias = [], isLoading } = useGarantiasContenedor(embarqueId);
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId);
  const updateMut = useUpdateGarantia(embarqueId);

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

  const handleChangeEstado = (id: string, estado: EstadoGarantia) => {
    const patch: Parameters<typeof updateMut.mutate>[0] = { id, estado };
    const today = new Date().toISOString().slice(0, 10);
    if (estado === 'depositado') patch.fecha_deposito = today;
    if (estado === 'liberado') patch.fecha_liberacion = today;
    updateMut.mutate(patch);
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
      cell: ({ row }) => formatCurrency(Number(row.original.monto_deposito_usd), 'USD') },
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
    { id: 'fLib', header: 'F. Liberación', cell: ({ row }) => row.original.fecha_liberacion ? formatDate(row.original.fecha_liberacion) : '—' },
  ]), [canEdit, updateMut.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="text-sm text-muted-foreground p-6">Cargando garantías…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-sm">Garantías por contenedor</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Los depósitos no son gasto: regresan al devolver el vacío. Si la naviera tiene carta de garantía vigente, el monto esperado es 0.
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

export default TabGarantias;
