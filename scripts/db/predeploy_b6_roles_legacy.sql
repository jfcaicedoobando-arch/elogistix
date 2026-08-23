-- ============================================================================
-- PRE-DEPLOY · FIX B-6 (Ola 8, hallazgo H2) — usuarios legacy con rol
-- financiero sólo en user_roles y SIN membresía equivalente.
-- ============================================================================
-- Contexto: desde la Ola 8 (20260821153354 + replay 20260827080020, corregidos
-- por 20260827090060_fix_b6_pilotos_listas_explicitas.sql), las RPCs
--   · registrar_pago_proveedor_lote
--   · registrar_pago_cliente_lote
--   · eliminar_pago_proveedor
-- autorizan por MEMBRESÍA en la organización del documento
-- (organization_members) y ya no por el rol global en user_roles.
--
-- Riesgo: un usuario con rol financiero en user_roles pero sin fila (o con rol
-- más bajo) en organization_members operaba antes y recibirá
-- LC_LOTE_SIN_ROL / LC_COBRO_LOTE_SIN_ROL / LC_PAGO_SIN_PERMISO tras el deploy.
--
-- CÓMO CORRERLA (antes del deploy, contra producción):
--   psql "$SUPABASE_DB_URL" -f scripts/db/predeploy_b6_roles_legacy.sql
--
-- CÓMO INTERPRETARLA:
--   · 0 filas  → no hay divergencia; el deploy no bloquea a nadie. Archiva la
--                evidencia (fecha + resultado) en el ticket del release.
--   · N filas  → cada fila es un usuario que HOY opera con su rol de
--                user_roles y quedará bloqueado. Saneamiento ANTES del deploy:
--                dar de alta/corregir su membresía en organization_members con
--                el rol financiero correcto (el trigger
--                _sync_user_roles_desde_membership mantiene el espejo), o
--                quitar el rol huérfano de user_roles si ya no debe operar.
--                Re-corre esta query hasta obtener 0 filas.
--
-- Nota: la lista de la izquierda (user_roles) es la unión de las listas
-- EXACTAS de los 3 pilotos; la de la derecha incluye además
-- auxiliar_contable porque una membresía de auxiliar ya sincroniza user_roles
-- vía el espejo canónico (membresía → user_roles), así que esos usuarios no
-- dependen del rol global. query tomada del hallazgo H2 del review
-- (output/review/review_ola678_crm_roles.md).
-- ============================================================================

SELECT ur.user_id,
       ur.role AS rol_en_user_roles,
       (SELECT om.role
          FROM organization_members om
         WHERE om.user_id = ur.user_id
         ORDER BY om.created_at
         LIMIT 1) AS rol_en_membresia
FROM user_roles ur
WHERE ur.role IN ('admin','admin_org','contador','tesorero','ejecutivo_cobranza')
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = ur.user_id
      AND om.role IN ('admin','admin_org','contador','auxiliar_contable','tesorero','ejecutivo_cobranza'));
