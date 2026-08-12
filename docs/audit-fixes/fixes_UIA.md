# Fix pack — UI dinámica interna (UIA-01 … UIA-17) — Elogistix v13.523.1

Fuente: `audit_reports/07_ui_dinamica_interna.md`. Repo: `main @ 1ef05ce9` (frontend `src/`).
Todas las rutas citadas fueron leídas y verificadas contra el repo real. Diffs con contexto real; donde el fix es compartido con otro pack se indica la referencia cruzada y sólo se desarrolla el delta propio. Contexto de bajo riesgo (feature freeze): cambios acotados a UI/validación, sin tocar contratos de BD salvo verificación de despliegue (UIA-07).

---

### [UIA-01] "Registrar pago" cross-moneda permite enviar con TC 0
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (factura MXN → pago USD → "Equivalente: MXN 0.00 (TC: 0.0000)", botón habilitado)
- **Archivos:** `src/features/facturacion/components/DialogRegistrarPago.tsx`, `src/features/facturacion/components/DialogRegistrarPagoParts.tsx`
- **Problema:** Con `exchange-rates` caído (501), `convertirAMonedaFactura` devuelve 0 (FIX C6 deliberado), pero `invalido = montoNum <= 0 || excede` no contempla el caso → el submit queda habilitado con `tipoCambio = 0` y el equivalente en gris tenue. El error llegaría crudo del servidor (23514) tras disparar timbrado REP.
- **Fix (instrucción para Lovable):** Fix principal compartido con FE-01, ver `fixes_FE.md` (bloqueo de submit sin TC + captura manual de TC como CxP). Delta propio de este pack: (1) añadir la guarda `crossSinTc` a `invalido`; (2) elevar el aviso de "Equivalente… TC 0.0000" de texto gris a alerta ámbar explícita.
- **Diff / código:**

`DialogRegistrarPago.tsx` — ANTES:
```ts
const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
const excede = montoAplicado > saldo + 0.01;
const invalido = montoNum <= 0 || excede;
const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
```
DESPUÉS:
```ts
const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
const excede = montoAplicado > saldo + 0.01;
const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
// UIA-01: cross-moneda SIN TC confiable (rates caídos) → bloquear el submit
// hasta que FE-01 habilite la captura manual del TC.
const crossSinTc = values.moneda !== factura.moneda && montoNum > 0 && tipoCambio <= 0;
const invalido = montoNum <= 0 || excede || crossSinTc;
```
`DialogRegistrarPagoParts.tsx` (`NotasPago`) — ANTES:
```tsx
{mostrarConversion && (
  <p className="text-xs text-muted-foreground">
    Equivalente: {formatCurrency(montoAplicado, monedaFactura)} (TC: {tipoCambio.toFixed(4)})
  </p>
)}
```
DESPUÉS:
```tsx
{mostrarConversion && tipoCambio > 0 && (
  <p className="text-xs text-muted-foreground">
    Equivalente: {formatCurrency(montoAplicado, monedaFactura)} (TC: {tipoCambio.toFixed(4)})
  </p>
)}
{mostrarConversion && tipoCambio <= 0 && (
  <Alert className="border-warning/40 bg-warning/5">
    <AlertDescription className="text-xs">
      No hay tipo de cambio {monedaPago}→{monedaFactura} disponible. No se puede
      registrar el cobro hasta capturar un TC válido (o reintentar cuando vuelva el servicio).
    </AlertDescription>
  </Alert>
)}
```
- **Tras aplicar, verificar:** con `exchange-rates` apagado, abrir factura MXN → Registrar pago → Moneda=USD: botón deshabilitado y alerta ámbar visible. Con TC disponible, el equivalente y el submit funcionan igual que antes. Factura PPD timbrada sigue disparando REP sólo tras guardar.

---

### [UIA-02] Traspaso cross-moneda con TC default 1 y preview 1:1 silencioso
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (MXN→USD, campo TC precargado con 1, preview "USD 1,000.00", postea como "Conciliada")
- **Archivos:** `src/features/tesoreria/hooks/useTraspasoForm.ts`, `src/features/tesoreria/routes/_sections/DialogTraspasoCuentas.tsx`
- **Problema:** `tipoCambio: 1` hardcodeado en el estado inicial y en el reset (`useTraspasoForm.ts` líneas 30 y 43); el preview usa `state.tipoCambio || 1` (línea 61), así que aunque el usuario borre el campo el equivalente se calcula 1:1. La validación `tipoCambio <= 0` ya existe pero nunca se dispara porque el default es 1. Coordinar con BL-04 (guarda server-side: rechazar traspasos cross-moneda sin TC explícito).
- **Fix (instrucción para Lovable):** TC vacío (0) por defecto en cross-moneda → la validación existente bloquea el submit hasta captura explícita. Preview sólo cuando hay TC capturado y marcado como "estimado". Opcional: prefijar como sugerencia el último TC DOF (`useExchangeRates`) sin habilitar el submit por sí solo.
- **Diff / código:**

`useTraspasoForm.ts` — ANTES (estado inicial y reset del `useEffect`):
```ts
    montoOrigen: 0,
    tipoCambio: 1,
    comision: 0,
```
DESPUÉS (ambos bloques):
```ts
    montoOrigen: 0,
    // UIA-02: 0 = "sin capturar". Antes el default 1 posteaba conversiones 1:1
    // silenciosas entre monedas distintas.
    tipoCambio: 0,
    comision: 0,
```
ANTES (`montoDestino`):
```ts
    if (mismoMoneda) return state.montoOrigen;
    return state.montoOrigen * (state.tipoCambio || 1);
```
DESPUÉS:
```ts
    if (mismoMoneda) return state.montoOrigen;
    if (!state.tipoCambio || state.tipoCambio <= 0) return 0;
    return state.montoOrigen * state.tipoCambio;
```
`DialogTraspasoCuentas.tsx` — ANTES (preview):
```tsx
            <p className="text-xs text-muted-foreground">
              {origen.moneda} → {destino.moneda}: {formatCurrency(montoDestino, destino.moneda)}
            </p>
```
DESPUÉS:
```tsx
            <p className="text-xs text-muted-foreground">
              {state.tipoCambio > 0
                ? `Estimado con el TC capturado: ${origen.moneda} → ${destino.moneda}: ${formatCurrency(montoDestino, destino.moneda)}`
                : `Captura el tipo de cambio para ver el equivalente en ${destino.moneda}.`}
            </p>
```
- **Tras aplicar, verificar:** abrir Traspaso con cuentas MXN/USD → campo TC vacío, botón "Registrar traspaso" deshabilitado con el mensaje "Captura el tipo de cambio para cuentas de distinta moneda."; capturar TC → preview marcado "Estimado…"; traspaso misma moneda no pide TC. Verificar además el convenio de dirección del TC (multiplica vs. divide) con un monto conocido, y que BL-04 rechaza el POST sin TC aunque se fuerce la UI.

---

### [UIA-03] KPIs suman USD como MXN (1:1) sin TC
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO ("Por cobrar 30 días MXN 17,400.00" = 11,600+5,800 a 1:1; Facturación "Saldo por cobrar MXN 11.6K" omite la USD)
- **Archivos:** `src/features/tesoreria/domain/resumen.ts`, `src/features/tesoreria/domain/resumen.types.ts`, `src/features/tesoreria/routes/_sections/TesoreriaKpis.tsx`, `src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx`
- **Problema:** En `resumen.ts` línea 51: `const tc = … ? args.tipoCambioUsd : 1;` — cuando `useExchangeRates` no trae TC (501), el fallback es **1** y `por_cobrar_total_mxn = mxn + usd*1`. Además `sumarVencidas` suma USD×1. En Facturación, `cobranzaAggregates.calcularKPIs` ya separa `total_mxn`/`total_usd`, pero el dashboard sólo muestra `_mxn` y la porción USD desaparece sin aviso. La misma pantalla de Tesorería sí excluye USD del saldo bancario con aviso (Q-06): criterio inconsistente.
- **Fix (instrucción para Lovable):** Regla única "sin TC confiable → excluir y avisar" (patrón Q-06 de `sumarSaldosCuentas`): (1) en `resumen.ts` el fallback pasa de 1 a 0 + flag `flujo_incompleto`; (2) `TesoreriaKpis` muestra hint cuando el flag está activo; (3) el dashboard de Facturación muestra la porción USD como sublabel en vez de omitirla.
- **Diff / código:**

`resumen.ts` — ANTES:
```ts
  const tc = args.tipoCambioUsd && args.tipoCambioUsd > 0 ? args.tipoCambioUsd : 1;

  const flujo = calcularFlujo(args.cobranza, args.cxp, enVentana, tc);
```
DESPUÉS:
```ts
  // UIA-03: sin TC confiable NO se asume 1:1 — la porción en USD queda excluida
  // de los totales MXN y se reporta vía `flujo_incompleto` (patrón Q-06).
  const tcConfiable = typeof args.tipoCambioUsd === "number" && args.tipoCambioUsd > 1;
  const tc = tcConfiable ? args.tipoCambioUsd : 0;

  const flujo = calcularFlujo(args.cobranza, args.cxp, enVentana, tc);
  flujo.flujo_incompleto =
    !tcConfiable && (flujo.por_cobrar_usd > 0 || flujo.por_pagar_usd > 0);
```
`resumen.types.ts` (`FlujoMes`) — ANTES:
```ts
  por_cobrar_total_mxn: number;
  por_pagar_total_mxn: number;
}
```
DESPUÉS:
```ts
  por_cobrar_total_mxn: number;
  por_pagar_total_mxn: number;
  /** UIA-03: `true` cuando hay saldos USD excluidos del total por falta de TC. */
  flujo_incompleto: boolean;
}
```
(inicializar `flujo_incompleto: false` en el objeto literal de `calcularFlujo`, junto a `por_cobrar_total_mxn: 0`).
`TesoreriaKpis.tsx` — ANTES:
```tsx
      <KpiCard
        label="Por cobrar 30 días"
        value={formatCurrency(data.flujo.por_cobrar_total_mxn, "MXN")}
```
DESPUÉS:
```tsx
      <KpiCard
        label="Por cobrar 30 días"
        value={formatCurrency(data.flujo.por_cobrar_total_mxn, "MXN")}
        hint={
          data.flujo.flujo_incompleto
            ? "Excluye saldos en USD sin tipo de cambio confiable."
            : undefined
        }
```
(mismo `hint` en "Por pagar 30 días"). `DashboardEjecutivoFacturacion.tsx` — ANTES:
```tsx
        <KpiCard
          label="Saldo por cobrar"
          value={formatCurrencyCompact(porCobrar, "MXN")}
          valueTooltip="Saldo total pendiente de cobro de todas las facturas vivas (no sólo del mes en curso). Es el mismo universo de la pestaña 'Por cobrar'."
        />
```
DESPUÉS:
```tsx
        <KpiCard
          label="Saldo por cobrar"
          value={formatCurrencyCompact(porCobrar, "MXN")}
          sublabel={cob.total_usd > 0 ? `+ ${formatCurrencyCompact(cob.total_usd, "USD")} en USD` : undefined}
          valueTooltip="Saldo total pendiente de cobro de todas las facturas vivas (no sólo del mes en curso). Las facturas en USD se muestran aparte para no mezclar monedas sin tipo de cambio."
        />
```
(análogo en "Vencido" con `cob.vencido_usd`).
- **Tras aplicar, verificar:** con exchange-rates caído y facturas MXN 11,600 + USD 5,800: Tesorería muestra "Por cobrar 30 días MXN 11,600.00" con hint de exclusión (no 17,400); "Total vencido" deja de mezclar; Facturación muestra "MXN 11.6K" + sublabel "+ USD 5.8K en USD". Con TC disponible todo vuelve a convertirse y sumarse como antes.

---

### [UIA-04] /sin-acceso: mensaje engañoso y callejón sin salida
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (ventas@ con rol y org → URL directa /tesoreria → "no tiene un rol ni una organización asignada", falso; sólo "Ver ayuda"/"Cerrar sesión")
- **Archivos:** `src/features/auth/components/ProtectedRoute.tsx`, `src/features/auth/routes/SinAcceso.tsx`
- **Problema:** `SinAcceso.tsx` tiene un único mensaje hardcodeado para el caso "cuenta sin rol ni organización" (el motivo RG1 original), pero `ProtectedRoute` también aterriza ahí a usuarios con rol válido que intentan un módulo fuera de su permiso (línea 74: `<Navigate to="/sin-acceso" replace />` sin state). El usuario cree que su cuenta está rota y no tiene salida más que cerrar sesión.
- **Fix (instrucción para Lovable):** Pasar el motivo en `location.state` desde `ProtectedRoute` y renderizar en `SinAcceso` mensaje + CTA por causa: "permiso-modulo" → mensaje de permiso con rol actual y botón "Volver al inicio"; "sin-rol-org" → mensaje actual (cuenta pendiente de alta).
- **Diff / código:**

`ProtectedRoute.tsx` — ANTES:
```tsx
  if (sinAcceso) {
    // RG1: antes íbamos a "/" y HomeRoute rebotaba a "/inicio" → bucle infinito.
    return <Navigate to="/sin-acceso" replace />;
  }
```
DESPUÉS:
```tsx
  if (sinAcceso) {
    // RG1: antes íbamos a "/" y HomeRoute rebotaba a "/inicio" → bucle infinito.
    // UIA-04: distinguimos "sin rol/org" de "rol sin permiso para este módulo".
    return (
      <Navigate
        to="/sin-acceso"
        replace
        state={{
          motivo: effectiveRole ? "permiso-modulo" : "sin-rol-org",
          from: location.pathname,
        }}
      />
    );
  }
```
`SinAcceso.tsx` — DESPUÉS (componente completo, reemplaza el cuerpo actual):
```tsx
import { Link, useLocation } from "react-router-dom";
import { ShieldAlert, LogOut, LifeBuoy, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/shared/Seo";
import { signOutCurrentSession } from "@/lib/auth/signOut";
import { useAuth } from "@/lib/contexts/AuthContext";
import { obtenerEtiquetaRol } from "@/features/admin/domain/roles/roleCatalog";

export default function SinAcceso() {
  const { state } = useLocation();
  const { effectiveRole } = useAuth();
  const motivo = (state as { motivo?: string; from?: string } | null)?.motivo ?? "sin-rol-org";
  const from = (state as { from?: string } | null)?.from;
  const esPermisoModulo = motivo === "permiso-modulo" && Boolean(effectiveRole);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Seo
        title="Sin acceso · Libre Carga"
        description="Tu cuenta aún no tiene permisos asignados en Libre Carga."
        ogTitle="Sin acceso · Libre Carga"
        ogDescription="Tu cuenta aún no tiene permisos asignados en Libre Carga."
      />
      <div className="max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sin acceso</h1>
        {esPermisoModulo ? (
          <p className="text-sm text-muted-foreground">
            Tu cuenta está activa con el rol <strong>{obtenerEtiquetaRol(effectiveRole)}</strong>,
            pero ese rol no tiene permiso para entrar a este módulo
            {from ? <> (<code>{from}</code>)</> : null}. Si crees que es un error, pide a un
            administrador que ajuste tus permisos.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tu cuenta está activa, pero todavía no tiene un rol ni una organización
            asignada. Pide a un administrador de tu empresa que te dé de alta para
            poder entrar.
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {esPermisoModulo && (
            <Button asChild>
              <Link to="/inicio">
                <Home className="mr-2 h-4 w-4" aria-hidden /> Volver al inicio
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/ayuda">
              <LifeBuoy className="mr-2 h-4 w-4" aria-hidden /> Ver ayuda
            </Link>
          </Button>
          <Button variant={esPermisoModulo ? "outline" : "default"} onClick={() => void signOutCurrentSession()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden /> Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
```
- **Tras aplicar, verificar:** login ventas@ → URL directa /tesoreria → mensaje "…rol Vendedor… no tiene permiso para este módulo" con botón "Volver al inicio" que navega a /inicio. Cuenta sin rol/org sigue viendo el mensaje original. La pantalla nunca rebota en bucle.

---

### [UIA-05] Delete de catálogo a un clic y botón ofrecido sin permiso
- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (clic en ícono eliminar → DELETE inmediato sin diálogo → toast "No tienes permisos para eliminar puertos.")
- **Archivos:** `src/features/configuracion/components/TabPuertos.tsx` (mismo patrón en los demás tabs de Catálogos — ver UX-01)
- **Problema:** El botón de eliminar llama `eliminarPuerto.mutate(row.original.id)` directo en el `onClick` (sin confirmación), y se renderiza para cualquier usuario con acceso a la pestaña aunque su rol no tenga permiso de borrado: puede crear pero no borrar, y descubre la restricción con un toast de error tras intentarlo.
- **Fix (instrucción para Lovable):** Confirmación compartida con UX-01, ver `fixes_UX.md` (mismo diálogo de confirmación de borrado para todos los catálogos; el repo ya tiene `DeleteConfirmDialog`/`DoubleConfirmDeleteDialog` en `src/components/shared/dialogs/DeleteConfirmDialog.tsx`). Delta propio de este pack: ocultar el botón de eliminar cuando el rol no puede administrar el tenant (`usePermissions().canAdminTenant`), de modo que UI y permisos no diverjan.
- **Diff / código (delta sobre TabPuertos.tsx):**

ANTES (columna eliminar, líneas ~48-54):
```tsx
    {
      id: "eliminar", header: "",
      meta: { headerClassName: "w-12" },
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => eliminarPuerto.mutate(row.original.id)} aria-label={`Eliminar puerto ${row.original.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
```
DESPUÉS:
```tsx
    {
      id: "eliminar", header: "",
      meta: { headerClassName: "w-12" },
      // UIA-05: el botón sólo se ofrece a quien sí tiene permiso de borrado
      // (antes el usuario lo descubría con un toast de error tras el clic).
      cell: ({ row }) =>
        canAdminTenant ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setPendienteEliminar(row.original)} aria-label={`Eliminar puerto ${row.original.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null,
    },
```
y dentro del componente:
```tsx
  const { canAdminTenant } = usePermissions();
  const [pendienteEliminar, setPendienteEliminar] = useState<Puerto | null>(null);
  // …al final del Card:
  <DoubleConfirmDeleteDialog
    open={pendienteEliminar !== null}
    onOpenChange={(o) => { if (!o) setPendienteEliminar(null); }}
    entityName={pendienteEliminar ? `${pendienteEliminar.name} (${pendienteEliminar.code})` : ""}
    description="El puerto dejará de estar disponible en cotizaciones y embarques nuevos."
    onConfirm={() => {
      if (pendienteEliminar) eliminarPuerto.mutate(pendienteEliminar.id);
      setPendienteEliminar(null);
    }}
    isPending={eliminarPuerto.isPending}
  />
```
(imports: `usePermissions` desde `@/hooks/shared`, `DoubleConfirmDeleteDialog` desde `@/components/shared/DoubleConfirmDeleteDialog`. Si UX-01 decide un confirmador de un solo paso, usar el componente acordado ahí — el gate por permiso es independiente.)
- **Tras aplicar, verificar:** usuario con permiso de creación pero no de borrado ya no ve el ícono eliminar; admin sí lo ve y el borrado exige confirmación explícita antes del DELETE; el toast de error por permisos deja de aparecer.

---

### [UIA-06] "Registrar pago" sin validación de fecha
- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (fecha de pago 01/05/2030 aceptada sin aviso ni bloqueo; CxP sí valida)
- **Archivos:** `src/features/facturacion/components/DialogRegistrarPago.tsx`, `src/features/facturacion/components/PagoFormFields.tsx`
- **Problema:** El diálogo de cobro inicializa `fecha: today()` pero no valida el valor editado: se aceptan fechas futuras (y anteriores a la emisión de la factura), distorsionando el REP y el aging. El campo `DatePickerMx` (`PagoFormFields.tsx` línea 50) no recibe ningún límite.
- **Fix (instrucción para Lovable):** Bloquear submit con fecha futura (guarda en el diálogo + aviso inline). Para "no anterior a emisión" se requiere exponer `fecha_emision` en la prop `factura` — hacerlo como aviso no bloqueante (hay cobros registrados a destiempo legítimos).
- **Diff / código:**

`DialogRegistrarPago.tsx` — ANTES:
```ts
  const montoNum = Number(values.monto) || 0;
  const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
```
DESPUÉS:
```ts
  const montoNum = Number(values.monto) || 0;
  // UIA-06: la fecha de pago no puede ser futura (REP y aging quedarían distorsionados).
  const fechaFutura = values.fecha > today();
  const montoAplicado = convertirAMonedaFactura(montoNum, values.moneda, factura.moneda, rates);
```
y en el cálculo de `invalido` (ya combinado con la guarda de UIA-01):
```ts
  const invalido = montoNum <= 0 || excede || crossSinTc || fechaFutura;
```
`DialogRegistrarPagoParts.tsx` (`NotasPago`) — agregar prop `fechaFutura: boolean` y renderizar junto a los avisos existentes:
```tsx
      {fechaFutura && (
        <p className="text-xs text-destructive">
          La fecha de pago no puede ser futura.
        </p>
      )}
```
(Opcional, si se agrega `fecha_emision` a la interfaz `Factura`: aviso ámbar no bloqueante "La fecha de pago es anterior a la emisión de la factura".)
- **Tras aplicar, verificar:** fecha 01/05/2030 → botón deshabilitado + mensaje; fecha de hoy o pasada → flujo normal. El aviso previo a corte (`AvisoFechaPreviaCorte`) sigue funcionando.

---

### [UIA-07] Cartera marca "Vence hoy" una factura que vence en 10 días
- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (vencimiento 22/08/2026, hoy 12/08 → badge "Vence hoy"; Facturación mostraba bien "Vence en 10 d")
- **Archivos:** `src/features/bandejas/routes/_sections/carteraColumns.tsx`, `src/features/bandejas/routes/_sections/CarteraMobileList.tsx`, BD: RPC `public.cartera_pendiente()` (canon `supabase/schema/facturacion/cartera_pendiente.sql`)
- **Problema:** La columna "DÍAS VENCIDO" usa `dias_vencido` tal cual viene de la RPC. El código vigente de la RPC ya es correcto (`(CURRENT_DATE - b.fecha_vencimiento)::int`, migración N9 `20260810121500_ola4_n9_cartera_pendiente_dias_vencido.sql`), pero la versión anterior truncaba con `GREATEST(0, …)` — con ese clamp una factura que vence en 10 días devuelve exactamente `0`, y el cell renderer muestra `d === 0 → "Vence hoy"`. Es el síntoma observado: la función desplegada en el entorno auditado es pre-N9. Hay además riesgo de divergencia de timezone entre `CURRENT_DATE` (UTC del servidor) y la fecha local del usuario.
- **Fix (instrucción para Lovable):** Doble capa: (1) BD — verificar en staging/prod que `cartera_pendiente()` desplegada coincide con el canon N9 (sin `GREATEST(0,…)` en la columna de salida; el clamp sólo ordena). Si no, re-aplicar la migración `20260810121500` / el archivo canon. (2) UI defensiva — recalcular los días en cliente desde `fecha_vencimiento` con el canon de fechas locales (`calcularDiasVencidoFactura`, misma convención de signo), en vez de confiar ciegamente en la RPC.
- **Diff / código:**

`carteraColumns.tsx` — ANTES:
```tsx
      cell: ({ row }) => {
        const d = row.original.dias_vencido;
        if (d > 0) return <Badge variant="destructive">Vencida {d}d</Badge>;
        // B-019 (v13.320.42): antes decíamos "Por vencer 0d" cuando vence hoy —
        // era ambiguo (¿ya venció? ¿faltan 0 días?). Ahora "Vence hoy" es literal.
        if (d === 0) return <Badge variant="secondary">Vence hoy</Badge>;
        if (d >= -7) return <Badge variant="secondary">Vence en {Math.abs(d)}d</Badge>;
        return <Badge variant="outline">Vence en {Math.abs(d)}d</Badge>;
      },
```
DESPUÉS:
```tsx
      cell: ({ row }) => {
        // UIA-07: recalcular desde fecha_vencimiento con el canon local
        // (`calcularDiasVencidoFactura`, misma convención de signo que la RPC).
        // La RPC desplegada puede ser pre-N9 (clamp GREATEST(0,…)) y devolver 0
        // → "Vence hoy" falso. Fallback a dias_vencido sólo si no hay fecha.
        const d = row.original.fecha_vencimiento
          ? (calcularDiasVencidoFactura(row.original.fecha_vencimiento) ?? row.original.dias_vencido)
          : row.original.dias_vencido;
        if (d > 0) return <Badge variant="destructive">Vencida {d}d</Badge>;
        if (d === 0) return <Badge variant="secondary">Vence hoy</Badge>;
        if (d >= -7) return <Badge variant="secondary">Vence en {Math.abs(d)}d</Badge>;
        return <Badge variant="outline">Vence en {Math.abs(d)}d</Badge>;
      },
```
(import: `import { calcularDiasVencidoFactura } from "@/features/facturacion/domain/facturaAging";`). Aplicar el mismo recálculo al badge de `CarteraMobileList.tsx` (líneas 48-49, `{row.dias_vencido}d`).
- **Tras aplicar, verificar:** factura con vencimiento a 10 días → Cartera muestra "Vence en 10d" igual que Facturación. En SQL: `SELECT prosrc FROM pg_proc WHERE proname='cartera_pendiente'` no debe contener `GREATEST(0, (CURRENT_DATE` en la columna de salida. Sin fecha de vencimiento no hay regresión ("Vence: —").

---

### [UIA-08] Toast global "No pudimos cargar la información" en páginas sanas
- **Severidad:** P2 · **Verificación:** PENDIENTE staging (en el stack local el toast aparece en casi todas las páginas; en consola sólo falla el WebSocket de realtime — limitación del stack — y, en páginas con FX, `501 /functions/v1/exchange-rates`. Probablemente no reproducible en prod, pero revela que un fallo de canal en background dispara error global)
- **Archivos:** `src/lib/query/queryErrorReporting.ts` (`notifyQueryFailure`), `src/features/catalogos/hooks/useExchangeRates.ts`, suscripciones realtime (`src/features/cxp/services/facturasEntrantesRealtime.ts`, `src/features/notificaciones/services/index.ts`)
- **Problema:** Cualquier query que falla sin `meta.silentError` dispara el toast global con "Ver detalles/Reintentar" (`queryErrorReporting.ts` líneas 141-153), aunque la página degrade con gracia. En el stack auditado la causa probable es la query de `exchange-rates` (501), presente en /inicio, /tesoreria, /facturacion… — no el WebSocket (éste no pasa por React Query). Resultado: alarma falsa permanente que mata la credibilidad de los errores reales.
- **Fix (instrucción para Lovable):** (1) Marcar `useExchangeRates` como `silentError` — su degradación ya es visible en UI ("TC no disponible", hints de exclusión) y no amerita toast de datos. (2) Verificación en staging (obligatoria antes de cerrar): si el toast persiste con realtime sano, identificar la queryKey exacta en "Ver detalles" del toast (el payload la incluye) y aplicar el mismo criterio: los canales de background (realtime, FX, notificaciones) nunca elevan a toast de error de datos; como mucho, badge discreto "tiempo real desconectado".
- **Diff / código:**

`useExchangeRates.ts` — ANTES:
```ts
export function useExchangeRates() {
  return useQuery({
    queryKey: queryKeys.exchangeRates.all,
    queryFn: () => fetchExchangeRates(),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}
```
DESPUÉS:
```ts
export function useExchangeRates() {
  return useQuery({
    queryKey: queryKeys.exchangeRates.all,
    queryFn: () => fetchExchangeRates(),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
    // UIA-08: degradación silenciosa. Sin TC la UI ya muestra "no disponible"
    // (hints de exclusión en Tesorería/Facturación); un fallo de este servicio
    // no es un fallo de carga de la página y no debe disparar el toast global.
    meta: { silentError: true },
  });
}
```
- **Tras aplicar, verificar (staging, no stack local):** recorrer /inicio, /facturacion, /cartera, /tesoreria con red sana → ningún toast "No pudimos cargar la información". Simular 501 en exchange-rates → sin toast; los hints de "TC no disponible" aparecen en su lugar. Cortar el WebSocket de realtime → sin toast de datos (a lo sumo el badge si se implementa). Errores reales de datos (ej. 500 en cobranza) siguen tostando con "Reintentar".

---

### [UIA-09] Descuadre de "contenedores" entre lista y detalle
- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (lista: "Embarques / 4 contenedores" con 4 embarques y 3 contenedores reales; detalle DEMO-001: "Contenedores (0)")
- **Archivos:** `src/features/embarques/routes/Embarques.tsx`, `src/features/embarques/domain/embarquesPageHelpers.ts` (`computeCounts`)
- **Problema:** En la vista por defecto (sin filtro de estado), `computeCounts` devuelve `contenedoresCount: totalCountServer` — el total de **embarques** del servidor — y `buildDescription` lo etiqueta como "contenedores" (`Embarques.tsx` línea 25). La columna además muestra un contenedor para un embarque cuyo detalle dice "(0)": dos vistas del mismo objeto se contradicen.
- **Fix (instrucción para Lovable):** Cuando el contador proviene del total server-side (sin filtro de estado), etiquetarlo como "embarques"; la forma "N contenedores en M expedientes" sólo cuando el conteo es real de contenedores (filtro de estado activo, set completo en cliente).
- **Diff / código:**

`Embarques.tsx` — ANTES:
```ts
function buildDescription(contenedoresCount: number, expedientesCount: number, estadoActivo: boolean): string {
  const cont = `${contenedoresCount} ${contenedoresCount === 1 ? "contenedor" : "contenedores"}`;
  if (!estadoActivo) return cont;
  const exp = `${expedientesCount} ${expedientesCount === 1 ? "expediente" : "expedientes"}`;
  return `${cont} en ${exp}`;
}
```
DESPUÉS:
```ts
function buildDescription(contenedoresCount: number, expedientesCount: number, estadoActivo: boolean): string {
  if (!estadoActivo) {
    // UIA-09: sin filtro de estado, `contenedoresCount` es el total SERVER-SIDE
    // de embarques (computeCounts → totalCountServer), no de contenedores.
    return `${contenedoresCount} ${contenedoresCount === 1 ? "embarque" : "embarques"}`;
  }
  const cont = `${contenedoresCount} ${contenedoresCount === 1 ? "contenedor" : "contenedores"}`;
  const exp = `${expedientesCount} ${expedientesCount === 1 ? "expediente" : "expedientes"}`;
  return `${cont} en ${exp}`;
}
```
- **Tras aplicar, verificar:** /embarques sin filtros → encabezado "4 embarques"; con filtro de estado activo → "N contenedores en M expedientes" y cuadra con el detalle del embarque. El descuadre columna-lista vs detalle (MSCU7788990 vs "Contenedores (0)") queda acotado a la fuente de contenedores por fila — verificar que la columna y el detalle lean la misma tabla (`embarque_contenedores`); si persiste, abrir como hallazgo de datos aparte.

---

### [UIA-10] P&L con TC "0.0000" y cifras descuadradas
- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (DEMO-2026-001: "USD 0.0000 · EUR 0.0000"; "Costo real MXN 14,500" vs tabla por concepto "Total MXN 12,500"; "Margen real 0.0%" con utilidad −14,500)
- **Archivos:** `src/features/embarques/components/TabPnl.tsx`, `src/features/embarques/services/pnlFinanciero.ts`, `src/features/embarques/domain/pnlAlertas.ts`
- **Problema:** Tres síntomas: (1) `pnlFinanciero.ts` línea 77 normaliza `tipo_cambio_usd: raw.tipo_cambio_usd ?? 0` y `TabPnl.tsx` línea 156 imprime `0?.toFixed(4)` → "0.0000" en vez de "no disponible". (2) Con venta real 0, `calcularAlertasPnl` devuelve `margenReal = 0` y el KPI muestra "0.0%" junto a una utilidad negativa. (3) El descuadre Costo real (14,500) vs total por concepto (12,500) sugiere conceptos fuera de la tabla (comisiones/impuestos) o filtro distinto entre agregados — requiere revisión de datos, no cosmética.
- **Fix (instrucción para Lovable):** (1) y (2) en UI: placeholder "—" cuando el TC es 0/nulo; margen "n/a" cuando la venta real es 0. (3) Queda como verificación: reconciliar `data.costo.real_mxn` con la suma de `data.por_concepto_costo` en `pnlFinanciero` (misma fuente o nota explicativa del faltante).
- **Diff / código:**

`TabPnl.tsx` — ANTES (línea 156):
```tsx
      <p className="text-xs text-muted-foreground">
        Tipos de cambio del embarque: USD {data.tipo_cambio_usd?.toFixed(4) ?? "—"} · EUR {data.tipo_cambio_eur?.toFixed(4) ?? "—"}
      </p>
```
DESPUÉS:
```tsx
      <p className="text-xs text-muted-foreground">
        {/* UIA-10: TC 0 = no disponible (el servicio cae a ?? 0 en pnlFinanciero) */}
        Tipos de cambio del embarque: USD {data.tipo_cambio_usd && data.tipo_cambio_usd > 0 ? data.tipo_cambio_usd.toFixed(4) : "—"} · EUR {data.tipo_cambio_eur && data.tipo_cambio_eur > 0 ? data.tipo_cambio_eur.toFixed(4) : "—"}
      </p>
```
ANTES (KPI Margen real, línea 86-88):
```tsx
        <KpiCard
          label="Margen real"
          value={pctPnl(margenReal)}
```
DESPUÉS:
```tsx
        <KpiCard
          label="Margen real"
          value={ventaReal > 0 ? pctPnl(margenReal) : "n/a"}
```
- **Tras aplicar, verificar:** embarque sin TC (exchange-rates caído) → "USD — · EUR —"; embarque sin venta real → Margen real "n/a" (sin badge de alerta de margen, que ya está condicionada a `ventaReal > 0` en `pnlAlertas`). Conciliar a mano un embarque: `costo.real_mxn` debe igualar la suma de la tabla por concepto o explicar el faltante.

---

### [UIA-11] Banner demo dice "modo demo como administrador" con cualquier rol
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (login ventas@ → banner "Estás en modo demo como administrador")
- **Archivos:** `src/features/marketing/components/DemoModeBanner.tsx`
- **Problema:** El texto del banner está hardcodeado (línea 19) e ignora el rol efectivo de la sesión; confunde la verificación de permisos por rol y la percepción de identidad.
- **Fix (instrucción para Lovable):** Usar `useAuth().effectiveRole` y la etiqueta canónica `obtenerEtiquetaRol` (ya existe en `roleCatalog.ts`).
- **Diff / código:**

ANTES:
```tsx
import { Sparkles } from "lucide-react";
import { useIsDemoUser } from "@/features/marketing/hooks/useIsDemoUser";

export function DemoModeBanner() {
  const isDemo = useIsDemoUser();
  if (!isDemo) return null;
…
        Estás en <strong>modo demo</strong> como administrador · datos de ejemplo, se reinician en cada acceso.
```
DESPUÉS:
```tsx
import { Sparkles } from "lucide-react";
import { useIsDemoUser } from "@/features/marketing/hooks/useIsDemoUser";
import { useAuth } from "@/lib/contexts/AuthContext";
import { obtenerEtiquetaRol } from "@/features/admin/domain/roles/roleCatalog";

export function DemoModeBanner() {
  const isDemo = useIsDemoUser();
  const { effectiveRole } = useAuth();
  if (!isDemo) return null;
…
        Estás en <strong>modo demo</strong> como {obtenerEtiquetaRol(effectiveRole).toLowerCase()} · datos de ejemplo, se reinician en cada acceso.
```
- **Tras aplicar, verificar:** login como ventas@ → "…como vendedor"; admin@ → "…como administración" (o la etiqueta del catálogo); cuenta sin rol → "—" (revisar que la etiqueta fallback no rompa la frase; en ese caso usar "usuario sin rol").

---

### [UIA-12] `<title>` del documento no se actualiza en rutas de detalle
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (pestaña dice "Libre Carga — Software de carga gratuito en México" en /embarques/:id y /facturacion/:id; las listas sí actualizan)
- **Archivos:** `src/features/embarques/routes/EmbarqueDetalle.tsx`, `src/features/facturacion/routes/FacturaDetalle.tsx`
- **Problema:** Las rutas de detalle no llaman `useDocumentTitle` (sí lo hacen las listas: `Embarques.tsx` línea 30, `Facturacion.tsx` línea 52), así que la pestaña conserva el título del landing de `index.html`. Ambas ya resuelven el folio para el breadcrumb (`useRegisterBreadcrumbLabel`), ideal como título.
- **Fix (instrucción para Lovable):** Llamar `useDocumentTitle` con el folio/ número en cada detalle.
- **Diff / código:**

`EmbarqueDetalle.tsx` — junto a la línea 52 existente:
```ts
  useRegisterBreadcrumbLabel(id, embarque?.expediente);
```
agregar:
```ts
  // UIA-12: la pestaña se distingue por folio (antes quedaba el título del landing).
  useDocumentTitle(embarque?.expediente ? `Embarque ${embarque.expediente}` : "Embarque");
```
`FacturaDetalle.tsx` — junto a la línea 42 existente:
```ts
  useRegisterBreadcrumbLabel(id, factura?.numero);
```
agregar:
```ts
  useDocumentTitle(factura?.numero ? `Factura ${factura.numero}` : "Factura");
```
(import `useDocumentTitle` desde `@/hooks/shared` en ambos).
- **Tras aplicar, verificar:** abrir dos detalles distintos en dos pestañas → títulos "Embarque DEMO-2026-001 · Libre Carga" y "Factura A-TEST-001 · Libre Carga"; al volver a la lista el título se restaura (el hook ya revierte al desmontar).

---

### [UIA-13] Toasts con texto técnico en inglés ("Failed to fetch")
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (Descargar PDF/XML con storage stub → toast "No se pudo abrir el PDF — Failed to fetch")
- **Archivos:** `src/features/facturacion/components/FacturaDownloadButton.tsx` (patrón general UX-02, ver `fixes_UX.md`)
- **Problema:** El `catch` pasa `(err as Error).message` como `description` del toast (líneas 37-40), exponiendo mensajes crudos de red en inglés al usuario final. El detalle técnico ya viaja en `error: err` y es visible en el ErrorDetailsDialog ("Ver detalles"), por lo que no se pierde diagnóstico.
- **Fix (instrucción para Lovable):** Descripción fija en español orientada a acción; el detalle técnico queda sólo en el payload del diálogo de detalles. Aplicar el patrón UX-02 al resto de toasts que interpolen `err.message`.
- **Diff / código:**

ANTES:
```ts
    } catch (err) {
      notifyError(undefined, { title: "No se pudo abrir el archivo",
        description: (err as Error).message, error: err, method: "FEATURES_FACTURACION_COMPONENTS_FACTURADOWNLOADBUTTON_1" });
    }
```
DESPUÉS:
```ts
    } catch (err) {
      // UIA-13: descripción fija en español; el mensaje crudo ("Failed to fetch")
      // queda sólo en el payload de "Ver detalles" (ErrorDetailsDialog).
      notifyError(undefined, { title: "No se pudo abrir el archivo",
        description: "El documento no está disponible en este momento. Intenta de nuevo; si el problema persiste, contacta a soporte.",
        error: err, method: "FEATURES_FACTURACION_COMPONENTS_FACTURADOWNLOADBUTTON_1" });
    }
```
- **Tras aplicar, verificar:** provocar fallo de descarga (storage caído) → toast en español sin texto técnico; "Ver detalles" sigue mostrando el mensaje original copiable.

---

### [UIA-14] Cotizaciones sin vigencia en lista; detalle "Vigencia 7 días (-)"
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (lista sin columna "Vence…" para COT-DEMO-002; detalle "Vigencia: 7 días (-)")
- **Archivos:** `src/features/cotizacion/components/columnsParts/estadoVigenciaCell.tsx`, `src/features/cotizacion/components/detalle/CotizacionDatosGeneralesCard.tsx`
- **Problema:** Dos frentes. (1) `buildVigenciaNode` oculta la vigencia cuando la cotización no está "enviada" y vence a más de 7 días (v13.223.0, densidad visual) — con el efecto de que no se puede priorizar por vencimiento en la lista. (2) El detalle interpola siempre el paréntesis: `` `${c.vigencia_dias} días (${c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "-"})` `` → "7 días (-)" luce roto.
- **Fix (instrucción para Lovable):** (1) Mostrar también la vigencia de cotizaciones "aceptada" (alimenta la revalidación de tarifa); mantener oculta sólo en estados terminales/borrador con vencimiento lejano. (2) Omitir el paréntesis cuando no hay fecha.
- **Diff / código:**

`estadoVigenciaCell.tsx` — ANTES (línea 21):
```ts
  if (!esEnviada && diffDias > 7) return null;
```
DESPUÉS:
```ts
  // UIA-14: la vigencia también importa en "aceptada" (revalidación de tarifa);
  // sólo se oculta fuera de enviada/aceptada y con vencimiento lejano.
  const esAceptada = estado.toLowerCase() === "aceptada";
  if (!esEnviada && !esAceptada && diffDias > 7) return null;
```
`CotizacionDatosGeneralesCard.tsx` — ANTES (línea 40):
```tsx
    { label: "Vigencia", value: `${c.vigencia_dias} días (${c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "-"})` },
```
DESPUÉS:
```tsx
    // UIA-14: sin fecha no se imprime el paréntesis vacío ("7 días (-)" lucía roto).
    { label: "Vigencia", value: c.fecha_vigencia ? `${c.vigencia_dias} días (hasta ${formatDate(c.fecha_vigencia)})` : `${c.vigencia_dias} días` },
```
- **Tras aplicar, verificar:** lista muestra "Vence en Xd · fecha" para cotizaciones enviadas y aceptadas próximas; detalle sin fecha de vigencia muestra "Vigencia: 7 días" a secas; con fecha, "7 días (hasta 22/08/2026)".

---

### [UIA-15] Empty state de búsqueda sin acción
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (buscar "zzzz-no-existe" → "No se encontraron embarques" a secas)
- **Archivos:** `src/features/embarques/routes/Embarques.tsx`
- **Problema:** `ResponsiveDataTable` recibe sólo `emptyMessage="No se encontraron embarques"` (línea 134) y el usuario debe borrar a mano la búsqueda/filtros. La tabla ya soporta `emptyState?: ReactNode` (prop documentada: "Nodo custom para el empty state (CTA accionable)").
- **Fix (instrucción para Lovable):** Reemplazar `emptyMessage` por un `emptyState` con CTA "Limpiar filtros" que restaure búsqueda y filtros a sus defaults del controller.
- **Diff / código:**

ANTES:
```tsx
              <ResponsiveDataTable
                columns={columns}
                data={deferredFiltered}
                isLoading={isLoading}
                emptyMessage="No se encontraron embarques"
```
DESPUÉS:
```tsx
              <ResponsiveDataTable
                columns={columns}
                data={deferredFiltered}
                isLoading={isLoading}
                emptyState={
                  <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                    <span>No se encontraron embarques con la búsqueda o los filtros actuales.</span>
                    <Button variant="outline" size="sm" onClick={limpiarFiltros}>
                      Limpiar filtros
                    </Button>
                  </div>
                }
```
y el handler dentro del componente (defaults según `useEmbarquesPageState`):
```ts
  // UIA-15: salida de un clic del empty state de búsqueda.
  const limpiarFiltros = () => {
    setSearch("");
    setFilterModo("todos");
    setFilterEstado("todos");
    setFilterCliente("todos");
    setFilterOperador("todos");
    setFilterAlerta("todos");
    setFechaDesde("");
    setFechaHasta("");
    setPage(0);
  };
```
(import `Button` de `@/components/ui/button` si no está).
- **Tras aplicar, verificar:** buscar "zzzz-no-existe" → empty state con botón; clic en "Limpiar filtros" → reaparecen los 4 embarques y los chips de filtro se resetean. El empty state de lista vacía real (`EmbarquesEmptyState`, "Aún no tienes embarques") no cambia.

---

### [UIA-16] Convertir cotización → embarque sin CTA descubrible ni expediente
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO ("Crear embarque" crea el Borrador de inmediato con expediente vacío; /embarques/nuevo standalone redirige a /cotizaciones con toast de error; la lista no muestra botón "Nuevo")
- **Archivos:** `src/features/embarques/routes/Embarques.tsx`, `src/features/embarques/routes/NuevoEmbarque.tsx`, `src/features/cotizacion/services/conversiones/embarques.ts` (sólo referencia)
- **Problema:** La política tarifa-first (v13.303.26) eliminó el CTA "Nuevo embarque" hardcodeando `const canCrear = false;` (línea 40), así que el flujo correcto (desde una cotización Aceptada) no es descubrible: quien busca crear un embarque en /embarques no encuentra puerta de entrada. Además la RPC `crear_embarque_borrador_desde_cotizacion` crea el Borrador sin asignar expediente (queda vacío hasta captura posterior).
- **Fix (instrucción para Lovable):** (1) Restaurar un CTA visible "Nuevo embarque" que, en vez de navegar a la ruta bloqueada, explique el prerrequisito y lleve a /cotizaciones (navegación proactiva, no toast de error tras el hecho). (2) El cambio de `goNuevo` mantiene el guard de ruta intacto como defensa. (3) Expediente al crear: es cambio server-side en la RPC — coordinar con el equipo BL; fuera del alcance del freeze de UI (registrar como pendiente).
- **Diff / código:**

`Embarques.tsx` — ANTES (líneas 38-41 y 54):
```ts
  // v13.303.26 — el CTA "Nuevo embarque" desaparece: los embarques sólo se crean
  // desde una cotización Aceptada (política tarifa-first, sin excepciones).
  const canCrear = false;
…
  const goNuevo = () => navigate("/embarques/nuevo");
```
DESPUÉS:
```ts
  // UIA-16: el CTA vuelve a ser visible pero guía al prerrequisito (cotización
  // Aceptada) en lugar de mandar a la ruta bloqueada. La política tarifa-first
  // (v13.303.26) se mantiene: el guard de /embarques/nuevo sigue activo.
  const canCrear = true;
…
  const goNuevo = () => {
    notifyInfo(undefined, {
      title: "Los embarques nacen de una cotización Aceptada",
      description: "Abre la cotización aceptada y usa el botón \"Crear embarque\" de su detalle.",
    });
    navigate("/cotizaciones");
  };
```
(import `notifyInfo` desde `@/lib/ui/appFeedback`). `EmbarquesHeaderActions` y `FloatingActionButton` ya consumen `canEdit={canCrear}`/`onNuevo={goNuevo}` — no requieren cambios. En `EmbarquesEmptyState` el CTA "Crear mi primer embarque" pasa por el mismo `goNuevo` y ahora guía en vez de rebotar.
- **Tras aplicar, verificar:** /embarques muestra "Nuevo Embarque" (desktop) y FAB (móvil); clic → toast informativo + navegación a /cotizaciones. La ruta /embarques/nuevo directa sigue redirigiendo con el aviso existente (defensa). Convertir desde una cotización Aceptada sigue creando el Borrador vía RPC idempotente. Pendiente BL: asignar expediente en `crear_embarque_borrador_desde_cotizacion` al crear.

---

### [UIA-17] Stepper de etapas duplicado en el árbol de accesibilidad (Tracking)
- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (el stepper Propuesta→Cerrado aparece 2 veces en el árbol de accesibilidad: variantes desktop y móvil renderizadas a la vez)
- **Archivos:** `src/features/embarques/components/tracking/FasesEmbarqueStepper.tsx`
- **Problema:** `StepperCompleto` renderiza la variante escritorio (`hidden md:block`, línea 120) y la móvil (`md:hidden`, línea 150) simultáneamente; el ocultamiento es sólo visual (CSS) y ambas permanecen en el árbol de accesibilidad → lectores de pantalla anuncian el stepper dos veces. Ya existe un `progressbar` sr-only (líneas 103-111) que expone el estado accesible.
- **Fix (instrucción para Lovable):** Marcar ambas variantes visuales como `aria-hidden="true"`: el canal accesible canónico pasa a ser el `progressbar` sr-only existente. Así no depende del viewport y elimina la duplicación en cualquier dispositivo.
- **Diff / código:**

ANTES (líneas 120 y 150):
```tsx
      {/* Escritorio: horizontal, con scroll contenido si el ancho aprieta */}
      <div className="hidden md:block overflow-x-auto">
…
      {/* Móvil: vertical */}
      <div className="md:hidden relative">
```
DESPUÉS:
```tsx
      {/* Escritorio: horizontal, con scroll contenido si el ancho aprieta.
          UIA-17: ambas variantes visuales son aria-hidden — el canal accesible
          canónico es el role="progressbar" sr-only de arriba (antes el stepper
          se anunciaba dos veces: desktop + móvil). */}
      <div className="hidden md:block overflow-x-auto" aria-hidden="true">
…
      {/* Móvil: vertical */}
      <div className="md:hidden relative" aria-hidden="true">
```
- **Tras aplicar, verificar:** árbol de accesibilidad del detalle → Tracking muestra el stepper una sola vez (el progressbar sr-only con "— %"); visualmente no cambia nada en desktop ni móvil. El stepper de la tarjeta de Resumen (`EstadoProgresoCard`) comparte el mismo componente y queda cubierto.

---

## Resumen de validación

| ID | Estado | Notas |
|---|---|---|
| UIA-01 | ✔ | Cross-ref FE-01 + delta (guarda submit + alerta ámbar) verificado en `DialogRegistrarPago.tsx`/`…Parts.tsx` |
| UIA-02 | ✔ | Fix en `useTraspasoForm.ts` (default 1→0) + preview condicionado; coordinar guarda server BL-04 |
| UIA-03 | ✔ | Fallback `tc=1` localizado en `resumen.ts:51`; fix excluir+avisar en dominio, KPIs Tesorería y dashboard Facturación |
| UIA-04 | ✔ | `ProtectedRoute` pasa motivo en state; `SinAcceso` renderiza por causa + CTA "Volver al inicio" |
| UIA-05 | ✔ | Cross-ref UX-01 + delta: gate `canAdminTenant` en `TabPuertos.tsx` |
| UIA-06 | ✔ | Guarda fecha futura en diálogo de cobro + aviso inline |
| UIA-07 | ✔ | Recálculo cliente con canon `calcularDiasVencidoFactura` + verificación de RPC desplegada (clamp pre-N9) |
| UIA-08 | ✔ | PENDIENTE staging: fix probable (`silentError` en `useExchangeRates`) + verificación requerida documentada |
| UIA-09 | ✔ | Etiqueta "embarques" cuando el contador es server-side (`computeCounts`) |
| UIA-10 | ✔ | Placeholders "—"/"n/a" en `TabPnl.tsx`; descuadre de agregados queda como verificación de datos |
| UIA-11 | ✔ | Banner usa `effectiveRole` + `obtenerEtiquetaRol` |
| UIA-12 | ✔ | `useDocumentTitle` con folio en ambos detalles |
| UIA-13 | ✔ | Descripción fija en español; detalle técnico sólo en ErrorDetailsDialog |
| UIA-14 | ✔ | Vigencia visible en "aceptada" + paréntesis condicional en detalle |
| UIA-15 | ✔ | `emptyState` con CTA "Limpiar filtros" |
| UIA-16 | ✔ | CTA "Nuevo embarque" restaurado con guía al prerrequisito; expediente al crear = pendiente BL |
| UIA-17 | ✔ | `aria-hidden` en ambas variantes visuales; canal accesible = progressbar sr-only existente |

**Divergencias / notas:**
- **UIA-07:** el código fuente del repo (migración N9 + canon) ya es correcto; el bug dinámico apunta a función desplegada pre-N9 en el entorno auditado. El fix UI defensivo se entrega igualmente; la verificación SQL en staging/prod es obligatoria.
- **UIA-08:** la causa raíz exacta del toast en el stack local no se pudo aislar a un solo origen (FX 501 vs. canal realtime); el fix entregado cubre la vía React Query (donde vive el toast) y se documenta la verificación en staging para el caso realtime.
- **UIA-09:** queda un posible descuadre de datos (columna lista vs detalle de contenedores) que puede ser de fuente de datos, no de etiqueta — se marca para verificación post-fix.
- **UIA-16:** la asignación de expediente al crear el borrador es server-side (RPC) y queda explícitamente fuera del fix de UI (feature freeze) — coordinar con BL.
- Ningún diff fue inventado: todos parten de fragmentos reales leídos del repo en `main @ 1ef05ce9`.
