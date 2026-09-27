# Capturas para auditoría visual

`capture.mjs` navega por rutas configuradas y genera PNG, `report.json`
y `REPORT.md`. Las capturas no certifican por sí solas permisos/workflows
ni todos los estados. Revisado el **2026-09-26**.

## Preparar

Servidor local/preview autorizado y Chromium para Playwright.
Comprobar URL, cuenta y organización: local puede apuntar a base remota.
No poner credenciales por defecto ni en Git.

Ejemplo Bash (en PowerShell configurar `$env:...` por separado):

```bash
AUDIT_EMAIL=<usuario-prueba> AUDIT_PASSWORD=<password-prueba> \
node scripts/visual-audit/capture.mjs \
  --base=http://localhost:8080 --out=./visual-snapshots
```

`AUDIT_BASE_URL` es alternativa a `--base`. Sin credenciales el script aborta.
Ver viewport/rutas efectivos en el script; no afirmar que un entorno viene
con Chromium o dev-server preinstalados sin comprobarlo.

## Interpretación

Registrar por corrida: SHA/versión, URL, rol, organización, tema, viewport,
rutas, errores y estados realmente observados.
Identificar diferencias entre el frame y el viewport completo.

Además del tamaño automático, validar 1280×720 y 691×763, claro/oscuro,
sidebar abierto/colapsado, teclado, modales y contenido largo.
Cambiar resolución/tema no equivale a validar acciones transaccionales.

Informe por hallazgo: evidencia, impacto, propuesta, prioridad y criterio
de aceptación. Un error de consola no es automáticamente un bug visual.
Capturas con datos reales se guardan protegidas, no en el repo público.

## Seguimiento

Usar issue/PR o informe autorizado, no el antiguo `.lovable/plan.md`.
Contrastar baseline contra el mismo estado/rol/viewport.
No ejecutar seeds, formularios, borrados o pruebas fiscales como parte de
un diagnóstico sólo visual sin autorización.
