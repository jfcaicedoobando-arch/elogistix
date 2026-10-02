/**
 * Editor de un reporte dinámico (crear/editar). Solo lo abre el súper
 * administrador. El filtro por etapa y vendedor aplica a Oportunidades.
 */
import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useEtapasPipeline } from "@/features/crm/hooks/useEtapasPipeline";
import {
  AGRUPACIONES,
  MEDIDAS_REPORTE,
  OBJETOS_REPORTE,
  TIPOS_GRAFICA,
  validarReporte,
  type CrmReporteRow,
  type MedidaReporte,
  type ObjetoReporte,
  type TipoGrafica,
} from "@/features/crm/services/reportes/tiposReportes";
import type { ReporteInput } from "@/features/crm/services/reportes/reportesCrm";
import { notifyError } from "@/lib/ui/appFeedback";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reporte?: CrmReporteRow | null;
  guardando: boolean;
  onGuardar: (input: ReporteInput) => void;
}

const VACIO = {
  nombre: "",
  objeto: "oportunidad" as ObjetoReporte,
  medida: "conteo" as MedidaReporte,
  agrupacion: "etapa",
  tipoGrafica: "barras" as TipoGrafica,
  desde: "",
  hasta: "",
  etapaId: "todas",
  vendedor: "",
};

export function ReporteEditorDialog({ open, onOpenChange, reporte, guardando, onGuardar }: Props) {
  const [f, setF] = useState(VACIO);
  const { data: etapas = [] } = useEtapasPipeline();

  useEffect(() => {
    if (!open) return;
    if (!reporte) {
      setF(VACIO);
      return;
    }
    setF({
      nombre: reporte.nombre,
      objeto: reporte.objeto,
      medida: reporte.medida,
      agrupacion: reporte.agrupacion,
      tipoGrafica: reporte.tipo_grafica,
      desde: reporte.filtro.desde ?? "",
      hasta: reporte.filtro.hasta ?? "",
      etapaId: reporte.filtro.etapaId ?? "todas",
      vendedor: reporte.filtro.vendedor ?? "",
    });
  }, [open, reporte]);

  const agrupaciones = AGRUPACIONES[f.objeto];
  const medidas = useMemo(
    () => MEDIDAS_REPORTE.filter((m) => !m.soloOportunidad || f.objeto === "oportunidad"),
    [f.objeto],
  );

  const cambiarObjeto = (objeto: ObjetoReporte) => {
    setF((p) => ({
      ...p,
      objeto,
      agrupacion: AGRUPACIONES[objeto][0].valor,
      medida: objeto === "oportunidad" ? p.medida : "conteo",
    }));
  };

  const guardar = () => {
    const error = validarReporte({ nombre: f.nombre, objeto: f.objeto, medida: f.medida, agrupacion: f.agrupacion });
    if (error) {
      notifyError(undefined, { title: "Revisa el reporte", description: error, method: "CRM_REPORTE_VALIDAR" });
      return;
    }
    onGuardar({
      nombre: f.nombre,
      objeto: f.objeto,
      medida: f.medida,
      agrupacion: f.agrupacion,
      tipoGrafica: f.tipoGrafica,
      filtro: {
        desde: f.desde || undefined,
        hasta: f.hasta || undefined,
        etapaId: f.objeto === "oportunidad" && f.etapaId !== "todas" ? f.etapaId : undefined,
        vendedor: f.objeto === "oportunidad" && f.vendedor.trim() !== "" ? f.vendedor.trim() : undefined,
      },
    });
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={BarChart3}
      title={reporte ? "Editar reporte" : "Nuevo reporte"}
      description="Elige qué medir, cómo agruparlo y en qué gráfica verlo."
      footer={
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar reporte"}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="rep-nombre">Nombre</Label>
          <Input id="rep-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Oportunidades por etapa" maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label>Objeto</Label>
          <Select value={f.objeto} onValueChange={(v) => cambiarObjeto(v as ObjetoReporte)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OBJETOS_REPORTE.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Medida</Label>
          <Select value={f.medida} onValueChange={(v) => setF({ ...f, medida: v as MedidaReporte })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {medidas.map((m) => <SelectItem key={m.valor} value={m.valor}>{m.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Agrupar por</Label>
          <Select value={f.agrupacion} onValueChange={(v) => setF({ ...f, agrupacion: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {agrupaciones.map((a) => <SelectItem key={a.valor} value={a.valor}>{a.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Gráfica</Label>
          <Select value={f.tipoGrafica} onValueChange={(v) => setF({ ...f, tipoGrafica: v as TipoGrafica })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_GRAFICA.map((g) => <SelectItem key={g.valor} value={g.valor}>{g.etiqueta}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rep-desde">Creados desde (opcional)</Label>
          <Input id="rep-desde" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rep-hasta">Creados hasta (opcional)</Label>
          <Input id="rep-hasta" type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        </div>
        {f.objeto === "oportunidad" && (
          <>
            <div className="space-y-2">
              <Label>Solo esta etapa (opcional)</Label>
              <Select value={f.etapaId} onValueChange={(v) => setF({ ...f, etapaId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep-vendedor">Solo este vendedor (correo, opcional)</Label>
              <Input id="rep-vendedor" value={f.vendedor} onChange={(e) => setF({ ...f, vendedor: e.target.value })} placeholder="nombre@empresa.com" />
            </div>
          </>
        )}
      </div>
    </FormDialogShell>
  );
}
