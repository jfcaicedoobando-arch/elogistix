/**
 * Glosario de la página /ayuda. Separado para mantener archivos ≤200 líneas
 * (Power of 10). Re-exportado por `ayudaContent.ts`.
 */
import type { GlossaryTerm } from "./ayudaTypes";

export const GLOSARIO: GlossaryTerm[] = [
  // Logística operativa
  { termino: "BL Master", definicion: "Bill of Lading que la naviera emite al consolidador. Agrupa varios BL House cuando es carga consolidada (LCL)." },
  { termino: "BL House", definicion: "Bill of Lading que el forwarder emite a su cliente final. Vive dentro de un BL Master en consolidados." },
  { termino: "Expediente", definicion: "Identificador interno único del embarque (I-25-00001 para importación, X-25-00001 para exportación). Se genera automáticamente al crear el embarque." },
  { termino: "ETD", definicion: "Estimated Time of Departure — fecha estimada de zarpe del puerto de origen." },
  { termino: "ETA", definicion: "Estimated Time of Arrival — fecha estimada de llegada al puerto destino." },
  { termino: "FCL", definicion: "Full Container Load — contenedor completo de un solo cliente." },
  { termino: "LCL", definicion: "Less than Container Load — carga consolidada. Varios clientes comparten un contenedor; se trackea por BL House." },
  { termino: "Incoterm", definicion: "Reglas internacionales (FOB, CIF, DDP, etc.) que definen qué costos y riesgos asume el comprador vs el vendedor." },
  { termino: "UN/LOCODE", definicion: "Código estandarizado de la ONU para identificar puertos, aeropuertos y ciudades (ej. MXVER = Veracruz). El selector de puertos lo usa." },
  { termino: "Free time", definicion: "Días libres que la naviera o terminal otorga antes de cobrar demoras/almacenaje." },
  { termino: "Demurrage", definicion: "Cargo que cobra la naviera cuando el contenedor se queda en el puerto más allá del free time." },
  { termino: "Detention", definicion: "Cargo cuando el cliente retiene el contenedor fuera de la terminal más allá del free time." },
  { termino: "Demoras", definicion: "Etiqueta general para cargos por exceso de días. El ERP calcula auto un tabulador escalonado a partir del timeline del embarque." },
  { termino: "Carta garantía", definicion: "Documento que el forwarder firma con la naviera para liberar el contenedor sin pagar demoras al momento (queda como garantía, no facturable al cliente)." },
  { termino: "Handoff", definicion: "Punto en que el Vendedor confirma la cotización con el cliente y pasa el control al Coordinador Logístico para ejecutar el embarque." },

  // Comercial / CRM
  { termino: "Lead", definicion: "Contacto comercial inicial sin oportunidad asignada. Vive en CRM → Leads." },
  { termino: "Oportunidad", definicion: "Lead calificado con monto estimado, etapa y probabilidad de cierre." },
  { termino: "Actividad CRM", definicion: "Llamada, correo, reunión o tarea con fecha. Aparece en Mi día cuando vence hoy." },
  { termino: "Pipeline ponderado", definicion: "Suma de oportunidades abiertas multiplicada por su probabilidad de cierre. Refleja el forecast realista." },
  { termino: "Next Best Action (NBA)", definicion: "Sugerencias automáticas del CRM sobre qué hacer ahora con cada cuenta (llamar, dar seguimiento a cotización, etc.)." },
  { termino: "Forecast", definicion: "Proyección de cierres por mes y por vendedor. Vive en CRM → Resumen y Analítica." },
  { termino: "Embudo", definicion: "Conteo de oportunidades por etapa del pipeline (Prospección → Calificación → Propuesta → Cierre)." },
  { termino: "KAM", definicion: "Key Account Manager — vendedor responsable de una cuenta clave de principio a fin." },

  // Pricing y costeo
  { termino: "Tarifa vigente", definicion: "Tarifa negociada con un partner (naviera/agente) con fecha de validez. El Costeo la sugiere automáticamente al armar una cotización con misma ruta + tipo de contenedor." },
  { termino: "Top 3 ranking", definicion: "Las 3 mejores tarifas para una ruta dada, ordenadas por costo total (flete + free time + frecuencia)." },
  { termino: "Override de tarifa", definicion: "Modificación manual de una tarifa sugerida en una cotización. Sólo el Gerente Comercial o admin pueden autorizarlo." },
  { termino: "Partner / Agente", definicion: "Proveedor de servicio logístico (naviera, agente en destino, transportista). Se administra en Directorio → Proveedores." },
  { termino: "Tarifa-first", definicion: "Política del wizard de cotización: el Vendedor sólo captura ruta + contenedor; los costos se heredan de la tarifa vigente, no se capturan a mano." },
  { termino: "P&L preliminar", definicion: "Cálculo de margen estimado de una cotización antes de cerrarse: venta − costos sugeridos. Vive en el wizard y en /profit." },
  { termino: "Margen bruto", definicion: "Venta menos costos directos del embarque. No incluye gastos operativos." },

  // Finanzas y compras
  { termino: "CXC", definicion: "Cuentas por cobrar — facturas emitidas al cliente. Vive en Facturación → Cartera." },
  { termino: "CXP", definicion: "Cuentas por pagar — facturas recibidas de proveedores. Vive en Compras → CXP." },
  { termino: "Folio interno proveedor (FP-XXXXXX)", definicion: "Identificador único por organización para cada factura de proveedor (FP-000001 en adelante). Es inmutable y lo asigna la BD." },
  { termino: "Por capturar", definicion: "Bandeja del módulo Compras con costos del embarque sin factura de proveedor recibida todavía." },
  { termino: "Por pagar", definicion: "Bandeja del módulo Compras con facturas de proveedor capturadas y vigentes (saldo > 0)." },
  { termino: "Conciliación bancaria", definicion: "Cruce automático entre movimientos del banco y pagos del ERP. Tolerancia ±$1 y ±5 días por defecto." },
  { termino: "CFDI 4.0", definicion: "Versión vigente del comprobante fiscal digital en México. Lo timbra Facturapi desde el ERP." },
  { termino: "Complemento de pago (REP)", definicion: "CFDI complementario que se emite cuando el cliente paga una factura PPD. Lo registra el Contador." },
  { termino: "Estado de resultados", definicion: "Reporte de ventas − costos − gastos por periodo, con diferencia cambiaria. Vive en /profit." },
  { termino: "Diferencia cambiaria", definicion: "Ganancia o pérdida por variación del tipo de cambio entre la fecha de la venta y la fecha del cobro." },
  { termino: "Aging de cartera", definicion: "Clasificación de facturas pendientes por antigüedad (0-30, 31-60, 61-90, 90+ días). Mide la calidad de la cobranza." },
  { termino: "Hueco de facturación", definicion: "Embarques cuyo ETD pasó hace más de 5 días sin factura. El proveedor ya nos cobró pero al cliente no — riesgo de capital de trabajo." },
  { termino: "Proforma", definicion: "Documento previo a la factura que el cliente aprueba antes de timbrar. No tiene valor fiscal." },
  { termino: "Factura", definicion: "Comprobante fiscal con valor legal (en México requiere timbrado SAT con CFDI 4.0). Aquí se genera, timbra y conserva en PDF/XML." },
  { termino: "Liquidación", definicion: "Pago a proveedores (navieras, aduanas, fletes locales). En el ERP se marca cada costo directo como Pagado/Pendiente." },
  { termino: "Tasa IVA", definicion: "Configurable globalmente (default 16%). Se aplica a conceptos marcados con 'aplica IVA' al generar la factura." },
  { termino: "Tipo de cambio", definicion: "Conversión USD→MXN o EUR→MXN. Se obtiene en vivo de Frankfurter.app con caché de 1 hora; se puede sobrescribir manualmente." },

  // Plataforma
  { termino: "Tenant / Organización", definicion: "Cada empresa que usa el ERP. Los datos están aislados entre organizaciones por RLS." },
  { termino: "Impersonación", definicion: "Capacidad del super-admin de Libre Carga para entrar a una organización con los permisos de un usuario suyo (siempre queda registrada en bitácora)." },
  { termino: "Bitácora", definicion: "Registro inmutable de cada acción importante (CRUD) con quién, cuándo y qué cambió. Vive en /bitacora." },
  { termino: "Bandeja", definicion: "Vista filtrada de pendientes (por capturar, por pagar, por emitir). Aparecen en el sidebar con badge cuando hay items." },
  { termino: "RLS", definicion: "Row-Level Security de la base de datos — garantiza que un usuario nunca vea datos de otra organización aunque cambie URLs." },
];
