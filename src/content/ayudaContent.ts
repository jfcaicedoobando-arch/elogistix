/**
 * Contenido estático de la página /ayuda.
 * Separado del componente para mantenerlo <200 líneas y permitir tests.
 */

export interface GlossaryTerm {
  termino: string;
  definicion: string;
}

export interface FaqItem {
  pregunta: string;
  respuesta: string;
}

export interface AyudaModulo {
  id: string;
  titulo: string;
  resumen: string;
  faqs: FaqItem[];
}

export const GLOSARIO: GlossaryTerm[] = [
  { termino: "BL Master", definicion: "Bill of Lading que la naviera emite al consolidador. Un BL Master agrupa varios BL House cuando es carga consolidada (LCL)." },
  { termino: "BL House", definicion: "Bill of Lading que el forwarder emite a su cliente final. Vive dentro de un BL Master en consolidados." },
  { termino: "Expediente", definicion: "Identificador interno único del embarque (formato I-25-00001 para importación, X-25-00001 para exportación). Se genera automáticamente al crear el embarque." },
  { termino: "ETD", definicion: "Estimated Time of Departure — fecha estimada de zarpe del puerto de origen." },
  { termino: "ETA", definicion: "Estimated Time of Arrival — fecha estimada de llegada al puerto destino." },
  { termino: "FCL", definicion: "Full Container Load — contenedor completo de un solo cliente. Cada embarque FCL tiene su propio contenedor." },
  { termino: "LCL", definicion: "Less than Container Load — carga consolidada. Varios clientes comparten un contenedor; se trackea por BL House." },
  { termino: "Incoterm", definicion: "Reglas internacionales (FOB, CIF, DDP, etc.) que definen qué costos y riesgos asume el comprador vs el vendedor durante el embarque." },
  { termino: "Proforma", definicion: "Documento previo a la factura que envías al cliente para que apruebe los conceptos antes de timbrar. No tiene valor fiscal." },
  { termino: "Factura", definicion: "Comprobante fiscal con valor legal (en México requiere timbrado SAT con CFDI 4.0). Aquí se genera y se conserva en PDF/XML." },
  { termino: "Demoras", definicion: "Cargos que cobra la naviera o el puerto cuando el contenedor se queda más días de los gratuitos (típico 7-10 días)." },
  { termino: "Liquidación", definicion: "Pago a proveedores (navieras, aduanas, fletes locales). En el ERP se marca cada concepto de costo como Pagado/Pendiente." },
  { termino: "Hueco de facturación", definicion: "Embarques cuyo ETD ya pasó hace más de 5 días y no tienen factura emitida — el proveedor ya nos cobró pero no hemos facturado al cliente. Indicador clave de capital de trabajo." },
  { termino: "Aging de cartera", definicion: "Clasificación de facturas pendientes por antigüedad (0-30, 31-60, 61-90, 90+ días). Mide la calidad de la cobranza." },
  { termino: "Tipo de cambio", definicion: "Conversión USD→MXN o EUR→MXN que se aplica al embarque. Se obtiene en vivo de Frankfurter.app con caché de 1 hora; se puede sobrescribir manualmente." },
  { termino: "Tasa IVA", definicion: "Configurable globalmente (default 16%). Se aplica a conceptos marcados con 'aplica IVA' al generar la factura." },
];

export const MODULOS: AyudaModulo[] = [
  {
    id: "embarques",
    titulo: "Embarques",
    resumen: "Crear, editar y dar seguimiento al ciclo completo: cotización → embarque → entrega.",
    faqs: [
      { pregunta: "¿Cómo creo un embarque desde cero?", respuesta: "Embarques → Nuevo. Sigue el wizard de 4 pasos: datos generales, ruta y fechas, conceptos de venta y costos, documentos. Al guardar se asigna expediente automático." },
      { pregunta: "¿Cómo creo un embarque desde una cotización aprobada?", respuesta: "En Cotizaciones, abre la cotización → botón 'Convertir a embarque'. Se copian cliente, ruta, conceptos y notas; sólo confirmas fechas y guardas." },
      { pregunta: "¿Cuándo uso FCL vs LCL?", respuesta: "FCL si el cliente paga un contenedor completo. LCL si comparte contenedor con otros clientes (consolidado) — en ese caso el sistema te obliga a registrar BL House y el embarque vive bajo un BL Master padre." },
      { pregunta: "¿Cómo cambio el estado del embarque?", respuesta: "En el detalle del embarque, pestaña Tracking → 'Avanzar estado'. Los 7 estados son: Cotización, Confirmado, En tránsito, En puerto, Liberado, Entregado, Cerrado. Cada cambio registra evento automático." },
      { pregunta: "¿Por qué no me deja eliminar un embarque?", respuesta: "Si tiene factura emitida o proforma aprobada, no se puede eliminar (regla fiscal). Cancela la factura primero o usa la papelera (admin)." },
    ],
  },
  {
    id: "facturacion",
    titulo: "Pre-Facturación",
    resumen: "Proformas, facturas y liquidación de gastos.",
    faqs: [
      { pregunta: "¿Diferencia entre proforma y factura?", respuesta: "La proforma es un borrador que envías al cliente para que apruebe los conceptos. La factura es el comprobante fiscal definitivo. Sólo se factura desde una proforma marcada como 'Aprobada por cliente'." },
      { pregunta: "¿Cómo consolido proformas?", respuesta: "Selecciona varias proformas del mismo cliente en la pestaña Pendientes → botón 'Consolidar'. Se genera una sola factura con todos los conceptos." },
      { pregunta: "¿Cómo descargo el layout contable?", respuesta: "Pre-Facturación → tab Facturas → botón 'Layout contable'. Descarga un CSV con RFC, subtotal, IVA, uso CFDI y todos los campos que tu contador necesita para timbrar." },
      { pregunta: "¿Qué hago con la pestaña Liquidación de gastos?", respuesta: "Lista de conceptos de costo (cobros del proveedor) sin pagar. Marca 'Pagado' cuando emitiste la transferencia, opcionalmente con referencia bancaria." },
      { pregunta: "¿Qué es el 'Hueco de facturación'?", respuesta: "Embarques cuyo ETD pasó hace más de 5 días sin factura. Indica que el proveedor ya nos cobró pero el cliente no — riesgo de capital de trabajo." },
    ],
  },
  {
    id: "clientes",
    titulo: "Clientes",
    resumen: "Alta de clientes, contactos, documentos onboarding y portal.",
    faqs: [
      { pregunta: "¿Qué documentos necesita un cliente para operar?", respuesta: "11 documentos obligatorios: CSF, comprobante domicilio, identificación oficial del representante legal, acta constitutiva, etc. El sistema los lista y bloquea operación hasta que estén todos." },
      { pregunta: "¿Cómo le doy acceso al portal a un cliente?", respuesta: "Cliente → pestaña Usuarios del portal → 'Invitar'. Recibe email con liga. Sólo verá SUS embarques, cotizaciones y facturas." },
      { pregunta: "¿El cliente recibe notificaciones?", respuesta: "Sí, cada cambio de estado de su embarque genera notificación en la campanita del portal (badge rojo si hay no leídas)." },
      { pregunta: "¿Cómo importo clientes masivamente?", respuesta: "Clientes → 'Importar CSV'. Descarga el template, llénalo, súbelo. El sistema valida con Zod antes de insertar." },
    ],
  },
  {
    id: "operacion-diaria",
    titulo: "Operación diaria",
    resumen: "Búsqueda global, dashboard, alertas y atajos.",
    faqs: [
      { pregunta: "¿Cómo busco rápido un embarque?", respuesta: "Presiona Ctrl+K (Cmd+K en Mac) desde cualquier pantalla. Busca por expediente, cliente, BL, factura o folio de proforma." },
      { pregunta: "¿Qué significan los badges de la barra lateral?", respuesta: "Rojo en Embarques = hay embarques en riesgo (demoras o sin movimiento >5 días). Rojo en Pre-Facturación = hay facturas vencidas." },
      { pregunta: "¿Dónde veo qué cambió alguien?", respuesta: "Bitácora — registra cada CRUD con diff de campos sensibles (qué cambió de qué a qué, quién lo hizo, cuándo)." },
      { pregunta: "¿Qué pasa si la app se cae?", respuesta: "Verás una pantalla con botón 'Reintentar'. El error se reporta automáticamente a logs internos. Si persiste, contacta al admin de tu organización." },
    ],
  },
];
