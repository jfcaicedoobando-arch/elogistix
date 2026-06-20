# Plan: Arreglar `post-deploy-smoke` (job `user-management-smoke`)

## Diagnóstico

Los logs del workflow `post-deploy-smoke` muestran:

- ✅ `exchange-rates-smoke` → HTTP 200, contrato OK.
- ✅ `tracking-public-smoke` → HTTP 404 esperado.
- ❌ `user-management-smoke` → falla en el paso *Validate required secrets* porque los GitHub Actions Secrets `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` no están configurados en el repo (`DEMO_USER_EMAIL:` viene vacío en el bloque `env:`).

No es un bug de código: es una dependencia de configuración del CI. El fallo encadena al job `notify-failure`, que abre/actualiza el issue `smoke-failure`.

**Analogía:** es como una alarma de incendios que se dispara porque le falta la batería, no porque haya fuego. El smoke en sí no probó nada.

## Opciones (a elegir contigo)

### Opción A — Usar la edge function `demo-access` (recomendada)

Ya tenemos `supabase/functions/demo-access` que provisiona la cuenta demo y devuelve `{ email, password }` (esto es exactamente lo que usa el botón "Probar demo" del marketing). El smoke puede:

1. Llamar `POST /functions/v1/demo-access` con el anon key.
2. Tomar `email` + `password` del payload.
3. Hacer login real y ejecutar `smoke_test.ts` con esas credenciales.

**Ventajas:** no requiere configurar secrets nuevos; el smoke prueba exactamente el mismo flujo que ven los usuarios reales del demo; password es público por diseño (cuenta demo).

**Cambios:**

- `.github/workflows/post-deploy-smoke.yml`: reemplazar paso *Validate required secrets* por un paso `Fetch demo credentials` que hace `curl` a `demo-access` y exporta `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` con `>> $GITHUB_ENV`. El paso *Run user-management smoke* se queda igual.

### Opción B — Configurar los secrets en GitHub

Tú agregas manualmente `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` en *Settings → Secrets and variables → Actions* del repo `jfcaicedoobando-arch/elogistix`. El workflow ya está listo y volverá a pasar sin cambios de código.

**Cuándo:** si prefieres una cuenta dedicada distinta a la del demo.

### Opción C — Saltarse el job si no hay secrets

Cambiar el paso de validación para que haga `echo` y `exit 0` cuando faltan los secrets (job pasa en verde con un warning). Más laxo: el smoke deja de cubrir user-management hasta que alguien configure las credenciales.

**Recomendación:** Opción A. Mantiene la cobertura del smoke sin trabajo manual de tu parte ni secrets adicionales.

## Detalle técnico (Opción A)

Reemplazar los pasos 40-48 del workflow por:

```yaml
- name: Fetch demo credentials
  run: |
    set -euo pipefail
    curl -sS -X POST \
      -H "apikey: ${ANON_KEY}" \
      -H "Authorization: Bearer ${ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{}' \
      "${SUPABASE_URL}/functions/v1/demo-access" > /tmp/demo.json
    EMAIL=$(jq -r '.email' /tmp/demo.json)
    PASSWORD=$(jq -r '.password' /tmp/demo.json)
    if [ -z "$EMAIL" ] || [ "$EMAIL" = "null" ]; then
      echo "::error::demo-access no devolvió credenciales válidas"
      cat /tmp/demo.json
      exit 1
    fi
    echo "DEMO_USER_EMAIL=$EMAIL" >> "$GITHUB_ENV"
    echo "::add-mask::$PASSWORD"
    echo "DEMO_USER_PASSWORD=$PASSWORD" >> "$GITHUB_ENV"
```

Y eliminar las referencias `${{ secrets.DEMO_USER_* }}` del paso *Run user-management smoke* (ya estarán en el env del job).

## Changelog + version

- Bump `APP_VERSION` a `13.85.6`.
- Entrada en `CHANGELOG.md`: "Smoke post-deploy: obtener credenciales demo desde `demo-access` en vez de exigir secrets manuales."

¿Voy con la **Opción A**, o prefieres B/C? Opción a