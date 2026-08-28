import { useState, useMemo } from "react";
import { Plus, Inbox } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnticiposProveedor, type AnticipoProveedorRow } from "../hooks/useAnticiposProveedor";
import { RegistrarAnticipoDialog } from "../components/RegistrarAnticipoDialog";
import { AplicarAnticipoDialog } from "../components/AplicarAnticipoDialog";
import { CancelarAnticipoDialog } from "../components/CancelarAnticipoDialog";
import { DevolverAnticipoDialog } from "../components/DevolverAnticipoDialog";
import { VincularEmbarqueAnticipoDialog } from "../components/VincularEmbarqueAnticipoDialog";

import { usePermissions, useTextoUrl } from "@/hooks/shared";
import { useProveedoresLite } from "@/features/proveedor/hooks";
import { PageSkeleton } from "@/components/shared/skeletons";
import EmptyState from "@/components/empty/EmptyState";
import { buildAnticipoColumns } from "./_sections/buildAnticipoColumns";
import { AnticiposKpis } from "./_sections/AnticiposKpis";

export default function AnticiposProveedor() {
  const { canEditFinance } = usePermissions();
  // M8 (Ola 8): filtros en la URL (link compartible).
  const [estado, setEstado] = useTextoUrl("estado", "todos");
  const [proveedorId, setProveedorId] = useTextoUrl("proveedor", "todos");
  const [soloSinEmbarque, setSoloSinEmbarque] = useState(false);

  const [openRegistrar, setOpenRegistrar] = useState(false);
  const [anticipoParaAplicar, setAnticipoParaAplicar] = useState<AnticipoProveedorRow | null>(null);
  const [anticipoParaCancelar, setAnticipoParaCancelar] = useState<AnticipoProveedorRow | null>(null);
  const [anticipoParaDevolver, setAnticipoParaDevolver] = useState<AnticipoProveedorRow | null>(null);
  const [anticipoParaVincular, setAnticipoParaVincular] = useState<AnticipoProveedorRow | null>(null);

  const { data, isLoading, isError, refetch } = useAnticiposProveedor({
    estado: estado === "todos" ? null : estado,
    proveedorId: proveedorId === "todos" ? null : proveedorId,
    sinEmbarque: soloSinEmbarque,
  });

  const { data: proveedores = [] } = useProveedoresLite();

  const columns = useMemo(
    () =>
      buildAnticipoColumns({
        canEditFinance,
        onAplicar: setAnticipoParaAplicar,
        onCancelar: setAnticipoParaCancelar,
        onDevolver: setAnticipoParaDevolver,
        onVincularEmbarque: setAnticipoParaVincular,
      }),
    [canEditFinance],
  );


  if (isLoading) return <PageSkeleton />;

  return (
    <PageContainer>
      <PageHeader
        title="Anticipos a proveedores"
        description="Gestión de pagos por adelantado y aplicaciones a facturas"
        actions={
          <Button onClick={() => setOpenRegistrar(true)} disabled={!canEditFinance}>
            <Plus className="mr-2 h-4 w-4" /> Registrar anticipo
          </Button>
        }
      />

      <AnticiposKpis anticipos={data} />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-64">
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">
                Estado
              </label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="aplicado_parcial">Aplicado parcial</SelectItem>
                  <SelectItem value="aplicado_total">Aplicado total</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="devuelto">Devuelto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-80">
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">
                Proveedor
              </label>
              <Select value={proveedorId} onValueChange={setProveedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los proveedores</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-64">
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">
                Vínculo con embarque
              </label>
              <Select
                value={soloSinEmbarque ? "sin" : "todos"}
                onValueChange={(v) => setSoloSinEmbarque(v === "sin")}
              >
                <SelectTrigger aria-label="Filtrar anticipos por vínculo con embarque">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sin">Sólo sin embarque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No hay anticipos"
              description="No se encontraron anticipos registrados con los filtros seleccionados."
              primaryAction={
                estado === "todos" && proveedorId === "todos" && canEditFinance
                  ? { label: "Registrar primer anticipo", onClick: () => setOpenRegistrar(true), variant: "outline" }
                  : undefined
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={data}
              rowKey={(r) => r.id}
              isLoading={isLoading}
              isError={isError}
              onRetry={refetch}
            />
          )}
        </CardContent>
      </Card>

      <RegistrarAnticipoDialog
        open={openRegistrar}
        onOpenChange={setOpenRegistrar}
      />

      <AplicarAnticipoDialog
        open={!!anticipoParaAplicar}
        onOpenChange={(o) => !o && setAnticipoParaAplicar(null)}
        anticipo={anticipoParaAplicar}
      />

      <CancelarAnticipoDialog
        open={!!anticipoParaCancelar}
        onOpenChange={(o) => !o && setAnticipoParaCancelar(null)}
        anticipo={anticipoParaCancelar}
      />

      <DevolverAnticipoDialog
        open={!!anticipoParaDevolver}
        onOpenChange={(o) => !o && setAnticipoParaDevolver(null)}
        anticipo={anticipoParaDevolver}
      />

      <VincularEmbarqueAnticipoDialog
        open={!!anticipoParaVincular}
        onOpenChange={(o) => !o && setAnticipoParaVincular(null)}
        anticipo={anticipoParaVincular}
      />

    </PageContainer>
  );
}
