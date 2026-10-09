-- Current body mirror. Install with the reviewed forward migration and its checks.
CREATE OR REPLACE FUNCTION public.crm_leads_buscar_duplicados(p_claves jsonb) RETURNS TABLE(id uuid, empresa text, contacto text, email text, telefono text, estado public.crm_lead_estado, empresa_norm text, email_norm text, telefono_norm text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH claves AS (
    SELECT
      NULLIF(lower(regexp_replace(coalesce(c->>'empresa', ''), '[^a-z0-9]', '', 'gi')), '') AS empresa_norm,
      NULLIF(lower(trim(coalesce(c->>'email', ''))), '')                                   AS email_norm,
      NULLIF(regexp_replace(coalesce(c->>'telefono', ''), '\D', '', 'g'), '')               AS telefono_norm
    FROM jsonb_array_elements(coalesce(p_claves, '[]'::jsonb)) AS c
  )
  SELECT DISTINCT
    l.id, l.empresa, l.contacto, l.email, l.telefono, l.estado,
    lower(regexp_replace(coalesce(l.empresa, ''), '[^a-z0-9]', '', 'gi')) AS empresa_norm,
    lower(trim(coalesce(l.email, '')))                                   AS email_norm,
    regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g')              AS telefono_norm
  FROM public.crm_leads l
  JOIN claves k ON (
       (k.email_norm    IS NOT NULL AND lower(trim(coalesce(l.email, ''))) = k.email_norm)
    OR (k.telefono_norm IS NOT NULL AND length(k.telefono_norm) >= 8
        AND right(regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g'), 10) = right(k.telefono_norm, 10))
    OR (k.empresa_norm  IS NOT NULL AND length(k.empresa_norm) >= 4
        AND lower(regexp_replace(coalesce(l.empresa, ''), '[^a-z0-9]', '', 'gi')) = k.empresa_norm)
  )
  WHERE l.deleted_at IS NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND l.organization_id = (SELECT public.org_scope())
    AND public.is_org_member(l.organization_id)
    AND public.rls_tenant_scope_ok(l.organization_id)
    AND (
      public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['admin', 'gerente_comercial']::public.app_role[], l.organization_id)
      OR public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['viewer', 'operador']::public.app_role[], l.organization_id)
      OR (l.vendedor_id IS NULL AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], l.organization_id))
      OR (l.vendedor_id = (SELECT auth.uid()) AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], l.organization_id))
    );
$$;
