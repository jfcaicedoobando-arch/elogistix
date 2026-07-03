import { useMemo, useState } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { MonthPickerMx } from "@/components/ui/month-picker-mx";
import { formatCurrency } from "@/lib/formatters";
import { useComisionesDevengadas, useUsuariosVendedores } from "@/features/comisiones/hooks";
import { useVendedorasEmailWarning } from "@/features/comisiones/hooks/useVendedorasEmailWarning";
import { buildComisionesColumns } from "@/features/comisiones/components/comisionesColumns";
import { TabLiquidaciones } from "@/features/comisiones/components/TabLiquidaciones";
import { TabVendedorasConfig } from "@/features/comisiones/components/TabVendedorasConfig";
import type { EstadoComision } from "@/features/comisiones/services";

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent density="tight">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

const ESTADOS: Array<EstadoComision | "todos"> = ["todos", "Devengada", "Liquidada", "Cancelada"];

export default function Comisiones() {
  const [vendedora, setVendedora] = useState<string>("todas");
  const [estado, setEstado] = useState<EstadoComision | "todos">("todos");
  const [periodo, setPeriodo] = useState<string>("");

  const { data: vendedoras = [] } = useUsuariosVendedores();
  const { data: comisiones = [], isLoading, kpis } = useComisionesDevengadas({
    vendedora_id: vendedora as string | "todas",
    estado,
    periodo: periodo || undefined,
  });

  useVendedorasEmailWarning(vendedoras);

  const columns = useMemo(() => buildComisionesColumns(), []);

  return (
    <PageContainer>
      <PageHeader
        title="Comisiones"
        description="Comisiones devengadas al cobrar facturas y liquidaciones a vendedoras"
      />

      <Tabs defaultValue="devengadas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devengadas">Devengadas</TabsTrigger>
          <TabsTrigger value="liquidaciones">Liquidaciones</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="devengadas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <KPICard label="Devengado del mes" value={formatCurrency(kpis.devengado_mes_mxn, "MXN")} />
            <KPICard label="Pendiente de liquidar" value={formatCurrency(kpis.pendiente_liquidar_mxn, "MXN")} />
            <KPICard label="Liquidado del mes" value={formatCurrency(kpis.liquidado_mes_mxn, "MXN")} />
          </div>

          <Card>
            <CardContent density="compact" className="flex flex-wrap gap-3">
              <Select value={vendedora} onValueChange={setVendedora}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las vendedoras</SelectItem>
                  {vendedoras.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoComision | "todos")}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>{e === "todos" ? "Todos los estados" : e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <MonthPickerMx
                value={periodo}
                onChange={setPeriodo}
                className="w-[180px] h-9"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent density="flush">
              <DataTable
                columns={columns}
                data={comisiones}
                isLoading={isLoading}
                emptyMessage="No hay comisiones devengadas"
                rowKey={(c) => c.id}
                density="comfortable"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liquidaciones">
          <TabLiquidaciones vendedoras={vendedoras} />
        </TabsContent>

        <TabsContent value="config">
          <TabVendedorasConfig vendedoras={vendedoras} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
