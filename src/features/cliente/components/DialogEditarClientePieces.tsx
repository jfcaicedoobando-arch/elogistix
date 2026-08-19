/**
 * Piezas del modal "Editar Cliente": tipo del formulario y campo de texto
 * reutilizable. Extraído para mantener el componente ≤200 líneas.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ClienteData {
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
  regimen_fiscal: string;
  uso_cfdi_default: string;
  dias_credito: number | null;
  limite_credito_mxn: number | null;
  sin_comision: boolean;
  requiere_autorizacion_cotizacion: boolean;
  requiere_autorizacion_proforma: boolean;
}

export type FieldKey = keyof Pick<
  ClienteData,
  "nombre" | "rfc" | "direccion" | "ciudad" | "estado" | "cp" | "contacto" | "email" | "telefono"
>;

interface TextFieldProps {
  label: string;
  field: FieldKey;
  form: ClienteData;
  setForm: (f: (p: ClienteData) => ClienteData) => void;
  full?: boolean;
  required?: boolean;
}

export function TextField({ label, field, form, setForm, full, required }: TextFieldProps) {
  const inputId = `editar-cliente-${field}`;
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <Label htmlFor={inputId}>
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={inputId}
        value={form[field]}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            [field]: field === "nombre" ? e.target.value.toLocaleUpperCase("es-MX") : e.target.value,
          }))
        }
        className="mt-1"
      />
    </div>
  );
}
