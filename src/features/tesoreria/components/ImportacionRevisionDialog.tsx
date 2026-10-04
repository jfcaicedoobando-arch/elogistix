import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { DataTable } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ImportacionPendiente } from "@/features/tesoreria/hooks/useImportarEstadoCuenta";
import { columnasRevisionImportacion } from "./ImportacionRevisionColumns";

interface Props {
  revision: ImportacionPendiente | null;
  confirmando: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
const FORM_ID = "form-importacion-revision";

export function ImportacionRevisionDialog({ revision, confirmando, onConfirm, onCancel }: Props) {
  const [coincidenciasRevisadas, setCoincidenciasRevisadas] = useState(false);
  useEffect(() => setCoincidenciasRevisadas(false), [revision]);
  const columns = useMemo(() => columnasRevisionImportacion(revision?.cuenta.moneda ?? "MXN"), [revision?.cuenta.moneda]);
  if (!revision) return null;
  const { cuenta, resumen: r } = revision;
  const requiereRevision = r.vinculables > 0 || r.ambiguas > 0;
  const bloqueado = confirmando || (requiereRevision && !coincidenciasRevisadas);
  return <FormDialogShell open onOpenChange={(open) => { if (!open && !confirmando) onCancel(); }}
    icon={FileSpreadsheet} title="Revisar importación bancaria" size="xl" formId={FORM_ID}
    description="Revisa el destino y los movimientos interpretados. El archivo todavía no se ha guardado."
    onSubmit={(e) => { e.preventDefault(); if (!bloqueado) onConfirm(); }}
    footer={<FormDialogFooter formId={FORM_ID} onCancel={onCancel} confirmLabel="Confirmar importación"
      loading={confirmando} disabled={bloqueado} />}>
    <FormDialogSection title="Archivo y cuenta de destino" cols={1}>
      <p className="text-body break-all">{revision.archivo}</p>
      <p className="text-body font-medium">{cuenta.banco} · {cuenta.alias} · {cuenta.moneda}</p>
      <p className="text-body-sm text-muted-foreground">Fechas interpretadas: {formatDate(r.desde)} a {formatDate(r.hasta)}.</p>
      <p className="text-body-sm">{r.filas.length} filas: {r.nuevas} nuevas, {r.duplicadas} duplicadas y {r.vinculables} vinculables.</p>
      <p className="text-body-sm">Totales del archivo: cargos {formatCurrency(r.cargos, cuenta.moneda)} · abonos {formatCurrency(r.abonos, cuenta.moneda)} · neto {formatCurrency(r.abonos - r.cargos, cuenta.moneda)}.</p>
      {revision.sinImporte > 0 && <p className="text-body-sm text-muted-foreground">{revision.sinImporte} filas sin importe se omitirán.</p>}
    </FormDialogSection>
    <FormDialogSection title="Movimientos interpretados" cols={1}>
      <DataTable columns={columns} data={r.filas} rowKey={(f) => f.movimiento.hash_dedupe} emptyMessage="No hay movimientos para importar." />
    </FormDialogSection>
    {requiereRevision && <FormDialogSection title="Coincidencias que requieren revisión" cols={1}>
      {r.vinculables > 0 && <p className="text-body-sm">{r.vinculables} filas coinciden de forma única con cobros internos. Al confirmar sustituirán su movimiento por la información del banco, conservando el vínculo y sin duplicar el dinero.</p>}
      {r.ambiguas > 0 && <p className="text-body-sm text-warning">{r.ambiguas} filas tienen varias coincidencias. Se importarán como nuevas, sin vincularlas automáticamente. Cancela y corrige el archivo si no corresponde.</p>}
      <div className="flex items-start gap-2"><Checkbox id="importacion-coincidencias-revisadas" checked={coincidenciasRevisadas}
        disabled={confirmando} onCheckedChange={(v) => setCoincidenciasRevisadas(v === true)} />
        <Label htmlFor="importacion-coincidencias-revisadas">Revisé las coincidencias y confirmo el tratamiento descrito.</Label>
      </div>
    </FormDialogSection>}
  </FormDialogShell>;
}
