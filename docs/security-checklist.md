# Checklist técnico de seguridad

Revisión documental: **2026-09-26**. No se ejecutó auditoría de Live ni scan
completo de secretos en esta limpieza. El [reporte RLS histórico](rls-multitenant-audit.md)
y los [riesgos aceptados](riesgos-aceptados.md) conservan sus fechas de evidencia.

## Repo y backend

- [ ] Credenciales privadas sólo en backend/Vault/secrets; nunca variables VITE.
- [ ] Gitleaks del SHA revisado aprobado.
- [ ] Tablas de dominio con RLS/policies apropiadas.
- [ ] Funciones SECURITY DEFINER con search_path y grants mínimos.
- [ ] Autenticación, organización y permisos comprobados en cada operación.
- [ ] Funciones públicas/webhooks validan su secreto/firma/token interno.
- [ ] Rate limit no sustituye autorización.
- [ ] URLs de tracking/portal revocables y con expiración cuando corresponda.
- [ ] Logs/evidencia sin credenciales ni datos fiscales/personales completos.
- [ ] Backups/restore comprobados según [operaciones](operations.md).

Inventario de functions y `verify_jwt` en `supabase/config.toml`.
No fijar conteos antiguos (“48 funciones”, “6 públicas”) como contrato.
Una función verify_jwt=false no es necesariamente anónima: revisar su
validación interna. CORS tampoco reemplaza JWT/permisos.

## Diagnóstico read-only de RLS

Con autorización en el entorno elegido:

```sql
SELECT c.relname, c.relrowsecurity,
       (SELECT count(*) FROM pg_policies p
        WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY c.relname;
```

Cantidad de policies no prueba aislamiento correcto. Revisar condiciones,
permisos y suites conductuales. Algunas tablas internas no deben exponerse
ni tener una policy de acceso cliente; consultar exenciones curadas.

## Secretos y entornos

Claves publicables Supabase y DSN de ingesta son públicos por diseño,
pero no deben confundirse con service-role o tokens administrativos.
No inferir que una variable “no es accesible en Lovable” sin revisar quién
administra los secretos del proyecto.

FacturAPI: [separación Sandbox/Live](facturapi-ambientes.md).
Una API key perdida se rota con el proveedor; purgar Git no la invalida.
[Higiene .env](ops/purga-env-git.md).

## Verificación real

RLS/guards en [Postgres efímero](../supabase/tests/rls/README.md).
La seguridad remota requiere revisión específica; CI verde no demuestra
ausencia total de vulnerabilidades.

El equipo prioriza lógica, workflow y UX; esta guía no agrega una iniciativa
de hardening ni cambia permisos como parte de mantener Markdown.
