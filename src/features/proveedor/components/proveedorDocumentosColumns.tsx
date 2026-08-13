/**
 * Ola 3 / Ola 4 — Columnas del expediente del proveedor: reexporta las columnas
 * compartidas del expediente para no duplicar la tabla en cada ficha.
 */
import type { ColumnDef } from "@/components/shared/DataTable";
import { expedienteColumns } from "@/features/expediente/components/expedienteColumns";
import type { DocumentoProveedor } from "@/features/proveedor/domain/documentosProveedor";

interface Acciones {
  onDescargar: (doc: DocumentoProveedor) => void;
  onEliminar?: (doc: DocumentoProveedor) => void;
}

export function documentosProveedorColumns<T extends DocumentoProveedor>(
  acciones: Acciones,
): ColumnDef<T, unknown>[] {
  return expedienteColumns<T>({
    onDescargar: acciones.onDescargar,
    onEliminar: acciones.onEliminar,
  });
}
