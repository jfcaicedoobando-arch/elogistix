import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type ChangeType = "major" | "minor" | "patch";

interface ChangelogEntry {
  version: string;
  date: string;
  type: ChangeType;
  title: string;
  description: string;
}

const changelog: ChangelogEntry[] = [
  {
    version: "4.12.0",
    date: "2026-03-06",
    type: "minor",
    title: "Botón eliminar cotización (solo admin)",
    description:
      "Se agregó una columna de acciones en la tabla de cotizaciones con botón de eliminar visible únicamente para administradores. Incluye confirmación con AlertDialog antes de proceder.",
  },
  {
    version: "4.11.2",
    date: "2026-03-06",
    type: "patch",
    title: "Corregir pre-llenado Paso 2 → Paso 3 en wizard de cotización",
    description:
      "El pre-llenado del Paso 3 ahora se ejecuta directamente al avanzar desde el Paso 2, eliminando la dependencia del useEffect que causaba problemas de sincronización. Se removió la prop redundante onCostosChange.",
  },
  {
    version: "4.11.1",
    date: "2026-03-06",
    type: "patch",
    title: "Corregir validación Paso 3 → Paso 4 en wizard de cotización",
    description:
      "La validación del Paso 3 ahora filtra conceptos con descripción vacía en lugar de rechazarlos. Solo se guardan en la base de datos los conceptos válidos. Se requiere al menos un concepto con descripción para avanzar.",
  },
  {
    version: "4.11.0",
    date: "2026-03-05",
    type: "minor",
    title: "Guardado progresivo por paso en wizard de cotización",
    description:
      "El wizard de nueva cotización ahora guarda en la base de datos en cada paso: Paso 1 crea/actualiza la cotización, Paso 2 guarda costos internos, Paso 3 actualiza conceptos de venta y Paso 4 finaliza como Borrador. Si ocurre un error en cualquier paso, no avanza al siguiente.",
  },
  {
    version: "4.10.6",
    date: "2026-03-05",
    type: "patch",
    title: "Corregir pre-llenado IVA del Paso 3 desde Paso 2",
    description:
      "Se agregó callback onCostosChange en SeccionCostosInternosPLLocal para sincronizar estado con el wizard. El pre-llenado del Paso 3 ahora aplica IVA automático solo a conceptos USD específicos (Handling, Desconsolidación, Revalidación, Demoras, Cargos en Destino, Release) y siempre IVA para MXN.",
  },
  {
    version: "4.10.5",
    date: "2026-03-05",
    type: "patch",
    title: "Actualizar catálogos y lógica de IVA en Cotización Cliente",
    description:
      "Se actualizaron los catálogos de conceptos USD (16 opciones) y MXN (3 opciones) en la sección Cotización Cliente. Se amplió CONCEPTOS_CON_IVA para incluir Demoras, Cargos en Destino y Release. Al seleccionar un concepto con IVA, aplica_iva se activa automáticamente.",
  },
  {
    version: "4.10.4",
    date: "2026-03-05",
    type: "patch",
    title: "Actualizar catálogos de conceptos en Costos & P&L",
    description:
      "Se reemplazaron los catálogos de conceptos USD y MXN en el wizard de cotización. USD ahora incluye 16 opciones (Cargos en Origen, Costos Portuarios, Consolidación, Seguro, Recolección, Modificación de BL, Flete Marítimo/Aéreo/Terrestre, Handling, Desconsolidación, Revalidación, Demoras, Cargos en Destino, Release, Otro). MXN se simplificó a 3 opciones (Entrega Nacional, Honorarios de Despacho Aduanal, Otro).",
  },
  {
    version: "4.10.3",
    date: "2026-03-05",
    type: "patch",
    title: "Agregar 'Cargos en Destino' al catálogo USD",
    description:
      "Se añadió la opción 'Cargos en Destino' al dropdown de conceptos en USD dentro del wizard de nueva cotización (SeccionCostosInternosPLLocal).",
  },
  {
    version: "4.10.2",
    date: "2026-03-05",
    type: "patch",
    title: "Botón eliminar documentos en embarque",
    description:
      "Se agregó un botón 'Eliminar' en la pestaña de documentos del detalle de embarque. Permite borrar el archivo adjunto de Storage y regresar el estado del documento a 'Pendiente' para subir uno nuevo. La acción queda registrada en la bitácora.",
  },
  {
    version: "4.10.1",
    date: "2026-03-05",
    type: "patch",
    title: "Layout de dos líneas y catálogo de conceptos en Costos P&L",
    description:
      "Rediseño del componente SeccionCostosInternosPLLocal: cada fila se muestra en dos líneas (concepto/proveedor/unidad + cantidad/costo/venta/profit). El campo Concepto ahora es un Select con catálogo predefinido por moneda (USD/MXN). Se eliminó la tabla apretada en favor de un layout espacioso sin scroll horizontal.",
  },
  {
    version: "4.10.0",
    date: "2026-03-05",
    type: "minor",
    title: "Wizard de 4 pasos en Nueva Cotización",
    description:
      "Rediseño de NuevaCotizacion como wizard con 4 pasos: Datos Generales, Costos & P&L (con SeccionCostosInternosPLLocal), Cotización Cliente (pre-llenado automático desde costos) y Resumen con P&L y datos de operación. Incluye campo Número de Embarques y navegación con StepIndicator.",
  },
  {
    version: "4.9.5",
    date: "2026-03-05",
    type: "minor",
    title: "Botón Generar Embarques y card de embarques vinculados",
    description:
      "En CotizacionDetalle se agrega botón para convertir cotización aceptada en embarques con diálogo de confirmación, y una card que lista los embarques generados con links navegables.",
  },
  {
    version: "4.9.4",
    date: "2026-03-05",
    type: "minor",
    title: "Hook para convertir cotización en embarques",
    description:
      "Nuevo hook useConvertirCotizacionAEmbarques que crea automáticamente embarques a partir de una cotización según num_contenedores, mapeando costos por unidad_medida (Contenedor, BL, W/M) y actualizando el estado a Convertida.",
  },
  {
    version: "4.9.3",
    date: "2026-03-05",
    type: "patch",
    title: "Migración de esquema: contenedores, cotización-embarque y P&L en costos",
    description:
      "Se agregó num_contenedores a cotizaciones, cotizacion_id a embarques, y columnas de precio_venta, precio_total, profit, porcentaje_profit y unidad_medida a cotizacion_costos (con columnas generadas).",
  },
  {
    version: "4.9.2",
    date: "2026-03-05",
    type: "patch",
    title: "Corrección de inputs numéricos en conceptos de cotización",
    description:
      "Los campos de cantidad y precio unitario en conceptos USD y MXN ahora limpian el 0 inicial al hacer clic y validan correctamente el formato numérico/decimal.",
  },
  {
    version: "4.9.1",
    date: "2026-03-05",
    type: "patch",
    title: "Campo Agente en Datos de Ruta marítimo",
    description:
      "Nuevo campo de texto libre 'Agente' en la sección marítima de Datos de Ruta, junto al campo Naviera. Disponible en creación y edición de embarques.",
  },
  {
    version: "4.9.0",
    date: "2026-03-04",
    type: "minor",
    title: "Catálogo de puertos configurable",
    description:
      "Los puertos de origen/destino en cotizaciones y embarques ahora se administran desde Configuración → Puertos. Se pueden agregar, desactivar y eliminar puertos. La tabla 'puertos' en la base de datos reemplaza el catálogo estático anterior.",
  },
  {
    version: "4.8.5",
    date: "2026-03-04",
    type: "patch",
    title: "Formato de moneda mexicana en todos los campos de dinero",
    description:
      "Reemplazados todos los formatos manuales de dinero con formatCurrency() usando Intl.NumberFormat('es-MX') en StepCostosPrecios, SeccionConceptosVentaCotizacion, CotizacionDetalle y cotizacionPdf. Separadores de miles y decimales consistentes en toda la app.",
  },
  {
    version: "4.8.4",
    date: "2026-03-04",
    type: "patch",
    title: "Refactorización: duplicados, sub-componentes y nombres",
    description:
      "Fase 1: Eliminado useClientesForSelect duplicado de useEmbarques, fmt local reemplazado por formatCurrency, CONCEPTOS_CON_IVA consolidado, calcularPL muerta eliminada, import Input no usado removido. Fase 2: Extraídos TablaConceptosUSD, TablaConceptosMXN, ResumenTotalesCotizacion y DialogConvertirProspecto de CotizacionDetalle (~488→~300 líneas). Fase 3: Variables crípticas renombradas (qc→queryClient, totUSD→totalesUSD, totMXN→totalesMXN).",
  },
  {
    version: "4.8.3",
    date: "2026-03-04",
    type: "patch",
    title: "P&L siempre calcula profit sin IVA",
    description:
      "Corregido el módulo de Costos Internos P&L para que todos los cálculos de profit usen subtotales sin IVA. La columna Venta muestra el valor neto con etiqueta visual '+ IVA' como referencia.",
  },
  {
    version: "4.8.2",
    date: "2026-03-04",
    type: "minor",
    title: "IVA condicional en conceptos USD",
    description:
      "Toggle switch de IVA 16% para conceptos Handling, Desconsolidación y Revalidación en la tabla USD de cotizaciones. Footer dinámico con desglose de subtotal, IVA y total cuando aplica.",
  },
  {
    version: "4.8.1",
    date: "2026-03-04",
    type: "patch",
    title: "Nuevos conceptos en catálogos de venta",
    description:
      "Se agregan Revalidación, Handling, Desconsolidación y Entrega Nacional a los dropdowns de conceptos USD y MXN en cotizaciones.",
  },
  {
    version: "4.8.0",
    date: "2026-03-04",
    type: "minor",
    title: "Unidad de Medida en conceptos de venta",
    description:
      "Nuevo campo dropdown 'Unidad de Medida' en ambas tablas de conceptos (USD y MXN) con opciones: BL, W/M, Documento, Contenedor, Kilo, Embarque. Visible también en el detalle de cotización.",
  },
  {
    version: "4.7.0",
    date: "2026-03-04",
    type: "minor",
    title: "Sección de Costos Internos P&L por moneda",
    description:
      "Nuevo componente SeccionCostosInternosPL con tablas separadas USD y MXN, pre-poblado automático desde conceptos de venta, cálculo de profit y % por fila, resumen colapsable con totales por moneda. Visible solo para admin y operador.",
  },
  {
    version: "4.6.0",
    date: "2026-03-04",
    type: "minor",
    title: "Reestructuración de costos internos de cotización",
    description:
      "Se recreó la tabla cotizacion_costos con nueva estructura: cantidad, costo unitario y costo total calculado automáticamente. Se eliminaron campos obsoletos (venta, profit, sección, unidad de medida). El formulario ahora muestra totales separados por moneda (USD/MXN).",
  },
  {
    version: "4.5.5",
    date: "2026-03-04",
    type: "minor",
    title: "Conceptos de venta separados por moneda (USD/MXN)",
    description:
      "Rediseño de conceptos de venta en cotizaciones con dos secciones fijas: USD (sin IVA) y MXN (con IVA 16% automático). Catálogos independientes por moneda, opción 'Otro' con texto libre, y resumen final con totales independientes. Se eliminó el campo Moneda global de datos generales.",
  },
  {
    version: "4.5.4",
    date: "2026-03-04",
    type: "patch",
    title: "Exportar cotización a PDF",
    description:
      "Botón para exportar cotizaciones a PDF con datos generales, mercancía y conceptos de venta. No incluye costos internos (P&L).",
  },
  {
    version: "4.5.3",
    date: "2026-03-04",
    type: "patch",
    title: "Rediseño de Costos Internos P&L",
    description:
      "Reestructuración visual de la sección de costos internos: cards individuales por concepto con labels, KPIs de resumen, badges por sección y desglose con mejor legibilidad.",
  },
  {
    version: "4.5.2",
    date: "2026-03-04",
    type: "patch",
    title: "Componente SeccionCostosInternosCotizacion",
    description:
      "Tabla editable de costos internos (P&L) por cotización con pre-poblado desde conceptos de venta, cálculo de profit en tiempo real, secciones y guardado en lote.",
  },
  {
    version: "4.5.1",
    date: "2026-03-04",
    type: "patch",
    title: "Hook useCotizacionCostos",
    description:
      "Nuevo hook con useCotizacionCostos (query), useUpsertCostos (upsert en lote), useDeleteCosto y función calcularPL para totales globales y por sección.",
  },
  {
    version: "4.5.0",
    date: "2026-03-04",
    type: "minor",
    title: "Tabla cotizacion_costos en base de datos",
    description:
      "Nueva tabla cotizacion_costos con campos de concepto, proveedor, moneda, costo, venta y columnas calculadas de profit y porcentaje. Incluye secciones (Origen, Flete Internacional, Destino, Otro), políticas RLS por rol y trigger de updated_at.",
  },
  {
    version: "4.4.2",
    date: "2026-03-04",
    type: "patch",
    title: "Validación inline en formulario de Nuevo Embarque",
    description:
      "Los campos obligatorios (modo, tipo, cliente, descripción de mercancía) ahora muestran mensajes de error en rojo cuando están vacíos. No se permite avanzar al paso 2 ni crear el embarque sin completarlos.",
  },
  {
    version: "4.4.1",
    date: "2026-03-04",
    type: "patch",
    title: "Valor por defecto FOB en campo Incoterm",
    description:
      "El campo Incoterm en el formulario de Nuevo Embarque ahora tiene 'FOB' como valor por defecto, evitando errores de validación cuando no se selecciona manualmente.",
  },
  {
    version: "4.4.0",
    date: "2026-03-04",
    type: "minor",
    title: "Agrupación de embarques por BL Master",
    description:
      "Cuando se crea un embarque con un BL Master existente, se asigna automáticamente la misma referencia Elogistix. Nueva columna BL Master en la lista de embarques con búsqueda incluida. Sección 'Embarques relacionados' en el detalle muestra todos los BL House bajo el mismo BL Master con navegación directa.",
  },
  {
    version: "4.3.5",
    date: "2026-03-04",
    type: "minor",
    title: "Generación automática de expediente EL[TIPO][CONSECUTIVO]",
    description:
      "El número de referencia del embarque ahora se genera automáticamente desde la base de datos con formato secuencial (ej: ELIMP00001, ELEXP00002). Es único, irrepetible y no editable por el operador.",
  },
  {
    version: "4.3.4",
    date: "2026-03-03",
    type: "patch",
    title: "Corrección de error UUID vacío al crear embarque",
    description:
      "Se agregó validación de campos requeridos (cliente, modo, tipo) antes de crear un embarque. Los campos UUID opcionales ahora envían null en lugar de cadena vacía, evitando el error de Postgres.",
  },
  {
    version: "4.3.3",
    date: "2026-03-03",
    type: "patch",
    title: "Carga funcional de documentos en Nuevo Embarque",
    description:
      "Los botones de 'Subir' en el paso 3 del wizard de creación de embarques ahora permiten seleccionar archivos reales. Los archivos se suben a Supabase Storage al crear el embarque y la ruta se guarda en la tabla documentos_embarque.",
  },
  {
    version: "4.3.2",
    date: "2026-03-03",
    type: "patch",
    title: "Auto-asignación de tipo contenedor LCL",
    description:
      "Cuando el tipo de servicio es LCL, el campo 'Tipo Contenedor' se fija automáticamente a 'LCL (Carga Consolidada)' y se deshabilita. Al cambiar a FCL se reactiva el dropdown normal.",
  },
  {
    version: "4.3.1",
    date: "2026-03-03",
    type: "patch",
    title: "Consolidadoras agregadas al catálogo de navieras",
    description:
      "Se agregaron 7 consolidadoras al dropdown de navieras: Charter Link, Ecu Line, Interteam, IFS, Vanguard, Fast Forward y Neutral.",
  },
  {
    version: "4.3.0",
    date: "2026-03-03",
    type: "minor",
    title: "Desacoplamiento de cotizaciones y embarques",
    description:
      "Las cotizaciones ahora funcionan como un módulo completamente independiente. Se eliminó la lógica de conversión a embarque, el botón 'Crear Embarque' y el estado 'Confirmada'. Flujo de estados: Borrador → Enviada → Aceptada / Rechazada / Vencida.",
  },
  {
    version: "4.2.6",
    date: "2026-03-03",
    type: "patch",
    title: "Opción 'Mismo cliente' en Consignatario",
    description:
      "Se agregó la opción 'Mismo cliente' al dropdown de Consignatario en el formulario de embarques (nuevo y edición). Al seleccionarla, se usa automáticamente el nombre del cliente como consignatario.",
  },
  {
    version: "4.2.5",
    date: "2026-03-03",
    type: "patch",
    title: "Etiqueta 'Tax ID' en contactos de cliente",
    description:
      "Se cambió la etiqueta 'RFC' por 'Tax ID' en el formulario de contactos (Proveedor/Exportador/Importador) dentro de un cliente, ya que estos pueden ser de otros países.",
  },
  {
    version: "4.2.4",
    date: "2026-03-03",
    type: "patch",
    title: "Campo Valor de mercancía sin flechas de incremento",
    description:
      "El campo 'Valor de mercancía (USD)' ahora es un input de texto con validación numérica decimal, sin las flechas de incremento/decremento del navegador.",
  },
  {
    version: "4.2.3",
    date: "2026-03-03",
    type: "patch",
    title: "Campo de seguro renombrado a Valor de mercancía (informativo)",
    description:
      "El campo 'Valor del seguro (USD)' se renombró a 'Valor de mercancía (USD)' y ahora es únicamente informativo: no se suma al total de la cotización. Se eliminó la línea de seguro del resumen de totales.",
  },
  {
    version: "4.2.2",
    date: "2026-03-03",
    type: "patch",
    title: "Auto-mapeo de conceptos de costo al crear embarque desde cotización",
    description:
      "Al confirmar una cotización y crear el embarque, ahora se generan automáticamente las filas de conceptos de costo espejo con los mismos nombres de concepto y moneda heredada, con monto en $0. El operador solo necesita asignar proveedor y capturar el monto.",
  },
  {
    version: "4.2.1",
    date: "2026-03-03",
    type: "patch",
    title: "Dropdown de conceptos en cotizaciones",
    description:
      "Se reemplazó el campo de texto libre 'Descripción' por un dropdown 'Concepto' con 8 opciones estandarizadas del catálogo (Flete Marítimo, Embalaje, Coordinación de Recolección, Seguro de Carga, Manejo, Demoras, Cargos en Destino, Cargos en Origen) en la sección de conceptos de venta de cotizaciones.",
  },
  {
    version: "4.2.0",
    date: "2026-03-03",
    type: "minor",
    title: "Mejora visual UI/UX integral",
    description:
      "Rediseño visual en 17 archivos sin cambios funcionales. Tablas con header uppercase tracking-wide y fondo sutil. KPI cards con borde izquierdo por categoría. Badges más compactos. Header global con shadow-sm y tipografía mejorada. Login con logo eLogistix y fondo gradiente. Filtros con gap-4 consistente. SearchInput con fondo sutil. Scrollbar personalizado. Tipografía con antialiased y font-feature-settings. Subtítulos descriptivos en todas las páginas.",
  },
  {
    version: "4.1.0",
    date: "2026-03-03",
    type: "minor",
    title: "Módulo de Configuración centralizado",
    description:
      "Nueva página /configuracion accesible solo para admins con 6 secciones: Datos de la Empresa, Tipos de Cambio por Defecto, Cotizaciones, Facturación, Embarques y Alertas del Dashboard. Tabla configuracion en BD con pares clave-valor por categoría, hook useConfiguracion con cache de 5 min, y useConfigValue para consumir valores individuales desde cualquier componente.",
  },
  {
    version: "4.0.0",
    date: "2026-03-02",
    type: "major",
    title: "Refactorización integral — Fases 1-4",
    description:
      "Fase 1: Eliminación de propiedad muerta 'iva' en tipos e inicializaciones, y funciones vacías isStep1Valid/isStep2Valid. Fase 2: Hook centralizado useEmbarqueForm con ~35 estados, handleMsdsUpload y builders de payload, eliminando ~200 líneas duplicadas entre NuevoEmbarque y EditarEmbarque. Fase 3: Componente DocumentChecklist reutilizable, usado en Clientes y NuevoProveedorDialog. Fase 4: NuevaCotizacion descompuesta en SeccionDestinatario, SeccionDatosGeneralesCotizacion, SeccionRutaCotizacion y SeccionConceptosVentaCotizacion.",
  },
  {
    version: "3.15.0",
    date: "2026-03-02",
    type: "minor",
    title: "Unificación de Monto y Subtotal en Costos y Venta",
    description:
      "Se unificaron las columnas Monto y Subtotal en un solo campo editable 'Subtotal (sin IVA)' en ambas tablas. El Total USD se calcula directamente desde este valor.",
  },
  {
    version: "3.14.0",
    date: "2026-03-02",
    type: "minor",
    title: "Conversión automática a USD en Costos y Venta",
    description:
      "Se agregó columna 'Total USD' en cada fila de Conceptos de Costo y Venta con conversión automática usando los tipos de cambio configurados. Los totales generales y la utilidad estimada ahora se calculan en USD.",
  },
  {
    version: "3.13.7",
    date: "2026-03-02",
    type: "patch",
    title: "Eliminación de checkbox IVA en Costos y Venta",
    description:
      "Se removió la columna IVA (checkbox) de las tablas de Conceptos de Costo y Conceptos de Venta para simplificar el formulario.",
  },
  {
    version: "3.13.6",
    date: "2026-03-02",
    type: "patch",
    title: "Total general en Conceptos de Costo",
    description:
      "Se agregó el total general al final de la tabla de Conceptos de Costo, mostrando la suma de todos los totales por fila.",
  },
  {
    version: "3.13.5",
    date: "2026-03-02",
    type: "patch",
    title: "Columna IVA en Conceptos de Venta",
    description:
      "Se agregó columna IVA con checkbox en la tabla de Conceptos de Venta. Total por fila incluye 16% si está marcado. El total general muestra la suma de todos los totales.",
  },
  {
    version: "3.13.4",
    date: "2026-03-02",
    type: "patch",
    title: "Columna IVA en Conceptos de Costo",
    description:
      "Se agregó una columna IVA con checkbox en la tabla de Conceptos de Costo. Si está marcado, el total de la fila incluye 16% de IVA. Sin cambios en Conceptos de Venta.",
  },
  {
    version: "3.13.3",
    date: "2026-03-02",
    type: "patch",
    title: "Catálogo estandarizado de conceptos en Costos y Pricing",
    description:
      "Se reemplazó el campo de texto libre de concepto en ambas tablas (Costos y Venta) por un dropdown con 7 opciones fijas: Flete Marítimo, Embalaje, Coordinación de Recolección, Seguro de Carga, Manejo, Demoras y Cargos en Destino. Aplica para todos los modos de transporte.",
  },
  {
    version: "3.13.2",
    date: "2026-03-02",
    type: "patch",
    title: "Reorden de secciones en Costos y Pricing",
    description:
      "Se reorganizó el paso 4 del wizard de embarques para mostrar primero 'Conceptos de Costo' y después 'Conceptos de Venta'. Sin cambios en campos, columnas ni lógica.",
  },
  {
    version: "3.13.1",
    date: "2026-03-02",
    type: "patch",
    title: "Tipo de carga y MSDS en Datos Generales de embarques",
    description:
      "Nuevo dropdown 'Tipo de carga' (Carga General / Mercancía Peligrosa) en la sección de Datos Generales del wizard de creación y edición de embarques. Si se selecciona 'Mercancía Peligrosa', se muestra un campo para adjuntar la hoja de seguridad (MSDS) al storage. Columnas tipo_carga y msds_archivo agregadas a la tabla embarques.",
  },
  {
    version: "3.13.0",
    date: "2026-03-02",
    type: "minor",
    title: "Refactorización integral del código",
    description:
      "Consolidación de utilidades duplicadas: getEstadoColor unificado para todos los estados (embarque, cotización, factura), resolverContacto centralizado, interfaces ConceptoVentaLocal/ConceptoCostoLocal extraídas a conceptoTypes.ts, hook useConceptosForm reutilizable. Componentes SearchInput y PaginationControls extraídos y usados en 5+ páginas. Eliminación de ~20 casts 'as any' en CotizacionDetalle, código muerto de validaciones y variables abreviadas renombradas.",
  },
  {
    version: "3.12.5",
    date: "2026-03-02",
    type: "patch",
    title: "Validaciones obligatorias deshabilitadas temporalmente",
    description:
      "Se deshabilitaron temporalmente todas las validaciones de campos obligatorios en el wizard de creación de embarques (Paso 1 y Paso 2) para facilitar las pruebas durante el desarrollo.",
  },
  {
    version: "3.12.4",
    date: "2026-03-02",
    type: "patch",
    title: "Campo 'Carta garantía' para Marítimo FCL",
    description:
      "Nuevo campo dropdown 'Carta garantía' (Sí/No) en la sección de Ruta del formulario de cotizaciones, visible únicamente cuando el modo es Marítimo y el tipo de embarque es FCL. Persistido en la base de datos y mostrado en el detalle de la cotización.",
  },
  {
    version: "3.12.3",
    date: "2026-03-02",
    type: "patch",
    title: "Campo 'Días libres de almacenaje' para Marítimo LCL",
    description:
      "Nuevo campo numérico 'Días libres de almacenaje' en la sección de Ruta del formulario de cotizaciones, visible únicamente cuando el modo es Marítimo y el tipo de embarque es LCL. Persistido en la base de datos y mostrado en el detalle de la cotización cuando el valor es mayor a 0.",
  },
  {
    version: "3.12.2",
    date: "2026-03-02",
    type: "patch",
    title: "Campo 'Días libres en destino' para Marítimo FCL",
    description:
      "Nuevo campo numérico 'Días libres en destino' en la sección de Ruta del formulario de cotizaciones, visible únicamente cuando el modo es Marítimo y el tipo de embarque es FCL. Persistido en la base de datos y mostrado en el detalle de la cotización cuando el valor es mayor a 0.",
  },
  {
    version: "3.12.1",
    date: "2026-03-02",
    type: "patch",
    title: "Vigencia reemplazada por Validez de la Propuesta",
    description:
      "Se eliminó el campo manual 'Vigencia (días)' de la sección inferior del formulario de cotizaciones. La vigencia ahora se calcula automáticamente a partir de la fecha de 'Validez de la propuesta' seleccionada en la sección de Ruta. La Card se renombró a 'Notas Adicionales' y solo muestra el campo de notas.",
  },
  {
    version: "3.12.0",
    date: "2026-03-02",
    type: "minor",
    title: "Campos adicionales de ruta y seguro en cotizaciones",
    description:
      "Se agregaron 7 campos nuevos a la sección Ruta de cotizaciones: tiempo de tránsito (días), frecuencia (Diaria/Semanal/Quincenal), ruta de texto libre, validez de la propuesta (fecha), tipo de movimiento (CY-CY/CY-DR/DR-DR/DR-CY), seguro (toggle Sí/No) con valor en USD. El valor del seguro se suma automáticamente al total de la cotización. Campos visibles en detalle de cotización.",
  },
  {
    version: "3.11.0",
    date: "2026-03-02",
    type: "minor",
    title: "Autocompletado de puertos para carga marítima y multimodal",
    description:
      "Los campos de Origen y Destino en la sección Ruta ahora usan un buscador con autocompletado basado en un catálogo de ~150 puertos cuando el modo es Marítimo o Multimodal. Cada sugerencia muestra nombre del puerto, ciudad y país. Si el puerto no está en la lista, se permite escribirlo manualmente. Los flujos Aéreo y Terrestre conservan sus campos actuales sin cambios.",
  },
  {
    version: "3.10.0",
    date: "2026-03-02",
    type: "minor",
    title: "Sección de Mercancía Aérea con peso volumétrico",
    description:
      "Nueva sección de mercancía específica para carga aérea. Incluye tipo de carga, sector económico, descripción adicional, MSDS condicional y tabla dinámica de dimensiones con cálculo automático de peso volumétrico por fila (H×L×W×Pcs / 6000). Totales de piezas y peso volumétrico en kg. Datos persistidos en columna JSONB dimensiones_aereas.",
  },
  {
    version: "3.9.0",
    date: "2026-03-02",
    type: "minor",
    title: "Mercancía dinámica FCL/LCL para carga marítima",
    description:
      "Sección de mercancía en cotizaciones ahora se adapta dinámicamente al tipo de embarque marítimo. FCL muestra selector de contenedor (10 tipos), tipo de peso (Normal/Sobrepeso) y campos compartidos. LCL muestra tabla dinámica de dimensiones con cálculo automático de volumen m³ y totales. Para modos no marítimos se mantienen los campos estándar. Los datos se persisten en 6 nuevas columnas de la tabla cotizaciones.",
  },
  {
    version: "3.8.0",
    date: "2026-03-02",
    type: "minor",
    title: "Tipo de Carga y Descripción de Mercancía en Cotizaciones",
    description:
      "Nuevo dropdown de Tipo de Carga (Carga General / Mercancía Peligrosa) con campo condicional para subir hoja de seguridad MSDS. Descripción de mercancía reemplazada por dropdown con 9 categorías fijas: Automotriz, Médica, Alimentos, Carga Proyecto, Construcción, Industrial, General, Tecnología, Arte y Moda.",
  },
  {
    version: "3.7.0",
    date: "2026-03-02",
    type: "minor",
    title: "Flujo Prospecto/Cliente en Cotizaciones",
    description:
      "Nuevo flujo de destinatario al crear cotizaciones: cliente existente o prospecto (empresa, contacto, email, teléfono). Nuevo estado 'Aceptada' intermedio. Al aceptar, si es prospecto se puede convertir a cliente con formulario pre-llenado; luego se habilita 'Crear Embarque'. Registro completo en bitácora.",
  },
  {
    version: "3.6.0",
    date: "2026-03-02",
    type: "minor",
    title: "Módulo de Cotizaciones",
    description:
      "Nuevo módulo completo de cotizaciones con tabla independiente. Incluye listado con filtros y paginación, formulario simplificado para crear cotizaciones, detalle con conceptos de venta, y conversión automática a embarque al confirmar. Estados: Borrador, Enviada, Confirmada, Rechazada, Vencida. Registro en bitácora y folio auto-generado (COT-YYYY-NNNN).",
  },
  {
    version: "3.5.0",
    date: "2026-03-02",
    type: "minor",
    title: "Mejoras operativas: estado de embarques, edición de clientes, notas y confirmación de eliminación",
    description:
      "Nuevo botón 'Avanzar estado' en el detalle del embarque con confirmación y registro en bitácora. Edición de datos del cliente desde su página de detalle. Doble confirmación antes de eliminar contactos. Formulario para agregar notas libres en la pestaña de Notas del embarque con registro automático en bitácora.",
  },
  {
    version: "3.4.0",
    date: "2026-03-01",
    type: "minor",
    title: "Edición de embarques existentes",
    description:
      "Nueva página para editar embarques con wizard de 3 pasos (Datos Generales, Datos de Ruta, Costos y Pricing) pre-cargados con los valores actuales. Sincronización completa de conceptos de venta y costo. Registro automático en bitácora. Botón Editar conectado desde el detalle del embarque.",
  },
  {
    version: "3.3.1",
    date: "2026-03-01",
    type: "patch",
    title: "Suite de tests unitarios y de integración",
    description:
      "44 tests en 11 archivos cubriendo helpers (formatDate, getEstadoColor, getModoIcon), formatters (formatCurrency), utils (cn), constantes de embarque/proveedor/contenedores/puertos/navieras, componente BitacoraActividad y hook usePermissions.",
  },
  {
    version: "3.3.0",
    date: "2026-03-01",
    type: "minor",
    title: "Sistema de Bitácora y Actividad",
    description:
      "Nueva tabla centralizada bitacora_actividad para registrar todas las acciones de usuarios. Hook useBitacora con consultas filtradas y registro automático. Componente BitacoraActividad como timeline visual. Página dedicada /bitacora con paginación y filtros por módulo. Widget de actividad reciente en Dashboard. Registro automático al crear embarques, clientes, proveedores, subir documentos e iniciar sesión.",
  },
  {
    version: "3.2.0",
    date: "2026-03-01",
    type: "minor",
    title: "Renombramiento de variables para mayor claridad",
    description:
      "Todas las variables de 1-2 letras y abreviaciones ambiguas fueron reemplazadas por nombres descriptivos en 22 archivos. Ejemplos: e→embarque, f→factura, qc→queryClient, tc→tipoCambio, le→cargandoEmbarques, cv→venta, cc→costo, prov→proveedor, [y,m,d]→[anio,mes,dia]. El código ahora es legible sin necesidad de contexto adicional.",
  },
  {
    version: "3.1.0",
    date: "2026-03-01",
    type: "minor",
    title: "Refactorización — Limpieza, deduplicación y modularización",
    description:
      "Eliminación de funciones helper duplicadas (getModoIcon, getEstadoColor, formatDate) en favor de las centralizadas en helpers.ts. Hook useContactosCliente deduplicado. Constantes de proveedor extraídas a proveedorConstants.ts. NuevoEmbarque dividido en 5 sub-componentes (StepDatosGenerales, StepDatosRuta, StepDocumentos, StepCostosPrecios, StepIndicator). EmbarqueDetalle dividido en 5 tabs (TabResumen, TabDocumentos, TabCostos, TabFacturacion, TabNotas). Eliminados componentes sin usar (TableSkeleton, ErrorState) y variable muerta fileInputRef.",
  },
  {
    version: "3.0.0",
    date: "2026-03-01",
    type: "major",
    title: "Fases 3 y 4 — Permisos, búsqueda, storage, responsive y tipos de cambio",
    description:
      "Permisos por rol en toda la UI (viewers solo lectura). Emails reales en gestión de usuarios. Subida de documentos al storage con descarga. Búsqueda global (Ctrl+K) en embarques, clientes, proveedores y facturas. Componentes reutilizables TableSkeleton y ErrorState. Tipos de cambio dinámicos desde API externa. Versión actualizada a v3.0.0.",
  },
  {
    version: "2.0.0",
    date: "2026-03-01",
    type: "major",
    title: "Migración completa a base de datos y limpieza de código",
    description:
      "Todos los módulos (Facturación, Dashboard, Reportes) ahora usan datos reales de la BD. Se eliminó mockData.ts y archivos obsoletos. KPIs, gráficas y alertas son dinámicos. Liquidación de gastos funcional con acción de marcar pagado.",
  },
  {
    version: "1.7.0",
    date: "2026-03-01",
    type: "minor",
    title: "Módulo de Embarques conectado a base de datos",
    description:
      "El listado, detalle y creación de embarques ahora persisten en la base de datos real. Se incluyen subentidades (conceptos de venta/costo, documentos, notas) y se eliminó la dependencia de mockData para embarques.",
  },
  {
    version: "1.6.0",
    date: "2026-02-28",
    type: "minor",
    title: "Módulo de Proveedores conectado a base de datos",
    description:
      "El listado, detalle, creación y edición de proveedores ahora persisten en la base de datos real con react-query. Se eliminó el store en memoria y se agregaron estados de carga.",
  },
  {
    version: "1.5.1",
    date: "2026-02-28",
    type: "patch",
    title: "Módulo de Clientes conectado a base de datos",
    description:
      "El listado de clientes, creación de nuevos clientes y gestión de contactos (CRUD) ahora persisten en la base de datos real. Se eliminó la dependencia de datos mock para este módulo.",
  },
  {
    version: "1.5.0",
    date: "2026-02-28",
    type: "minor",
    title: "Esquema de base de datos para entidades core",
    description:
      "Se crearon las tablas clientes, proveedores, embarques, facturas y sus subtablas relacionales (contactos, conceptos de venta/costo, documentos, notas) con políticas RLS por rol, triggers de updated_at e índices de rendimiento.",
  },
  {
    version: "1.4.1",
    date: "2026-02-28",
    type: "patch",
    title: "Alta de usuarios desde el panel de administración",
    description:
      "Los administradores ahora pueden registrar nuevos usuarios directamente desde el módulo de Gestión de Usuarios, asignando email, contraseña y rol.",
  },
  {
    version: "1.4.0",
    date: "2026-02-28",
    type: "minor",
    title: "Módulo de usuarios con login y roles",
    description:
      "Sistema de autenticación con login/registro, gestión de roles (admin, operador, viewer), protección de rutas por rol y página de administración de usuarios.",
  },
  {
    version: "1.3.2",
    date: "2026-02-28",
    type: "patch",
    title: "Pricing simplificado",
    description:
      "Se eliminaron las líneas de IVA (16%) y Total (Con IVA) en el paso de Costos y Pricing. Ahora solo se muestra el Subtotal (Sin IVA) como entrada manual.",
  },
  {
    version: "1.3.1",
    date: "2026-02-27",
    type: "patch",
    title: "Dropdowns de conceptos marítimos",
    description:
      'Se agregaron opciones predefinidas "Flete marítimo" y "Revalidación" en los campos de concepto cuando el modo de transporte es Marítimo.',
  },
  {
    version: "1.3.0",
    date: "2026-02-26",
    type: "minor",
    title: "Costos y Pricing dinámico",
    description:
      "Nuevo paso en el wizard de embarque con filas dinámicas para conceptos de venta y costos. Incluye agregar/eliminar filas, cálculo de subtotal y utilidad estimada.",
  },
  {
    version: "1.2.1",
    date: "2026-02-25",
    type: "patch",
    title: "Validación de ruta marítima",
    description:
      "Todos los campos del paso 2 (Datos de Ruta) son obligatorios para embarques marítimos, excepto BL Master y BL House.",
  },
  {
    version: "1.2.0",
    date: "2026-02-24",
    type: "minor",
    title: "Wizard de Nuevo Embarque",
    description:
      "Formulario de 4 pasos para crear embarques: Datos Generales, Datos de Ruta, Documentos y Costos y Pricing. Incluye selectores de puertos, navieras y tipos de contenedor.",
  },
  {
    version: "1.1.0",
    date: "2026-02-20",
    type: "minor",
    title: "Wizard de Nuevo Cliente",
    description:
      "Diálogo de dos pasos para crear clientes. Requiere carga obligatoria de documentos (CIF, opinión fiscal, acta constitutiva, etc.) antes de guardar.",
  },
  {
    version: "1.0.0",
    date: "2026-02-15",
    type: "major",
    title: "Lanzamiento inicial",
    description:
      "Dashboard con KPIs y gráficas, listado y detalle de embarques, módulo de facturación, módulo de clientes con vista detalle, módulo de proveedores con CRUD completo, página de reportes y navegación lateral.",
  },
];

const typeConfig: Record<ChangeType, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-destructive text-destructive-foreground" },
  minor: { label: "Minor", className: "bg-info text-info-foreground" },
  patch: { label: "Patch", className: "bg-muted text-muted-foreground" },
};

export default function Changelog() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Historial de cambios y nuevas funcionalidades de la plataforma.
        </p>
      </div>

      <div className="relative border-l-2 border-border ml-4 space-y-6 pl-8">
        {changelog.map((entry) => {
          const config = typeConfig[entry.type];
          return (
            <div key={entry.version} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />

              <Card>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-sm">v{entry.version}</span>
                    <Badge className={config.className}>{config.label}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{entry.date}</span>
                  </div>
                  <h3 className="font-semibold">{entry.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
