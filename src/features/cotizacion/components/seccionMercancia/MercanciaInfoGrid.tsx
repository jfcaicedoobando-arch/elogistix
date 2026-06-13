import { Button } from "@/components/ui/button";
import { AlertTriangle, FileDown } from "lucide-react";
import { getSignedUrl } from "@/services/storage";

interface Cot {
  modo: string;
  tipo_embarque: string;
  tipo_contenedor: string | null;
  tipo_peso: string;
  tipo_carga: string;
  sector_economico: string;
  descripcion_mercancia: string;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  msds_archivo: string | null;
}

export function MercanciaInfoGrid({ cotizacion }: { cotizacion: Cot }) {
  const esMaritimo = cotizacion.modo === 'Marítimo';
  const esAereo = cotizacion.modo === 'Aéreo';
  const esFCL = esMaritimo && cotizacion.tipo_embarque === 'FCL';
  const esTerrestre = !esMaritimo && !esAereo;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      {esMaritimo && (
        <div>
          <span className="text-muted-foreground">Tipo de Embarque</span>
          <p className="font-medium">{cotizacion.tipo_embarque}</p>
        </div>
      )}
      {esFCL && (
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
      {esTerrestre && (
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
  );
}
