import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatDate, getModoIcon } from "@/lib/helpers";
import type { EmbarqueConEstado, EstadoFiltro } from "@/hooks/useDashboardData";
import { ESTADO_CONFIG } from "./estadoConfig";

interface Props {
  embarques: EmbarqueConEstado[];
  filtroEstado: EstadoFiltro | null;
  onLimpiarFiltro: () => void;
  isLoading: boolean;
}

function shortName(raw: string) {
  return raw.split(/[,—]/)[0].trim();
}

const columns: DataTableColumn<EmbarqueConEstado>[] = [
  { key: "expediente", header: "Expediente", className: "font-medium", render: (e) => e.expediente },
  { key: "cliente", header: "Cliente", className: "max-w-[180px] truncate", render: (e) => e.cliente_nombre },
  {
    key: "modo", header: "Modo", render: (e) => (
      <span className="flex items-center gap-1.5">
        <span>{getModoIcon(e.modo)}</span>
        <span className="text-xs">{e.modo}</span>
      </span>
    ),
  },
  {
    key: "ruta", header: "Origen → Destino", className: "text-xs max-w-[180px] truncate", render: (e) => {
      const origen = shortName(e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "-");
      const destino = shortName(e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "-");
      return `${origen} → ${destino}`;
    },
  },
  { key: "etd", header: "ETD", className: "text-xs", render: (e) => e.etd ? formatDate(e.etd) : "-" },
  { key: "eta", header: "ETA", className: "text-xs", render: (e) => e.eta ? formatDate(e.eta) : "-" },
  {
    key: "estado", header: "Estado", render: (e) => {
      const cfg = ESTADO_CONFIG[e.estadoReal as EstadoFiltro];
      return (
        <Badge variant="secondary" className={`text-xs ${cfg ? `${cfg.text} bg-transparent border ${cfg.border}/30` : ""}`}>
          {e.estadoReal}
        </Badge>
      );
    },
  },
  { key: "operador", header: "Operador", className: "text-xs", render: (e) => e.operador },
];

export function EmbarquesActivosTable({ embarques, filtroEstado, onLimpiarFiltro, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Embarques Activos
            {filtroEstado && (
              <Badge className={`ml-2 text-[10px] ${ESTADO_CONFIG[filtroEstado].text}`}>
                {filtroEstado}
              </Badge>
            )}
          </CardTitle>
          {filtroEstado && (
            <button onClick={onLimpiarFiltro} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Limpiar filtro
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={embarques}
          isLoading={isLoading}
          emptyMessage={`No hay embarques${filtroEstado ? ` en estado "${filtroEstado}"` : ""}`}
          onRowClick={(e) => navigate(`/embarques/${e.id}`)}
          rowKey={(e) => e.id}
        />
      </CardContent>
    </Card>
  );
}
