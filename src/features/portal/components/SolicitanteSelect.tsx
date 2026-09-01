/**
 * Selector de "Empresa solicitante" del portal.
 *
 * Sólo aparece cuando el usuario está ligado a varias empresas: antes la
 * solicitud se atribuía en silencio a la primera. Con una sola empresa no se
 * pinta nada (cero fricción); sin empresas se explica por qué no se puede
 * enviar.
 */
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import type { ClienteSolicitante } from "@/features/portal/domain/clientesSolicitantes";

interface Props {
  clientes: ClienteSolicitante[];
  value: string;
  onChange: (clienteId: string) => void;
  intentoEnvio: boolean;
}

export function SolicitanteSelect({ clientes, value, onChange, intentoEnvio }: Props) {
  if (clientes.length === 0) {
    return (
      <FormDialogSection title="Empresa solicitante" cols={1}>
        <p className="text-body-sm text-destructive">
          Tu cuenta aún no está vinculada a una empresa, así que no podemos registrar la
          solicitud. Escríbenos y la vinculamos.
        </p>
      </FormDialogSection>
    );
  }

  if (clientes.length === 1) return null;

  return (
    <FormDialogSection
      title="Empresa solicitante"
      description="Tu cuenta tiene varias empresas: elige a nombre de cuál solicitas."
      cols={1}
    >
      <div className="space-y-1.5">
        <Label htmlFor="solicitud-cliente">
          Empresa solicitante <span className="text-destructive">*</span>
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            id="solicitud-cliente"
            aria-required
            aria-invalid={intentoEnvio && !value}
          >
            <SelectValue placeholder="Selecciona la empresa" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {intentoEnvio && !value && (
          <p className="text-body-sm text-destructive">
            Elige la empresa solicitante para continuar.
          </p>
        )}
      </div>
    </FormDialogSection>
  );
}
