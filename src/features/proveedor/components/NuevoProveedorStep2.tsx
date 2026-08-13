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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label htmlFor="nprov-banco">Banco</Label>
        <Select value={c.form.banco || undefined} onValueChange={(v) => c.setField("banco", v)}>
          <SelectTrigger id="nprov-banco"><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
          <SelectContent>
            {BANCOS_MEXICO.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="nprov-clabe">CLABE interbancaria</Label>
        <Input id="nprov-clabe"
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
    </div>
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
          <Label htmlFor="nprov-beneficiario">Beneficiario</Label>
          <Input id="nprov-beneficiario"
            value={c.form.beneficiario}
            placeholder={c.form.nombre || "Nombre legal del beneficiario"}
            onChange={(e) => c.setField("beneficiario", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nprov-banco-nombre">Nombre del banco</Label>
          <Input id="nprov-banco-nombre" value={c.form.banco} onChange={(e) => c.setField("banco", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nprov-banco-pais">País del banco</Label>
          <Input id="nprov-banco-pais" value={c.form.banco_pais} onChange={(e) => c.setField("banco_pais", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nprov-swift">SWIFT / BIC</Label>
          <Input id="nprov-swift"
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
          <Label htmlFor="nprov-iban">IBAN o número de cuenta</Label>
          <Input id="nprov-iban" value={c.form.iban} onChange={(e) => c.setField("iban", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nprov-aba">ABA / Routing (EE.UU.)</Label>
          <Input id="nprov-aba" value={c.form.aba_routing} onChange={(e) => c.setField("aba_routing", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nprov-intermediario">Banco intermediario</Label>
          <Input id="nprov-intermediario" value={c.form.banco_intermediario} onChange={(e) => c.setField("banco_intermediario", e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nprov-swift-intermediario">SWIFT del intermediario</Label>
          <Input id="nprov-swift-intermediario"
            value={c.form.banco_intermediario_swift}
            maxLength={11}
            onChange={(e) => c.setField("banco_intermediario_swift", e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nprov-banco-direccion">Dirección del banco</Label>
          <Textarea id="nprov-banco-direccion"
            rows={2}
            value={c.form.banco_direccion}
            onChange={(e) => c.setField("banco_direccion", e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nprov-referencia">Referencia / notas para el pago</Label>
          <Textarea id="nprov-referencia"
            rows={2}
            value={c.form.referencia_pago}
            onChange={(e) => c.setField("referencia_pago", e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
