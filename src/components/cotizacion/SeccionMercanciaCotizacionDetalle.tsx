import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, FileDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { getSignedUrl } from "@/lib/storage";
import type { DimensionLCL, DimensionAerea } from "@/hooks/useCotizaciones";

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
  const dimensiones: DimensionLCL[] = Array.isArray(cotizacion.dimensiones_lcl) ? cotizacion.dimensiones_lcl as DimensionLCL[] : [];
  const dimensionesAereas: DimensionAerea[] = Array.isArray(cotizacion.dimensiones_aereas) ? cotizacion.dimensiones_aereas as DimensionAerea[] : [];

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {esMaritimo && (
            <div>
              <span className="text-muted-foreground">Tipo de Embarque</span>
              <p className="font-medium">{cotizacion.tipo_embarque}</p>
            </div>
          )}
          {esMaritimo && cotizacion.tipo_embarque === 'FCL' && (
            <>
              <div>
                <span className="text-muted-foreground">Tipo de Contenedor</span>
                <p className="font-medium">{cotizacion.tipo_contenedor || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Peso</span>
                <p className="font-medium">{cotizacion.tipo_peso}</p>
              </div>
            </>
          )}
          <div>
            <span className="text-muted-foreground">Tipo de Carga</span>
            <p className="font-medium flex items-center gap-1">
              {cotizacion.tipo_carga === 'Mercancía Peligrosa' && <AlertTriangle className="h-4 w-4 text-destructive" />}
              {cotizacion.tipo_carga || 'Carga General'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Sector Económico</span>
            <p className="font-medium">{cotizacion.sector_economico || cotizacion.descripcion_mercancia || '-'}</p>
          </div>
          {!esMaritimo && !esAereo && (
            <>
              <div><span className="text-muted-foreground">Peso</span><p className="font-medium">{cotizacion.peso_kg} kg</p></div>
              <div><span className="text-muted-foreground">Volumen</span><p className="font-medium">{cotizacion.volumen_m3} m³</p></div>
              <div><span className="text-muted-foreground">Piezas</span><p className="font-medium">{cotizacion.piezas}</p></div>
            </>
          )}
          {cotizacion.msds_archivo && (
            <div>
              <span className="text-muted-foreground">MSDS</span>
              <Button
                variant="link" size="sm" className="p-0 h-auto text-sm"
                onClick={async () => {
                  const url = await getSignedUrl(cotizacion.msds_archivo!);
                  window.open(url, '_blank');
                }}
              >
                <FileDown className="h-3 w-3 mr-1" /> Descargar
              </Button>
            </div>
          )}
        </div>

        {cotizacion.descripcion_adicional && (
          <div className="text-sm">
            <span className="text-muted-foreground">Descripción Adicional</span>
            <p className="font-medium whitespace-pre-wrap">{cotizacion.descripcion_adicional}</p>
          </div>
        )}

        {/* Tabla dimensiones LCL */}
        {esMaritimo && cotizacion.tipo_embarque === 'LCL' && dimensiones.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground font-semibold">Dimensiones</span>
            <div className="border rounded-md overflow-auto mt-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Piezas</TableHead>
                    <TableHead>Alto (cm)</TableHead>
                    <TableHead>Largo (cm)</TableHead>
                    <TableHead>Ancho (cm)</TableHead>
                    <TableHead>Volumen m³</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dimensiones.map((dimension, indice) => (
                    <TableRow key={indice}>
                      <TableCell>{dimension.piezas}</TableCell>
                      <TableCell>{dimension.alto_cm}</TableCell>
                      <TableCell>{dimension.largo_cm}</TableCell>
                      <TableCell>{dimension.ancho_cm}</TableCell>
                      <TableCell>{dimension.volumen_m3.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
              <span>Total piezas: {cotizacion.piezas}</span>
              <span>Volumen total: {cotizacion.volumen_m3} m³</span>
            </div>
          </div>
        )}

        {/* Tabla dimensiones Aéreas */}
        {esAereo && dimensionesAereas.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground font-semibold">Dimensiones</span>
            <div className="border rounded-md overflow-auto mt-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Piezas</TableHead>
                    <TableHead>Alto (cm)</TableHead>
                    <TableHead>Largo (cm)</TableHead>
                    <TableHead>Ancho (cm)</TableHead>
                    <TableHead>Peso vol. (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dimensionesAereas.map((dimension, indice) => (
                    <TableRow key={indice}>
                      <TableCell>{dimension.piezas}</TableCell>
                      <TableCell>{dimension.alto_cm}</TableCell>
                      <TableCell>{dimension.largo_cm}</TableCell>
                      <TableCell>{dimension.ancho_cm}</TableCell>
                      <TableCell>{dimension.peso_volumetrico_kg.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
              <span>Total piezas: {cotizacion.piezas}</span>
              <span>Peso volumétrico total: {cotizacion.peso_kg} kg</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
