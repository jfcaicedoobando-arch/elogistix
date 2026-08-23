# Validación del parche `fix-b1-seguridad.diff`

Revisé cada afirmación del parche contra las funciones **vivas** en la base y contra el código actual del front.

## Veredicto

| Afirmación del parche | Veredicto | Evidencia |
|---|---|---|
| B-1: `is_org_member` devuelve NULL para usuario sin org → el guard `IF NOT ...` se salta (bypass 42501) | **YA CORREGIDO (no es bug hoy)** | La función viva es `SELECT COALESCE(current_user_org_id() = p_org, false) OR COALESCE(has_role(...,'super_admin'), false)`: nunca devuelve NULL. Fue el arreglo estructural de la v13.724.2 |
| Re-emitir 8 RPCs con `IS NOT TRUE` | **Innecesario para seguridad** | 6 de ellas todavía usan `IF NOT is_org_member(...)`, pero con `COALESCE` en el helper ese guard ya es fail-closed. `revertir_proforma` y `crm_propagar_conversion_cliente` ya usan `IS NOT TRUE` |
| Bitácora rota en `revertir_proforma` (`usuario_email` NULL → 23502) | **YA CORREGIDO** | El cuerpo vivo declara `v_email text := COALESCE(auth.email(), '')` y lo inserta |
| B-3: `rechazar_documento_embarque` llama `_assert_writer()` sin argumentos → 42883 siempre | **YA CORREGIDO** | El cuerpo vivo hace `PERFORM public._assert_writer(v_doc.organization_id)` |
| Documento `Validado` no debe ser rechazable | **YA CORREGIDO** | Guard vivo `LC_DOC_VALIDADO` (y además `LC_DOC_YA_RECHAZADO`) |
| Desalineación del mínimo de motivo (front 10 vs RPC 5) | **FALSO / al revés** | La RPC viva exige **10** y el front exige **10**. Bajar el front a 5 (como propone el diff) **crearía** el bug: la RPC rechazaría con `LC_MOTIVO_REQUERIDO` |
| Falta fallback de notificación cuando `embarques.created_by` es NULL | **REAL (menor)** | El cuerpo vivo sólo notifica si `created_by IS NOT NULL`; sin él nadie se entera del rechazo |
| Falta chequeo de rol financiero por-org en `revertir_proforma_al_cancelar_sustitucion` | **REAL (endurecimiento menor)** | Sólo valida membresía, no rol; cualquier miembro autenticado de la org puede liberar proformas |
| Tests SQL nuevos + cableado en CI | **Útil** | Hoy no hay regresión que fije el fail-closed de `is_org_member` ni el contrato de `rechazar_documento_embarque` |

Analogía: el parche llegó con el diagnóstico de la semana pasada. La cerradura defectuosa (`is_org_member`) ya se cambió, así que reforzar todas las puertas que dependían de ella no aporta nada; y una de las "mejoras" (bajar el motivo a 5 caracteres) aflojaría un tornillo que hoy está bien puesto.

## Qué propongo aplicar (sólo lo real)

1. **Notificación de rechazo sin destinatario huérfano** — nueva migración que re-emite `rechazar_documento_embarque` conservando todo el cuerpo actual (incluido el mínimo de 10 caracteres) y agregando el `ELSE` que notifica a los `admin` / `admin_org` de la organización vía `organization_members` cuando `embarques.created_by` es NULL.
2. **Rol financiero en `revertir_proforma_al_cancelar_sustitucion`** — agregar `has_any_role_in_org` (admin, admin_org, contador, tesorero) después de la validación de membresía, conservando la ruta `service_role` intacta.
3. **Regresión en CI** — incorporar los dos tests SQL del parche, corregidos al contrato real: `fix_b1_guard_trivaluado.sql` valida que `is_org_member(x)` devuelve `false` (no NULL) sin organización y que las RPC lanzan 42501; `fix_b3_rechazar_documento.sql` valida motivo < 10, documento `Validado`, y el fallback a admins. Cableados en `.github/workflows/rls-tests.yml`.

## Qué NO se aplica

- Las 748 líneas de re-emisión de las 8 RPCs con `IS NOT TRUE` (riesgo alto de drift por reescribir cuerpos completos, beneficio nulo tras el fix de `is_org_member`).
- El cambio del front `MIN_MOTIVO = 10 → 5` y el cambio del mensaje de la RPC a 5 caracteres.
- Los espejos canónicos `supabase/schema/cxp/*.sql` del parche (corresponden a la re-emisión descartada).

## Detalles técnicos

- Dos migraciones nuevas con timestamp posterior a los espejos vigentes; ninguna edita migraciones históricas.
- H6 en cada función re-emitida: `SECURITY DEFINER` + `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE` explícito a `authenticated`/`service_role`.
- Actualizar el espejo canónico de `rechazar_documento_embarque` bajo `supabase/schema/`.
- Sincronizar `migration-manifest.json`, `CHANGELOG.md` y bump de `APP_VERSION`.
- Sin cambios de datos existentes.
