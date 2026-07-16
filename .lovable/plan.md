# Fix CI: tests fallidos en `useNuevoProveedorController`

## Contexto

En `v13.301.8` endurecí la validación para exigir `tipo` en TODO proveedor Logístico (nacional y extranjero) — esto alineó el form con el CHECK `proveedores_categoria_check` y cerró el Sentry `JAVASCRIPT-REACT-1M`.

Pero rompí 3 tests del shard 14 porque el helper `fillStep1Logistico` sólo captura `nombre + origen + rfc` (sin `tipo`), y los tests declaran explícitamente "**default Naviera**" — es decir, esperan que al elegir categoría "Logistico" el controller **auto-seleccione** `tipo = "Naviera"`.

Tests fallidos:
1. `valida logístico nacional con nombre + rfc + tipo (default Naviera)` → `isStep1Valid` = false
2. `avanza y carga 7 documentos nacionales` → no avanza al step 2 (bloqueado por validación)
3. `handleFileChange marca documento como adjuntado` → misma causa, no llega al step 2

## Cambio propuesto (1 archivo, 1 línea)

**`src/features/proveedor/hooks/useNuevoProveedorController.ts`** — en `handleCategoriaChange`:

```diff
-      tipo: next === "Logistico" ? null : null,
+      tipo: next === "Logistico" ? "Naviera" : null,
```

Naviera es el default más neutro (no requiere `pais` extra, a diferencia de "Agente de Carga"). El usuario puede cambiarlo con el `Select` en el mismo paso. Actualizo también el comentario adyacente.

## Analogía

Es como cuando un formulario web te pregunta "país" y te pre-selecciona "México" — no te obliga, pero evita que el botón "Siguiente" quede gris por olvido. Antes: dejaba el campo vacío y bloqueaba (correcto por BD, malo por UX y tests). Ahora: precarga "Naviera", usuario cambia si quiere.

## Verificación

- Los 3 tests fallidos vuelven a pasar sin tocar el helper.
- No regresa el Sentry `1M`: la BD sigue recibiendo `tipo` no-nulo.
- El UI ya muestra el `Select` de tipo, así que el usuario puede cambiar el default.

## Changelog

Bump `APP_VERSION` a `13.301.9` y agregar bullet en `CHANGELOG.md`:
- Fix: al crear proveedor Logístico se preselecciona `tipo="Naviera"` (evita bloqueo silencioso del wizard y arregla 3 tests de CI).
