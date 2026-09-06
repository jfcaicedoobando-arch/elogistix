# Cerrar los dos fallos de CI (calidad de código + tamaño de la app)

CI reporta dos cosas independientes. Ambas son de corrección, no features nuevas.

## 1. Aviso de calidad en el código de tarifas

El reporte de auditoría de "casts" marca 1 hallazgo CRÍTICO, y es la única razón por la que
`src/__tests__/audit-report.test.ts` falla (esperaba 0).

Origen confirmado por lectura del archivo: `src/features/costeo/hooks/useTarifaFormReset.ts:28`
usa `JSON.parse(initialKey) as Partial<TarifaInput>` para estabilizar por contenido el valor
inicial del formulario de tarifas (el arreglo que evitaba que un refetch borrara la naviera
capturada en el portal del agente).

Corrección propuesta: quitar el `JSON.parse` y estabilizar la identidad sin reconstruir el
objeto, conservando exactamente el comportamiento actual (se hidrata cuando los datos llegan
tarde, no se reinicia si el contenido no cambió) y sin desactivar reglas de React ni volver a
introducir el aviso del compilador de React que ya se corrigió.

Si por alguna razón técnica no queda una versión limpia sin cast, la alternativa es documentar
el cast con el marcador `// SAFE-CAST:` (política ya existente del proyecto: la cadena la
produce el propio hook con `JSON.stringify` del valor tipado), lo que degrada la severidad.
Se prefiere la primera opción.

## 2. La app inicial pesa 351 KB y el límite es 350 KB

El control de tamaño falla por 1 KB en el archivo de arranque. No hay diagnóstico previo del
causante, así que el primer paso es medir, no adivinar:

1. Generar el build con análisis (`ANALYZE=true bun run build`) y revisar qué módulos entraron
   al archivo de arranque.
2. Si aparece algo pesado que no se necesita en el primer render (pantallas, editores,
   generadores de documentos, gráficas), moverlo a carga diferida. Esa es la corrección
   preferida y baja el peso de forma real.
3. Sólo si el análisis muestra que el archivo de arranque ya es mínimo y el crecimiento es
   difuso (suma de muchas pantallas legítimas), se subirá el límite con una nota explicando el
   motivo, igual que se hizo antes con otros límites del proyecto.

## Detalles técnicos

- Archivos previstos: `src/features/costeo/hooks/useTarifaFormReset.ts`, más el archivo que
  el análisis señale como import estático pesado (o `scripts/check-bundle-size.sh` sólo en el
  caso 3), `CHANGELOG.md` y bump de `APP_VERSION`.
- Se agrega/ajusta regresión mínima del hook de reset si el cambio toca su comportamiento.
- Verificación local focalizada: `bunx vitest run` de los 4 archivos de auditoría que CI
  ejecutó, `bunx tsgo --noEmit`, lint focalizado con `--max-warnings 0`, build y
  `bash scripts/check-bundle-size.sh`.
- CI completo y pruebas RLS quedan para GitHub Actions. No se publica la app.
