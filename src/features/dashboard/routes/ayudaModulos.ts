/**
 * Módulos de FAQ de la página /ayuda. Separado para mantener archivos
 * ≤200 líneas (Power of 10). Re-exportado por `ayudaContent.ts`.
 */
import type { AyudaModulo } from "./ayudaTypes";
import {
  DOCUMENTOS_OBLIGATORIOS_CLIENTE,
  DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO,
} from "@/features/cliente/domain/documentosCliente";
import {
  NBA_LEAD_SIN_CONTACTAR_HORAS,
  SEMANA_LEAD_SIN_CONTACTAR_DIAS,
} from "@/features/crm/domain/umbralesContacto";

export const MODULOS: AyudaModulo[] = [
  {
    id: "inicio",
    titulo: "1. Inicio / Dashboard",
    resumen: "Tu pantalla de arranque: qué pasa hoy en la operación.",
    audiencia: ["Todos"],
    faqs: [
      { pregunta: "¿Qué muestra el dashboard?", respuesta: "Cards de arribos del mes (con utilidad proyectada), embarques en riesgo (demoras), facturación pendiente y comisiones devengadas. Cambia según tu rol: un vendedor ve sólo sus cuentas, un coordinador ve toda la operación." },
      { pregunta: "¿Para qué sirve el toggle 'míos / todos'?", respuesta: "Lo ven vendedores y operadores. Filtra el dashboard a sólo los embarques/cuentas asignados a ti, o muestra los de toda la organización." },
      { pregunta: "¿Qué significan los colores de los badges?", respuesta: "Rojo = atención urgente (factura vencida, demora). Amarillo = próximo a vencer (ETA en ≤1 día). Azul = informativo. Gris = sin pendientes." },
      { pregunta: "¿Por qué no veo utilidad MXN en una card?", respuesta: "La utilidad se calcula al tipo de cambio del día de cierre. Si el embarque sigue abierto, verás 'proyectado' con el TC actual; cuando cierre, se fija el real." },
    ],
  },
  {
    id: "crm",
    titulo: "2. CRM",
    resumen: "Leads, oportunidades, actividades y proyección comercial.",
    audiencia: ["Vendedor", "Gerente Comercial"],
    faqs: [
      { pregunta: "¿Diferencia entre 'Mi día' y 'Resumen'?", respuesta: "Mi día es tu lista de trabajo: acciones sugeridas, actividades de hoy y oportunidades que cierran esta semana. Resumen es el tablero ejecutivo: indicadores, proyección de ventas, embudo y desempeño de vendedores. Mi día = qué hacer; Resumen = cómo vamos. Revisa el periodo indicado en cada bloque antes de comparar cifras con Analítica." },
      { pregunta: "¿Cómo creo un lead rápido?", respuesta: "Botón '+' arriba a la derecha del CRM (Quick Add) o atajo de teclado en cualquier pantalla del CRM. También puedes importar masivamente desde CRM → Leads → Importar CSV." },
      { pregunta: "¿Cómo convierto una oportunidad ganada en cotización?", respuesta: "Abre la oportunidad → botón 'Crear cotización desde oportunidad'. Se prellenan cliente, contacto, ruta y vendedor; sólo confirmas tarifa y conceptos." },
      { pregunta: "¿Qué son las Next Best Actions (NBA)?", respuesta: `Sugerencias automáticas del CRM que aparecen primero en Mi día: leads nuevos sin contactar hace más de ${NBA_LEAD_SIN_CONTACTAR_HORAS} horas, cotizaciones sin respuesta, oportunidades a punto de cerrarse. Ojo: la tarjeta 'Leads sin contactar' del resumen usa otro contexto y agrupa los que llevan más de ${SEMANA_LEAD_SIN_CONTACTAR_DIAS} días; son dos umbrales distintos a propósito (acción inmediata vs. seguimiento semanal).` },
      { pregunta: "¿Cómo busco una cuenta o contacto?", respuesta: "Ctrl+K (Cmd+K en Mac) abre la paleta global y busca en leads, oportunidades, clientes, contactos y embarques al mismo tiempo." },
      { pregunta: "¿Quién ve la proyección de ventas?", respuesta: "Se muestra según el alcance de tu rol. Gerencia Comercial y administradores pueden consultar al equipo y su desempeño por vendedor. En Analítica, los totales abarcan todas las fechas de cierre estimado, no sólo el mes actual." },
    ],
  },
  {
    id: "cotizaciones",
    titulo: "3. Cotizaciones",
    resumen: "Cotizar por modo de transporte, revisar costos y utilidad y convertir a embarque.",
    audiencia: ["Vendedor", "Ejecutivo de Pricing"],
    faqs: [
      { pregunta: "¿Cómo empiezo una cotización y cuándo uso una tarifa?", respuesta: "En Datos generales del asistente, elige modo de transporte y tipo de operación. Para marítimo, completa ruta y tipo de carga; selecciona una tarifa compatible cuando corresponda. En aéreo, terrestre y otras operaciones, revisa o captura los costos en Costos y utilidad según las opciones habilitadas. El contenedor marítimo no es un requisito de todos los modos." },
      { pregunta: "¿Qué hago si no hay tarifa para esa ruta?", respuesta: "Marca la cotización como 'requiere pricing' y notifica al Ejecutivo de Pricing. Él captura/negocia la tarifa en Costeo y la cotización se actualiza." },
      { pregunta: "¿Quién puede sobrescribir una tarifa sugerida (override)?", respuesta: "Sólo Gerente Comercial y admins. El Vendedor propone, el Gerente aprueba. El override queda registrado en bitácora con quién y por qué." },
      { pregunta: "¿Dónde veo el margen de mi cotización?", respuesta: "Revisa los costos en Costos y utilidad, prepara la venta en Cotización del cliente y comprueba la comparación venta/costo en Resumen. La utilidad es preliminar mientras los importes sean estimados; el alcance de consulta depende de tu rol." },
      { pregunta: "¿Cómo hago el handoff al Coordinador Logístico?", respuesta: "Cuando el cliente confirma, abre la cotización → botón 'Convertir a embarque'. Se crea el embarque con expediente, se copian datos y el Coordinador recibe la notificación." },
      { pregunta: "¿Puedo enviar la cotización por correo desde el ERP?", respuesta: "Sí. Botón 'Enviar por correo' en el detalle de la cotización. Adjunta el PDF, valida el dominio del destinatario y registra el envío en bitácora." },
    ],
  },
  {
    id: "costeo",
    titulo: "4. Costeo / Tarifas",
    resumen: "Matriz de tarifas con partners, ranking y demoras automáticas.",
    audiencia: ["Ejecutivo de Pricing", "Gerente Comercial"],
    faqs: [
      { pregunta: "¿Cómo capturo una tarifa nueva?", respuesta: "Costeo → Tarifas → '+ Nueva tarifa'. Ruta (origen/destino con UN/LOCODE), tipo de contenedor, partner (proveedor), vigencia, días libres y frecuencia del servicio. Sin alguno de esos campos no entra al ranking." },
      { pregunta: "¿Cómo funciona el Top 3 ranking?", respuesta: "Para una ruta + contenedor dados, el sistema ordena las tarifas vigentes por costo total considerando flete, días libres y frecuencia. Las 3 mejores se le ofrecen al Vendedor en el asistente de cotización." },
      { pregunta: "¿Cómo vinculo un agente a un proveedor?", respuesta: "En la tarifa, campo 'Partner'. Es obligatorio: cada agente debe estar vinculado a un proveedor del directorio para que CXP pueda recibir su factura después." },
      { pregunta: "¿Qué es la carta garantía y cuándo se usa?", respuesta: "Documento que firmas con la naviera para liberar el contenedor sin pagar demoras al momento. Se registra en el embarque y NO es facturable al cliente." },
      { pregunta: "¿De dónde salen las demoras facturadas al cliente?", respuesta: "El ERP calcula, a partir de las fechas de la cronología del embarque, un tabulador escalonado de días extra × tarifa contra cliente. Aparece como concepto en la proforma; el costo equivalente (lo que cobra la naviera) entra a CXP." },
    ],
  },
  {
    id: "embarques",
    titulo: "5. Embarques",
    resumen: "Crear, editar y dar seguimiento al ciclo cotización → entrega.",
    audiencia: ["Coordinador Logístico", "Gerente de Operaciones"],
    faqs: [
      { pregunta: "¿Cómo creo un embarque desde cero?", respuesta: "Embarques → Nuevo embarque. Sigue los pasos del asistente: Datos Generales → Datos de Ruta → Documentos → Costos y Pricing. Completa los campos requeridos para tu modo de transporte; al guardar se asigna el expediente." },
      { pregunta: "¿Cómo lo creo desde una cotización aprobada?", respuesta: "En Cotizaciones, abre la cotización → 'Convertir a embarque'. Se copian cliente, ruta, conceptos y notas; sólo confirmas fechas y guardas. Es el handoff oficial Vendedor → Coordinador." },
      { pregunta: "¿Cuándo uso FCL vs LCL?", respuesta: "FCL si el cliente paga un contenedor completo. LCL si comparte contenedor (consolidado) — en ese caso el sistema te obliga a registrar BL House bajo un BL Master padre." },
      { pregunta: "¿Cómo avanzo el estado del embarque?", respuesta: "En el detalle, revisa la fase actual y la acción para avanzar. La cronología muestra fases como Confirmado, En Tránsito, Arribo, En Aduana, Entregado, EIR, Por liquidar y Cerrado. Las transiciones habilitadas dependen del modo de transporte y del estado actual; no todos los modos siguen la misma secuencia. Un borrador aparece como Por confirmar." },
      { pregunta: "¿Por qué no puedo avanzar el estado?", respuesta: "La siguiente transición depende del modo de transporte, la fase actual y sus requisitos. Revisa el aviso de la acción: indica qué datos o pendientes debes resolver antes de avanzar. No confundas una fecha estimada con la confirmación de un hito real." },
      { pregunta: "¿Por qué no me deja eliminar un embarque?", respuesta: "Si tiene factura emitida o proforma aprobada, no se puede eliminar (regla fiscal). Cancela la factura primero o usa la papelera (sólo admin)." },
      { pregunta: "¿De dónde sale la alerta de docs faltantes?", respuesta: "El embarque tiene un checklist de documentos obligatorios según incoterm y tipo de carga. La sidebar muestra badge cuando algún embarque está incompleto." },
    ],
  },
  {
    id: "cxp",
    titulo: "6. Compras (CXP)",
    resumen: "Facturas de proveedor, bandejas 'Por capturar' y 'Por pagar', conciliación con embarque.",
    audiencia: ["Auxiliar Contable", "Tesorero", "Contador"],
    faqs: [
      { pregunta: "¿Qué es 'Por capturar'?", respuesta: "Bandeja con costos del embarque (sugeridos por la tarifa) que todavía no tienen factura de proveedor recibida. Es la lista del Auxiliar Contable: cuando llega el PDF/XML, lo captura desde aquí." },
      { pregunta: "¿Cómo subo una factura de proveedor?", respuesta: "Compras → CXP → 'Nueva factura' (o desde 'Por capturar', botón 'Capturar'). Sube el XML o PDF; el sistema parsea RFC, monto e IVA y te muestra los costos del embarque candidatos para conciliar." },
      { pregunta: "¿Qué es el folio interno FP-XXXXXX?", respuesta: "Identificador único por organización para cada factura de proveedor (FP-000001 en adelante). Lo asigna la BD, es inmutable y la tabla de CXP viene ordenada por folio descendente (lo más reciente arriba)." },
      { pregunta: "¿Quién autoriza pagar al proveedor?", respuesta: "Sólo Tesorero (y admins). El Auxiliar Contable captura, el Tesorero paga — separación de funciones a propósito." },
      { pregunta: "¿Cómo veo qué facturas están vencidas?", respuesta: "Compras → Facturas → Por pagar, o Dinero → Antigüedad CxP. Revisa el saldo y los días de vencimiento por factura." },
      { pregunta: "¿Por qué no puedo eliminar un proveedor?", respuesta: "Si tiene facturas, embarques o tarifas vinculadas, el sistema lo bloquea (te dice cuántos registros depende de él). Hay que migrarlos primero." },
    ],
  },
  {
    id: "facturacion",
    titulo: "7. Facturación (CXC)",
    resumen: "Proformas, facturas, cartera, complementos de pago y comisiones.",
    audiencia: ["Contador", "Ejecutivo de Cobranza"],
    faqs: [
      { pregunta: "¿Diferencia entre proforma y factura?", respuesta: "La proforma es un documento comercial previo, sin valor fiscal. Desde una proforma lista, Crear borrador de factura prepara el documento para revisión; todavía no hay un CFDI timbrado. La aprobación se exige cuando la política del cliente lo indica. La factura adquiere validez fiscal al timbrarse." },
      { pregunta: "¿Cómo consolido proformas?", respuesta: "Selecciona varias proformas del mismo cliente en la pestaña Pendientes → 'Consolidar'. Se genera una sola factura con todos los conceptos." },
      { pregunta: "¿Cómo emito una factura?", respuesta: "Desde una proforma lista, usa Crear borrador de factura. Abre el borrador en Facturación → Por timbrar, revisa conceptos y datos fiscales y usa Timbrar. El envío a Facturapi puede quedar en proceso; comprueba que el estado confirme el timbrado antes de entregar el CFDI. Los roles autorizados también pueden empezar con Nueva factura manual." },
      { pregunta: "¿Cómo cancelo un CFDI?", respuesta: "Detalle de la factura → 'Cancelar'. Eliges motivo SAT (01, 02, 03, 04) y, si aplica, el folio del CFDI sustituto. Queda registrado en bitácora." },
      { pregunta: "¿Cuándo emito un complemento de pago (REP)?", respuesta: "Cuando se cobra una factura PPD, total o parcialmente. Al aplicar el cobro se solicita el timbrado cuando corresponde. Revisa REP pendientes si queda en proceso o presenta un error; no registres otra vez el cobro. Cancelar un REP aceptado por el SAT da de baja su cobro en el ERP y recalcula el saldo y sus vínculos bancarios, pero no devuelve dinero en el banco." },
      { pregunta: "¿Cómo descargo el layout contable?", respuesta: "Facturación → tab Facturas → 'Layout contable'. CSV con RFC, subtotal, IVA, uso CFDI y todos los campos que tu contador necesita." },
      { pregunta: "¿Qué es el 'Hueco de facturación'?", respuesta: "Embarques cuyo ETD pasó hace más de 5 días sin factura emitida. Indica que el proveedor ya nos cobró pero al cliente no — riesgo de capital de trabajo." },
      { pregunta: "¿Cómo registro una promesa de pago?", respuesta: "Facturación → Cartera → abre la factura vencida → 'Registrar promesa'. El sistema crea recordatorio para esa fecha." },
    ],
  },
  {
    id: "tesoreria",
    titulo: "8. Tesorería",
    resumen: "Pagos a proveedores, conciliación bancaria y liquidación de comisiones.",
    audiencia: ["Tesorero"],
    faqs: [
      { pregunta: "¿Cómo concilio movimientos bancarios?", respuesta: "Dinero → Conciliación bancaria → selecciona una cuenta e importa el estado de cuenta. Revisa y confirma la importación antes de guardar. Usa Conciliar coincidencias únicas para casos compatibles en moneda, dirección, importe y fecha; la ayuda de la cuenta indica las tolerancias. Revisa manualmente las coincidencias ambiguas y los movimientos restantes." },
      { pregunta: "¿Qué pasa si un movimiento no tiene coincidencia?", respuesta: "Queda pendiente de conciliación. Revisa la moneda, dirección, fecha, importe y referencia antes de vincularlo manualmente. No registres de nuevo un pago que ya existe sólo para conciliarlo." },
      { pregunta: "¿Cómo registro un pago a proveedor?", respuesta: "Compras → Facturas → abre la factura y registra el pago con banco, monto y referencia. Registrar el pago no confirma su conciliación bancaria. Importa y revisa el estado de cuenta en Dinero → Conciliación bancaria; usa Conciliar coincidencias únicas para los casos compatibles y revisa manualmente los restantes." },
      { pregunta: "¿Cómo liquido comisiones del vendedor?", respuesta: "Facturación → Comisiones → calcula devengadas del mes (sólo facturas cobradas). Marca como liquidadas al pagarlas." },
      { pregunta: "¿Mezcla el ERP MXN con USD?", respuesta: "No. Cada divisa lleva su propia cartera, su propia caja y su propia conciliación. Las conversiones quedan registradas con tipo de cambio del día." },
    ],
  },
  {
    id: "profit",
    titulo: "9. Utilidad y reportes",
    resumen: "Estado de resultados, rentabilidad de embarques y desempeño de vendedores.",
    audiencia: ["Gerencia", "Contador"],
    faqs: [
      { pregunta: "¿Cómo veo el margen de un embarque específico?", respuesta: "/profit → 'P&L por contenedor'. Lista cada embarque con venta, costos directos, margen y % margen. Filtra por mes, cliente o vendedor." },
      { pregunta: "¿Qué incluye el estado de resultados?", respuesta: "Ventas − costos directos − gastos operativos + diferencia cambiaria del periodo. Lo ves por mes o trimestre, con comparativo vs periodo anterior." },
      { pregunta: "¿De dónde sale la diferencia cambiaria?", respuesta: "De la variación de TC entre el día de la factura y el día del cobro (o entre captura y pago, en CXP). El ERP lo calcula automático cuando concilias el movimiento." },
      { pregunta: "¿Cómo exporto a contabilidad?", respuesta: "Cada reporte tiene botón 'Exportar CSV'. Layout contable separado para facturas emitidas, recibidas y pagos." },
      { pregunta: "¿Dónde reviso el desempeño de vendedores?", respuesta: "En CRM → Resumen y Analítica, consulta Desempeño de vendedores. Revisa el periodo y alcance indicados en ese bloque antes de compararlo con facturación o cobranza: oportunidades ganadas no equivalen a facturas cobradas." },
    ],
  },
  {
    id: "clientes-portal",
    titulo: "10. Clientes y Portal",
    resumen: "Onboarding, documentos, contactos y acceso al portal del cliente.",
    audiencia: ["Atención a Clientes", "Coordinador Logístico", "Vendedor"],
    faqs: [
      { pregunta: "¿Qué documentos necesita un cliente para operar?", respuesta: `El expediente mínimo incluye ${DOCUMENTOS_OBLIGATORIOS_CLIENTE.length} documentos: ${DOCUMENTOS_OBLIGATORIOS_CLIENTE.join(", ")}. Si opera con crédito, son ${DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO.length}; se agrega ${DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO.filter((tipo) => !DOCUMENTOS_OBLIGATORIOS_CLIENTE.includes(tipo)).join(", ")}. Consulta Cliente → Documentos para ver lo que falta y los requisitos aplicables; no todos los documentos del catálogo son obligatorios para todos los clientes.` },
      { pregunta: "¿Cómo subo la CSF de un cliente?", respuesta: "Cliente → tab Documentos → sube el PDF de la CSF. El ERP la lee con IA y extrae RFC, razón social, régimen fiscal y domicilio fiscal automáticamente para que sólo confirmes." },
      { pregunta: "¿Cómo doy acceso al portal a un cliente?", respuesta: "Cliente → pestaña Usuarios del portal → 'Invitar'. Recibe email con liga; sólo verá SUS embarques, cotizaciones y facturas." },
      { pregunta: "¿Qué ve el cliente en el portal?", respuesta: "Sus embarques con tracking en vivo, sus cotizaciones, sus facturas (con descarga de PDF/XML), notificaciones de cambios de estado y datos de contacto del Coordinador asignado." },
      { pregunta: "¿Cómo manejo contactos con Tax ID extranjero?", respuesta: "En el contacto del cliente, campo 'Tax ID internacional' (no RFC). Aplica para shippers o consignees en el extranjero." },
      { pregunta: "¿Cómo importo clientes masivamente?", respuesta: "Clientes → 'Importar CSV'. Descarga el template, llénalo, súbelo. El sistema valida cada fila antes de insertar." },
    ],
  },
  {
    id: "operacion",
    titulo: "11. Operación diaria",
    resumen: "Atajos, búsqueda global, bandejas, bitácora y multi-organización.",
    audiencia: ["Todos"],
    faqs: [
      { pregunta: "¿Cómo busco rápido un embarque, cliente o factura?", respuesta: "Ctrl+K (Cmd+K en Mac) desde cualquier pantalla. Busca en embarques, cotizaciones, clientes, contactos, facturas y proformas al mismo tiempo." },
      { pregunta: "¿Qué son las bandejas del sidebar?", respuesta: "Vistas filtradas de pendientes: 'Por capturar' (costos sin factura de proveedor), 'Por pagar' (CXP vigente), 'Por emitir' (proformas aprobadas sin facturar). El badge rojo cuenta los items." },
      { pregunta: "¿Qué significan los badges del sidebar?", respuesta: "Rojo en Embarques = embarques en riesgo (demoras o ETA hoy). Rojo en Facturación = facturas vencidas. Rojo en CXP = facturas próximas a vencer. Aparece sólo si hay algo que ver." },
      { pregunta: "¿Dónde veo qué cambió alguien?", respuesta: "/bitacora — registra cada CRUD importante con diff de campos sensibles (qué cambió de qué a qué, quién lo hizo, cuándo). Es inmutable." },
      { pregunta: "¿Cómo cambio entre organizaciones (super-admin)?", respuesta: "Selector arriba del sidebar — sólo lo ve el super-admin de Libre Carga. Al entrar a otra organización, todos los datos se filtran a ese tenant y cada acción queda registrada como impersonación." },
      { pregunta: "¿Qué pasa si la app se cae?", respuesta: "Si aparece Reintentar, úsalo. Si el error persiste, dentro del ERP usa Reportar bug o mejora en la barra superior. Incluye los pasos y, si el aviso permite Copiar JSON, adjunta ese diagnóstico. Desde Ayuda, entra al ERP o inicia sesión para acceder al reporte." },
      { pregunta: "¿Cómo cambio el tema (claro/oscuro)?", respuesta: "Menú del usuario abajo del sidebar → 'Tema' → claro / oscuro / sistema." },
    ],
  },
  {
    id: "roles",
    titulo: "12. Roles y permisos",
    resumen: "Quién puede hacer qué dentro del ERP.",
    audiencia: ["Administrador de organización"],
    faqs: [
      { pregunta: "¿Cómo invito a un usuario?", respuesta: "Usuarios → 'Nuevo Usuario'. Email, contraseña inicial y rol (dropdown agrupado por área: Administración / Operaciones / Comercial / Finanzas / Soporte). El usuario debe cambiar su contraseña al primer login." },
      { pregunta: "¿Cuáles son los 12 roles asignables?", respuesta: "Admin (org). Operaciones: Gerente de Operaciones, Gerente Visor, Coordinador Logístico. Comercial: Gerente Comercial, Ejecutivo de Pricing, Vendedor/KAM. Finanzas: Contador, Tesorero, Auxiliar Contable, Ejecutivo de Cobranza. Soporte: Atención a Clientes." },
      { pregunta: "¿Qué hace cada uno?", respuesta: "El dropdown del modal de nuevo usuario muestra la descripción de cada rol. Resumen: Vendedor arma cotizaciones; Pricing negocia tarifas con partners; Coordinador ejecuta embarques tras el handoff; Contador timbra y emite; Tesorero paga y concilia; Auxiliar captura facturas de proveedor; Cobranza da seguimiento a vencidas." },
      { pregunta: "¿Cómo funciona el handoff Vendedor → Coordinador?", respuesta: "El Vendedor arma la cotización con P&L preliminar. Cuando el cliente confirma, dispara 'Convertir a embarque' — el Coordinador Logístico recibe el embarque y toma el control operativo. El Vendedor sigue viendo embarques y cobranza de sus cuentas." },
      { pregunta: "¿Quién aprueba un override de tarifa?", respuesta: "Sólo Gerente Comercial y admins. El Vendedor o Pricing proponen; el override queda en bitácora con quién aprobó y motivo." },
      { pregunta: "¿Cómo cambio el rol de un usuario existente?", respuesta: "Usuarios → abre el usuario → cambia el rol → guarda. El cambio aplica inmediatamente al siguiente refresh de su sesión." },
      { pregunta: "¿Puedo tener un usuario con varios roles?", respuesta: "No. Cada usuario tiene un rol único por organización. Para responsabilidades cruzadas, asigna el rol con más permisos (típicamente Gerente)." },
    ],
  },
];
