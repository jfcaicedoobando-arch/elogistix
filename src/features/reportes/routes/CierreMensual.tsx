/**
 * Reporte de Cierre Mensual (proyección de facturación del mes).
 * Antes vivía como tab 6 dentro de /facturacion. Movido a /reportes/cierre-mensual
 * en v13.92.0 porque es un reporte, no una bandeja transaccional.
 */
import { PageHeader } from "@/components/shared/PageHeader";
import { TabProyeccion } from "@/features/facturacion/components/TabProyeccion";

export default function CierreMensual() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cierre mensual"
        description="Proyección de facturación del mes en curso con base en ETA de embarques"
      />
      <TabProyeccion />
    </div>
  );
}
