import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DistribucionBarras, EmptyMsg } from "./_helpers";
import type { AuditoriaEjecutivoData } from "@/hooks/auditoria/useAuditoriaEjecutivo";

interface Props {
  porEtapa: AuditoriaEjecutivoData["porEtapa"];
  topClientes: AuditoriaEjecutivoData["topClientes"];
  onDrillEtapa?: (etapa: string) => void;
  onDrillCliente?: (cliente: string) => void;
}

export function EjecutivoDistribucionRow({
  porEtapa,
  topClientes,
  onDrillEtapa,
  onDrillCliente,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pendientes por etapa del embarque
          </CardTitle>
        </CardHeader>
        <CardContent>
          {porEtapa.length === 0 ? (
            <EmptyMsg msg="Sin pendientes." />
          ) : (
            <DistribucionBarras
              items={porEtapa.map((e) => ({
                label: e.etapa,
                total: e.total,
                destacado: e.criticos,
                destacadoLabel: "críticos",
                onClick: onDrillEtapa ? () => onDrillEtapa(e.etapa) : undefined,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top 5 clientes con pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          {topClientes.length === 0 ? (
            <EmptyMsg msg="Sin pendientes por cliente." />
          ) : (
            <DistribucionBarras
              items={topClientes.map((c) => ({
                label: c.cliente,
                total: c.total,
                destacado: c.criticos,
                destacadoLabel: "críticos",
                onClick: onDrillCliente ? () => onDrillCliente(c.cliente) : undefined,
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
