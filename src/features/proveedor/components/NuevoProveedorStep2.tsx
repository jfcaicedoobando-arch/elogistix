import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BANCOS_MEXICO } from "@/constants/bancosMexico";
import { SectionHeading } from "@/components/shared/SectionHeading";
import type { useNuevoProveedorController } from "@/features/proveedor/hooks";

type Controller = ReturnType<typeof useNuevoProveedorController>;

/**
 * Paso 2 del wizard de Nuevo Proveedor: datos bancarios opcionales.
 * Si el proveedor es Nacional muestra banco mexicano + CLABE.
 * Si es Extranjero muestra los campos típicos de una transferencia internacional
 * (SWIFT/BIC, IBAN, ABA, banco intermediario, etc.).
 */
export function NuevoProveedorStep2({ c }: { c: Controller }) {
  const esExtranjero = c.form.origen_proveedor === "Extranjero";
  return (
    <div className="space-y-4">
      <SectionHeading as="h3" description="Opcional. Puedes capturarlos después desde la edición del proveedor.">
        Datos bancarios
      </SectionHeading>
      {esExtranjero ? <Step2Internacional c={c} /> : <Step2Nacional c={c} />}
    </div>
  );
}

function Step2Nacional({ c }: { c: Controller }) {
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
          value={c.form.clabe}
          onChange={(e) => c.setField("clabe", e.target.value.replace(/\D/g, ""))}
        />
        {c.form.clabe.length > 0 && c.form.clabe.length !== 18 && (
          <p className="text-xs text-destructive">
            La CLABE debe tener 18 dígitos ({c.form.clabe.length}/18).
          </p>
        )}
      </div>
    </>
  );
}

function Step2Internacional({ c }: { c: Controller }) {
  const swift = c.form.swift_bic.trim().toUpperCase();
  const swiftInvalid = swift.length > 0 && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift);
  return (
    <>
      <p className="text-xs text-muted-foreground -mt-2">
        Transferencia internacional. Captura los datos que te haya proporcionado el proveedor.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Beneficiario</Label>
          <Input
            value={c.form.beneficiario}
            placeholder={c.form.nombre || "Nombre legal del beneficiario"}
            onChange={(e) => c.setField("beneficiario", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Nombre del banco</Label>
          <Input value={c.form.banco} onChange={(e) => c.setField("banco", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>País del banco</Label>
          <Input value={c.form.banco_pais} onChange={(e) => c.setField("banco_pais", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>SWIFT / BIC</Label>
          <Input
            value={c.form.swift_bic}
            placeholder="8 u 11 caracteres"
            maxLength={11}
            onChange={(e) => c.setField("swift_bic", e.target.value.toUpperCase())}
          />
          {swiftInvalid && (
            <p className="text-xs text-destructive">SWIFT/BIC inválido (formato AAAABBCC o AAAABBCCXXX).</p>
          )}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>IBAN o número de cuenta</Label>
          <Input value={c.form.iban} onChange={(e) => c.setField("iban", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>ABA / Routing (EE.UU.)</Label>
          <Input value={c.form.aba_routing} onChange={(e) => c.setField("aba_routing", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Banco intermediario</Label>
          <Input value={c.form.banco_intermediario} onChange={(e) => c.setField("banco_intermediario", e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>SWIFT del intermediario</Label>
          <Input
            value={c.form.banco_intermediario_swift}
            maxLength={11}
            onChange={(e) => c.setField("banco_intermediario_swift", e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Dirección del banco</Label>
          <Textarea
            rows={2}
            value={c.form.banco_direccion}
            onChange={(e) => c.setField("banco_direccion", e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Referencia / notas para el pago</Label>
          <Textarea
            rows={2}
            value={c.form.referencia_pago}
            onChange={(e) => c.setField("referencia_pago", e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
