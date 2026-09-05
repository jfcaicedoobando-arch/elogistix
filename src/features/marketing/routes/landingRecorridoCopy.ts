/**
 * Copy de las secciones "Antes y después" y "Recorrido" de la landing.
 * Vive aparte de `landingCopy.ts` para respetar el límite de 200 líneas.
 */
// Comparativa honesta: sólo capacidades que ya existen en el sistema.
export const ANTES_DESPUES = {
  eyebrow: "Antes y después",
  title: "Así se opera hoy… y así queda con Libre Carga",
  subtitle: "Ninguna agencia pierde embarques por falta de talento. Los pierde por falta de un solo lugar donde vive la información.",
  antesTitle: "Excel, carpetas y WhatsApp",
  despuesTitle: "Un solo expediente por embarque",
  filas: [
    {
      antes: "Un archivo de Excel por embarque, con versiones distintas en cada computadora.",
      despues: "Un expediente único con ruta, contenedores, documentos y costos siempre al día.",
    },
    {
      antes: "El cliente escribe por WhatsApp para preguntar dónde va su contenedor.",
      despues: "El cliente entra a su portal y ve el timeline, sus facturas y su saldo cuando quiera.",
    },
    {
      antes: "La cotización se rearma desde cero cada vez y el margen se calcula a mano.",
      despues: "Conceptos y márgenes precargados: la cotización sale en minutos y se convierte en embarque.",
    },
    {
      antes: "La cobranza vive en otra hoja y nadie sabe con certeza qué falta cobrar.",
      despues: "Proforma, factura y pago en el mismo flujo, con saldos y antigüedad calculados solos.",
    },
    {
      antes: "El tipo de cambio y el IVA se copian a mano, con riesgo de error fiscal.",
      despues: "Tipo de cambio del DOF e IVA configurable por organización, aplicados en automático.",
    },
  ],
} as const;

// Recorrido del producto: maquetas construidas con los mismos tokens de la app.
export const RECORRIDO = {
  eyebrow: "Recorrido",
  title: "Mira cómo se ve por dentro",
  subtitle: "El mismo flujo que usan las agencias todos los días: cotizar, operar y cobrar.",
  pasos: [
    {
      id: "cotizacion",
      tab: "Cotización",
      title: "Cotiza con tus conceptos y tu margen",
      desc: "Capturas la ruta y el equipo; los conceptos, la moneda y el margen se calculan al momento. El PDF sale listo para enviar.",
      docLabel: "Cotización",
      folio: "COT-2026-0184",
      estado: "Enviada",
      campos: [
        { label: "Cliente", value: "Importadora del Bajío" },
        { label: "Ruta", value: "CNSHA → MZLO" },
        { label: "Equipo", value: "1 × 40' HC" },
        { label: "Margen", value: "18.4 %" },
      ],
      bullets: ["Conceptos predefinidos", "Tipo de cambio del DOF", "PDF listo para enviar"],
    },
    {
      id: "embarque",
      tab: "Embarque",
      title: "Convierte la cotización en operación",
      desc: "Un clic y nace el embarque con su timeline, sus documentos y sus contenedores. Todo el equipo ve el mismo avance.",
      docLabel: "Embarque · FCL",
      folio: "LCG-2026-0142",
      estado: "En tránsito",
      campos: [
        { label: "BL Master", value: "MAEU-794821" },
        { label: "Naviera", value: "Maersk" },
        { label: "ETA", value: "08/06/2026" },
        { label: "Contenedores", value: "1 × 40' HC" },
      ],
      bullets: ["Timeline automático", "Documentos por embarque", "Tracking para el cliente"],
    },
    {
      id: "cobro",
      tab: "Cobro",
      title: "Cierra el ciclo con la factura y el pago",
      desc: "Emites proforma, generas la factura con IVA dinámico y registras el pago. Los saldos y la utilidad se actualizan solos.",
      docLabel: "Factura",
      folio: "FAC-2026-0331",
      estado: "Pagada",
      campos: [
        { label: "Subtotal", value: "$48,500.00 MXN" },
        { label: "IVA", value: "$7,760.00 MXN" },
        { label: "Total", value: "$56,260.00 MXN" },
        { label: "Saldo", value: "$0.00 MXN" },
      ],
      bullets: ["Proforma consolidada", "IVA configurable", "Saldos y utilidad al día"],
    },
  ],
} as const;
