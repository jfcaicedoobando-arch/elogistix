## Ítem 3.2 — Dividir god functions SQL

**Contexto:** Bloques 1 y 2 y el ítem 3.1 (fuentes canónicas SQL) ya se aplicaron (v13.309.0–v13.309.6). El siguiente ítem según el orden obligatorio del documento es **3.2 – Dividir god functions**.

**Regla del propio documento:** *"Cada una en su propio PR con tests de humo E2E del flujo afectado"*. Es decir, **una función por commit/turno**, no las 5 juntas.

### Alcance de este turno (solo la primera)

Refactorizar `auditoria_embarques_org` (664 líneas) — es la más grande y la que la auditoría lista primero.

**Regla dura:** refactor puro. Firma pública, tipo de retorno, textos de hallazgo (es-MX) y semántica de resultados deben ser **byte-idénticos** contra el estado actual. Si algo obliga a cambiar comportamiento, me detengo.

### Cómo se divide

1. Leer la fuente canónica en `supabase/schema/auditoria/auditoria_embarques_org.sql` (creada en 3.1) y mapear las secciones lógicas (bloques `INSERT INTO hallazgos SELECT ...` por categoría de hallazgo: cierre, financieros, tracking, documentos, garantías, demoras, etc.).
2. Extraer cada categoría a una función privada `_audit_embarques_<categoria>(p_org_id uuid) RETURNS SETOF hallazgo_row` en el mismo schema, sin cambiar el SQL interno de cada bloque (copia literal).
3. Reescribir `auditoria_embarques_org` como orquestador: `UNION ALL` de las funciones privadas, preservando el ORDER BY / severidad / metadata final.
4. Mantener `SECURITY DEFINER`, `search_path`, permisos y `GRANT`s idénticos.
5. Actualizar la fuente canónica `supabase/schema/auditoria/*.sql` (una función = un archivo) — regla establecida en 3.1.

### Migración

- Un archivo: `supabase/migrations/<ts>_split_auditoria_embarques_org.sql`.
- Contiene `CREATE OR REPLACE FUNCTION` de los helpers privados + el orquestador. Sin `DROP` (siguen usando el mismo nombre público).
- Sin cambios en tablas, sin `CASCADE`, sin RLS nueva.

### Verificación (checklist del documento)

1. `npm run lint`, `npx tsc -b`, `npx vitest run`, `npx knip` — todos verdes.
2. **Prueba de equivalencia SQL** (crítica para "refactor puro"):
   ```sql
   -- capturar snapshot ANTES de aplicar la migración en una org real de staging
   SELECT * FROM auditoria_embarques_org('<org-id>') ORDER BY 1,2,3;
   -- comparar contra el mismo query después de la migración
   ```
   Ejecutar contra al menos 2 organizaciones con datos representativos vía `supabase--read_query`. **Diff debe ser vacío.**
3. Snapshot de invariantes de esquema (creado en 2.2) sigue verde: los triggers y funciones críticas no se tocan; sólo se agregan helpers privados nuevos.
4. `CHANGELOG.md` + bump `APP_VERSION` a `13.309.7`.

### Detalles técnicos (para revisión)

- **Naming de helpers:** prefijo `_audit_embarques_` (underscore inicial marca uso interno), en el schema `public` (mismo que la función pública).
- **Contrato de retorno:** cada helper devuelve exactamente las columnas que `auditoria_embarques_org` inserta hoy (misma tupla). Se define un `TYPE` o se reusa el `RETURNS TABLE (...)` idéntico al público.
- **Permisos:** los helpers privados **no** reciben `GRANT` a `authenticated`/`anon` (sólo el orquestador público mantiene sus grants actuales). Así evitamos ampliar superficie.
- **NO se toca:** `search_path`, `SECURITY DEFINER`, `LANGUAGE plpgsql`/`sql`, ni el orden de columnas del `RETURNS TABLE` del orquestador.
- **Fuera de alcance de este turno:** las otras 4 god functions (`convertir_proformas_a_factura`, `operaciones_stats`, `crear_embarque_borrador_core`, `calcular_demoras_embarque`). Cada una será su propio turno/PR.

### Riesgos y mitigación

- **Riesgo:** que un `UNION ALL` cambie el orden implícito de resultados y algún consumidor UI dependa de él → mitigado con `ORDER BY` explícito idéntico al actual.
- **Riesgo:** helpers privados sin `search_path` heredan uno inseguro → cada helper declara `SET search_path = public, pg_catalog` igual que el orquestador.
- **Riesgo:** que el diff SQL sea > lo esperado (>15 archivos o >2 h) → si al abrir la fuente canónica veo que la función mezcla categorías inseparablemente, me detengo y reporto en vez de forzar (regla 6 de las reglas de oro).

### Entregables

- `supabase/migrations/<ts>_split_auditoria_embarques_org.sql`
- `supabase/schema/auditoria/auditoria_embarques_org.sql` (actualizada + nuevas)
- `CHANGELOG.md` entry
- `APP_VERSION` → `13.309.7`