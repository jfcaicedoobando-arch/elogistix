/**
 * Glosario de la página /ayuda. Separado para mantener archivos ≤200 líneas
 * (Power of 10). Re-exportado por `ayudaContent.ts`.
 */
import type { GlossaryTerm } from "./ayudaTypes";
import { TIPO_IVA_AYUDA_GENERAL, TIPO_IVA_OPCIONES } from "@/lib/financial/tipoIvaSat";

export const GLOSARIO: GlossaryTerm[] = [
  // Logística operativa
  { termino: "BL Master", definicion: "Bill of Lading que la naviera emite al consolidador. Agrupa varios BL House cuando es carga consolidada (LCL)." },
  { termino: "BL House", definicion: "Bill of Lading que el forwarder emite a su cliente final. Vive dentro de un BL Master en consolidados." },
  { termino: "Expediente", definicion: "Identificador interno del embarque. Se asigna al crearlo según la serie configurada de la organización y el tipo de operación; por ejemplo, ELIMP00014." },
  { termino: "ETD", definicion: "Estimated Time of Departure — fecha estimada de zarpe del puerto de origen." },
  { termino: "ETA", definicion: "Estimated Time of Arrival — fecha estimada de llegada al puerto destino." },
  { termino: "FCL", definicion: "Full Container Load — contenedor completo de un solo cliente." },
  { termino: "LCL", definicion: "Less than Container Load — carga consolidada. Varios clientes comparten un contenedor; se trackea por BL House." },
  { termino: "Incoterm", definicion: "Reglas internacionales (FOB, CIF, DDP, etc.) que definen qué costos y riesgos asume el comprador vs el vendedor." },
  { termino: "UN/LOCODE", definicion: "Código estandarizado de la ONU para identificar puertos, aeropuertos y ciudades (ej. MXVER = Veracruz). El selector de puertos lo usa." },
  { termino: "Free time", definicion: "Días libres que la naviera o terminal otorga antes de cobrar demoras/almacenaje." },
  { termino: "Demurrage", definicion: "Cargo que cobra la naviera cuando el contenedor se queda en el puerto más allá del free time." },
  { termino: "Detention", definicion: "Cargo cuando el cliente retiene el contenedor fuera de la terminal más allá del free time." },
  { termino: "Demoras", definicion: "Etiqueta general para cargos por exceso de días. El ERP calcula un tabulador escalonado a partir de las fechas de la cronología del embarque." },
  { termino: "Carta garantía", definicion: "Documento que el forwarder firma con la naviera para liberar el contenedor sin pagar demoras al momento (queda como garantía, no facturable al cliente)." },
  { termino: "Handoff", definicion: "Punto en que el Vendedor confirma la cotización con el cliente y pasa el control al Coordinador Logístico para ejecutar el embarque." },

  // Comercial / CRM
  { termino: "Lead", definicion: "Contacto comercial inicial sin oportunidad asignada. Vive en CRM → Leads." },
  { termino: "Oportunidad", definicion: "Lead calificado con monto estimado, etapa y probabilidad de cierre." },
  { termino: "Actividad CRM", definicion: "Llamada, correo, reunión o tarea con fecha. Aparece en Mi día cuando vence hoy." },
  { termino: "Valor ponderado", definicion: "Suma del monto de cada oportunidad abierta multiplicado por su probabilidad de cierre. Es una estimación de la proyección, no una venta confirmada." },
  { termino: "Next Best Action (NBA)", definicion: "Sugerencias automáticas del CRM sobre qué hacer ahora con cada cuenta (llamar, dar seguimiento a cotización, etc.)." },
  { termino: "Proyección de ventas (forecast)", definicion: "Estimación de cierres por mes y vendedor. CRM → Resumen muestra el periodo indicado en cada bloque; Analítica incluye todas las fechas de cierre estimado, incluso anteriores al mes actual y sin fecha." },
  { termino: "Embudo", definicion: "Conteo de oportunidades por etapa del pipeline (Prospección → Calificación → Propuesta → Cierre)." },
  { termino: "KAM", definicion: "Key Account Manager — vendedor responsable de una cuenta clave de principio a fin." },

  // Pricing y costeo
  { termino: "Tarifa vigente", definicion: "Tarifa negociada con un proveedor logístico y con fecha de validez. En las cotizaciones marítimas se buscan opciones compatibles con ruta, carga y contenedor cuando corresponde. No sustituye la revisión de los costos de cada modo de transporte." },
  { termino: "Top 3 ranking", definicion: "Las 3 mejores tarifas para una ruta dada, ordenadas por costo total (flete + free time + frecuencia)." },
  { termino: "Override de tarifa", definicion: "Modificación manual de una tarifa sugerida en una cotización. Sólo el Gerente Comercial o admin pueden autorizarlo." },
  { termino: "Partner / Agente", definicion: "Proveedor de servicio logístico (naviera, agente en destino, transportista). Se administra en Directorio → Proveedores." },
  { termino: "Tarifa-first", definicion: "Cotización basada en una tarifa vigente cuando la operación lo permite. El asistente empieza por modo de transporte y datos generales; los costos se revisan o capturan en Costos y utilidad. No todas las modalidades requieren contenedor marítimo." },
  { termino: "P&L preliminar", definicion: "Comparación de venta y costos estimados antes de cerrar una cotización. Revisa los costos en Costos y utilidad y la comparación final en Resumen del asistente." },
  { termino: "Margen bruto", definicion: "Venta menos costos directos del embarque. No incluye gastos operativos." },

  // Finanzas y compras
  { termino: "CXC", definicion: "Cuentas por cobrar — facturas emitidas al cliente. Vive en Facturación → Cartera." },
  { termino: "CXP", definicion: "Cuentas por pagar — facturas recibidas de proveedores. Vive en Compras → CXP." },
  { termino: "Folio interno proveedor (FP-XXXXXX)", definicion: "Identificador único por organización para cada factura de proveedor (FP-000001 en adelante). Es inmutable y lo asigna la BD." },
  { termino: "Por capturar", definicion: "Bandeja del módulo Compras con costos del embarque sin factura de proveedor recibida todavía." },
  { termino: "Por pagar", definicion: "Bandeja del módulo Compras con facturas de proveedor capturadas y vigentes (saldo > 0)." },
  { termino: "Conciliación bancaria", definicion: "Vinculación entre movimientos del banco y pagos del ERP. Registrar un pago no confirma su conciliación. En Dinero → Conciliación bancaria, usa Conciliar coincidencias únicas para casos compatibles; las coincidencias ambiguas requieren revisión manual. La ayuda de la cuenta seleccionada indica las tolerancias por moneda y fecha." },
  { termino: "CFDI 4.0", definicion: "Versión vigente del comprobante fiscal digital en México. Lo timbra Facturapi desde el ERP." },
  { termino: "Complemento de pago (REP)", definicion: "CFDI complementario que se emite cuando el cliente paga una factura PPD. Lo registra el Contador." },
  { termino: "Estado de resultados", definicion: "Reporte de ventas − costos − gastos por periodo, con diferencia cambiaria. Vive en /profit." },
  { termino: "Diferencia cambiaria", definicion: "Ganancia o pérdida por variación del tipo de cambio entre la fecha de la venta y la fecha del cobro." },
  { termino: "Antigüedad de saldos (aging)", definicion: "Clasificación de saldos pendientes por tramos de vencimiento. Permite distinguir lo que aún no vence de lo vencido y priorizar la cobranza o el pago." },
  { termino: "Hueco de facturación", definicion: "Embarques cuyo ETD pasó hace más de 5 días sin factura. El proveedor ya nos cobró pero al cliente no — riesgo de capital de trabajo." },
  { termino: "Proforma", definicion: "Documento previo a la factura, sin valor fiscal. Su aprobación depende de la política del cliente. Crear un borrador de factura desde ella no equivale a timbrar un CFDI." },
  { termino: "Factura", definicion: "Comprobante fiscal con valor legal (en México requiere timbrado SAT con CFDI 4.0). Aquí se genera, timbra y conserva en PDF/XML." },
  { termino: "Liquidación", definicion: "Pago a proveedores (navieras, aduanas, fletes locales). En el ERP se marca cada costo directo como Pagado/Pendiente." },
  { termino: "Tratamiento de IVA", definicion: `Se define por producto o servicio en Configuración → Catálogo de productos y servicios. Opciones: ${TIPO_IVA_OPCIONES.map((o) => o.label).join(", ")}. ${TIPO_IVA_AYUDA_GENERAL} El 8% requiere habilitación de la organización. Revisa el tratamiento de cada concepto antes de timbrar.` },
  { termino: "Tipo de cambio", definicion: "Conversión USD→MXN o EUR→MXN. Se obtiene del DOF vía API SIE de Banxico (series SF43718 y SF46410) con caché de 12 h. La Publicación DOF de hoy = FIX del día hábil anterior; esa es la fuente legal para CFDI (Art. 20 CFF) y se puede sobrescribir manualmente." },

  // Plataforma
  { termino: "Tenant / Organización", definicion: "Cada empresa que usa el ERP. Los datos están aislados entre organizaciones por RLS." },
  { termino: "Impersonación", definicion: "Capacidad del super-admin de Libre Carga para entrar a una organización con los permisos de un usuario suyo (siempre queda registrada en bitácora)." },
  { termino: "Bitácora", definicion: "Registro inmutable de cada acción importante (CRUD) con quién, cuándo y qué cambió. Vive en /bitacora." },
  { termino: "Bandeja", definicion: "Vista filtrada de pendientes (por capturar, por pagar, por emitir). Aparecen en el sidebar con badge cuando hay items." },
  { termino: "RLS", definicion: "Row-Level Security de la base de datos — garantiza que un usuario nunca vea datos de otra organización aunque cambie URLs." },
];
