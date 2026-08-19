/**
 * Paso 1 — Diagnóstico e intención: cliente destino, ruta fiscal y motivo.
 * Cuando el caso ya existe, los datos se muestran en modo lectura.
 */
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import type { ClienteFiscalOpt } from "@/features/facturacion/hooks/useClientesFiscalOpts";
import type { RutaFiscalRefacturacion } from "@/features/facturacion/services/refacturacion";
import type { ReceptorFiscal } from "@/features/facturacion/domain/refacturacionValidaciones";
import { ReceptorFiscalSemaforo } from "./ReceptorFiscalSemaforo";

interface Props {
  numeroOriginal: string;
  clienteOriginal: string;
  rfcOriginal: string | null;
  total: number | null;
  moneda: string;
  clientes: ClienteFiscalOpt[];
  clienteDestinoId: string | null;
  onClienteDestino: (id: string) => void;
  rutaFiscal: RutaFiscalRefacturacion;
  onRutaFiscal: (r: RutaFiscalRefacturacion) => void;
  motivo: string;
  onMotivo: (v: string) => void;
  bloqueado: boolean;
  receptorDestino: ReceptorFiscal | null;
}

export function PasoDiagnostico(props: Props) {
  const destino = props.clientes.find((c) => c.id === props.clienteDestinoId) ?? null;

  return (
    <div className="space-y-5">
      <FormDialogSection title="Factura a corregir" cols={2}>
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-folio">Folio</Label>
          <Input id="refact-folio" value={props.numeroOriginal} readOnly />
        </div>
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-importe">Importe</Label>
          <Input
            id="refact-importe"
            value={props.total !== null ? formatCurrency(props.total, props.moneda) : "—"}
            readOnly
          />
        </div>
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-receptor-actual">Receptor actual</Label>
          <Input id="refact-receptor-actual" value={props.clienteOriginal || "—"} readOnly />
        </div>
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-rfc-actual">RFC actual</Label>
          <Input id="refact-rfc-actual" value={props.rfcOriginal ?? "—"} readOnly />
        </div>
      </FormDialogSection>

      <FormDialogSection
        title="Nuevo receptor"
        description="La nueva factura tomará el RFC, régimen fiscal y uso de CFDI de este cliente."
        cols={2}
      >
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-cliente">Cliente destino</Label>
          {props.bloqueado ? (
            <Input id="refact-cliente" value={destino?.nombre ?? "—"} readOnly />
          ) : (
            <Select value={props.clienteDestinoId ?? undefined} onValueChange={props.onClienteDestino}>
              <SelectTrigger id="refact-cliente">
                <SelectValue placeholder="Selecciona el cliente" />
              </SelectTrigger>
              <SelectContent>
                {props.clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}{c.rfc ? ` · ${c.rfc}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-rfc-destino">RFC destino</Label>
          <Input id="refact-rfc-destino" value={destino?.rfc ?? "—"} readOnly />
        </div>
        <div className="md:col-span-2">
          <ReceptorFiscalSemaforo
            clienteId={props.clienteDestinoId}
            receptor={props.receptorDestino}
          />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Ruta fiscal" cols={1} flat>
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-ruta">Cómo se corrige ante el SAT</Label>
          {props.bloqueado ? (
            <Input
              id="refact-ruta"
              readOnly
              value={props.rutaFiscal === "01" ? "01 · Sustitución de CFDI" : "02 · Factura nueva sin relación"}
            />
          ) : (
            <Select
              value={props.rutaFiscal}
              onValueChange={(v) => props.onRutaFiscal(v as RutaFiscalRefacturacion)}
            >
              <SelectTrigger id="refact-ruta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="01">01 · Sustitución (la nueva reemplaza a la original)</SelectItem>
                <SelectItem value="02">02 · Factura nueva sin relación (error de receptor)</SelectItem>
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            Con la ruta 01 la nueva factura queda relacionada como sustituta; con la ruta 02
            se cancela la original por error y la nueva se emite de forma independiente.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-motivo">Motivo</Label>
          <Textarea
            id="refact-motivo"
            rows={2}
            readOnly={props.bloqueado}
            value={props.motivo}
            onChange={(e) => props.onMotivo(e.target.value)}
            placeholder="Ej. el cliente pagó desde otra empresa del grupo y solicitó la factura a ese RFC."
          />
        </div>
      </FormDialogSection>
    </div>
  );
}
