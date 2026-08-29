# Checklist pre-ads · Libre Carga

Objetivo: dejar los cimientos para poder empezar a invertir en Google Ads y Meta Ads con confianza de que:

1. Cada visitante que llega convierta o se registre como lead.
2. Podamos medir qué campaña / anuncio genera cada lead (atribución).
3. Los flujos de signup y demo funcionan de punta a punta.

Leyenda: 🟢 Listo · 🟡 Recomendado · 🔴 Bloqueador para gastar en ads

> Última revisión: 2026-08-29 (v13.795.0). Los 🔴 (GA4 y Meta Pixel) siguen abiertos: requieren los IDs del cliente.

---

## Captura de leads
- 🟢 Diálogo "Probar demo" pide **nombre, empresa, email y teléfono** antes de entrar.
- 🟢 Tabla `demo_leads` en Lovable Cloud con RLS (insert público, lectura sólo super_admin).
- 🟢 Bandeja `/admin/demo-leads` con exportación CSV.
- 🟢 UTM params y referrer capturados desde la landing (sessionStorage → BD).
- 🟢 Campo teléfono opcional agregado al signup normal.

## Analítica y píxeles (🔴 bloqueador)
- 🔴 **Google Analytics 4** no está instalado. Sin esto, Google Ads no puede optimizar. Necesito tu ID de medición (formato `G-XXXXXXXXXX`).
- 🔴 **Meta Pixel** no está instalado. Sin esto, Facebook/Instagram Ads no puede optimizar. Necesito tu Pixel ID.
- 🟡 Recomendado: **Google Tag Manager** en su lugar, para agregar/quitar pixeles sin redeploy.
- 🟡 Eventos de conversión a instrumentar cuando llegue el pixel:
  - `demo_lead_submitted` (envío del diálogo de demo)
  - `sign_up_started` / `sign_up_completed` (crear cuenta)
  - `onboarding_completed` (RFC/dirección guardados)

## Landing y SEO
- 🟢 Landing es responsive y tiene FAQ con JSON-LD.
- 🟢 SEO scan disparado en este release (revisar resultados en la pestaña SEO).
- 🟡 Placeholders en la sección de "prueba social" (`PROOF_LOGOS`) — sustituir por logos de clientes reales o cambiar el copy a algo verificable.
- 🟡 Verificar que `og:image` publicado se ve bien al compartir en WhatsApp/LinkedIn.

## Signup y onboarding
- 🟢 Signup pide nombre, empresa, email, contraseña, teléfono (opcional).
- 🟡 **Confirmar que el email de bienvenida funciona en producción** con dominio verificado (revisar en Cloud → email settings). Si Supabase envía desde su dominio genérico, muchos lo marcan como spam.
- 🟡 Onboarding requiere RFC + dirección + moneda. Recomendado: permitir "configurar después" (necesita cambio de RPC `complete_onboarding`) para no bloquear a quienes exploran sin datos fiscales a la mano.

## Legal
- 🟢 Aviso de privacidad, términos, seguridad publicados en `/legal/*`.
- 🟡 Revisar que el aviso de privacidad mencione la captura de teléfono y el uso comercial de los datos (WhatsApp/email de follow-up).

## Performance
- 🟡 Correr Lighthouse en la URL publicada — meta: LCP < 2.5s en 4G.
- 🟡 Confirmar que las imágenes del hero están optimizadas y con `loading="lazy"` donde aplica.

---

## Antes de encender el primer ad, verifica
1. Instalar GA4 + Meta Pixel (envíame los IDs).
2. Confirmar que los emails transaccionales llegan a Gmail/Outlook sin ir a spam.
3. Hacer un signup real end-to-end desde el celular.
4. Definir presupuesto/día máximo en cada plataforma (recomiendo empezar con 100–200 MXN/día en Meta y 200 MXN/día en Google Search sobre keywords como "software agente de carga", "sistema para forwarder", etc.).
5. Landing pages específicas por campaña (opcional para v1, útil para v2).

## URLs útiles
- Landing: https://librecarga.com/
- Signup: https://librecarga.com/login?tab=signup
- Portal admin (leads): https://librecarga.com/admin/demo-leads
