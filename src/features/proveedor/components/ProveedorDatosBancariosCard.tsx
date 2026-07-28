import { useState } from "react";
import { Eye, EyeOff, Landmark, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function maskClabe(clabe: string | null | undefined, reveal: boolean): string {
  if (!clabe) return "No capturado";
  if (reveal) return clabe;
  const last4 = clabe.slice(-4);
  return `${"•".repeat(Math.max(0, clabe.length - 4))}${last4}`;
}

interface Props {
  banco: string | null | undefined;
  clabe: string | null | undefined;
  // Datos internacionales opcionales.
  origen?: "Nacional" | "Extranjero" | null;
  bancoPais?: string | null;
  swiftBic?: string | null;
  iban?: string | null;
  abaRouting?: string | null;
  bancoDireccion?: string | null;
  bancoIntermediario?: string | null;
  bancoIntermediarioSwift?: string | null;
  beneficiario?: string | null;
  referenciaPago?: string | null;
  /** Si se pasa y no hay datos capturados, muestra un CTA para capturarlos. */
  onCapturar?: () => void;
}


function Row({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={value ? (mono ? "font-medium font-mono tabular-nums" : "font-medium") : "text-muted-foreground italic"}>
        {value || "No capturado"}
      </p>
    </div>
  );
}

/**
 * Card de datos bancarios del proveedor. Muestra el bloque nacional (banco + CLABE
 * con toggle reveal) o el internacional (SWIFT/IBAN/ABA/etc.) según el origen
 * del proveedor o los datos presentes.
 */
export function ProveedorDatosBancariosCard({
  banco,
  clabe,
  origen,
  bancoPais,
  swiftBic,
  iban,
  abaRouting,
  bancoDireccion,
  bancoIntermediario,
  bancoIntermediarioSwift,
  beneficiario,
  referenciaPago,
  onCapturar,
}: Props) {
  const [revealClabe, setRevealClabe] = useState(false);
  const tieneDatosIntl = !!(swiftBic || iban || abaRouting || bancoPais || bancoIntermediario);
  const esInternacional = origen === "Extranjero" || tieneDatosIntl;
  const sinDatos = !banco && !clabe && !tieneDatosIntl && !beneficiario;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex flex-wrap items-center gap-2">
          {esInternacional ? (
            <Globe className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Landmark className="h-4 w-4 text-muted-foreground" />
          )}
          Datos bancarios
          <Badge variant="outline" className="font-normal">
            {esInternacional ? "Internacional" : "Nacional"}
          </Badge>
        </CardTitle>
      </CardHeader>
      {sinDatos ? (
        <CardContent className="text-sm">
          <p className="text-muted-foreground">
            Este proveedor todavía no tiene datos bancarios capturados. Sin ellos no se
            puede registrar el pago.
          </p>
          {onCapturar && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onCapturar}>
              Capturar datos bancarios
            </Button>
          )}
        </CardContent>
      ) : (
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {!esInternacional && (
          <>
            <Row label="Banco" value={banco} />
            <div>
              <p className="text-xs text-muted-foreground mb-1">CLABE interbancaria</p>
              {clabe ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums tracking-wider">{maskClabe(clabe, revealClabe)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setRevealClabe((v) => !v)}
                    aria-label={revealClabe ? "Ocultar CLABE" : "Mostrar CLABE"}
                  >
                    {revealClabe ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground italic">No capturado</p>
              )}
            </div>
          </>
        )}

        {esInternacional && (
          <>
            <Row label="Beneficiario" value={beneficiario} />
            <Row label="Banco" value={banco} />
            <Row label="País del banco" value={bancoPais} />
            <Row label="SWIFT / BIC" value={swiftBic} mono />
            <Row label="IBAN / Cuenta" value={iban} mono />
            <Row label="ABA / Routing" value={abaRouting} mono />
            <Row label="Banco intermediario" value={bancoIntermediario} />
            <Row label="SWIFT intermediario" value={bancoIntermediarioSwift} mono />
            {bancoDireccion && (
              <div className="md:col-span-2">
                <Row label="Dirección del banco" value={bancoDireccion} />
              </div>
            )}
            {referenciaPago && (
              <div className="md:col-span-2">
                <Row label="Referencia / notas" value={referenciaPago} />
              </div>
            )}
          </>
        )}
      </CardContent>
      )}
    </Card>

  );
}
