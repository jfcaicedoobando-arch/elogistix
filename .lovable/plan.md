# Plan: cerrar los errores de Sentry 6A/6B que reaparecieron

## Qué encontramos
- Los 2 eventos nuevos de `JAVASCRIPT-REACT-6A` y `JAVASCRIPT-REACT-6B` ocurrieron en la app publicada (versión 13.823.190). La corrección ya existe en el código (13.823.201) pero aún no se ha publicado en librecarga.com.
- `JAVASCRIPT-REACT-69` (búsqueda global) sigue abierto sin causa identificada; con el cambio de 13.823.200 los próximos eventos llegarán legibles.

## Pasos
1. Marcar `JAVASCRIPT-REACT-6A` y `JAVASCRIPT-REACT-6B` como resueltos (el fix ya está en el código actual).
2. Publicar la app para que librecarga.com reciba la corrección 13.823.201 (sólo con tu autorización — si prefieres no publicar aún, los avisos pueden volver a aparecer hasta que publiques).
3. Dejar `JAVASCRIPT-REACT-69` abierto y monitoreado; investigarlo cuando llegue un evento legible.

## Fuera de alcance
- No tocar base de datos, migraciones, RLS ni datos.
- No ejecutar CI/RLS global (queda para GitHub Actions).
