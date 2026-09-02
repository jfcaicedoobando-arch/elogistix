-- v13.823.50 — Backfill acotado por organización de `crm_actividades.responsable_id`.
-- Idempotente: sólo filas con responsable_id IS NULL; correlación por correo
-- SOLO contra miembros de la MISMA organización (nunca cross-org).
UPDATE public.crm_actividades a
   SET responsable_id = u.id
  FROM auth.users u
  JOIN public.organization_members om
    ON om.user_id = u.id
 WHERE a.responsable_id IS NULL
   AND coalesce(a.responsable_email, '') <> ''
   AND lower(u.email) = lower(a.responsable_email)
   AND om.organization_id = a.organization_id;