# Plan: Preparar Libre Carga para adquisición de clientes

Voy a auditar el flujo, capturar el teléfono (y nombre/empresa) antes de entrar al demo, verificar el signup real, y dejar un checklist accionable antes de meter presupuesto en ads.

## 1. Captura de lead antes del demo (lo más importante)

Hoy el botón "Probar demo" hace `enterDemoMode()` directo y entra a `/inicio`. Sin datos, no podemos hacer follow-up ni medir ROI de ads.

**Cambios:**
- Nuevo `DemoAccessDialog` (Radix Dialog) que se abre al pulsar `ProbarDemoButton` en lugar de entrar directo.
- Campos: **Nombre**, **Empresa**, **Email de trabajo**, **Teléfono (MX + país)**, checkbox de aviso de privacidad.
- Validación con `zod` (email válido, teléfono con `libphonenumber-js/min` que ya usamos en `src/lib/formatters/phone.ts`, empresa 2–120 chars).
- Nueva tabla `demo_leads` en Lovable Cloud:
  - `id`, `nombre`, `empresa`, `email`, `telefono_e164`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `referrer`, `landing_path`, `user_agent`, `created_at`.
  - RLS: `INSERT` público (rol `anon`), `SELECT` sólo `super_admin`. GRANT explícito a `anon` (insert) y `authenticated`/`service_role`.
- Servicio `createDemoLead()` que inserta el lead antes de llamar a `enterDemoMode()`.
- Persistir UTM params en `sessionStorage` desde `LandingNav`/`Landing` (leer `window.location.search`) para atribuir el lead a la campaña de ads.
- Vista `/admin/demo-leads` (sólo super_admin) para revisar leads y exportar CSV.

**Nota**: el email/teléfono NO se validan por SMS todavía (fuera de alcance de esta ronda); es captura de lead para outbound comercial. Si más adelante quieres verificación real, se puede sumar Twilio (ya está documentado como conector).

## 2. Auditoría del signup real

El signup actual (`SignupForm.tsx` → `signUpWithEmail`) tiene:
- ✅ Nombre, empresa, email, contraseña + confirmación, aceptación de términos.
- ✅ Redirect a `/onboarding` tras confirmar email (trigger BD crea org + membership admin).
- ⚠️ **No pide teléfono** — lo agregamos como campo opcional-pero-recomendado para poder llamar a leads calientes.
- ⚠️ El mensaje "Revisa tu correo para confirmar" asume que el email de confirmación está configurado. Verifico que el dominio de email transaccional esté activo con `email_domain--check_email_domain_status`. Si no lo está, lo documento como bloqueador para ads.
- ⚠️ El signup depende del trigger `handle_new_user_signup` en BD (crea org desde `company_name` metadata). Hago una prueba end-to-end real con Playwright: registrar cuenta nueva → confirmar → aterrizar en `/onboarding` → completar → llegar a `/inicio`.

**Fixes probables durante la verificación:**
- Añadir campo `telefono` opcional al `SignupForm` (guardar en `user_metadata` y propagar a `organizaciones.telefono` via trigger si existe la columna, si no la agrego).
- Traducir errores comunes de Supabase Auth ("User already registered", "rate limit") — ya existe `translateAuthError`, confirmo cobertura.

## 3. Auditoría de landing (SEO + conversión)

Reviso las 12 secciones (`LandingHero`, `LandingDemo`, `LandingModulos`, etc.) contra un checklist de conversión y SEO. Correcciones esperadas (sólo presentación, sin tocar business logic):

**Conversión:**
- Hero: el CTA secundario "Probar demo" ahora abre el diálogo con captura (punto 1).
- `MobileStickyCta`: verificar que sea visible en 343px (viewport actual) y no tape contenido.
- Agregar un bloque de **testimonios / logos reales** si tienes; hoy `PROOF_LOGOS` son placeholders — si no hay logos reales, cambio el copy a "Diseñado con feedback de agentes en Manzanillo, Veracruz y AICM" para no mentir.
- Sección de **precio** (`LandingPrecio`): confirmar que tenga precio o "Solicita demo" claro, y CTA a signup.

**SEO (para que los ads no compitan contra un site débil):**
- Correr `seo_chat--trigger_scan` sobre `librecarga.com` para obtener findings frescos.
- Revisar `index.html` (title, description, og:*), `robots.txt`, `sitemap.xml`, canonicals.
- Aplicar los fixes que reporte el scanner en las secciones `<head>` sin tocar lógica.

**Analítica (imprescindible antes de ads):**
- Verificar si hay pixel/analytics instalado. Si no, agregar **Google Analytics 4** (GA4) y **Meta Pixel** con eventos:
  - `page_view` (todas)
  - `demo_lead_submitted` (al enviar el diálogo del demo)
  - `sign_up_started` / `sign_up_completed`
  - `onboarding_completed`
- Sin estos eventos NO se puede optimizar campañas de Google/Meta Ads — es el bloqueador #1 para spend.

## 4. Onboarding

Actual (`Onboarding.tsx`) pide RFC + dirección + moneda. Está bien pero:
- Añadir campo **teléfono** de la organización (opcional) para follow-up comercial.
- Aclarar en el header que estos datos aparecen en facturas/proformas, para reducir la fricción de pedir RFC tan pronto.
- Agregar link "Configurar después" que marque `onboarding_completado = true` con datos mínimos (sólo moneda) y permita entrar a `/inicio`. Hoy si un usuario no tiene RFC listo, se queda bloqueado.

## 5. Checklist pre-ads (entregable final en Markdown)

Al terminar, actualizo `CHANGELOG.md` (bump `APP_VERSION`) y creo `docs/pre-ads-checklist.md` con el semáforo:
- 🟢 Listo | 🟡 Recomendado | 🔴 Bloqueador
- Cubre: captura de lead, email transaccional funcionando, GA4/Meta Pixel, política de privacidad completa (`/legal/privacidad`), términos, tiempo de carga (Lighthouse), landing responsive 320–1920, signup e2e ok.

## Detalles técnicos

- **Stack**: sin cambios de dependencias (usamos `zod`, `libphonenumber-js`, `@radix-ui/react-dialog` ya presentes).
- **BD**: 1 migración con `CREATE TABLE demo_leads` + GRANTs + RLS (INSERT anon, SELECT super_admin).
- **Archivos nuevos**:
  - `src/features/marketing/components/DemoAccessDialog.tsx`
  - `src/features/marketing/services/demoLeads.ts`
  - `src/features/marketing/hooks/useUtmParams.ts`
  - `src/features/admin/routes/DemoLeadsList.tsx` (+ ruta admin)
  - `docs/pre-ads-checklist.md`
- **Archivos tocados**:
  - `ProbarDemoButton.tsx` (abre diálogo en vez de entrar directo)
  - `SignupForm.tsx` (+ teléfono opcional)
  - `Onboarding.tsx` (+ teléfono opcional, botón "configurar después")
  - `index.html` / secciones de landing (SEO fixes según scan)
  - `CHANGELOG.md` + `src/constants/appVersion.ts`

## Verificación

1. `bun run test:fast` (unit).
2. Playwright headless: flujo demo con captura → flujo signup → onboarding → inicio.
3. `seo_chat--trigger_scan` post-fix.
4. Build de producción y checar bundle.

## Respuesta directa a tus preguntas

- **¿Sirve el signup?** Lo verifico end-to-end como parte de esta ronda; hoy el código se ve correcto pero depende del email transaccional (lo checo) y del trigger BD (existe según memoria del proyecto).
- **¿Podemos empezar a gastar en ads?** Todavía no con seguridad: faltan captura de lead + analytics (GA4/Meta Pixel) + confirmación de email transaccional. Con este plan quedan cubiertos en una sola ronda.
