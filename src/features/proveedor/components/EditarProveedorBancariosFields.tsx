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
  return <p className="text-body-sm text-destructive">{message}</p>;
}

function FieldsNacional({ c }: { c: Controller }) {
  const clabe = c.form.clabe ?? "";
  const errClabe = c.fieldErrorMessage("clabe");
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="prov-banc-banco">Banco</Label>
        <Select value={c.form.banco || undefined} onValueChange={(v) => c.setField("banco", v)}>
          <SelectTrigger id="prov-banc-banco"><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
          <SelectContent>
            {BANCOS_MEXICO.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="prov-banc-clabe">CLABE interbancaria</Label>
        <Input id="prov-banc-clabe"
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
        <Label htmlFor="prov-banc-beneficiario">Beneficiario</Label>
        <Input id="prov-banc-beneficiario"
          value={c.form.beneficiario ?? ""}
          placeholder={c.form.nombre || ""}
          onChange={(e) => c.setField("beneficiario", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prov-banc-banco-nombre">Nombre del banco</Label>
        <Input id="prov-banc-banco-nombre" value={c.form.banco ?? ""} onChange={(e) => c.setField("banco", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prov-banc-banco-pais">País del banco</Label>
        <Input id="prov-banc-banco-pais" value={c.form.banco_pais ?? ""} onChange={(e) => c.setField("banco_pais", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prov-banc-swift">SWIFT / BIC</Label>
        <Input id="prov-banc-swift"
          value={c.form.swift_bic ?? ""}
          maxLength={11}
          onChange={(e) => c.setField("swift_bic", e.target.value.toUpperCase())}
          onBlur={() => c.markTouched("swift_bic")}
          aria-invalid={!!c.fieldErrorMessage("swift_bic")}
        />
        <ErrorCampo message={c.fieldErrorMessage("swift_bic")} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="prov-banc-iban">IBAN o número de cuenta</Label>
        <Input id="prov-banc-iban" value={c.form.iban ?? ""} onChange={(e) => c.setField("iban", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prov-banc-aba">ABA / Routing (EE.UU.)</Label>
        <Input id="prov-banc-aba" value={c.form.aba_routing ?? ""} onChange={(e) => c.setField("aba_routing", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prov-banc-intermediario">Banco intermediario</Label>
        <Input id="prov-banc-intermediario"
          value={c.form.banco_intermediario ?? ""}
          onChange={(e) => c.setField("banco_intermediario", e.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="prov-banc-swift-intermediario">SWIFT del intermediario</Label>
        <Input id="prov-banc-swift-intermediario"
          value={c.form.banco_intermediario_swift ?? ""}
          maxLength={11}
          onChange={(e) => c.setField("banco_intermediario_swift", e.target.value.toUpperCase())}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="prov-banc-banco-direccion">Dirección del banco</Label>
        <Textarea id="prov-banc-banco-direccion"
          rows={2}
          value={c.form.banco_direccion ?? ""}
          onChange={(e) => c.setField("banco_direccion", e.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="prov-banc-referencia">Referencia / notas para el pago</Label>
        <Textarea id="prov-banc-referencia"
          rows={2}
          value={c.form.referencia_pago ?? ""}
          onChange={(e) => c.setField("referencia_pago", e.target.value)}
        />
      </div>
    </div>
  );
}
