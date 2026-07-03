import FacturapiCredencialesCard from "@/features/configuracion/components/FacturapiCredencialesCard";
import { CatalogoClavesSATCard } from "@/features/configuracion/components/CatalogoClavesSATCard";

/**
 * Tab de Facturación en Configuración.
 *
 * El IVA global (`facturacion.tasa_iva`) se retiró en 13.170.0: cada producto
 * del catálogo define su propio tipo de IVA (16% / 0% / Exento) y la tasa
 * general de México (16%) queda hardcodeada en `TASA_IVA`.
 */
export default function TabFacturacion() {
  return (
    <div className="space-y-4">
      <FacturapiCredencialesCard />
      <CatalogoClavesSATCard />
    </div>
  );
}
