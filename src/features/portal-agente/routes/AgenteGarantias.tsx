/**
 * Carta garantía y tabulador de demoras del agente.
 *
 * Reutiliza el flujo de `CosteoNavieras` (NavieraCondicionForm + DemorasTarifaEditor).
 * El agente sólo verá/podrá modificar las condiciones cuyo proveedor coincide con su
 * `costeo_agente.proveedor_id` (lo aplica la RLS `Agente CRUD own naviera condiciones`).
 *
 * Nota: el form de condiciones obliga a elegir un "Proveedor vinculado". El agente
 * sólo verá su propio proveedor en la lista porque la query `fetchProveedoresPorTipo`
 * pasa por RLS de `proveedores` (org-scoped) y, en su org, sólo está su proveedor activo
 * del tipo Naviera. Si la naviera aún no está vinculada al agente, RLS rechazará el
 * insert con un mensaje claro.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, FileSignature, Info } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  useCondicionesNaviera,
  useNavierasCatalogo,
} from "@/features/costeo/hooks/useNavieraCondiciones";
import { NavieraCondicionForm } from "@/features/costeo/components/NavieraCondicionForm";
import { DemorasTarifaEditor } from "@/features/costeo/components/DemorasTarifaEditor";
import { CartaGarantiaBadge } from "@/features/costeo/components/CartaGarantiaBadge";
import type { CosteoNavieraCondicion } from "@/features/costeo/types/navieraCondicion";

interface FilaNaviera {
  naviera_id: string;
  naviera_nombre: string;
  naviera_code: string;
  condicion: CosteoNavieraCondicion | null;
}

export default function AgenteGarantias() {
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
    <div className="space-y-4">
      <PageHeader
        title="Carta garantía y demoras"
        description="Mantén actualizada tu carta garantía y el tabulador escalonado de demoras por naviera."
      />

      <Card className="p-3 flex items-start gap-2 bg-muted/40">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong>¿Por qué importa?</strong> La carta garantía vigente permite que tus tarifas
          aparezcan como prioritarias en el comparador de cotizaciones. Si vence, el sistema
          marca tus tarifas con un aviso amarillo. El tabulador escalonado define cuánto cobra la
          naviera por cada día extra de demora (después de los días libres).
        </p>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naviera</TableHead>
              <TableHead>SCAC</TableHead>
              <TableHead>Carta garantía</TableHead>
              <TableHead className="text-right">Días libres</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(loadingNav || loadingCond) && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
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
                title={!seleccion.condicion ? "Primero guarda las condiciones generales" : undefined}
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
