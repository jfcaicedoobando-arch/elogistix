/** Vistas 2 y 3 del tarifario: cargos FOB de agentes / cargos locales por naviera. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { costeo } from "../queryKeys";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { exportToCsv } from "@/generators/exportCsv";
import { formatCurrency } from "@/lib/formatters/numbers";
import { archivarCargo, listarCargos, type CargoTarifario, type TipoCargo } from "./cargosService";
import { CargoFormDialog } from "./CargoFormDialog";

interface Props { tipo: TipoCargo; orgId: string | null; puedeEditar: boolean }

export function CargosTab({ tipo, orgId, puedeEditar }: Props) {
  const q = useQuery({ queryKey: costeo.tarifario.cargos(tipo), queryFn: () => listarCargos(tipo) });
  const [editando, setEditando] = useState<CargoTarifario | null | "nuevo">(null);
  const etiqueta = tipo === "fob" ? "Agente" : "Naviera";
  const filas = q.data ?? [];

  const descargar = () => exportToCsv(`${tipo === "fob" ? "cargos-fob" : "cargos-locales"}.csv`,
    [{ key: "e", label: etiqueta }, { key: "c", label: "Concepto" }, { key: "m", label: "Monto" }, { key: "cur", label: "Currency" }, { key: "u", label: "Unidad" }],
    filas.map((c) => ({ e: c.entidad?.nombre ?? "", c: c.concepto, m: c.monto, cur: c.moneda, u: c.unidad ?? "" })));

  const archivar = async (c: CargoTarifario) => {
    try { await archivarCargo(tipo, c.id); notifySuccess(undefined, { title: "Cargo retirado" }); void q.refetch(); }
    catch (error) { notifyError(undefined, { title: "No se pudo retirar el cargo.", error, method: "archivarCargo" }); }
  };

  const columns = defineColumns<CargoTarifario>([
    { id: "entidad", header: etiqueta, accessorFn: (c) => c.entidad?.nombre ?? "—" },
    { accessorKey: "concepto", header: "Concepto" },
    { accessorKey: "monto", header: "Monto", cell: ({ row }) => formatCurrency(row.original.monto, row.original.moneda) },
    { accessorKey: "moneda", header: "Currency" },
    { id: "unidad", header: "Unidad", accessorFn: (c) => c.unidad ?? "—" },
    ...(puedeEditar ? [{ id: "acciones", header: "Acciones", cell: ({ row }: { row: { original: CargoTarifario } }) => <>
      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditando(row.original)}><Pencil className="size-4" /></Button>
      <Button size="icon" variant="ghost" aria-label="Retirar" onClick={() => void archivar(row.original)}><Trash2 className="size-4" /></Button>
    </> }] : []),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={descargar}><Download className="mr-1 size-4" /> Descargar Excel</Button>
        {puedeEditar && orgId && <Button onClick={() => setEditando("nuevo")}><Plus className="mr-1 size-4" /> Nuevo cargo</Button>}
      </div>
      <DataTable columns={columns} data={filas} rowKey={(c) => c.id} isLoading={q.isLoading}
        isError={q.isError} onRetry={() => { void q.refetch(); }} emptyMessage="Sin cargos capturados." />
      {editando && orgId && (
        <CargoFormDialog tipo={tipo} orgId={orgId} cargo={editando === "nuevo" ? null : editando}
          onClose={() => setEditando(null)} onSaved={() => { void q.refetch(); }} />
      )}
    </div>
  );
}
