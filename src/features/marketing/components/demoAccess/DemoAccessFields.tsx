/**
 * Campos del formulario de acceso a la demo (datos de contacto + autorización).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import type { DemoAccessValues } from "./useDemoAccessForm";

interface Props {
  values: DemoAccessValues;
  set: <K extends keyof DemoAccessValues>(campo: K, valor: DemoAccessValues[K]) => void;
}

export function DemoAccessFields({ values, set }: Props) {
  return (
    <>
      <FormDialogSection title="Tus datos">
        <div className="space-y-1.5">
          <Label htmlFor="demo-nombre">Nombre completo</Label>
          <Input
            id="demo-nombre"
            value={values.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            autoComplete="name"
            placeholder="Juan Pérez"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-empresa">Empresa</Label>
          <Input
            id="demo-empresa"
            value={values.empresa}
            onChange={(e) => set("empresa", e.target.value)}
            autoComplete="organization"
            placeholder="Mi Agencia S.A. de C.V."
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-email">Email de trabajo</Label>
          <Input
            id="demo-email"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
            placeholder="tu@agencia.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-telefono">Teléfono (WhatsApp)</Label>
          <Input
            id="demo-telefono"
            type="tel"
            value={values.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            autoComplete="tel"
            placeholder="55 1234 5678"
            inputMode="tel"
            required
          />
          <p className="text-2xs text-muted-foreground">
            Con lada. Para números fuera de México incluye el prefijo del país (+1, +34…).
          </p>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Autorización" cols={1} flat>
        <label className="flex items-start gap-2 text-body-sm text-muted-foreground">
          <Checkbox
            className="mt-0.5"
            checked={values.aceptaContacto}
            onCheckedChange={(checked) => set("aceptaContacto", checked === true)}
          />
          <span>
            Autorizo a Libre Carga a contactarme por email o WhatsApp para dar seguimiento a mi
            prueba. Consulta el{" "}
            <a
              href="/legal/privacidad"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              aviso de privacidad
            </a>
            .
          </span>
        </label>
      </FormDialogSection>
    </>
  );
}
