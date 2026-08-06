import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BANCOS_MEXICO } from "@/constants/bancosMexico";
import { SectionHeading } from "@/components/shared/SectionHeading";
import type { useEditarProveedorController } from "@/features/proveedor/hooks";

type Controller = ReturnType<typeof useEditarProveedorController>;

/**
 * Bloque de datos bancarios para el dialog de edición. Cambia los campos
 * mostrados según `origen_proveedor` (Nacional vs Extranjero).
 */
export default function EditarProveedorBancariosFields({ c }: { c: Controller }) {
  const esExtranjero = c.form.origen_proveedor === "Extranjero";
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <SectionHeading as="h3">Datos bancarios</SectionHeading>
      {esExtranjero ? <FieldsInternacional c={c} /> : <FieldsNacional c={c} />}
    </div>
  );
}

/** Mensaje de error de campo (mismo estilo que el dialog padre). */
function ErrorCampo({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function FieldsNacional({ c }: { c: Controller }) {
  const clabe = c.form.clabe ?? "";
  const errClabe = c.fieldErrorMessage("clabe");
  return (
    <>
      <div className="space-y-2">
        <Label>Banco</Label>
        <Select value={c.form.banco || undefined} onValueChange={(v) => c.setField("banco", v)}>
          <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
          <SelectContent>
            {BANCOS_MEXICO.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>CLABE interbancaria</Label>
        <Input
          inputMode="numeric"
          maxLength={18}
          placeholder="18 dígitos"
          value={clabe}
          onChange={(e) => c.setField("clabe", e.target.value.replace(/\D/g, ""))}
          onBlur={() => c.markTouched("clabe")}
          aria-invalid={!!errClabe}
        />
        <ErrorCampo message={errClabe} />
      </div>
    </>
  );
}

function FieldsInternacional({ c }: { c: Controller }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Beneficiario</Label>
        <Input
          value={c.form.beneficiario ?? ""}
          placeholder={c.form.nombre || ""}
          onChange={(e) => c.setField("beneficiario", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Nombre del banco</Label>
        <Input value={c.form.banco ?? ""} onChange={(e) => c.setField("banco", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>País del banco</Label>
        <Input value={c.form.banco_pais ?? ""} onChange={(e) => c.setField("banco_pais", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>SWIFT / BIC</Label>
        <Input
          value={c.form.swift_bic ?? ""}
          maxLength={11}
          onChange={(e) => c.setField("swift_bic", e.target.value.toUpperCase())}
          onBlur={() => c.markTouched("swift_bic")}
          aria-invalid={!!c.fieldErrorMessage("swift_bic")}
        />
        <ErrorCampo message={c.fieldErrorMessage("swift_bic")} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>IBAN o número de cuenta</Label>
        <Input value={c.form.iban ?? ""} onChange={(e) => c.setField("iban", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>ABA / Routing (EE.UU.)</Label>
        <Input value={c.form.aba_routing ?? ""} onChange={(e) => c.setField("aba_routing", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Banco intermediario</Label>
        <Input
          value={c.form.banco_intermediario ?? ""}
          onChange={(e) => c.setField("banco_intermediario", e.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>SWIFT del intermediario</Label>
        <Input
          value={c.form.banco_intermediario_swift ?? ""}
          maxLength={11}
          onChange={(e) => c.setField("banco_intermediario_swift", e.target.value.toUpperCase())}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Dirección del banco</Label>
        <Textarea
          rows={2}
          value={c.form.banco_direccion ?? ""}
          onChange={(e) => c.setField("banco_direccion", e.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Referencia / notas para el pago</Label>
        <Textarea
          rows={2}
          value={c.form.referencia_pago ?? ""}
          onChange={(e) => c.setField("referencia_pago", e.target.value)}
        />
      </div>
    </div>
  );
}
