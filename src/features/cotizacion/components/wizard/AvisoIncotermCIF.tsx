import { Info } from "lucide-react";
import { esIncotermConSeguroIncluido } from "@/features/cotizacion/utils/incotermRules";

/**
 * Banner informativo que sustituye los bloques de Tarifa marítima y
 * Condiciones comerciales cuando el incoterm transfiere el flete al shipper
 * en origen. El seguro sólo se incluye para CIF / CIP.
 *
 * No captura datos del shipper: ese registro se hace al convertir a embarque.
 */
export default function AvisoIncotermCIF({ incoterm }: { incoterm: string }) {
  const conSeguro = esIncotermConSeguroIncluido(incoterm);
  return (
    <div
      id="seccion-incoterm-c"
      role="note"
      className="scroll-mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
    >
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1.5 text-body">
          <p className="font-semibold text-foreground">
            {`Embarque ${incoterm}: ${conSeguro ? "flete y seguro contratados" : "flete contratado"} en origen`}
          </p>
          <p className="text-muted-foreground">
            Bajo Incoterms® 2020 <strong>{incoterm}</strong>, el vendedor/shipper
            en origen ya pagó el flete internacional
            {conSeguro ? " y el seguro de carga" : ""}{" "}
            hasta el puerto/lugar de destino. Libre Carga sólo cotiza los gastos
            locales en destino (THC, despacho aduanal, maniobras, flete
            terrestre, almacenaje, demoras, honorarios, etc.).
          </p>
          <p className="text-muted-foreground">
            No es necesario vincular tarifa marítima en este paso. Continúa con
            los conceptos de venta destino.
          </p>
        </div>
      </div>
    </div>
  );
}
