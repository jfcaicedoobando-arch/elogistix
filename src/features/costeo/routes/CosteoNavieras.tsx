/**
 * Página: Condiciones por naviera (carta garantía + tabulador de demoras).
 * Lista todas las navieras del catálogo y permite configurar las condiciones
 * comerciales que negociamos con cada una.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, FileSignature } from "lucide-react";
import {
  useCondicionesNaviera,
  useNavierasCatalogo,
} from "@/features/costeo/hooks/useNavieraCondiciones";
import { NavieraCondicionForm } from "@/features/costeo/components/NavieraCondicionForm";
import { DemorasTarifaEditor } from "@/features/costeo/components/DemorasTarifaEditor";
import { CartaGarantiaBadge } from "@/features/costeo/components/CartaGarantiaBadge";
import type { CosteoNavieraCondicion } from "@/features/costeo/types/navieraCondicion";
import { PageHeader } from "@/components/shared/PageHeader";

interface FilaNaviera {
  naviera_id: string;
  naviera_nombre: string;
  naviera_code: string;
  condicion: CosteoNavieraCondicion | null;
}

export default function CosteoNavieras() {
  const { data: navieras = [], isLoading: loadingNav } = useNavierasCatalogo();
  const { data: condiciones = [], isLoading: loadingCond } = useCondicionesNaviera();
  const [seleccion, setSeleccion] = useState<FilaNaviera | null>(null);

  const filas: FilaNaviera[] = useMemo(() => {
    const mapa = new Map(condiciones.map((c) => [c.naviera_id, c]));
    return navieras.map((n) => ({
      naviera_id: n.id,
      naviera_nombre: n.name,
      naviera_code: n.code,
      condicion: mapa.get(n.id) ?? null,
    }));
  }, [navieras, condiciones]);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Condiciones por naviera"
        description="Carta garantía, días libres y tabulador escalonado de demoras por tipo de contenedor."
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naviera</TableHead>
              <TableHead>SCAC</TableHead>
              <TableHead>Carta garantía</TableHead>
              <TableHead className="text-right">Días libres</TableHead>
              <TableHead>Proveedor vinculado</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(loadingNav || loadingCond) && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {filas.map((f) => (
              <TableRow key={f.naviera_id}>
                <TableCell className="font-medium">{f.naviera_nombre}</TableCell>
                <TableCell className="font-mono text-xs">{f.naviera_code}</TableCell>
                <TableCell>
                  <CartaGarantiaBadge
                    tieneCarta={f.condicion?.tiene_carta_garantia ?? false}
                    vigenteHasta={f.condicion?.carta_garantia_vigente_hasta ?? null}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {f.condicion?.dias_libres_demoras_default ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {f.condicion ? "Vinculado" : "Sin configurar"}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setSeleccion(f)}>
                    <Settings2 className="size-4 mr-1" /> Configurar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <FormDialogShell
        open={!!seleccion}
        onOpenChange={(o) => !o && setSeleccion(null)}
        icon={FileSignature}
        title={seleccion ? `Condiciones — ${seleccion.naviera_nombre}` : "Condiciones"}
        description="Carta garantía, días libres y tabulador de demoras por tipo de contenedor."
        size="3xl"
        footer={null}
      >
        {seleccion && (
          <Tabs defaultValue="condiciones">
            <TabsList>
              <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
              <TabsTrigger
                value="demoras"
                disabled={!seleccion.condicion}
                title={!seleccion.condicion ? "Primero guarda las condiciones generales para habilitar el tabulador" : undefined}
              >
                Tabulador de demoras
              </TabsTrigger>
            </TabsList>
            <TabsContent value="condiciones" className="pt-4">
              <NavieraCondicionForm
                navieraId={seleccion.naviera_id}
                navieraNombre={seleccion.naviera_nombre}
                existente={seleccion.condicion}
                onSaved={() => setSeleccion(null)}
              />
            </TabsContent>
            <TabsContent value="demoras" className="pt-4">
              {seleccion.condicion ? (
                <DemorasTarifaEditor navieraCondicionId={seleccion.condicion.id} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Primero guarda las condiciones generales para habilitar el tabulador.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </FormDialogShell>
    </div>
  );
}
