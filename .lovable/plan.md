# Ola 7 — "Vendedor productivo": qué vale la pena

Revisé el diff y el estado real del CRM en el proyecto. Hay cosas que ya existen, cosas que son bugs reales y cosas que son módulos nuevos grandes que conviene aplazar.

## Vale la pena ahora (Entrega 1)

**O7.7 · Conversión de prospecto transaccional (bug real)**
Hoy `propagarConversionProspectoCRM` hace tres escrituras sueltas: actualiza la oportunidad, marca el lead como Convertido y registra bitácora. Si falla la segunda, queda un cliente creado con el lead sin convertir (estado inconsistente que después obliga a corregir a mano). Se envuelve en una RPC `SECURITY DEFINER` con validación de organización, igual que `crm_vincular_cotizacion`.

**O7.4 · Auto-registro de actividad al contactar**
`PlantillaSelector` abre mailto/WhatsApp y sólo escribe bitácora. La actividad no queda en `crm_actividades`, así que las métricas y el leaderboard subestiman el trabajo del vendedor. Se registrará una actividad (llamada/email) con resultado pendiente y un recordatorio de seguimiento.

**O7.8 · Leaderboard etiquetado**
Cuando el RLS filtra al vendedor, el "Leaderboard del mes" muestra una sola fila y parece roto. Se cambiará el título a "Tu desempeño" cuando sólo hay datos propios.

**O7.6 · Export CSV de leads y oportunidades**
Ya existe importación CSV de leads, pero no exportación. Se agrega export del listado filtrado (respeta RLS: sólo se exporta lo que el usuario puede ver).

## Vale la pena, pero como entrega aparte

**O7.1 · Recordatorios de actividades vencidas por correo**
Es el punto de mayor impacto en disciplina, pero necesita cron + edge function + plantilla + escalado al gerente. Ya hay infraestructura de correo (`process-email-queue`, `send-transactional-email`) y de cron (`cxc-recordatorios`), así que es reutilizable. Lo propongo como Entrega 2.

## No lo haría en esta ola

- **O7.2 Adjuntos CRM** y **O7.3 Contactos múltiples**: son módulos nuevos completos (tabla, bucket, políticas, UI). No hay dolor reportado hoy y suman superficie de seguridad; mejor después de que el CRM esté en uso real.
- **O7.5 Empty states / onboarding**: ya usan `EmptyStateInline` en todo el CRM y ya existe el diálogo de importación CSV; el valor extra es marginal.

## Detalles técnicos

- Nueva RPC `crm_propagar_conversion_cliente(_oportunidad_id, _cliente_id, _cliente_nombre)`, `SECURITY DEFINER SET search_path TO 'public'`, valida `organization_id` y usa códigos `LC_*` ya existentes; test de regresión en `supabase/tests/`.
- `propagarConversion.ts` pasa a llamar la RPC; se ajusta su test existente.
- `PlantillaSelector` inserta en `crm_actividades` (tipo según canal, `resultado` nulo, `fecha_programada` +2 días) sin bloquear la apertura del mailto.
- Export CSV con el helper de formateo existente y fechas `DD/MM/YYYY`, montos MXN.
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION`.
