/**
 * FacturaTimbradoCard — bloque fiscal consolidado del CFDI.
 * v13.308.16: además del UUID/folio/serie absorbió los campos fiscales
 * (Uso CFDI, Forma de pago, Método de pago) que antes vivían en
 * "Datos generales", y la línea de Emisor (razón social · RFC) que antes
 * ocupaba un card independiente. Reduce ruido y agrupa lo que un contador
 * revisa cuando audita el CFDI.
 */
import { Copy, FileCheck2, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCopyText } from "@/hooks/shared";
import { AmbienteBadge } from "@/features/facturacion/components/AmbienteBadge";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";
import { useEmisorEmpresa } from "@/features/facturacion/hooks/useEmisorEmpresa";

interface Props {
  uuidFiscal: string;
  folioFiscal: number | null;
  serie: string | null;
  usoCfdi?: string | null;
  formaPago?: string | null;
  metodoPago?: string | null;
  ambiente?: "sandbox" | "live" | null;
}

function labelDe(options: readonly { value: string; label: string }[], clave: string | null | undefined) {
  if (!clave) return "—";
  const o = options.find((x) => x.value === clave);
  return o ? o.label : clave;
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

export function FacturaTimbradoCard(props: Props) {
  const { uuidFiscal, folioFiscal, serie, usoCfdi, formaPago, metodoPago, ambiente } = props;
  const copy = useCopyText();
  const copiarUuid = () =>
    void copy(uuidFiscal, {
      successMessage: "UUID copiado",
      errorTitle: "No se pudo copiar",
      method: "FACTURA_UUID_COPY",
    });
  const { data: emisor } = useEmisorEmpresa();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-success" /> Timbrado fiscal
          <AmbienteBadge ambiente={ambiente} size="md" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {emisor && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground border-b pb-3">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              Emitido por{" "}
              <span className="font-medium text-foreground">{emisor.razonSocial}</span>
              {emisor.rfc && (
                <>
                  {" · "}
                  <span className="font-mono">{emisor.rfc}</span>
                </>
              )}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 min-w-0">
            <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Folio fiscal (UUID)</p>
            <div className="flex items-center gap-1">
              <p className="font-mono text-sm truncate">{uuidFiscal}</p>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copiarUuid}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Field label="Folio" mono value={folioFiscal ?? "—"} />
          <Field label="Serie" mono value={serie || "—"} />
          <Field label="Uso CFDI" value={labelDe(USOS_CFDI_SAT, usoCfdi)} />
          <Field label="Forma de pago" value={labelDe(FORMAS_PAGO_SAT, formaPago)} />
          <Field label="Método de pago" value={labelDe(METODOS_PAGO_SAT, metodoPago)} />
        </div>
      </CardContent>
    </Card>
  );
}
