# Fix Pack — Auditoría UI Dinámica Portales Públicos / Landing (UIB-01 a UIB-15)

**Fuente:** `audit_reports/08_ui_dinamica_portales.md` (hallazgos UIB-01 a UIB-15).
**Repo:** main @ 1ef05ce9. Todos los fragmentos fueron copiados del repo real y verificados línea por línea (rutas, líneas y contexto citados abajo).
**Reglas globales:** bajo riesgo, retrocompatible (feature freeze), sin cambios de contratos ni RPCs. Copys de usuario en español (es-MX). Componentes compartidos citados (`LoadingState`, `ErrorState`, `formatDate`, `filtrarEventosVisiblesCliente`) ya existen en el repo.
**Nota de stack:** la auditoría dinámica corrió sobre el stack local (`:9000`) con edge functions stubbeadas (501). Donde el hallazgo depende del stack se marca **verificar en staging**.

---

### [UIB-01] Error crudo en inglés en el modal "Probar demo"

- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (modal demo en `/`; en local el edge `demo-access` responde 501 → "Edge Function returned a non-2xx status code" en el `Alert` y el toast)
- **Archivos:**
  - `src/features/marketing/components/DemoAccessDialog.tsx` (líneas 80-90, bloque `catch`)
  - `src/features/marketing/services/demoAccess.ts` (líneas 28-48, `ejecutarDemoAccess`)
- **Problema:** el `catch` del diálogo muestra `err.message` crudo al usuario (`setError(msg)` y `description: msg`). `functions.invoke` lanza `FunctionsHttpError` cuyo `message` es la cadena genérica en inglés "Edge Function returned a non-2xx status code" (el body real queda en `error.context`). El mismo patrón del repo ya documentado en `facturapiError.ts:47-51` lo confirma. En landing pública es el primer contacto del prospecto con la marca.
- **Fix (instrucción para Lovable):**
  1. En `DemoAccessDialog.tsx` agregar un helper local `mensajeAmigableDemo(err)` que mapee los fallos conocidos a copy propio es-MX (nunca mostrar `err.message` crudo).
  2. En el `catch`, usar el helper para `setError` y para el `description` del toast; el mensaje crudo se conserva en `error: err` (va al diálogo "Ver detalles" y a Sentry, no a la vista).
  3. El texto amable debe cubrir: edge no-2xx/red (reintentar), `permission denied` (registro del lead), y fallback genérico.
- **Diff / código:**

`src/features/marketing/components/DemoAccessDialog.tsx`:

```diff
 export function DemoAccessDialog({ open, onOpenChange }: Props) {
   const navigate = useNavigate();
   const { toast } = useToast();
```

```diff
+/**
+ * UIB-01: nunca mostrar `err.message` crudo en la landing pública — los errores
+ * de `functions.invoke` llegan en inglés ("Edge Function returned a non-2xx
+ * status code"). El mensaje técnico sigue yendo a "Ver detalles"/Sentry vía
+ * `error: err`.
+ */
+function mensajeAmigableDemo(err: unknown): string {
+  const m = (err instanceof Error ? err.message : "").toLowerCase();
+  if (m.includes("non-2xx") || m.includes("failed to fetch") || m.includes("network")) {
+    return "No pudimos abrir la demo en este momento. Intenta de nuevo en unos minutos.";
+  }
+  if (m.includes("permission denied") || m.includes("row-level security")) {
+    return "No pudimos registrar tus datos. Intenta de nuevo o escríbenos a contacto@librecarga.com.";
+  }
+  return "No pudimos abrir la demo. Intenta de nuevo en un momento.";
+}
+
   const handleSubmit = async (e: React.FormEvent) => {
```

```diff
     } catch (err) {
-      const msg = err instanceof Error ? err.message : "Intenta de nuevo en un momento.";
+      const msg = mensajeAmigableDemo(err);
       setError(msg);
       notifyError(undefined, {
         title: "No pudimos abrir la demo",
         description: msg,
         error: err,
         method: "DEMO_ACCESS_DIALOG",
       });
       setLoading(false);
     }
```

- **Tras aplicar, verificar:**
  1. En `/`, abrir "Probar demo", llenar el formulario y enviar con el edge `demo-access` caído (o bloqueado en DevTools → Network) → el `Alert` y el toast muestran el copy es-MX, nunca la cadena en inglés.
  2. Toast "Ver detalles" sigue mostrando el mensaje técnico original (trazabilidad).
  3. En staging (edge real): provocar un fallo 500 de `demo-access` y repetir — **verificar en staging** el body real que llega en `error.context` para afinar el mapeo.

---

### [UIB-02] Login vacío → error crudo en inglés, sin validación de cliente

- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (fuente: "PARCIALMENTE REFUTADAS" sólo para errores de servidor ya traducidos; campos vacíos → inglés crudo ❌). Estático: `LoginForm.tsx:49` usa `noValidate` y `handleLogin` (27-46) llama `signInWithEmail` sin validar; `translateAuthError` (lib/auth/translateAuthError.ts) no tiene caso para credenciales faltantes y cae al `return message` crudo (línea 36)
- **Archivos:**
  - `src/features/auth/components/LoginForm.tsx` (líneas 27-46, 49)
  - `src/lib/auth/translateAuthError.ts` (líneas 5-37)
- **Problema:** con email/contraseña vacíos el form hace submit igual (atributos `required` anulados por `noValidate`), Supabase responde "email and password required" (o similar, en inglés) y se muestra tal cual porque el traductor no lo reconoce.
- **Fix (instrucción para Lovable):**
  1. Validación de cliente ANTES de llamar al servicio: campos vacíos → mensaje es-MX propio, sin ida al servidor.
  2. Defensa en profundidad: agregar el caso al traductor por si otro flujo dispara el mismo error.
- **Diff / código:**

`src/features/auth/components/LoginForm.tsx`:

```diff
   const handleLogin = async (e: React.FormEvent) => {
     e.preventDefault();
+    // UIB-02/UIB-03: validación de cliente — el <form> usa noValidate, así que
+    // los `required` de los inputs no frenan el submit.
+    if (!email.trim() || !password) {
+      setLoginError("Ingresa tu email y tu contraseña.");
+      return;
+    }
     setLoading(true);
     setLoginError(null);
```

`src/lib/auth/translateAuthError.ts`:

```diff
   const m = message.toLowerCase();
 
+  if (m.includes("email and password required") || m.includes("missing email or phone")) {
+    return "Ingresa tu email y tu contraseña.";
+  }
   if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
     return "Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.";
   }
```

- **Tras aplicar, verificar:**
  1. `/login` → clic en "Iniciar sesión" con ambos campos vacíos → "Ingresa tu email y tu contraseña.", sin request de red a `/auth/v1/token` (DevTools).
  2. Sólo email lleno (sin contraseña) → mismo mensaje, sin request.
  3. Credenciales incorrectas reales → sigue saliendo "Email o contraseña incorrectos…" (traducción existente no se rompe).

---

### [UIB-03] Login no valida formato de email; servidor responde genérico engañoso

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (sin validación de formato en cliente). Estático: `LoginForm.tsx:27-46` no valida formato; el input es `type="email"` pero el form lleva `noValidate` (línea 49), así que el browser tampoco valida
- **Archivos:**
  - `src/features/auth/components/LoginForm.tsx` (líneas 27-46, 49, 58-66)
- **Problema:** un email con formato inválido ("juan@", "correo") llega al servidor y la respuesta genérica ("Email o contraseña incorrectos…") induce a pensar que la contraseña está mal, cuando el problema es el email. Feedback engañoso en superficie pública.
- **Fix (instrucción para Lovable):**
  1. En el mismo bloque de validación de UIB-02, validar formato con regex simple (sin dependencias nuevas) y mensaje específico que oriente a corregir el email.
- **Diff / código:**

`src/features/auth/components/LoginForm.tsx`:

```diff
 import { translateAuthError } from "@/lib/auth/translateAuthError";
 import { resolveDeepLinkDestino } from "@/features/auth/utils/deepLink";
 
+// UIB-03: formato mínimo de email (no RFC completo — sólo evitar mandar basura
+// al servidor y recibir el genérico "credenciales incorrectas").
+const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
+
```

```diff
     if (!email.trim() || !password) {
       setLoginError("Ingresa tu email y tu contraseña.");
       return;
     }
+    if (!EMAIL_RE.test(email.trim())) {
+      setLoginError("Escribe un email válido (ej. usuario@empresa.com).");
+      return;
+    }
     setLoading(true);
```

- **Tras aplicar, verificar:**
  1. `/login` con email "juan@" y contraseña cualquiera → "Escribe un email válido…", sin request de red.
  2. Email bien formado con contraseña incorrecta → sigue el flujo normal al servidor.

---

### [UIB-04] Banner "modo demo como administrador" en portales cliente/agente

- **Severidad:** P1 · **Verificación:** CONFIRMADO EN DINÁMICO (banner visible en `/portal*`, `/agente*`, `/tracking/*`). Estático: `DemoModeBanner.tsx:19` hardcodea "como administrador" y "se reinician en cada acceso"; se monta global en `App.tsx:48` para cualquier ruta cuando `useIsDemoUser()` es true
- **Archivos:**
  - `src/features/marketing/components/DemoModeBanner.tsx` (línea 19)
  - `src/App.tsx` (línea 48, montaje global — no se toca)
- **Problema:** el copy afirma un rol ("administrador") que no corresponde a la pantalla que el usuario está viendo (portal cliente / agente / tracking público) — es confuso y mina la confianza. Además promete "se reinician en cada acceso": el docstring de `demoAccess.ts` dice que la edge `demo-access` "reinicia datos", pero en el stack local no se pudo verificar (501) y la auditoría lo marcó como promesa no comprobada — **verificar en staging** si el re-sembrado realmente ocurre.
- **Fix (instrucción para Lovable):**
  1. Quitar la afirmación de rol del copy: el banner es global y no conoce la superficie; un copy neutro es correcto en todas.
  2. Suavizar la promesa de reinicio a un hecho verificable ("datos de ejemplo") mientras se confirma en staging que `demo-access` re-siembra en cada acceso.
- **Diff / código:**

`src/features/marketing/components/DemoModeBanner.tsx`:

```diff
       <Sparkles className="h-4 w-4" aria-hidden="true" />
       <span>
-        Estás en <strong>modo demo</strong> como administrador · datos de ejemplo, se reinician en cada acceso.
+        Estás explorando la <strong>demo</strong> de Libre Carga · todos los datos son de ejemplo.
       </span>
```

- **Tras aplicar, verificar:**
  1. Entrar a la demo desde `/` y navegar `/inicio`, `/portal`, `/agente`, `/tracking/<token>` → el banner muestra el copy neutro en todas.
  2. Usuario no demo → el banner no aparece (comportamiento existente, `useIsDemoUser`).
  3. **Verificar en staging:** entrar dos veces a la demo y confirmar si los cambios hechos en la primera sesión persisten o se reinician; si NO se reinician, el copy ya no promete nada falso (queda cubierto), pero abrir ticket aparte contra la edge `demo-access`.

---

### [UIB-05] PortalPerfil: spinner genérico y error sin retry

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO y estático — `PortalPerfil.tsx:28-41`: `Loader2` centrado sin timeout y en error sólo texto plano "No se pudo cargar tu perfil.", sin botón Reintentar
- **Archivos:**
  - `src/features/portal/routes/PortalPerfil.tsx` (líneas 1-4, 24, 28-42)
- **Problema:** si `usePortalPerfil` falla (red/RLS), el usuario queda en un callejón sin salida: ni skeleton con timeout ni acción de recuperación, aunque el repo ya tiene el patrón estándar `LoadingState` con `onRetry` (usado en `PortalCotizaciones.tsx:54-64` tras R-05) y `ErrorState`. **Referencia cruzada:** es el mismo hallazgo que **UX-05** (ver `fixes_UX.md`); el fix es idéntico, se documenta aquí porque la superficie es el portal cliente.
- **Fix (instrucción para Lovable):**
  1. Reusar `LoadingState` con `error`/`onRetry`/`errorLabel` exactamente como `PortalCotizaciones`.
  2. Tomar `refetch` del hook; eliminar el `Loader2` ya innecesario del import.
- **Diff / código:**

`src/features/portal/routes/PortalPerfil.tsx`:

```diff
 import { useState } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
-import { Loader2, Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
+import { Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
 import { usePortalPerfil } from "@/features/portal/hooks";
+import { LoadingState } from "@/components/shared/states/LoadingState";
```

```diff
-  const { data, isLoading, isError } = usePortalPerfil();
+  const { data, isLoading, isError, refetch } = usePortalPerfil();
   const [editContacto, setEditContacto] = useState(false);
   const [cambiarPass, setCambiarPass] = useState(false);
 
-  if (isLoading) {
-    return (
-      <div className="flex items-center justify-center py-20">
-        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
-      </div>
-    );
-  }
-
-  if (isError || !data) {
+  // UIB-05 / UX-05: mismo patrón R-05 de PortalCotizaciones — spinner con
+  // timeout (15s) y, ante error, estado accionable con "Reintentar".
+  if (isLoading || isError) {
     return (
-      <div className="py-20 text-center text-sm text-muted-foreground">
-        No se pudo cargar tu perfil.
-      </div>
+      <LoadingState
+        error={isError}
+        onRetry={() => void refetch()}
+        errorLabel="No pudimos cargar tu perfil. Revisa tu conexión e intenta de nuevo."
+      />
     );
   }
 
+  if (!data) return null;
+
   const { email, cliente } = data;
```

- **Tras aplicar, verificar:**
  1. `/portal/perfil` con la query forzada a fallar (DevTools offline o bloquear `rest/v1/client_users`) → aparece el estado de error con botón "Reintentar"; al re-conectar y reintentar, carga el perfil.
  2. Carga normal sin cambios (skeleton/spinner con timeout, no spinner perpetuo).
  3. `tsc`/lint del archivo sin símbolos huérfanos (`Loader2`).

---

### [UIB-06] Tracking público muestra código crudo y no tiene navegación de regreso

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (en local la consola muestra +1 error de recurso 501 y la tarjeta muestra `edge_functions_unavailable`; la 501 es **limitación del stack local** → verificar en staging). Estático: `TrackingPublico.tsx:27` pasa `error.message` crudo a la tarjeta; `TrackingPublicoErrorCard.tsx` lo imprime tal cual y no ofrece salida
- **Archivos:**
  - `src/features/auth/routes/TrackingPublico.tsx` (línea 27)
  - `src/features/embarques/components/tracking/TrackingPublicoErrorCard.tsx` (archivo completo, 16 líneas)
  - `src/features/embarques/services/tracking/index.ts` (líneas 45-52, origen del mensaje: `throw new Error(body.error || "Error al cargar tracking")`)
- **Problema:** la edge `tracking-public` devuelve `body.error` con códigos técnicos (`edge_functions_unavailable`, `token_invalid`, etc.) que el servicio lanza como `Error.message` y la tarjeta renderiza literal. Además la pantalla de error no tiene ningún enlace/botón de regreso: el destinatario del tracking (cliente final, externo) queda atrapado.
- **Fix (instrucción para Lovable):**
  1. En `TrackingPublicoErrorCard.tsx` mapear códigos conocidos a copy es-MX (el componente es puro presentacional, el cambio es local y de bajo riesgo).
  2. Agregar un enlace "Volver al inicio" (`react-router-dom` ya está en el árbol de rutas públicas).
  3. No tocar el servicio ni la edge (contrato intacto); el mapeo vive en la capa de presentación.
- **Diff / código:**

`src/features/embarques/components/tracking/TrackingPublicoErrorCard.tsx`:

```diff
 import { Card, CardContent } from "@/components/ui/card";
 import { AlertTriangle } from "lucide-react";
 import { SectionHeading } from "@/components/shared/SectionHeading";
+import { Link } from "react-router-dom";
+
+/**
+ * UIB-06: la edge `tracking-public` devuelve códigos técnicos en `body.error`
+ * (p.ej. `edge_functions_unavailable`). Nunca mostrarlos crudos al destinatario
+ * externo del tracking.
+ */
+function mensajeTrackingAmigable(raw?: string): string {
+  const m = (raw ?? "").toLowerCase();
+  if (!m || m.includes("invalid") || m.includes("expired") || m.includes("not found")) {
+    return "Este enlace de tracking no existe o ha expirado.";
+  }
+  return "El servicio de seguimiento no está disponible en este momento. Intenta de nuevo en unos minutos.";
+}
 
 export function TrackingPublicoErrorCard({ message }: { message?: string }) {
   return (
     <div className="min-h-screen bg-background flex items-center justify-center">
       <Card className="max-w-md w-full mx-4">
         <CardContent className="flex flex-col items-center py-12">
           <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
           <SectionHeading as="h2" className="mb-2">Enlace no disponible</SectionHeading>
           <p className="text-sm text-muted-foreground text-center">
-            {message || "Este enlace de tracking no existe o ha expirado."}
+            {mensajeTrackingAmigable(message)}
           </p>
+          <Link to="/" className="mt-4 text-sm font-medium text-accent hover:underline">
+            Volver al inicio
+          </Link>
         </CardContent>
       </Card>
     </div>
   );
 }
```

- **Tras aplicar, verificar:**
  1. `/tracking/token-inventado` → copy amable + enlace "Volver al inicio" funcional (navega a `/`).
  2. Token válido real → la página de tracking sigue igual (no se tocó el camino feliz).
  3. **Verificar en staging:** con la edge real, provocar token inválido/expirado y caída de la función; confirmar que los `body.error` reales caen en los dos copys del mapeo (ajustar la lista de códigos si la edge usa otros literales — revisar `supabase/functions/tracking-public`).

---

### [UIB-07] `/logo-preview` (QA interno) accesible públicamente sin login

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO ("accesible sin sesión, muestra matriz QA del logo"). Estático: ruta pública en `routes/publicRoutes.tsx:33`; el propio encabezado de `LogoPreview.tsx:6` lo declara "Ruta: /logo-preview (pública, no indexable)"
- **Archivos:**
  - `src/routes/publicRoutes.tsx` (líneas 15, 33)
- **Problema:** una herramienta de QA interna está expuesta en el bundle y dominio públicos. No hay fuga de datos, pero daña la percepción de pulido y amplía la superficie pública. El smoke test de rutas (`routes/__tests__/routes.smoke.test.tsx`) NO exige `/logo-preview`, así que se puede condicionar sin romper tests.
- **Fix (instrucción para Lovable):**
  1. Montar la ruta sólo en builds de desarrollo (`import.meta.env.DEV`). En producción cae al `*` → `NotFound` (la 404 amigable existente).
  2. Mantener el archivo `LogoPreview.tsx` (sigue siendo útil en dev; los tests de arquitectura lo tienen en allowlist de colores).
- **Diff / código:**

`src/routes/publicRoutes.tsx`:

```diff
-    <Route path="/logo-preview" element={<LogoPreview />} />
+    {/* UIB-07: vista QA del logo — sólo en dev; en producción cae al 404. */}
+    {import.meta.env.DEV && <Route path="/logo-preview" element={<LogoPreview />} />}
```

- **Tras aplicar, verificar:**
  1. `bun dev` (o `npm run dev`) → `/logo-preview` sigue funcionando.
  2. `bun run build && bun run preview` → `/logo-preview` muestra la 404 amigable.
  3. `routes.smoke.test.tsx` sigue en verde (no se tocaron las rutas asertadas).

---

### [UIB-08] Legales públicos marcados "Borrador — pendiente de revisión legal"

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO y estático — `Privacidad.tsx` y `Terminos.tsx` renderizan el banner "Borrador — pendiente de revisión legal. Sustituir antes de producción." (ambos, ~línea 28) y el aviso de privacidad carece del domicilio del responsable (obligatorio LFPDPPP art. 16)
- **Archivos:**
  - `src/features/legal/routes/Privacidad.tsx` (banner ~línea 28; sección "1. Responsable" sin domicilio)
  - `src/features/legal/routes/Terminos.tsx` (banner ~línea 28)
  - `src/routes/publicRoutes.tsx` (líneas 34-36 — NO quitar las rutas: `routes.smoke.test.tsx:58-59` las exige y el footer del landing las enlaza)
- **Problema:** los documentos legales publicados se auto-declaran borrador. El aviso de privacidad sin domicilio del responsable es incumplimiento LFPDPPP. **El TEXTO legal definitivo requiere insumo humano (asesoría legal): NO redactar ni "completar" los documentos con texto inventado.** El fix de código es únicamente el mecanismo de gateo.
- **Fix (instrucción para Lovable):**
  1. Crear `src/features/legal/config.ts` con un flag único `LEGAL_CONTENT_APPROVED = false` (un solo lugar para voltear cuando legal entregue los textos finales).
  2. Mientras el flag sea `false`, las páginas `/legal/privacidad` y `/legal/terminos` NO muestran el cuerpo borrador: muestran un aviso neutro "Documento en revisión legal" + contacto. Las rutas permanecen montadas (no romper smoke test ni enlaces del footer).
  3. Mantener el banner de borrador ligado al MISMO flag (desaparece automáticamente al aprobar), no borrarlo a mano.
  4. Cuando legal entregue los textos: sustituir el cuerpo (incluyendo domicilio del responsable en "1. Responsable" — insumo humano) y voltear el flag a `true`.
- **Diff / código:**

Archivo nuevo `src/features/legal/config.ts`:

```ts
/**
 * UIB-08: el contenido legal (aviso de privacidad, términos) es BORRADOR y
 * requiere revisión/aprobación de asesoría legal (insumo humano — el código
 * no lo sustituye). Mientras este flag sea `false`, las páginas /legal/*
 * muestran un aviso "en revisión" SIN el texto borrador. Al recibir los
 * textos aprobados: pegarlos en Privacidad.tsx / Terminos.tsx (incluyendo el
 * domicilio del responsable, obligatorio LFPDPPP) y voltear a `true`.
 */
export const LEGAL_CONTENT_APPROVED = false;
```

`src/features/legal/routes/Privacidad.tsx` (mismo patrón en `Terminos.tsx`):

```diff
 import { Seo } from "@/components/shared/Seo";
 import { Link } from "react-router-dom";
 import { ArrowLeft } from "lucide-react";
 import { BrandLockup } from "@/components/layout/BrandLockup";
+import { LEGAL_CONTENT_APPROVED } from "@/features/legal/config";
```

```diff
         <p className="mt-2 text-sm text-muted-foreground">Última actualización: 4 de junio de 2026</p>
-        <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
-          Borrador — pendiente de revisión legal. Sustituir antes de producción.
-        </p>
 
-        <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground/85">
+        {LEGAL_CONTENT_APPROVED ? (
+        <div className="prose prose-sm mt-8 max-w-none space-y-4 text-foreground/85">
           <h2 className="text-xl font-semibold">1. Responsable</h2>
           … (cuerpo existente, sin cambios — será sustituido por el texto
           aprobado por asesoría legal, incluyendo el domicilio del responsable) …
-        </div>
+        </div>
+        ) : (
+        <div className="mt-8 rounded-lg border border-border bg-muted/40 px-5 py-8 text-center">
+          <p className="text-sm text-foreground">
+            Este documento está en revisión legal y se publicará próximamente.
+          </p>
+          <p className="mt-2 text-xs text-muted-foreground">
+            Para cualquier duda sobre el tratamiento de tus datos, escríbenos a{" "}
+            <a className="text-accent hover:underline" href="mailto:contacto@librecarga.com">
+              contacto@librecarga.com
+            </a>.
+          </p>
+        </div>
+        )}
```

(El diff es esquemático por legibilidad — el cuerpo borrador actual se conserva intacto dentro de la rama `true` para no perder el trabajo previo; Lovable debe envolverlo, no reescribirlo. El banner amarillo de borrador se elimina porque queda sustituido por este gate.)

- **Tras aplicar, verificar:**
  1. `/legal/privacidad` y `/legal/terminos` ya NO muestran "Borrador" ni el texto preliminar; muestran el aviso "en revisión" con mailto funcional.
  2. Los enlaces del footer del landing y del checkbox del `DemoAccessDialog` (`/legal/privacidad`) siguen resolviendo (rutas intactas).
  3. `routes.smoke.test.tsx` en verde.
  4. **Pendiente humano (bloqueante para producción):** texto final aprobado por asesoría legal + domicilio del responsable → voltear `LEGAL_CONTENT_APPROVED = true`.

---

### [UIB-09] Error de carga del portal disfrazado de "cuenta no vinculada"

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (falso positivo). Estático: `PortalLayout.tsx:22-23` — `sinClienteVinculado = !cargandoVinculo && (clientUsers?.length ?? 0) === 0`: cuando la query **falla**, `clientUsers` es `undefined` → se interpreta como "0 empresas" y se muestra `PortalSinCliente` aunque la cuenta sí esté vinculada
- **Archivos:**
  - `src/features/portal/components/PortalLayout.tsx` (líneas 22-23, 55-61)
  - `src/components/shared/states/ErrorState.tsx` (componente estándar ya existente, con "Reintentar")
- **Problema:** un fallo transitorio de red/RLS en `usePortalClientUsers` presenta al cliente la pantalla "Tu cuenta aún no está vinculada a una empresa" — información falsa que le dice que su ejecutivo no lo ha activado. La página no distingue "consulta OK con 0 filas" de "consulta falló".
- **Fix (instrucción para Lovable):**
  1. Excluir el caso error del cálculo de `sinClienteVinculado` (sólo 0 filas **confirmado** cuenta como sin vínculo).
  2. Añadir una rama `errorVinculo` con `ErrorState` + `refetch` antes de la rama `sinClienteVinculado`.
- **Diff / código:**

`src/features/portal/components/PortalLayout.tsx`:

```diff
 import { usePortalClienteName, usePortalOrgName, usePortalClientUsers } from "@/features/portal/hooks";
 import { PortalSinCliente } from "./PortalSinCliente";
+import { ErrorState } from "@/components/shared/states/ErrorState";
```

```diff
-  const { data: clientUsers, isLoading: cargandoVinculo } = usePortalClientUsers();
-  const sinClienteVinculado = !cargandoVinculo && (clientUsers?.length ?? 0) === 0;
+  const {
+    data: clientUsers,
+    isLoading: cargandoVinculo,
+    isError: errorVinculo,
+    refetch: reintentarVinculo,
+  } = usePortalClientUsers();
+  // UIB-09: "sin empresa" sólo cuando la consulta SÍ respondió con 0 filas;
+  // un error de red no puede disfrazarse de cuenta no vinculada.
+  const sinClienteVinculado =
+    !cargandoVinculo && !errorVinculo && (clientUsers?.length ?? 0) === 0;
```

```diff
           {cargandoVinculo ? (
             <ListSkeleton rows={6} />
+          ) : errorVinculo ? (
+            <ErrorState
+              title="No pudimos cargar tu cuenta"
+              description="Revisa tu conexión e intenta de nuevo. Si el problema persiste, contacta a tu ejecutivo."
+              onRetry={() => void reintentarVinculo()}
+              className="my-10"
+            />
           ) : sinClienteVinculado ? (
             <PortalSinCliente email={user?.email} onSignOut={handleSignOut} />
           ) : (
             <Outlet />
           )}
```

- **Tras aplicar, verificar:**
  1. Forzar fallo de `client_users` (DevTools offline o bloqueo de request) y abrir `/portal` → aparece "No pudimos cargar tu cuenta" con Reintentar, NUNCA la pantalla de "no vinculada".
  2. Cuenta realmente sin vínculo (query OK, 0 filas) → sigue apareciendo `PortalSinCliente` (tests `PortalLayout.sinCliente.test.tsx` deben seguir en verde; si el mock no define `isError`, su default `false` mantiene el comportamiento).
  3. Reintentar tras recuperar red → entra al `<Outlet />`.

---

### [UIB-10] Saludo con razón social en MAYÚSCULAS en vez del contacto

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO. Estático: `PortalWelcomeCard.tsx` saluda con `clienteName`, que es `clientes.nombre` (razón social, frecuentemente capturada en mayúsculas: `identity.ts:21` sólo selecciona `clientes(nombre)`); el nombre de la persona existe en `clientes.contacto` (ya seleccionado en `perfil.ts:29`)
- **Archivos:**
  - `src/features/portal/services/identity.ts` (líneas 15-29, `fetchPortalClienteName`)
  - `src/features/portal/hooks/usePortalData.ts` (líneas 99-104, `usePortalClienteName`)
  - `src/features/portal/components/dashboard/PortalWelcomeCard.tsx` (saludo)
  - `src/features/portal/routes/PortalDashboard.tsx` (líneas 29, 56, consumidor)
- **Problema:** el dashboard del portal saluda "¡Hola, EMPRESA EJEMPLO SA DE CV!" — la razón social fiscal en vez de la persona que usa la plataforma; en mayúsculas se percibe como registro contable, no como saludo.
- **Fix (instrucción para Lovable):**
  1. En `identity.ts` agregar `fetchPortalContactoNombre()` (misma consulta, seleccionando `clientes(nombre, contacto)` y devolviendo `contacto`). No tocar `fetchPortalClienteName` (lo usan header/breadcrumbs).
  2. En `usePortalData.ts` agregar `usePortalContactoNombre()` con `queryKeys.portal` — registrar la clave nueva siguiendo el patrón existente (o reusar una clave compuesta existente si el equipo prefiere no tocar `lib/query`).
  3. En `PortalWelcomeCard`: saludar con el primer nombre del contacto cuando exista (`contacto.split(" ")[0]`, Title Case); si no, mantener el comportamiento actual (razón social / "Bienvenido").
- **Diff / código:**

`src/features/portal/services/identity.ts` — DESPUÉS (función nueva, junto a `fetchPortalClienteName`):

```ts
/** UIB-10: nombre de la persona de contacto para el saludo del dashboard. */
export async function fetchPortalContactoNombre(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await unwrap(
    supabase
      .from("client_users")
      .select("cliente_id, clientes(contacto)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  const clientes = fromDb<{ contacto: string | null } | null>(data?.clientes);
  return clientes?.contacto ?? null;
}
```

`src/features/portal/components/dashboard/PortalWelcomeCard.tsx`:

```diff
 interface Props {
   clienteName?: string | null;
+  contactoName?: string | null;
   orgName?: string | null;
 }
 
-export function PortalWelcomeCard({ clienteName, orgName }: Props) {
+export function PortalWelcomeCard({ clienteName, contactoName, orgName }: Props) {
+  // UIB-10: saludar a la persona, no a la razón social fiscal.
+  const primerNombre = contactoName?.trim().split(/\s+/)[0];
+  const saludo = primerNombre
+    ? `¡Hola, ${primerNombre.charAt(0).toUpperCase()}${primerNombre.slice(1).toLowerCase()}!`
+    : clienteName ? `¡Hola, ${clienteName}!` : "Bienvenido";
   return (
     <div className="bg-gradient-to-r from-accent/5 via-accent/3 to-transparent rounded-xl px-5 py-4 border">
       <h1 className="text-xl font-bold tracking-tight">
-        {clienteName ? `¡Hola, ${clienteName}!` : "Bienvenido"}
+        {saludo}
       </h1>
```

`src/features/portal/routes/PortalDashboard.tsx`:

```diff
-  const { data: clienteName } = usePortalClienteName();
+  const { data: clienteName } = usePortalClienteName();
+  const { data: contactoName } = usePortalContactoNombre();
```

```diff
-          <PortalWelcomeCard clienteName={clienteName} orgName={orgName} />
+          <PortalWelcomeCard clienteName={clienteName} contactoName={contactoName} orgName={orgName} />
```

- **Tras aplicar, verificar:**
  1. `/portal` con cliente que tiene `contacto = "Juan Pérez"` → "¡Hola, Juan!" (no la razón social).
  2. Cliente sin `contacto` → fallback al comportamiento anterior (razón social / "Bienvenido").
  3. El header y breadcrumbs del portal siguen mostrando la razón social (correcto ahí).

---

### [UIB-11] Códigos técnicos sin nombre: naviera "MAEU", rutas "CNSHA→MXZLO"

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (portal embarques). Estático: `EmbarqueCard.tsx:54` renderiza `e.naviera` crudo (SCAC); `getOrigen/getDestino` (`lib/formatters/places.ts:4-9`) devuelven el valor de `puerto_origen/destino` tal cual (UN/LOCODE cuando se capturó con `PortSelect`); `PortalEmbarqueResumenTab.tsx:73` y `transporteLabel` en `TrackingPublico.tsx:17-19` repiten el patrón
- **Archivos:**
  - `src/features/portal/components/EmbarqueCard.tsx` (líneas 54, ~93-102: render de carrier y ruta)
  - `src/features/portal/components/embarqueDetalle/PortalEmbarqueResumenTab.tsx` (líneas 71-73)
  - `src/features/auth/routes/TrackingPublico.tsx` (líneas 17-19, 57, 66-67)
  - `src/lib/formatters/places.ts` (líneas 4-9)
  - Catálogos existentes a reusar: `features/catalogos/services/index.ts` (`fetchNavieras` code+name, `fetchPuertos` code+name+country)
- **Problema:** el cliente ve identificadores de industria (SCAC de naviera, UN/LOCODE de puerto) en lugar de nombres legibles. En la DB ya existen catálogos globales `navieras` (code, name) y `puertos` (code, name, country) — el portal no los consulta al renderizar.
- **Fix (instrucción para Lovable):**
  1. Crear `src/lib/formatters/carrierLabels.ts` con un mapa estático de SCAC frecuentes → nombre comercial (MAEU→Maersk, MSCU→MSC, COSU→COSCO Shipping, HLCU→Hapag-Lloyd, EGLV→Evergreen, CMDU→CMA CGM, ONEY→ONE, ZIMU→ZIM) y `labelNaviera(code)` que devuelva `"Nombre (CODE)"` cuando hay mapeo y el código tal cual cuando no. Mapa estático = cero riesgo de RLS y funciona también en la superficie pública de tracking.
  2. Usarlo en `EmbarqueCard` (carrier), `PortalEmbarqueResumenTab` (dd naviera) y `transporteLabel` de `TrackingPublico`.
  3. Para puertos: en el portal autenticado, resolver el LOCODE contra el catálogo `puertos` vía un hook ligero (`usePuertos` ya existe en `features/catalogos/hooks`); fallback: código + `title` con el valor. **Verificar en staging** que el rol `cliente` del portal tiene SELECT por RLS sobre `puertos`; si no lo tiene, dejar como mejora de backend (que las vistas/edge del portal ya devuelvan el nombre) y aplicar en esta ola sólo el paso 1-2.
- **Diff / código:**

Archivo nuevo `src/lib/formatters/carrierLabels.ts`:

```ts
/**
 * UIB-11: etiquetas legibles para códigos de naviera (SCAC) en superficies
 * de cliente. Mapa estático deliberado: sin dependencia de RLS/catálogo y
 * disponible también para el tracking público. Si el código no está mapeado
 * se muestra tal cual (mejor código conocido que silencio).
 */
const SCAC_NAVIERAS: Record<string, string> = {
  MAEU: "Maersk",
  MSCU: "MSC",
  COSU: "COSCO Shipping",
  HLCU: "Hapag-Lloyd",
  EGLV: "Evergreen",
  CMDU: "CMA CGM",
  ONEY: "ONE",
  ZIMU: "ZIM",
};

export function labelNaviera(code: string | null | undefined): string {
  if (!code) return "—";
  const nombre = SCAC_NAVIERAS[code.trim().toUpperCase()];
  return nombre ? `${nombre} (${code.trim().toUpperCase()})` : code;
}
```

`src/features/auth/routes/TrackingPublico.tsx`:

```diff
-import { getOrigen, getDestino } from "@/lib/formatters";
+import { getOrigen, getDestino } from "@/lib/formatters";
+import { labelNaviera } from "@/lib/formatters/carrierLabels";
 
 function transporteLabel(e: TrackingPublicoData["embarque"]): string {
-  return e.naviera || e.aerolinea || e.transportista || "—";
+  // UIB-11: SCAC crudo ("MAEU") → "Maersk (MAEU)"; aéreo/terrestre ya son texto libre.
+  if (e.naviera) return labelNaviera(e.naviera);
+  return e.aerolinea || e.transportista || "—";
 }
```

`src/features/portal/components/EmbarqueCard.tsx`:

```diff
-  const carrier = e.naviera || e.aerolinea || e.transportista;
+  const carrier = e.naviera ? labelNaviera(e.naviera) : (e.aerolinea || e.transportista);
```

(`PortalEmbarqueResumenTab.tsx:73`: mismo reemplazo en el `<dd>` de naviera.)

- **Tras aplicar, verificar:**
  1. Portal → Embarques: tarjeta con naviera MAEU muestra "Maersk (MAEU)"; naviera no mapeada muestra el código (fallback, sin regresión).
  2. `/tracking/<token>` muestra el nombre en "Transporte".
  3. **Verificar en staging:** SELECT de `puertos`/`navieras` con sesión de cliente de portal (RLS) para decidir si el mapeo de puertos LOCODE→nombre se hace en frontend esta ola o queda como ticket de backend.

---

### [UIB-12] Badge "Tracking N" no coincide con los eventos visibles de la línea de tiempo

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (badge "3", línea de tiempo con 1 evento). Estático: `PortalEmbarqueDetalle.tsx:118-120` cuenta `eventos.length` crudo, pero `PortalEmbarqueTimeline.tsx:32-33` renderiza `filtrarEventosVisiblesCliente(eventos)` (sólo hitos de negocio, sin internos — P2-6.4)
- **Archivos:**
  - `src/features/portal/routes/PortalEmbarqueDetalle.tsx` (líneas 13, 116-121, 134-136)
  - `src/features/portal/components/PortalEmbarqueTimeline.tsx` (líneas 31-33, el filtro correcto)
  - `src/features/portal/domain/eventosVisiblesCliente.ts` (filtro puro existente, a importar)
- **Problema:** el contador del tab promete N eventos y la lista muestra menos (los internos/filtrados). Inconsistencia visible que el cliente interpreta como datos perdidos o bug.
- **Fix (instrucción para Lovable):**
  1. Calcular el badge con el MISMO filtro que el timeline (`filtrarEventosVisiblesCliente`), una sola vez antes del `return`, y usarlo en el badge.
- **Diff / código:**

`src/features/portal/routes/PortalEmbarqueDetalle.tsx`:

```diff
 import { PortalEmbarqueStepper } from "@/features/portal/components/embarqueDetalle/PortalEmbarqueStepper";
+import { filtrarEventosVisiblesCliente } from "@/features/portal/domain/eventosVisiblesCliente";
```

```diff
   if (!embarque) {
     return (
       <EmptyState
         icon={Ship}
         title="Embarque no encontrado"
         primaryAction={{ label: "Volver", onClick: volver, variant: "outline" }}
       />
     );
   }
 
+  // UIB-12: el badge del tab debe contar lo mismo que la línea de tiempo
+  // muestra (hitos visibles para el cliente), no los eventos crudos.
+  const eventosVisiblesCount = filtrarEventosVisiblesCliente(eventos).length;
+
```

```diff
           <TabsTrigger value="tracking" className="relative">
             Tracking
-            {eventos.length > 0 && (
-              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-2xs px-1.5 font-bold">{eventos.length}</span>
+            {eventosVisiblesCount > 0 && (
+              <span className="ml-1.5 rounded-full bg-accent/10 text-accent text-2xs px-1.5 font-bold">{eventosVisiblesCount}</span>
             )}
           </TabsTrigger>
```

- **Tras aplicar, verificar:**
  1. Detalle de embarque con eventos mixtos (hitos + internos/seed) → el número del badge coincide exactamente con las filas de la línea de tiempo.
  2. Embarque con sólo eventos internos → el badge desaparece y el tab muestra el empty state "No hay eventos registrados aún." (ya existente).

---

### [UIB-13] Cotización "Solicitada" muestra "MXN 0.00" prominente

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO (`/portal/cotizaciones`). Estático: `PortalCotizacionCard.tsx:45-48` — sin conceptos parseables, `totalLista = Number(c.subtotal ?? 0)`; una solicitud recién creada no tiene conceptos ni subtotal → `formatCurrency(0, "MXN")` en negrita (líneas 126-128)
- **Archivos:**
  - `src/features/portal/components/PortalCotizacionCard.tsx` (líneas 45-48, 126-128)
- **Problema:** una cotización en estado "Solicitada" aún no tiene precio, pero la tarjeta destaca "MXN 0.00" — el cliente puede leerlo como "gratis" o como error de cálculo.
- **Fix (instrucción para Lovable):**
  1. Cuando el total derivado sea 0 (sin conceptos y sin subtotal), mostrar la etiqueta neutral "Por cotizar" en vez del monto. El cambio es presentacional y cubre cualquier estado sin importe aún (no hay que acoplarlo al literal del estado).
- **Diff / código:**

`src/features/portal/components/PortalCotizacionCard.tsx`:

```diff
           <p className="text-sm font-bold tabular-nums shrink-0 text-right min-w-[110px]">
-            {formatCurrency(totalLista, c.moneda)}
+            {/* UIB-13: una solicitud sin conceptos no vale "MXN 0.00" — está por cotizar. */}
+            {totalLista > 0 ? (
+              formatCurrency(totalLista, c.moneda)
+            ) : (
+              <span className="text-xs font-medium text-muted-foreground">Por cotizar</span>
+            )}
           </p>
```

- **Tras aplicar, verificar:**
  1. Solicitar una cotización nueva desde el portal → la tarjeta muestra "Por cotizar" en lugar de "MXN 0.00".
  2. Cotización con conceptos (Enviada/Aceptada) → sigue mostrando el total con moneda (B-099 intacto).
  3. Detalle de la cotización (`/portal/cotizaciones/:id`) sin cambios.

---

### [UIB-14] Vigencias de tarifas en formato ISO en `/agente/tarifas`

- **Severidad:** P3 · **Verificación:** CONFIRMADO EN DINÁMICO. Estático: `agenteTarifasColumns.tsx:117` interpola `vigente_desde`/`vigente_hasta` crudos ("2026-06-01 → 2026-09-01") mientras el resto de la app usa `formatDate` dd/MM/yy (p.ej. `EmbarqueCard.tsx` con `"dd/MM/yy"`)
- **Archivos:**
  - `src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx` (líneas 14, 111-118)
- **Problema:** inconsistencia de formato de fecha en superficie de agente: ISO crudo vs. el formato corto local usado en todo el producto. Ruido visual y menor legibilidad (ISO confunde día/mes a usuarios es-MX).
- **Fix (instrucción para Lovable):**
  1. Formatear la celda con `formatDate` (ya exportado desde `@/lib/formatters`; maneja vacío → "-" y parseo seguro).
- **Diff / código:**

`src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx`:

```diff
 import { formatNumber } from "@/lib/formatters/numbers";
+import { formatDate } from "@/lib/formatters";
```

```diff
       meta: { className: "text-xs text-muted-foreground" },
-      cell: ({ row }) => `${row.original.vigente_desde} → ${row.original.vigente_hasta}`,
+      // UIB-14: mismo formato corto que el resto de la app (dd/MM/yy), no ISO crudo.
+      cell: ({ row }) =>
+        `${formatDate(row.original.vigente_desde, "dd/MM/yy")} → ${formatDate(row.original.vigente_hasta, "dd/MM/yy")}`,
     },
```

- **Tras aplicar, verificar:**
  1. `/agente/tarifas` → la columna Vigencia muestra p.ej. "01/06/26 → 01/09/26".
  2. El ordenamiento de la columna sigue funcionando (usa `accessorFn`/`sortByDate` sobre el valor crudo — no se toca).
  3. El form de duplicar/editar recibe los valores ISO originales vía `toInitial` (no se toca).

---

### [UIB-15] Patrón transversal: `error.message` crudo del backend en formularios públicos

- **Severidad:** P2 · **Verificación:** CONFIRMADO EN DINÁMICO (p.ej. "permission denied for table demo_leads" visible). **Referencia cruzada:** es la clase pública del patrón **UX-02** (`error.message` crudo) — el fix estructural y el inventario completo de call sites internos vive en `fixes_UX.md` [UX-02]; aquí se cubren únicamente los archivos de superficie PÚBLICA
- **Archivos:** (superficie pública)
  - `src/features/marketing/components/DemoAccessDialog.tsx` (línea 81 — **cubierto por UIB-01**, mismo diff)
  - `src/features/marketing/services/demoLeads.ts` (línea 34 — `throw new Error(error.message)` propaga el crudo de PostgREST)
  - `src/features/auth/routes/TrackingPublico.tsx` (línea 27 — **cubierto por UIB-06**, el mapeo vive en `TrackingPublicoErrorCard`)
  - `src/features/auth/routes/Unsubscribe.tsx` (línea 54 — `setErrorMsg((e as Error).message)`)
  - `src/lib/auth/translateAuthError.ts` (línea 36 — `return message` como fallback crudo; parcialmente cubierto por UIB-02/03)
- **Problema:** en superficies sin sesión, el mensaje de error del backend (PostgREST/edge/Auth) llega crudo al usuario final: jerga en inglés, nombres de tablas y códigos internos. Es el hallazgo transversal detrás de UIB-01/02/06 y aplica también a `Unsubscribe`.
- **Fix (instrucción para Lovable):**
  1. **UIB-01 (DemoAccessDialog) y UIB-06 (TrackingPublico) ya resuelven sus call sites** — no duplicar trabajo; este hallazgo sólo agrega los puntos restantes.
  2. `Unsubscribe.tsx`: sustituir el mensaje crudo por copy fijo es-MX en el estado `error` (el detalle técnico no aporta nada al destinatario de un correo de baja).
  3. `translateAuthError.ts`: el fallback final NO debe devolver el mensaje crudo; devolver un genérico es-MX (el crudo sigue disponible en consola/Sentry por los call sites que pasan `error`). Ojo: hay tests que pueden asertar el passthrough — revisar `lib/auth/__tests__` y ajustar expectativas.
  4. `demoLeads.ts`: lanzar el error con un mensaje propio y adjuntar el crudo como `cause` para diagnóstico.
- **Diff / código:**

`src/features/auth/routes/Unsubscribe.tsx`:

```diff
     } catch (e) {
-      setErrorMsg((e as Error).message);
+      // UIB-15 (UX-02): superficie pública — nunca error.message crudo.
+      console.error("[unsubscribe]", e);
+      setErrorMsg("No pudimos procesar la baja. Intenta de nuevo en unos minutos.");
       setStatus("error");
     }
```

`src/lib/auth/translateAuthError.ts`:

```diff
   if (m.includes("token has expired") || m.includes("invalid token")) {
     return "El enlace expiró o no es válido. Solicita uno nuevo.";
   }
-  return message;
+  // UIB-15 (UX-02): nunca devolver el mensaje crudo del backend a la vista.
+  return "Ocurrió un error inesperado. Intenta de nuevo.";
 }
```

`src/features/marketing/services/demoLeads.ts`:

```diff
-  if (error) throw new Error(error.message);
+  // UIB-15: el crudo de PostgREST (p.ej. "permission denied for table
+  // demo_leads") va como `cause` para diagnóstico, no al usuario.
+  if (error) {
+    throw new Error("No pudimos registrar tus datos de contacto.", { cause: error });
+  }
```

- **Tras aplicar, verificar:**
  1. `/unsubscribe?token=…` con la edge fallando → copy es-MX, sin `error.message` en pantalla.
  2. Forzar `permission denied` en `demo_leads` (o bloquear la request) → el modal demo muestra el copy de UIB-01; `error.cause` conserva el detalle (visible en "Ver detalles"/Sentry, no en la vista).
  3. Correr los tests de `translateAuthError` y ajustar el caso de fallback si asertaba passthrough.
  4. **Verificar en staging** (stack local con edges 501): repetir los flujos contra las funciones reales y confirmar que ningún `body.error` nuevo se cuela crudo; si aparecen literales nuevos, extender los mapeos de UIB-01/UIB-06.

---

## Resumen de validación

| ID | Verificado en repo (archivos clave leídos) | Tipo de fix |
|---|---|---|
| UIB-01 | `DemoAccessDialog.tsx:80-90`, `demoAccess.ts`, patrón `facturapiError.ts` | Diff unificado |
| UIB-02 | `LoginForm.tsx:27-49`, `translateAuthError.ts:5-37` | Diff unificado |
| UIB-03 | `LoginForm.tsx:27-66` (`noValidate` confirma falta de validación) | Diff unificado |
| UIB-04 | `DemoModeBanner.tsx:19`, `App.tsx:48`, `demoAccess.ts` (docstring reinicio) | Diff unificado + verificar en staging |
| UIB-05 | `PortalPerfil.tsx:24-42`, patrón `LoadingState` de `PortalCotizaciones.tsx:54-64` | Diff unificado (x-ref UX-05) |
| UIB-06 | `TrackingPublico.tsx:27`, `TrackingPublicoErrorCard.tsx`, `tracking/index.ts:45-52` | Diff unificado + verificar en staging (501 local) |
| UIB-07 | `publicRoutes.tsx:33`, `LogoPreview.tsx:6`, smoke test no lo exige | Diff unificado |
| UIB-08 | `Privacidad.tsx`, `Terminos.tsx` (banner borrador), smoke test exige rutas | Flag de config + gate de contenido; texto legal = insumo humano |
| UIB-09 | `PortalLayout.tsx:22-23, 55-61`, `ErrorState.tsx` existente | Diff unificado |
| UIB-10 | `PortalWelcomeCard.tsx`, `identity.ts:15-29`, `perfil.ts:29` (campo `contacto` existe) | Diffs + función nueva |
| UIB-11 | `EmbarqueCard.tsx:54`, `places.ts:4-9`, catálogos `navieras`/`puertos` existentes | Helper nuevo estático + verificar RLS en staging |
| UIB-12 | `PortalEmbarqueDetalle.tsx:116-121`, `PortalEmbarqueTimeline.tsx:32-33`, `eventosVisiblesCliente.ts` | Diff unificado |
| UIB-13 | `PortalCotizacionCard.tsx:45-48, 126-128` | Diff unificado |
| UIB-14 | `agenteTarifasColumns.tsx:14, 111-118`, `formatDate` en `lib/formatters/dates.ts` | Diff unificado |
| UIB-15 | `DemoAccessDialog.tsx:81`, `demoLeads.ts:34`, `TrackingPublico.tsx:27`, `Unsubscribe.tsx:54`, `translateAuthError.ts:36` | X-ref UX-02 + diffs en archivos públicos |

**Total: 15/15 IDs cubiertos.** Sin divergencias respecto a la fuente. Dependencias del stack local (edge 501 en `demo-access` y `tracking-public`; RLS de catálogos para el rol cliente; re-sembrado real de la demo) quedan marcadas explícitamente como **verificar en staging** dentro de cada hallazgo.
