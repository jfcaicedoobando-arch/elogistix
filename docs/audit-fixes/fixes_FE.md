# Fix Pack — Auditoría Frontend Elogistix (Lógica de negocio y edge cases)

**Fuente:** `audit_reports/03_frontend_logica.md` (hallazgos FE-01 a FE-12).
**Repo:** main @ 1ef05ce9. Todos los fragmentos de código fueron copiados del repo real y verificados línea por línea.
**Reglas globales:** bajo riesgo, retrocompatible (feature freeze), sin cambios de contratos ni RPCs. Los helpers citados (`roundMoney`, `subtotalLinea`, `sumarSubtotales`, `todayLocalISO`, `todayLocalISOPlus`, `factorEntreMonedas`) ya existen en el repo. Mensajes de usuario en español (es-MX).

---

### [FE-01] Cobro cruzado de moneda sin tipo de cambio → error 23514 crudo (P1)

- **Severidad:** P1 · **Verificación:** dinámico (repro: factura USD → Registrar pago → moneda MXN con `exchange-rates` sin resolver/caída)
- **Archivos:**
  - `src/features/facturacion/components/DialogRegistrarPago.tsx` (líneas 41-51, 86-90, 102-115)
  - `src/features/facturacion/components/DialogRegistrarPagoParts.tsx` (líneas 60-64)
  - `src/features/facturacion/hooks/useRegistrarPagoSubmit.ts` (líneas 58-71)
- **Problema:** `convertirAMonedaFactura` devuelve `0` cuando `factorEntreMonedas` es `null` (rates no cargados o edge `exchange-rates` caída; el hook tiene `retry: 1`). Con `montoAplicado = 0`, `excede = false` y `invalido = montoNum <= 0 || excede` queda **false**: el botón sigue habilitado con `tipoCambio = 0`. El insert choca con `CHECK (tipo_cambio > 0)` / `CHECK (monto_aplicado_factura > 0)` y el usuario ve "new row for relation violates check constraint". No hay captura manual de TC (a diferencia de CxP).
- **Fix (instrucción para Lovable):**
  1. En `DialogRegistrarPago.tsx`, detectar el caso cross-moneda sin TC usando `factorEntreMonedas` directamente (devuelve `null` cuando falta TC confiable; devuelve `1` cuando las monedas son iguales, así que el mismo cálculo cubre ambos casos).
  2. Incluir `tcBloqueado` en `invalido` (deshabilita el botón) **y** validar de nuevo en el handler (`useRegistrarPagoSubmit.submit`), no solo en UI.
  3. Mostrar un `Alert` inline en español mientras dure el bloqueo: "Esperando tipo de cambio…".
  4. Pasar la prop `tcBloqueado` a `NotasPago` en `DialogRegistrarPagoParts.tsx`.
- **Diff / código:**

`src/features/facturacion/components/DialogRegistrarPago.tsx`:

```diff
   const montoNum = Number(values.monto) || 0;
   const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
   const excede = montoAplicado > saldo + 0.01;
-  const invalido = montoNum <= 0 || excede;
+  // FE-01: cross-moneda sin TC confiable → factorEntreMonedas devuelve null.
+  // Bloqueamos el submit (botón + handler) en vez de dejar que el insert
+  // reviente contra CHECK (tipo_cambio > 0) con un 23514 crudo.
+  const tcBloqueado = factorEntreMonedas(values.moneda, factura.moneda, {
+    usd: rates?.usdMxn, eur: rates?.eurMxn,
+  }) === null;
+  const invalido = montoNum <= 0 || excede || tcBloqueado;
   const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
```

y en el JSX del mismo archivo:

```diff
       <NotasPago
         esPpdTimbrada={esPpdTimbrada}
         monedaPago={values.moneda}
         monedaFactura={factura.moneda}
         montoNum={montoNum}
         montoAplicado={montoAplicado}
         tipoCambio={tipoCambio}
         excede={excede}
         saldo={saldo}
+        tcBloqueado={tcBloqueado}
       />
```

`src/features/facturacion/components/DialogRegistrarPagoParts.tsx`:

```diff
 export function NotasPago({
-  esPpdTimbrada, monedaPago, monedaFactura, montoNum, montoAplicado, tipoCambio, excede, saldo,
+  esPpdTimbrada, monedaPago, monedaFactura, montoNum, montoAplicado, tipoCambio, excede, saldo, tcBloqueado,
 }: {
   esPpdTimbrada: boolean;
   monedaPago: string;
   monedaFactura: string;
   montoNum: number;
   montoAplicado: number;
   tipoCambio: number;
   excede: boolean;
   saldo: number;
+  tcBloqueado?: boolean;
 }) {
   const mostrarConversion = monedaPago !== monedaFactura && montoNum > 0;
   return (
     <>
+      {tcBloqueado && monedaPago !== monedaFactura && (
+        <Alert variant="destructive">
+          <AlertDescription className="text-xs">
+            Esperando tipo de cambio… No se puede registrar un cobro en {monedaPago} para una
+            factura en {monedaFactura} sin un tipo de cambio disponible. Intenta de nuevo en unos
+            segundos; si el problema persiste, contacta a soporte.
+          </AlertDescription>
+        </Alert>
+      )}
       {esPpdTimbrada && (
```

`src/features/facturacion/hooks/useRegistrarPagoSubmit.ts` (validación en handler, defensa en profundidad):

```diff
   const submit = async (args: SubmitArgs) => {
+    // FE-01: guard de dominio (no sólo UI). El CHECK de BD exige tipo_cambio > 0
+    // y monto_aplicado_factura > 0; aquí el mensaje es claro y en español.
+    if (!(args.tipoCambio > 0) || !(args.montoAplicado > 0)) {
+      notifyError(undefined, {
+        title: "No hay tipo de cambio disponible",
+        description:
+          "No se pudo obtener el tipo de cambio para convertir el pago a la moneda de la factura. Espera unos segundos y vuelve a intentar.",
+        method: "ON_ERROR",
+        errorCode: ERROR_CODES.VALIDATION_FAILED,
+      });
+      return;
+    }
     try {
```

Nota: con misma moneda, `tipoCambio = 1` y `montoAplicado = monto > 0`, así que el guard no afecta el flujo normal. La captura manual de TC (como `tcNum`/`bloqueadoPorTc` de CxP) queda como mejora opcional posterior; este fix ya elimina el error crudo y el flujo bloqueado sin explicación.
- **Tras aplicar, verificar:**
  1. Simular `useExchangeRates` sin resolver (throttle de red o edge caída): factura USD → pago en MXN → el botón "Registrar pago" queda deshabilitado y aparece el aviso "Esperando tipo de cambio…".
  2. Forzar el submit programáticamente (o con rates que expiran entre captura y guardado): debe aparecer el toast "No hay tipo de cambio disponible", nunca un 23514 crudo.
  3. Regresión: pago en la misma moneda de la factura y pago cross-moneda con rates cargados siguen funcionando y timbrando REP en PPD.

---

### [FE-02] El diálogo de pago CxC resetea la captura ante cualquier refetch (P2)

- **Severidad:** P2 · **Verificación:** estático (deps del `useEffect`) + dinámico (abrir diálogo, teclear monto, provocar invalidación de `queryKeys.facturas.all`)
- **Archivos:** `src/features/facturacion/components/DialogRegistrarPago.tsx` (líneas 10, 73-82)
- **Problema:** `useEffect(() => { setValues({...}) }, [open, factura, saldo])`. `factura` es un objeto nuevo en cada refetch del query de detalle y `saldo` deriva de `usePagosFactura`/`useNotasCreditoAplicadas`. Cualquier invalidación mientras el diálogo está abierto re-ejecuta el efecto y borra monto/fecha/referencia ya tecleados, reponiendo el monto al saldo total.
- **Fix (instrucción para Lovable):** inicializar el formulario una sola vez por apertura/factura con un `useRef` de guardia (patrón `initializedRef`), conservando `saldo` en las deps para que el monto inicial use el saldo ya cargado pero sin resetear después.
- **Diff / código:**

```diff
-import { useEffect, useMemo, useState } from "react";
+import { useEffect, useMemo, useRef, useState } from "react";
```

```diff
-  useEffect(() => {
-    if (open && factura) {
-      setValues({
-        fecha: today(),
-        monto: saldo > 0 ? saldo.toFixed(2) : "",
-        moneda: factura.moneda,
-        formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
-      });
-    }
-  }, [open, factura, saldo]);
+  // FE-02: inicializar una sola vez por apertura (open + factura.id). Antes las
+  // deps vivas (objeto factura nuevo en cada refetch, saldo derivado de queries)
+  // re-ejecutaban el efecto y borraban lo que el usuario ya había capturado.
+  const initializedForRef = useRef<string | null>(null);
+  useEffect(() => {
+    if (!open || !factura) {
+      initializedForRef.current = null;
+      return;
+    }
+    if (initializedForRef.current === factura.id) return;
+    initializedForRef.current = factura.id;
+    setValues({
+      fecha: today(),
+      monto: saldo > 0 ? saldo.toFixed(2) : "",
+      moneda: factura.moneda,
+      formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
+    });
+  }, [open, factura, saldo]);
```

- **Tras aplicar, verificar:**
  1. Abrir "Registrar pago", editar monto/fecha/referencia; provocar un refetch (p. ej. registrar otra mutación o invalidar `queryKeys.facturas.all` desde DevTools): lo capturado NO se borra.
  2. Cerrar y reabrir el diálogo (o cambiar de factura): el formulario se reinicia con el saldo vigente.
  3. Regresión: el monto inicial por defecto sigue siendo el saldo pendiente al abrir.

---

### [FE-03] Pago CxC sin validación de fecha (futura o anterior a emisión) (P2)

- **Severidad:** P2 · **Verificación:** dinámico (capturar fecha futura en "Registrar pago" → se acepta)
- **Archivos:**
  - `src/features/facturacion/components/DialogRegistrarPago.tsx` (líneas 24-33, 86-90, 102-115)
  - `src/features/facturacion/components/detalle/FacturaDetalleModales.tsx` (líneas 34-45)
  - Patrón a portar: `src/features/cxp/services/pagoProveedorValidaciones.ts:97-104` (`validarFechas`)
- **Problema:** la única validación del diálogo CxC es monto/saldo (`invalido = montoNum <= 0 || excede`). En CxP sí existe `validarFechas` ("La fecha del pago no puede ser futura" / "no puede ser anterior a la fecha de emisión"). La tabla `pagos_factura` no tiene CHECK de fecha, así que la distorsión de aging CxC persiste en BD.
- **Fix (instrucción para Lovable):**
  1. Agregar `fechaEmision` al interface `Factura` del diálogo y pasarlo desde `FacturaDetalleModales` (el padre ya tiene `fecha_emision` en su `Pick`, línea 15).
  2. Añadir una función pura `validarFechaPago(fecha, hoy, fechaEmision)` con los mismos mensajes es-MX de CxP, en el propio archivo del diálogo (módulo chico; no hace falta importar el de CxP, que está acoplado a `ValidarPagoInput`).
  3. Incluir el error en `invalido`, mostrarlo inline y revalidar en `handleGuardar`.
- **Diff / código:**

`src/features/facturacion/components/DialogRegistrarPago.tsx`:

```diff
 interface Factura {
   id: string;
   numero: string;
   total: number;
   moneda: string;
   /** `PPD` requiere REP automático tras cada abono; `PUE` no. */
   metodoPago?: string | null;
   /** UUID fiscal del CFDI emitido. Sin él no se puede timbrar REP. */
   uuidFiscal?: string | null;
+  /** Fecha de emisión (ISO corto). FE-03: cota inferior para la fecha del pago. */
+  fechaEmision?: string | null;
 }
```

```diff
 const today = () => todayLocalISO();
+
+/** FE-03: misma regla y mensajes que `validarFechas` de CxP (pagoProveedorValidaciones). */
+function validarFechaPago(fecha: string, hoy: string, fechaEmision?: string | null): string | null {
+  if (!fecha) return "Captura la fecha del pago";
+  if (fecha > hoy) return "La fecha del pago no puede ser futura";
+  if (fechaEmision && fecha < fechaEmision) {
+    return "La fecha del pago no puede ser anterior a la fecha de emisión de la factura";
+  }
+  return null;
+}
```

```diff
   const montoNum = Number(values.monto) || 0;
   const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
   const excede = montoAplicado > saldo + 0.01;
-  const invalido = montoNum <= 0 || excede;
+  const errorFecha = validarFechaPago(values.fecha, today(), factura.fechaEmision);
+  const invalido = montoNum <= 0 || excede || errorFecha !== null;
```

```diff
-  const handleGuardar = () => submit({
+  const handleGuardar = () => {
+    if (invalido) return; // FE-03: defensa en handler, no sólo botón deshabilitado
+    submit({
       facturaId: factura.id,
       facturaNumero: factura.numero,
       fecha: values.fecha,
       monto: montoNum,
       moneda: values.moneda as "MXN" | "USD" | "EUR",
       tipoCambio,
       montoAplicado,
       formaPago: values.formaPago,
       referencia: values.referencia,
       notas: values.notas,
       cuentaBancariaId: values.cuentaBancariaId || null,
       esPpdTimbrada,
-  });
+    });
+  };
```

y mostrar el mensaje inline junto a `NotasPago` (en el JSX del return, dentro de `FormDialogShell`):

```diff
       <PagoFormFields values={values} onChange={handleChange} cuentas={cuentas} />
+      {errorFecha && (
+        <p className="text-xs text-destructive" role="alert">{errorFecha}</p>
+      )}
       <NotasPago
```

`src/features/facturacion/components/detalle/FacturaDetalleModales.tsx`:

```diff
         factura={{
           id: factura.id,
           numero: factura.numero,
           total: Number(factura.total),
           moneda: factura.moneda,
           metodoPago: factura.metodo_pago ?? null,
           uuidFiscal: factura.uuid_fiscal ?? null,
+          fechaEmision: factura.fecha_emision ?? null,
         }}
```

Nota de interacción con FE-01: si se aplican ambos, `invalido` queda `montoNum <= 0 || excede || tcBloqueado || errorFecha !== null`.
- **Tras aplicar, verificar:**
  1. Capturar fecha de mañana → botón deshabilitado y mensaje "La fecha del pago no puede ser futura".
  2. Capturar fecha anterior a `fecha_emision` de la factura → mensaje "…anterior a la fecha de emisión de la factura".
  3. Pago con fecha de hoy y fecha = emisión → se registra normal.
  4. Facturas legacy con `fecha_emision` nula → sólo aplica la regla de fecha futura (sin falsos bloqueos).

---

### [FE-04] Off-by-one UTC en fechas-calendario (vigencia de cotización, celda "Vence", KPIs) (P2)

- **Severidad:** P2 · **Verificación:** estático (patrón `toISOString().split("T")[0]` / `new Date(dateOnly)` documentado como bug en `src/lib/date/today.ts:5-8`) + dinámico (crear cotización entre 18:00 y 23:59 hora MX)
- **Archivos (4 ubicaciones):**
  1. `src/features/cotizacion/domain/cotizacion.conversion.ts:63-71` (`calcularFechaVigencia`)
  2. `src/features/cotizacion/domain/mappers/cotizacion.ts:14-19` (`toIsoDateString`)
  3. `src/features/cotizacion/components/columnsParts/estadoVigenciaCell.tsx:15-16` (`buildVigenciaNode`)
  4. `src/features/dashboard/direccion/services/calculosCartera.ts:86-87` (`calcularPulso`)
- **Problema:** `fecha.toISOString().split("T")[0]` devuelve el día en UTC: entre 18:00 y 23:59 (UTC−6) la vigencia sale un día adelantada (documento que va al cliente). En la celda, `new Date("2026-08-01")` es medianoche UTC (= 18:00 del día anterior en MX), así que "Vence mañana" se muestra como "Vence hoy"/"Vencida" medio día al día. En el dashboard, los KPIs "arribos 7d"/"demoras" cambian de día a las 18:00.
- **Fix (instrucción para Lovable):** reemplazar el patrón UTC por `format(d, "yyyy-MM-dd")` de `date-fns` (hora local, mismo helper que usa `todayLocalISO`) en las ubicaciones 1, 2 y 4; en la 3, parsear el date-only como medianoche **local** con `+"T00:00:00"`. Los helpers ya existen (`src/lib/date/today.ts`).
- **Diff / código:**

1) `src/features/cotizacion/domain/cotizacion.conversion.ts`:

```diff
+import { format } from "date-fns";
+
 /**
  * Calcula la fecha de vigencia (`fecha_vigencia`) sumando `vigenciaDias` a la fecha base.
  * Devuelve string ISO `YYYY-MM-DD` (formato esperado por la columna `date` de Postgres).
  * Si `vigenciaDias` es null/undefined se usa el default de 15 días.
  */
 export function calcularFechaVigencia(
   desde: Date = new Date(),
   vigenciaDias: number | null | undefined = 15,
 ): string {
   const dias = vigenciaDias ?? 15;
   const fecha = new Date(desde);
   fecha.setDate(fecha.getDate() + dias);
-  return fecha.toISOString().split("T")[0];
+  // FE-04: día en hora LOCAL (canon `todayLocalISO`); toISOString() devuelve el
+  // día UTC y entre 18:00-23:59 (UTC−6) adelantaba la vigencia un día.
+  return format(fecha, "yyyy-MM-dd");
 }
```

2) `src/features/cotizacion/domain/mappers/cotizacion.ts`:

```diff
+import { format } from "date-fns";
 import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from '@/features/cotizacion/types';
 import type { CotizacionFormValues } from '@/features/cotizacion/types';
```

```diff
 function toIsoDateString(v: unknown): string | null {
   if (!v) return null;
   const d = v instanceof Date ? v : new Date(v as string);
   if (Number.isNaN(d.getTime())) return null;
-  return d.toISOString().split("T")[0];
+  return format(d, "yyyy-MM-dd"); // FE-04: día local, no UTC
 }
```

3) `src/features/cotizacion/components/columnsParts/estadoVigenciaCell.tsx`:

```diff
 function buildVigenciaNode(fechaVigencia: string, estado: string): ReactNode {
   const fechaStr = formatDate(fechaVigencia);
   const esEnviada = estado.toLowerCase() === "enviada";
-  const fecha = new Date(fechaVigencia);
+  // FE-04: date-only ("YYYY-MM-DD") se parsea como medianoche UTC; con
+  // "T00:00:00" es medianoche LOCAL y el badge deja de adelantarse medio día.
+  const fecha = new Date(`${fechaVigencia}T00:00:00`);
   const diffDias = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
```

4) `src/features/dashboard/direccion/services/calculosCartera.ts`:

```diff
+import { format } from "date-fns";
```

```diff
       const etaDia = r.eta.slice(0, 10);
-      const hoyDia = hoy.toISOString().slice(0, 10);
-      const en7dDia = en7d.toISOString().slice(0, 10);
+      // FE-04: día local MX; toISOString() cambiaba los KPIs de día a las 18:00.
+      const hoyDia = format(hoy, "yyyy-MM-dd");
+      const en7dDia = format(en7d, "yyyy-MM-dd");
```

(`r.eta.slice(0, 10)` se conserva: es un string de BD ya en fecha-calendario, no un instante.)
- **Tras aplicar, verificar:**
  1. Con el reloj del sistema entre 18:00 y 23:59 (o mockeando `new Date()` a esa franja): crear cotización → `fecha_vigencia` = hoy local + 15 días (no +16 ni un día adelantado).
  2. Actualizar/crear tests en `src/features/cotizacion/domain/__tests__/cotizacion.test.ts` y `cotizacion.extra.test.ts`: hoy usan fechas `...T00:00:00Z`; añadir un caso con `new Date(2026, 7, 10, 23, 30)` (hora local) que verifique el día local.
  3. Tabla de cotizaciones a las 19:00 con una cotización que vence mañana → badge "Vence en 1d", no "Vence hoy".
  4. Dashboard de Dirección: KPI "arribos 7d" idéntico antes y después de las 18:00 (mismo día local).

---

### [FE-05] Listado de cotizaciones sin paginación ni `limit` (cap silencioso de 1000) (P2)

- **Severidad:** P2 · **Verificación:** estático (query sin `.limit`/`.range`; el propio repo reconoce el patrón en `embarques/services/queries/proveedores.ts:9`)
- **Archivos:** `src/features/cotizacion/services/queries.ts:42-48` (`fetchCotizaciones`); relacionada: `fetchCotizacionesAceptadas` (líneas 73-82)
- **Problema:** `fetchCotizaciones` ordena pero no limita ni pagina. PostgREST capa en ~1000 filas sin aviso: al superar ese volumen por org, las cotizaciones más antiguas desaparecen del listado (búsquedas, duplicados, conversiones a embarque afectadas). Embarques y Facturación sí pagan server-side.
- **Fix (instrucción para Lovable):** corto plazo (este fix): `.limit(1000)` explícito y documentado, igual que el "`.limit(500)` defensivo" ya existente en proveedores. Aplicar lo mismo a `fetchCotizacionesAceptadas` (mismo riesgo). La paginación server-side con RPC `p_offset/p_limit` (patrón `embarques/services/paginados.ts`) queda como trabajo a mediano plazo fuera del freeze.
- **Diff / código:**

```diff
 export async function fetchCotizaciones(organizationId: string | null) {
   let query = supabase
     .from("cotizaciones")
     .select(COTIZACION_LIST_COLUMNS)
-    .order("created_at", { ascending: false });
+    .order("created_at", { ascending: false })
+    // FE-05: límite explícito defensivo (evita el cap silencioso de 1000 de
+    // PostgREST pasando desapercibido). TODO post-freeze: paginación
+    // server-side como `embarques/services/paginados.ts`.
+    .limit(1000);
   if (organizationId) query = query.eq("organization_id", organizationId);
```

```diff
 export async function fetchCotizacionesAceptadas(organizationId: string | null) {
   let query = supabase
     .from("cotizaciones")
     .select(COTIZACION_ACEPTADA_COLUMNS)
     .in("estado", ["Aceptada", "En operación"])
-    .order("created_at", { ascending: false });
+    .order("created_at", { ascending: false })
+    .limit(1000); // FE-05: mismo cap defensivo que fetchCotizaciones
   if (organizationId) query = query.eq("organization_id", organizationId);
```

- **Tras aplicar, verificar:**
  1. Listado de cotizaciones carga sin cambios visibles con < 1000 filas (retrocompatible).
  2. Revisar la query en la pestaña Network: incluye `limit=1000`.
  3. Abrir ticket de deuda técnica para paginación server-side (fuera de alcance de este fix).

---

### [FE-06] Captura CxP admite componentes negativos, vencimiento < emisión y TC sin tope (P2)

- **Severidad:** P2 · **Verificación:** dinámico (captura manual: `subtotal = -100`, `iva = 200` → total = 100 → el formulario pasa)
- **Archivos:** `src/features/cxp/hooks/useNuevaFacturaProveedorForm.schema.ts:43-68` (`superRefine`); cálculo en `src/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers.ts:64-70`
- **Problema:** el `superRefine` solo exige `total > 0`. `calcularTotal` suma valores crudos (`s + i + e - r`), así que componentes negativos pueden quedar enmascarados por otros positivos. No hay chequeo `vencimiento >= emision`, ni tope de TC (el módulo de *pagos* CxP sí tiene `TC_MAX = 1000`).
- **Fix (instrucción para Lovable):** agregar 3 `addIssue` al `superRefine` existente (sin tocar el hook ni la UI: los errores fluyen por `facturaFormErrorsFromZod` al shape actual): (a) componentes no negativos, (b) `vencimiento >= emision`, (c) `tc ≤ 1000` cuando hay TC. Opcionalmente también rechazar emisión futura.
- **Diff / código:**

`src/features/cxp/hooks/useNuevaFacturaProveedorForm.schema.ts`:

```diff
     .superRefine((values, refCtx) => {
       if (!values.provId) {
         refCtx.addIssue({ code: "custom", path: ["provId"], message: "Selecciona un proveedor" });
       }
       if (!values.folio.trim()) {
         refCtx.addIssue({ code: "custom", path: ["folio"], message: "Captura el folio del proveedor" });
       }
       // P1-2: sin fecha de emisión el índice único de la BD (proveedor + folio
       // + fecha) no puede evaluarse y el 23505 llega crudo al toast.
       if (!values.emision.trim()) {
         refCtx.addIssue({
           code: "custom",
           path: ["emision"],
           message: "La fecha de emisión es obligatoria",
         });
       }
       if (!values.categoriaId) {
         refCtx.addIssue({ code: "custom", path: ["categoriaId"], message: "Selecciona una categoría contable" });
       }
+      // FE-06a: componentes no negativos. Sin esto, subtotal = -100 e iva = 200
+      // dan total = 100 y pasaban la única validación existente (total > 0).
+      const componentes: Array<[keyof typeof values, string, string]> = [
+        ["subtotal", values.subtotal, "El subtotal no puede ser negativo"],
+        ["iva", values.iva, "El IVA no puede ser negativo"],
+        ["ieps", values.ieps, "El IEPS no puede ser negativo"],
+        ["retenciones", values.retenciones, "Las retenciones no pueden ser negativas"],
+      ];
+      for (const [campo, texto, mensaje] of componentes) {
+        if (texto.trim() !== "" && Number(texto) < 0) {
+          refCtx.addIssue({ code: "custom", path: [campo], message: mensaje });
+        }
+      }
+      // FE-06b: aging coherente — el vencimiento no puede ser anterior a la emisión.
+      if (
+        values.emision.trim() && values.vencimiento.trim() &&
+        values.vencimiento < values.emision
+      ) {
+        refCtx.addIssue({
+          code: "custom",
+          path: ["vencimiento"],
+          message: "La fecha de vencimiento no puede ser anterior a la fecha de emisión",
+        });
+      }
       if (ctx.total <= 0) {
         refCtx.addIssue({ code: "custom", path: ["subtotal"], message: "El total debe ser mayor a 0" });
       }
       if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
         refCtx.addIssue({ code: "custom", path: ["tc"], message: "Captura el tipo de cambio" });
       }
+      // FE-06c: mismo tope que el módulo de pagos CxP (TC_MAX = 1000,
+      // pagoProveedorValidaciones.ts:70,110).
+      if (Number(values.tc) > 1000) {
+        refCtx.addIssue({
+          code: "custom",
+          path: ["tc"],
+          message: "El tipo de cambio no puede ser mayor a 1000",
+        });
+      }
     });
```

- **Tras aplicar, verificar:**
  1. `subtotal = -100, iva = 200` → error "El subtotal no puede ser negativo" y submit bloqueado.
  2. `vencimiento` anterior a `emision` → error en el campo vencimiento.
  3. Moneda USD con `tc = 1500` → "El tipo de cambio no puede ser mayor a 1000".
  4. Regresión: correr los tests existentes `useNuevaFacturaProveedorForm.emision.test.ts` y `useNuevaFacturaProveedorForm.dup.test.ts` (usan `tc: "1"`, `subtotal: "1000"` — deben seguir en verde); alta normal de factura con CFDI y captura manual sin cambios.

---

### [FE-07] Traspaso entre cuentas: sin validación de fecha futura y preview sin redondeo (P3)

- **Severidad:** P3 · **Verificación:** dinámico (DatePickerMx acepta cualquier fecha; preview con TC de 4+ decimales difiere un centavo del abono real)
- **Archivos:** `src/features/tesoreria/hooks/useTraspasoForm.ts:58-73`; UI en `src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx:93` (ojo: el archivo vive en `routes/_sections/`, no en `components/` — divergencia menor de la fuente)
- **Problema:** el `error` valida cuentas/monto/TC pero no la fecha. `montoDestino = montoOrigen * tipoCambio` sin `roundMoney`, mientras la RPC redondea (`ROUND(p_monto_origen*v_tc, 2)`): el preview puede diferir un centavo del abono real. Además la dirección del TC (siempre multiplica) es ambigua para el usuario.
- **Fix (instrucción para Lovable):** en `useTraspasoForm`: (a) redondear el preview con `roundMoney` (ya existe en `@/lib/financial/financialUtils`), (b) añadir validación `fecha <= hoy` con mensaje es-MX. El hint de dirección del TC se resuelve en el diálogo con una línea de texto aclaratoria.
- **Diff / código:**

`src/features/tesoreria/hooks/useTraspasoForm.ts`:

```diff
 import { useEffect, useMemo, useState } from "react";
 import { format } from "date-fns";
 import type { Tables } from "@/integrations/supabase/types";
+import { roundMoney } from "@/lib/financial/financialUtils";
```

```diff
   const montoDestino = useMemo(() => {
     if (!state.montoOrigen || state.montoOrigen <= 0) return 0;
     if (mismoMoneda) return state.montoOrigen;
-    return state.montoOrigen * (state.tipoCambio || 1);
+    // FE-07: la RPC redondea con ROUND(monto*tc, 2); el preview debe coincidir
+    // centavo a centavo con el abono real (canon `roundMoney` = half away from zero).
+    return roundMoney(state.montoOrigen * (state.tipoCambio || 1));
   }, [state.montoOrigen, mismoMoneda, state.tipoCambio]);
```

```diff
   const error = useMemo(() => {
     if (!state.origenId || !state.destinoId) return "Selecciona ambas cuentas.";
     if (state.origenId === state.destinoId) return "La cuenta origen y destino deben ser distintas.";
     if (!state.montoOrigen || state.montoOrigen <= 0) return "El monto debe ser mayor a cero.";
     if (!origen?.activa || !destino?.activa) return "Ambas cuentas deben estar activas.";
+    if (!state.fecha) return "Captura la fecha del traspaso.";
+    if (state.fecha > hoyIso()) return "La fecha del traspaso no puede ser futura.";
     if (!mismoMoneda && (!state.tipoCambio || state.tipoCambio <= 0)) {
       return "Captura el tipo de cambio para cuentas de distinta moneda.";
     }
     return null;
   }, [state, origen, destino, mismoMoneda]);
```

`src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx` (hint de dirección del TC):

```diff
             <p className="text-xs text-muted-foreground">
               {origen.moneda} → {destino.moneda}: {formatCurrency(montoDestino, destino.moneda)}
             </p>
+            <p className="text-xs text-muted-foreground">
+              El tipo de cambio multiplica: 1 {origen.moneda} = {state.tipoCambio} {destino.moneda}.
+              Si tu referencia viene expresada al revés, divídela antes de capturarla.
+            </p>
```

- **Tras aplicar, verificar:**
  1. Seleccionar fecha futura en el DatePicker → botón deshabilitado con "La fecha del traspaso no puede ser futura.".
  2. Traspaso USD→MXN con TC de 4 decimales: el preview coincide exactamente con el abono registrado por la RPC (comparar en el listado de movimientos).
  3. Regresión: traspaso entre cuentas de la misma moneda sigue sin pedir TC y con monto espejo.

---

### [FE-08] Alta de vendedora con % de comisión fuera de rango (P3)

- **Severidad:** P3 · **Verificación:** dinámico (agregar vendedora con 150% o −5% → se guarda)
- **Archivos:** `src/features/comisiones/components/TabVendedorasConfig.tsx:42-54` (`agregar`), línea 85 (input sin min/max); la edición sí valida en línea 58
- **Problema:** `agregar` guarda `Number(nuevoPct) || 0` sin chequeo de rango y el input de alta no tiene `min`/`max`. La edición (`guardarPct`) sí valida 0-100. Se puede crear configuración con 150% o −5%.
- **Fix (instrucción para Lovable):** reutilizar el mismo chequeo de rango de `guardarPct` en `agregar` (con el mismo `notifyError`) y añadir `min="0" max="100"` al input de alta.
- **Diff / código:**

```diff
   const agregar = () => {
     if (!nuevaVendedora || !organizationId) return;
+    // FE-08: mismo rango que la edición (guardarPct). Antes se podía dar de
+    // alta una vendedora con 150% o -5% (la edición sí lo validaba).
+    const pct = Number(nuevoPct);
+    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
+      return notifyError(undefined, { title: "% inválido", method: "FEATURES_COMISIONES_COMPONENTS_TABVENDEDORASCONFIG_1" });
+    }
     upsert.mutate({
       organization_id: organizationId,
       user_id: nuevaVendedora,
-      porcentaje_default: Number(nuevoPct) || 0,
+      porcentaje_default: pct,
       activa: true,
     }, {
```

```diff
-            <Input type="number" step="0.1" value={nuevoPct} onChange={(e) => setNuevoPct(e.target.value)} />
+            <Input type="number" step="0.1" min="0" max="100" value={nuevoPct} onChange={(e) => setNuevoPct(e.target.value)} />
```

- **Tras aplicar, verificar:**
  1. Alta con 150 o −5 → toast "% inválido", no se guarda.
  2. Alta con 0, 5 y 100 → se guarda correctamente.
  3. Regresión: edición de porcentaje y toggle "Activa" sin cambios.

---

### [FE-09] Borrado de catálogos con un solo click, sin confirmación ni `disabled` (P3)

- **Severidad:** P3 · **Verificación:** dinámico (un misclick borra; doble click dispara dos deletes y el segundo falla con toast feo)
- **Archivos:**
  - `src/features/configuracion/components/TabNavieras.tsx:55`
  - `src/features/configuracion/components/TabPuertos.tsx:50`
  - `src/features/configuracion/components/TabTiposContenedor.tsx:48`
  - Componente compartido a reutilizar: `src/components/shared/dialogs/DeleteConfirmDialog.tsx` (re-export de `DoubleConfirmDeleteDialog`, typable "ELIMINAR"); patrón de `disabled` de referencia: `CatalogoClavesSATCard.tsx:108`
- **Problema:** `onClick={() => eliminarNaviera.mutate(row.original.id)}` directo, sin diálogo de confirmación ni `disabled={...isPending}` — patrón distinto al resto del repo. Los tres tabs tienen el mismo defecto.
- **Fix (instrucción para Lovable):** en cada tab: (1) agregar estado `porEliminar` con la fila seleccionada, (2) el botón de basura solo abre el diálogo y queda `disabled={eliminar.isPending}`, (3) renderizar `<DeleteConfirmDialog>` que ejecuta el mutate en `onConfirm`. Ejemplo con `TabNavieras` (replicar idéntico en `TabPuertos` con `eliminarPuerto`/`Puerto` y en `TabTiposContenedor` con `eliminarTipo`/tipo de contenedor).
- **Diff / código:**

`src/features/configuracion/components/TabNavieras.tsx`:

```diff
 import { useAllNavieras, useAdminNavieras } from "@/features/catalogos/hooks";
 import SearchInput from "@/components/shared/SearchInput";
+import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
```

```diff
   const [navieraEnEdicion, setNavieraEnEdicion] = useState<Naviera | null>(null);
+  const [navieraAEliminar, setNavieraAEliminar] = useState<Naviera | null>(null);
```

```diff
-          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarNaviera.mutate(row.original.id)} aria-label={`Eliminar naviera ${row.original.name}`}>
+          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={eliminarNaviera.isPending} onClick={() => setNavieraAEliminar(row.original)} aria-label={`Eliminar naviera ${row.original.name}`}>
             <Trash2 className="h-4 w-4" />
           </Button>
```

```diff
       <NavieraFormDialog
         open={!!navieraEnEdicion}
         onOpenChange={(open) => { if (!open) setNavieraEnEdicion(null); }}
         naviera={navieraEnEdicion}
       />
+      <DeleteConfirmDialog
+        open={!!navieraAEliminar}
+        onOpenChange={(open) => { if (!open) setNavieraAEliminar(null); }}
+        entityName={`la naviera ${navieraAEliminar?.name ?? ""}`}
+        isPending={eliminarNaviera.isPending}
+        onConfirm={() => {
+          if (!navieraAEliminar) return;
+          eliminarNaviera.mutate(navieraAEliminar.id, {
+            onSuccess: () => setNavieraAEliminar(null),
+          });
+        }}
+      />
     </Card>
```

Equivalente en `TabPuertos.tsx`:

```diff
-        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarPuerto.mutate(row.original.id)} aria-label={`Eliminar puerto ${row.original.name}`}>
+        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={eliminarPuerto.isPending} onClick={() => setPuertoAEliminar(row.original)} aria-label={`Eliminar puerto ${row.original.name}`}>
```

y en `TabTiposContenedor.tsx`:

```diff
-        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarTipo.mutate(row.original.id)} aria-label={`Eliminar tipo ${row.original.name}`}>
+        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={eliminarTipo.isPending} onClick={() => setTipoAEliminar(row.original)} aria-label={`Eliminar tipo ${row.original.name}`}>
```

(con sus respectivos estados `puertoAEliminar` / `tipoAEliminar` y `<DeleteConfirmDialog>` al final del `Card`, siguiendo el patrón completo de TabNavieras).
- **Tras aplicar, verificar:**
  1. Click en la basura de una naviera/puerto/tipo → aparece el diálogo de confirmación de dos pasos (escribir "ELIMINAR"); nada se borra con un solo click.
  2. Durante el delete, el botón queda deshabilitado: doble click no genera segundo mutate ni toast de error.
  3. Regresión: alta, edición y toggle activo de los tres catálogos sin cambios; `CatalogoClavesSATCard` (que ya deshabilita) intacto.

---

### [FE-10] Divergencia UI vs RLS en "Registrar pago": rol `tesorero` (P3)

- **Severidad:** P3 · **Verificación:** estático (contraste matriz UI vs función RLS)
- **Archivos:** `src/lib/access/permissionMatrix.finanzas.ts:44-50`; contraste SQL: `supabase/migrations/20260722001738_dfc9effb-9345-47e2-9809-473dc2970c23.sql:7-16` (`es_escritor_financiero`) y policies de `pagos_factura` (líneas 278-300)
- **Problema:** UI `REGISTRAR_COBRO` = super_admin, admin_org, admin, contador, ejecutivo_cobranza. La RLS (`es_escritor_financiero`) incluye además `tesorero`: `role IN ('super_admin','admin','admin_org','contador','tesorero','ejecutivo_cobranza')`. Es restrictivo a favor de la UI (nadie ve una acción que la BD rechaza), pero si fue omisión, tesorería no puede registrar cobros aunque la BD se lo permite.
- **Fix (instrucción para Lovable):** **requiere decisión de producto** — alinear una de las dos fuentes:
  - **Opción A (recomendada, alinear UI a la RLS):** agregar `"tesorero"` a `REGISTRAR_COBRO`. Es coherente con `PAGAR_PROVEEDOR` (que ya incluye tesorero, líneas 24-29) y con la BD.
  - **Opción B (mantener UI restrictiva):** sin cambio de código; documentar la decisión como deliberada en el comentario del bloque.
- **Diff / código (Opción A):**

```diff
 // v13.213.40 — auxiliar_contable NO registra cobros (separación de responsabilidades):
 // sólo captura facturas de proveedor. Cobros los registran contador + ejecutivo_cobranza.
+// FE-10: tesorero alineado con la RLS `es_escritor_financiero` (migración
+// 20260722001738), que ya le permite escribir en `pagos_factura`.
 export const REGISTRAR_COBRO: readonly AppRole[] = [
   "super_admin",
   "admin_org",
   "admin",
   "contador",
   "ejecutivo_cobranza",
+  "tesorero",
 ];
```

Si se elige la Opción B: **sin cambio de código** — acción: agregar al comentario `// FE-10: tesorero excluido deliberadamente pese a que la RLS es_escritor_financiero lo permite (decisión de producto, fecha).`
- **Tras aplicar, verificar:**
  1. (Opción A) Login como tesorero → aparece el botón "Registrar pago" en el detalle de factura y el insert pasa la RLS sin 42501.
  2. Correr los tests de la matriz de permisos si existen (`grep` por `REGISTRAR_COBRO` en `src/**/__tests__`) y actualizar expectativas.
  3. Confirmar con dirección/contabilidad que la segregación de funciones (v13.310.0) no se ve afectada: tesorero sigue sin aprobar facturas de proveedor.

---

### [FE-11] Sin protección global de navegación con formulario sucio (P3)

- **Severidad:** P3 · **Verificación:** estático (grep verificado: no existe `useBlocker`/`beforeunload`/`Prompt` en todo `src/`; router es `react-router-dom@^6.30.4`, que sí soporta `useBlocker`)
- **Archivos:** sin archivo existente que modificar — **archivo nuevo**: `src/hooks/shared/useDirtyGuard.ts` (o la ubicación de hooks compartidos que prefiera Lovable); aplicación en `DialogNuevaFacturaProveedor` (CxP, 11 `useState`), editor de conceptos de cotización y wizard de embarque. El wizard de cotización ya mitiga con autosave a localStorage (`useCotizacionDraftAutosave`).
- **Problema:** los formularios largos pierden toda la captura al cerrar el diálogo o navegar, sin aviso. Es la contraparte de FE-02 (que pierde la captura *dentro* del diálogo por refetch).
- **Fix (instrucción para Lovable):** crear un hook genérico `useDirtyGuard(isDirty)` que (a) avise al cerrar/recargar la pestaña vía `beforeunload` y (b) bloquee la navegación interna con `useBlocker` de react-router-dom v6, mostrando un `ConfirmActionDialog` (ya existe en `src/components/shared/dialogs/ConfirmActionDialog.tsx`). Aplicarlo solo en los 3-4 formularios más largos, derivando `isDirty` de los valores actuales vs. iniciales. No requiere refactor de los formularios.
- **Diff / código (archivo nuevo):**

`src/hooks/shared/useDirtyGuard.ts`:

```ts
/**
 * FE-11 — Protección de navegación con formulario sucio.
 * Aplica a los formularios largos (captura CxP, editor de conceptos, wizard de
 * embarque): avisa antes de perder la captura al cerrar la pestaña o navegar.
 */
import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

export function useDirtyGuard(isDirty: boolean) {
  // 1) Cierre/recarga de pestaña (diálogo nativo del navegador).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // 2) Navegación interna (react-router-dom v6.30).
  const blocker = useBlocker(isDirty);

  const guardDialog = (
    <ConfirmActionDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
      title="¿Salir sin guardar?"
      description="Tienes cambios sin guardar en este formulario. Si sales ahora, se perderá lo capturado."
      confirmLabel="Salir sin guardar"
      cancelLabel="Seguir capturando"
      variant="destructive"
      onConfirm={() => blocker.proceed?.()}
    />
  );

  return { guardDialog };
}
```

Uso (ejemplo en el diálogo de captura CxP):

```tsx
const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues());
const { guardDialog } = useDirtyGuard(open && isDirty);
// …dentro del JSX, junto al FormDialogShell:
{guardDialog}
```

- **Tras aplicar, verificar:**
  1. Capturar CxP con datos, intentar navegar a otra ruta → diálogo "¿Salir sin guardar?"; "Seguir capturando" conserva todo.
  2. Recargar la pestaña con el formulario sucio → aviso nativo del navegador.
  3. Guardado exitoso → `isDirty` vuelve a false y no hay falsos positivos al navegar.
  4. Regresión: wizard de cotización (autosave) no debe quedar doblemente protegido ni romper la restauración del borrador.

---

### [FE-12] Validación de límite de crédito con flotantes crudos (P3)

- **Severidad:** P3 · **Verificación:** estático (comparación directa con el canon `financialUtils.ts:41-44`: "Usar SIEMPRE…")
- **Archivos:** `src/features/facturacion/utils/calcularTotalMxn.ts:22-34`; consumidor: `src/features/facturacion/hooks/useFacturaManualForm.ts:136-151`
- **Problema:** `calcularTotalMxn` acumula `acc + cant * precio` y `base * tasaIva` con flotantes crudos, pese al comentario del canon ("Usar SIEMPRE `subtotalLinea`… antes de acumular a un total padre, para evitar drift de punto flotante"). El resultado alimenta la validación de límite de crédito antes de timbrar (`validarLimite`), así que puede divergir centavos del total que realmente se persiste/timbra.
- **Fix (instrucción para Lovable):** reescribir las dos reducciones con `sumarSubtotales` y `calcularIVA`/`roundMoney` (helpers ya existentes en `@/lib/financial/financialUtils`), preservando la firma pública `TotalFacturaMxn` y la lógica `conIva || subtotal`.
- **Diff / código:**

```diff
 import { aMxn } from "@/lib/financial/convertir";
+import { sumarSubtotales, subtotalLinea, calcularIVA, roundMoney } from "@/lib/financial/financialUtils";
 import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
```

```diff
-  const subtotal = conceptos.reduce((acc, c) => {
-    const cant = Number(c.cantidad) || 0;
-    const precio = Number(c.precio_unitario) || 0;
-    return acc + cant * precio;
-  }, 0);
-  const conIva = conceptos.reduce((acc, c) => {
-    const cant = Number(c.cantidad) || 0;
-    const precio = Number(c.precio_unitario) || 0;
-    const base = cant * precio;
-    const iva = c.tipo_iva === "gravado_16" ? base * tasaIva : 0;
-    return acc + base + iva;
-  }, 0);
+  // FE-12: canon currency.js — subtotal por línea redondeado antes de acumular
+  // e IVA por línea con el mismo redondeo, para que la validación de crédito
+  // coincida centavo a centavo con el total que se persiste/timbra.
+  const subtotal = sumarSubtotales(conceptos, (c) => ({
+    cantidad: Number(c.cantidad) || 0,
+    precioUnitario: Number(c.precio_unitario) || 0,
+  }));
+  const conIva = roundMoney(
+    conceptos.reduce((acc, c) => {
+      const base = subtotalLinea(Number(c.cantidad) || 0, Number(c.precio_unitario) || 0);
+      const iva = c.tipo_iva === "gravado_16" ? calcularIVA(base, tasaIva) : 0;
+      return acc + base + iva;
+    }, 0),
+  );
   const total = conIva || subtotal;
   const conv = aMxn(total, moneda, tipoCambio);
   return { mxn: conv.monto, tcFaltante: !conv.completo };
```

- **Tras aplicar, verificar:**
  1. Factura manual con conceptos de precios con 3-4 decimales (p. ej. 3 × 19.995 gravado_16): el monto enviado a `validarLimite` coincide con el total mostrado/persistido al centavo.
  2. Concepto exento/tasa 0 mezclado con gravado_16: el IVA solo se calcula sobre los gravados.
  3. Regresión: `tcFaltante` sigue bloqueando el timbrado sin TC confiable; el flujo de límite de crédito (`rebasa` → alerta) intacto. Agregar/actualizar test unitario de `calcularTotalMxn` (existe suite en `src/features/facturacion/utils/__tests__/`).

---

## Resumen de validación

| ID | Archivo(s) principal(es) | Tipo de cambio |
|----|--------------------------|----------------|
| FE-01 | `DialogRegistrarPago.tsx`, `DialogRegistrarPagoParts.tsx`, `useRegistrarPagoSubmit.ts` | Bloqueo TC=0 (UI + handler) |
| FE-02 | `DialogRegistrarPago.tsx` | Guard de inicialización única |
| FE-03 | `DialogRegistrarPago.tsx`, `FacturaDetalleModales.tsx` | Validación de fechas (patrón CxP) |
| FE-04 | 4 archivos (conversion, mappers, estadoVigenciaCell, calculosCartera) | Fecha local en vez de UTC |
| FE-05 | `cotizacion/services/queries.ts` | `.limit(1000)` defensivo |
| FE-06 | `useNuevaFacturaProveedorForm.schema.ts` | 3 `addIssue` en `superRefine` |
| FE-07 | `useTraspasoForm.ts`, `DialogTraspasoCuentas.tsx` | Fecha ≤ hoy + `roundMoney` + hint TC |
| FE-08 | `TabVendedorasConfig.tsx` | Rango 0-100 en alta |
| FE-09 | `TabNavieras.tsx`, `TabPuertos.tsx`, `TabTiposContenedor.tsx` | `DeleteConfirmDialog` + `disabled` |
| FE-10 | `permissionMatrix.finanzas.ts` | Alinear UI↔RLS (decisión) |
| FE-11 | `src/hooks/shared/useDirtyGuard.ts` (nuevo) | Guard de formulario sucio |
| FE-12 | `calcularTotalMxn.ts` | Canon `currency.js` |
