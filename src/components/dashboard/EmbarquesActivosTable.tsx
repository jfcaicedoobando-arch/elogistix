import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, getModoIcon } from "@/lib/helpers";
import type { EmbarqueConEstado, EstadoFiltro } from "@/hooks/useDashboardData";
import { ESTADO_CONFIG } from "./estadoConfig";

interface Props {
  embarques: EmbarqueConEstado[];
  filtroEstado: EstadoFiltro | null;
  onLimpiarFiltro: () => void;
  isLoading: boolean;
}

export function EmbarquesActivosTable({
  embarques,
  filtroEstado,
  onLimpiarFiltro,
  isLoading,
}: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Embarques Activos
            {filtroEstado && (
              <Badge
                className={`ml-2 text-[10px] ${ESTADO_CONFIG[filtroEstado].text}`}
              >
                {filtroEstado}
              </Badge>
            )}
          </CardTitle>
          {filtroEstado && (
            <button
              onClick={onLimpiarFiltro}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : embarques.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay embarques
            {filtroEstado ? ` en estado "${filtroEstado}"` : ""}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expediente</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Origen → Destino</TableHead>
                <TableHead>ETD</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Operador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {embarques.map((e) => {
                const origen = (
                  e.puerto_origen ||
                  e.aeropuerto_origen ||
                  e.ciudad_origen ||
                  "-"
                ).split(",")[0];
                const destino = (
                  e.puerto_destino ||
                  e.aeropuerto_destino ||
                  e.ciudad_destino ||
                  "-"
                ).split(",")[0];
                const cfg = ESTADO_CONFIG[e.estadoReal as EstadoFiltro];

                return (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/embarques/${e.id}`)}
                  >
                    <TableCell className="font-medium">
                      {e.expediente}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {e.cliente_nombre}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span>{getModoIcon(e.modo)}</span>
                        <span className="text-xs">{e.modo}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">
                      {origen} → {destino}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.etd ? formatDate(e.etd) : "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.eta ? formatDate(e.eta) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          cfg
                            ? `${cfg.text} bg-transparent border ${cfg.border}/30`
                            : ""
                        }`}
                      >
                        {e.estadoReal}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.operador}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
