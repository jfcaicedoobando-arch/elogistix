# Ola 6 — "Ventas arranca": qué vale la pena

Revisé la base de datos y el código actual. De los 6 puntos, **3 son bugs reales de código** y **3 son trabajo operativo tuyo** (captura, importación, capacitación), no cambios de programa.

## Vale la pena (código)

### 1. O6.2 — La conversión de lead pierde los datos fiscales (P1, confirmado)
La función `convertir_lead_rpc` inserta el cliente con `rfc = ''`, `direccion = ''`, `cp = ''` en duro, aunque el lead **sí** tiene esas columnas (`rfc`, `direccion`, `cp`, más `sector`, `origen`, `destino`).
Efecto: ventas captura el RFC en el lead y alguien lo vuelve a capturar en el cliente. Analogía: llenas el formulario, y al pasar de ventanilla te lo dan en blanco otra vez.
Cambio: propagar `rfc/direccion/cp` al cliente y `sector/origen/destino` a la oportunidad, con test de regresión.

### 2. O6.3 — Configuración del CRM: la UI abre lo que la base rechaza (P1, confirmado)
La ruta y el ícono ya se gatean con `canEditCrm`, pero la política de escritura de `crm_etapas_pipeline` sólo acepta el rol `admin` (y `super_admin`). Un `admin_org` o `gerente_comercial` ve el botón y recibe error de permisos al guardar.
Cambio: alinear la política a `admin` + `admin_org` + `gerente_comercial`, igual que el resto del CRM.

### 3. O6.1 — Leads sin asignar son invisibles para vendedores (P0 de adopción, confirmado)
La política "Vendedor own" exige `vendedor_id = auth.uid()`, así que un lead sin vendedor no lo ve nadie con rol `vendedor`.
Cambio propuesto (bolsa común): política de lectura de leads sin asignar dentro de la organización + RPC `crm_tomar_lead` (valida organización, asigna al usuario, con bloqueo `FOR UPDATE` para que dos vendedores no tomen el mismo) y botón "Tomar lead" en el detalle. Tests: el vendedor ve la bolsa, toma un lead, el otro ya no lo ve; su privacidad de leads propios queda intacta.

## No vale la pena implementar ahora

- **O6.4 Configuración inicial asistida** — todo ya existe en `/crm/configuracion`; es captura manual (cuotas, presupuesto, metas, plantillas).
- **O6.5 Migración del Excel Hunter** — el importador CSV ya existe; es una corrida de datos + verificación, no código nuevo.
- **O6.6 Smoke test + capacitación** — proceso con usuarios reales.

## Propuesta de entrega

Una sola entrega con los 3 fixes de código, en este orden: O6.2 → O6.3 → O6.1 (el último es el más grande porque toca política, RPC y UI).

## Detalles técnicos

- Migración nueva con timestamp para: cuerpo actualizado de `convertir_lead_rpc`, política de `crm_etapas_pipeline`, política de bolsa en `crm_leads` y `crm_tomar_lead` (`SECURITY DEFINER SET search_path TO 'public'`, errores `LC_*`, `GRANT EXECUTE` sólo a `authenticated`, revocado a `anon` para no romper FIX-45).
- Tests SQL nuevos en `supabase/tests/` (`ola6_convertir_propaga.sql`, `ola6_ventas_arranca.sql` en el grupo `operaciones` del workflow de RLS).
- Frontend: botón "Tomar lead" en `LeadHeaderActions.tsx` + hook de mutación; se respetan los límites de 200 líneas por archivo.
- Sincronizar `migration-manifest.json`, bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
