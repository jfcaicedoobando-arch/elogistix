import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DimensionLCL, DimensionAerea } from "@/hooks/cotizacion/useCotizaciones";
import { MercanciaInfoGrid } from "./seccionMercancia/MercanciaInfoGrid";
import { DimensionesLCLTable } from "./seccionMercancia/DimensionesLCLTable";
import { DimensionesAereasTable } from "./seccionMercancia/DimensionesAereasTable";

interface Props {
  cotizacion: {
    modo: string;
    tipo_embarque: string;
    tipo_contenedor: string | null;
    tipo_peso: string;
    tipo_carga: string;
    sector_economico: string;
    descripcion_mercancia: string;
    descripcion_adicional: string;
    peso_kg: number;
    volumen_m3: number;
    piezas: number;
    msds_archivo: string | null;
    dimensiones_lcl: unknown;
    dimensiones_aereas: unknown;
  };
}

export default function SeccionMercanciaCotizacionDetalle({ cotizacion }: Props) {
  const esMaritimo = cotizacion.modo === 'Marítimo';
  const esAereo = cotizacion.modo === 'Aéreo';
  const esLCL = esMaritimo && cotizacion.tipo_embarque === 'LCL';
  const dimensiones: DimensionLCL[] = Array.isArray(cotizacion.dimensiones_lcl) ? cotizacion.dimensiones_lcl as DimensionLCL[] : [];
  const dimensionesAereas: DimensionAerea[] = Array.isArray(cotizacion.dimensiones_aereas) ? cotizacion.dimensiones_aereas as DimensionAerea[] : [];

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <MercanciaInfoGrid cotizacion={cotizacion} />

        {cotizacion.descripcion_adicional && (
          <div className="text-sm">
            <span className="text-muted-foreground">Descripción Adicional</span>
            <p className="font-medium whitespace-pre-wrap">{cotizacion.descripcion_adicional}</p>
          </div>
        )}

        {esLCL && dimensiones.length > 0 && (
          <DimensionesLCLTable dimensiones={dimensiones} totalPiezas={cotizacion.piezas} volumenTotal={cotizacion.volumen_m3} />
        )}

        {esAereo && dimensionesAereas.length > 0 && (
          <DimensionesAereasTable dimensiones={dimensionesAereas} totalPiezas={cotizacion.piezas} pesoTotal={cotizacion.peso_kg} />
        )}
      </CardContent>
    </Card>
  );
}
