import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { usePortalCotizacion } from "@/hooks/usePortalData";
import { formatCurrency } from "@/lib/formatters";
import SeccionMercanciaCotizacionDetalle from "@/components/cotizacion/SeccionMercanciaCotizacionDetalle";
import TablaConceptosGenerico from "@/components/cotizacion/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/components/cotizacion/ResumenTotalesCotizacion";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizacionTypes";
import { calcularSubtotal, calcularIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";

const estadoColor: Record<string, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Enviada: "bg-info text-info-foreground",
  Confirmada: "bg-success text-success-foreground",
  Aceptada: "bg-success text-success-foreground",
  Rechazada: "bg-destructive text-destructive-foreground",
  Vencida: "bg-warning text-warning-foreground",
  Embarcada: "bg-primary text-primary-foreground",
};

export default function PortalCotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cot, isLoading } = usePortalCotizacion(id);
  const tasaIva = useTasaIVA();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!cot) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cotización no encontrada.</p>
        <Button variant="link" onClick={() => navigate("/portal/cotizaciones")}>
          Volver a cotizaciones
        </Button>
      </div>
    );
  }

  const conceptos: ConceptoVentaCotizacion[] = Array.isArray(cot.conceptos_venta)
    ? (cot.conceptos_venta as unknown as ConceptoVentaCotizacion[])
    : [];

  const conceptosUSD = conceptos.filter((c) => c.moneda === "USD");
  const conceptosMXN = conceptos.filter((c) => c.moneda === "MXN");

  const totalUSD = conceptosUSD.reduce((s, c) => s + (c.total || 0), 0);
  const subtotalMXN = conceptosMXN.reduce(
    (s, c) => s + calcularSubtotal(c.cantidad, c.precio_unitario),
    0
  );
  const ivaMXN = conceptosMXN.reduce(
    (s, c) => s + calcularIVA(calcularSubtotal(c.cantidad, c.precio_unitario), tasaIva),
    0
  );
  const totalMXN = subtotalMXN + ivaMXN;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portal/cotizaciones")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{cot.folio}</h1>
            <Badge className={estadoColor[cot.estado] ?? "bg-muted text-muted-foreground"}>
              {cot.estado}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{cot.cliente_nombre}</p>
        </div>
      </div>

      {/* Datos generales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Modo</span>
              <p className="font-medium">{cot.modo}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tipo</span>
              <p className="font-medium">{cot.tipo}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Incoterm</span>
              <p className="font-medium">{cot.incoterm}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Moneda</span>
              <p className="font-medium">{cot.moneda}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Origen</span>
              <p className="font-medium">{cot.origen || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Destino</span>
              <p className="font-medium">{cot.destino || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vigencia</span>
              <p className="font-medium">{cot.fecha_vigencia || "—"}</p>
            </div>
            {cot.tiempo_transito_dias != null && (
              <div>
                <span className="text-muted-foreground">Tiempo de Tránsito</span>
                <p className="font-medium">{cot.tiempo_transito_dias} días</p>
              </div>
            )}
            {cot.ruta_texto && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Ruta</span>
                <p className="font-medium">{cot.ruta_texto}</p>
              </div>
            )}
            {cot.frecuencia && (
              <div>
                <span className="text-muted-foreground">Frecuencia</span>
                <p className="font-medium">{cot.frecuencia}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mercancía */}
      <SeccionMercanciaCotizacionDetalle cotizacion={cot} />

      {/* Conceptos USD */}
      {conceptosUSD.length > 0 && (
        <TablaConceptosGenerico moneda="USD" conceptos={conceptosUSD} total={totalUSD} />
      )}

      {/* Conceptos MXN */}
      {conceptosMXN.length > 0 && (
        <TablaConceptosGenerico
          moneda="MXN"
          conceptos={conceptosMXN}
          subtotal={subtotalMXN}
          iva={ivaMXN}
          total={totalMXN}
        />
      )}

      {/* Resumen */}
      <ResumenTotalesCotizacion totalUSD={totalUSD} totalMXN={totalMXN} />

      {/* Notas */}
      {cot.notas && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{cot.notas}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
