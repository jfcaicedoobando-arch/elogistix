/** Vistas 2 y 3 del tarifario: cargos FOB de agentes / cargos locales por naviera. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportToCsv } from "@/generators/exportCsv";
import { formatCurrency } from "@/lib/formatters/numbers";
import { archivarCargo, listarCargos, type CargoTarifario, type TipoCargo } from "./cargosService";
import { CargoFormDialog } from "./CargoFormDialog";

interface Props { tipo: TipoCargo; orgId: string | null; puedeEditar: boolean }

export function CargosTab({ tipo, orgId, puedeEditar }: Props) {
  const q = useQuery({ queryKey: ["tarifario", "cargos", tipo], queryFn: () => listarCargos(tipo) });
  const [editando, setEditando] = useState<CargoTarifario | null | "nuevo">(null);
  const etiqueta = tipo === "fob" ? "Agente" : "Naviera";
  const filas = q.data ?? [];

  const descargar = () => exportToCsv(`${tipo === "fob" ? "cargos-fob" : "cargos-locales"}.csv`,
    [{ key: "e", label: etiqueta }, { key: "c", label: "Concepto" }, { key: "m", label: "Monto" }, { key: "cur", label: "Currency" }, { key: "u", label: "Unidad" }],
    filas.map((c) => ({ e: c.entidad?.nombre ?? "", c: c.concepto, m: c.monto, cur: c.moneda, u: c.unidad ?? "" })));

  const archivar = async (c: CargoTarifario) => {
    try { await archivarCargo(tipo, c.id); toast.success("Cargo retirado"); void q.refetch(); }
    catch { toast.error("No se pudo retirar el cargo."); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={descargar}><Download className="mr-1 size-4" /> Descargar Excel</Button>
        {puedeEditar && orgId && <Button onClick={() => setEditando("nuevo")}><Plus className="mr-1 size-4" /> Nuevo cargo</Button>}
      </div>
      {q.isError && <p className="text-body-sm text-destructive">No se pudieron cargar los cargos.</p>}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{etiqueta}</TableHead><TableHead>Concepto</TableHead><TableHead>Monto</TableHead>
            <TableHead>Currency</TableHead><TableHead>Unidad</TableHead>{puedeEditar && <TableHead />}
          </TableRow></TableHeader>
          <TableBody>
            {filas.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.entidad?.nombre ?? "—"}</TableCell><TableCell>{c.concepto}</TableCell>
                <TableCell className="tabular-nums">{formatCurrency(c.monto, c.moneda)}</TableCell>
                <TableCell>{c.moneda}</TableCell><TableCell>{c.unidad ?? "—"}</TableCell>
                {puedeEditar && (
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditando(c)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Retirar" onClick={() => void archivar(c)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!q.isLoading && filas.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin cargos capturados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {editando && orgId && (
        <CargoFormDialog tipo={tipo} orgId={orgId} cargo={editando === "nuevo" ? null : editando}
          onClose={() => setEditando(null)} onSaved={() => { void q.refetch(); }} />
      )}
    </div>
  );
}
