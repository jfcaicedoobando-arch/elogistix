/**
 * DialogDescargarZipMes — descarga el paquete ZIP mensual de CFDI directo del
 * PAC (FacturApi zip-requests, SDK 4.20.0): PDF+XML de facturas, notas de
 * crédito y REPs del mes en un solo archivo. Pensado para el cierre contable.
 *
 * v13.794.0
 */
import { useMemo, useState } from "react";
import { FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { descargarZipMensual } from "@/features/facturacion/services/descargarZipMensual";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface OpcionMes { value: string; label: string; year: number; month: number }

function ultimosMeses(cantidad: number): OpcionMes[] {
  const hoy = new Date();
  const opciones: OpcionMes[] = [];
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    opciones.push({
      value: `${year}-${month}`,
      label: `${NOMBRES_MES[month - 1]} ${year}`,
      year,
      month,
    });
  }
  return opciones;
}

export function DialogDescargarZipMes({ open, onOpenChange }: Props) {
  const { organizationId } = useOrgActiva();
  const opciones = useMemo(() => ultimosMeses(13), []);
  const [mesSel, setMesSel] = useState<string>(opciones[1]?.value ?? opciones[0].value);
  const [descargando, setDescargando] = useState(false);

  const descargar = async () => {
    if (!organizationId) {
      notifyError(undefined, {
        title: "Selecciona una organización",
        description: "Elige el tenant en el selector de organización antes de descargar.",
        method: "DIALOG_DESCARGAR_ZIP_MES_SIN_ORG",
      });
      return;
    }
    const opcion = opciones.find((o) => o.value === mesSel);
    if (!opcion) return;
    setDescargando(true);
    try {
      await descargarZipMensual({ organizationId, year: opcion.year, month: opcion.month });
      notifySuccess(undefined, { title: `ZIP de ${opcion.label} descargado` });
      onOpenChange(false);
    } catch (e) {
      notifyError(undefined, {
        title: `No se pudo descargar el ZIP: ${(e as Error).message}`,
        error: e,
        method: "DIALOG_DESCARGAR_ZIP_MES",
      });
      reportCaughtError(e, { feature: "facturacion", op: "zip_mensual_pac" }, { mes: mesSel });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileArchive}
      title="Descargar ZIP del mes (PAC)"
      description="FacturApi genera un paquete con el PDF y XML de todas las facturas, notas de crédito y REPs emitidos en el mes. Ideal para entregar al contador."
      size="sm"
      isDirty={false}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={descargando}>
            Cancelar
          </Button>
          <Button onClick={descargar} loading={descargando}>
            {descargando ? "Generando ZIP…" : "Descargar ZIP"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-muted-foreground">Mes a descargar</label>
        <Select value={mesSel} onValueChange={setMesSel} disabled={descargando}>
          <SelectTrigger aria-label="Mes a descargar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opciones.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-caption text-muted-foreground">
          Si el mes tiene muchos CFDI, el PAC puede tardar hasta un minuto en generar el paquete.
        </p>
      </div>
    </FormDialogShell>
  );
}
