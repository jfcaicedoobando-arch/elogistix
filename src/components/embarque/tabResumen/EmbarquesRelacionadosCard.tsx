import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { DataTable } from "@/components/shared/DataTable";
// eslint-disable-next-line no-restricted-imports -- render row custom para sub-tabla de embarques relacionados
import { TableRow, TableCell } from "@/components/ui/table";
import { useEmbarquesRelacionados } from "@/hooks/embarque";

type RelacionadoRow = ReturnType<typeof useEmbarquesRelacionados>["data"] extends (infer U)[] | undefined ? U : never;

interface Props {
  embarqueId: string;
  blMaster: string | null;
  relacionados: RelacionadoRow[];
}

export function EmbarquesRelacionadosCard({ embarqueId, blMaster, relacionados }: Props) {
  const navigate = useNavigate();
  const totalPeso = relacionados.reduce((s, r) => s + (Number(r.peso_kg) || 0), 0);
  const totalVol = relacionados.reduce((s, r) => s + (Number(r.volumen_m3) || 0), 0);
  const totalPiezas = relacionados.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
  const ordenados = [...relacionados].sort((a, b) =>
    a.id === embarqueId ? -1 : b.id === embarqueId ? 1 : 0,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link className="h-4 w-4" />
          Embarques del BL Master: {blMaster}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {relacionados.length} contenedores · {formatNumber(totalPeso, { suffix: "kg" })} · {formatNumber(totalVol, { decimals: 2, suffix: "m³" })} · {formatNumber(totalPiezas)} piezas
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={[
            { key: "expediente", header: "Expediente", className: "font-medium", render: (r: RelacionadoRow) => (
              <span className="inline-flex items-center gap-2">
                {r.expediente}
                {r.id === embarqueId && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Actual</Badge>}
              </span>
            ) },
            { key: "bl_house", header: "BL House", className: "text-xs", render: (r: RelacionadoRow) => r.bl_house || '-' },
            { key: "contenedor", header: "Contenedor", className: "text-xs", render: (r: RelacionadoRow) =>
              r.contenedor ? `${r.contenedor}${r.tipo_contenedor ? ` (${r.tipo_contenedor})` : ''}` : '-' },
            { key: "peso", header: "Peso", align: "right", className: "text-xs tabular-nums", render: (r: RelacionadoRow) =>
              formatNumber(Number(r.peso_kg), { suffix: "kg" }) },
            { key: "volumen", header: "Volumen", align: "right", className: "text-xs tabular-nums", render: (r: RelacionadoRow) =>
              formatNumber(Number(r.volumen_m3), { decimals: 2, suffix: "m³" }) },
            { key: "piezas", header: "Piezas", align: "right", className: "text-xs tabular-nums", render: (r: RelacionadoRow) =>
              formatNumber(r.piezas) },
            { key: "estado", header: "Estado", render: (r: RelacionadoRow) => (
              <Badge variant="secondary" className={`text-xs ${getEstadoColor(r.estado)}`}>{r.estado}</Badge>
            ) },
          ]}
          data={ordenados}
          rowKey={(r) => r.id}
          density="compact"
          rowClassName={(r) => r.id === embarqueId ? 'bg-accent/10 font-medium' : ''}
          onRowClick={(r) => r.id !== embarqueId && navigate(`/embarques/${r.id}`)}
          footer={
            <TableRow className="hover:bg-transparent even:bg-transparent font-semibold">
              <TableCell colSpan={3} className="text-xs text-right">Totales:</TableCell>
              <TableCell className="text-xs text-right tabular-nums">{formatNumber(totalPeso, { suffix: "kg" })}</TableCell>
              <TableCell className="text-xs text-right tabular-nums">{formatNumber(totalVol, { decimals: 2, suffix: "m³" })}</TableCell>
              <TableCell className="text-xs text-right tabular-nums">{formatNumber(totalPiezas)}</TableCell>
              <TableCell />
            </TableRow>
          }
        />
      </CardContent>
    </Card>
  );
}
