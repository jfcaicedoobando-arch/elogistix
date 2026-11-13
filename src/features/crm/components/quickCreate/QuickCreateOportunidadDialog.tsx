/**
 * QuickCreateOportunidadDialog — alta express de oportunidad:
 * nombre, empresa asociada, etapa inicial y valor estimado (todos obligatorios).
 * El origen (cliente o prospecto calificado) se toma de la empresa elegida.
 */
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { MSG_SIN_ETAPA_ABIERTA } from "@/features/crm/domain/oportunidadFormHelpers";
import { useQuickCreateOportunidad, type OportunidadQuickDraft } from "@/features/crm/hooks/useQuickCreateOportunidad";
import { OportunidadEmpresaField } from "../nuevaOportunidad/OportunidadEmpresaField";
import { OrigenEmpresaEstado } from "../nuevaOportunidad/OrigenEmpresaEstado";

export type { OportunidadQuickDraft };

const MONEDAS = ["MXN", "USD", "EUR"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  onMore: (draft: OportunidadQuickDraft) => void;
}

export default function QuickCreateOportunidadDialog({ open, onOpenChange, onCreated, onMore }: Props) {
  const {
    nombre, setNombre, empresa, setEmpresa,
    etapasAbiertas, etapa, setEtapaId,
    valorEstimado, setValorEstimado, moneda, setMoneda,
    consultaOrigen, origenCargando, motivoOrigen, faltantes, listo,
    crear, submit, construirBorrador,
  } = useQuickCreateOportunidad({ open, onOpenChange, onCreated });

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Target}
      title="Nueva oportunidad"
      description="Se crea en la etapa que elijas; después puedes completar montos y ruta."
      size="md"
      formId="qc-oportunidad-form"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      isDirty={nombre.trim().length > 0 || empresa !== null || valorEstimado.length > 0}
      busy={crear.isPending}
      footer={
        <FormDialogFooter
          formId="qc-oportunidad-form"
          onCancel={() => onOpenChange(false)}
          confirmLabel="Crear"
          loading={crear.isPending}
          disabled={!listo || origenCargando}
          extra={
            <Button type="button" variant="ghost" size="sm" onClick={() => onMore(construirBorrador())}
              disabled={crear.isPending} className="text-body-sm">
              Más campos →
            </Button>
          }
        />
      }
    >
      <FormDialogSection flat>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="qc-oportunidad-nombre">Nombre *</Label>
            <Input id="qc-oportunidad-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Importación China Q1" />
          </div>
          <OportunidadEmpresaField empresa={empresa} onChange={setEmpresa} disabled={crear.isPending} />
          <OrigenEmpresaEstado consulta={consultaOrigen} />
          {motivoOrigen && <p role="alert" className="text-body-sm text-destructive">{motivoOrigen}</p>}
          <div className="space-y-1">
            <Label htmlFor="qc-oportunidad-etapa">Etapa *</Label>
            {etapasAbiertas.length === 0 ? (
              <p role="alert" className="text-body-sm text-destructive">{MSG_SIN_ETAPA_ABIERTA}</p>
            ) : (
              <Select value={etapa?.id ?? ""} onValueChange={setEtapaId}>
                <SelectTrigger id="qc-oportunidad-etapa"><SelectValue placeholder="Selecciona una etapa" /></SelectTrigger>
                <SelectContent>
                  {etapasAbiertas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="qc-oportunidad-valor">Valor estimado *</Label>
            <div className="flex gap-2">
              <Input id="qc-oportunidad-valor" type="number" inputMode="decimal" min={0} step="0.01" className="flex-1"
                value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} placeholder="0.00" />
              <Select value={moneda} onValueChange={(v) => setMoneda(v as typeof moneda)}>
                <SelectTrigger className="w-24" aria-label="Moneda del valor estimado"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {faltantes.length > 0 && (
            <p role="status" className="text-body-sm text-destructive">Falta: {faltantes.join(", ")}.</p>
          )}
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
