
Objetivo: corregir la búsqueda global para que “indimex” sí aparezca en el diálogo de búsqueda (ya confirmé que el backend sí regresa el cliente).

1) Corregir el filtrado interno de `CommandItem` en `GlobalSearch`
- Problema detectado: `cmdk` filtra por el `value` del item y hoy en `GlobalSearch` no se le pasa `value`, por eso puede ocultar resultados aunque la RPC devuelva datos.
- Cambio propuesto en `src/components/GlobalSearch.tsx`:
  - En cada `CommandItem`, agregar `value` concatenando campos buscables, por ejemplo:
    - `item.label`
    - `item.sublabel`
    - tipo (`cliente`, `embarque`, etc.)
  - Normalizar a minúsculas para consistencia.
- Resultado esperado: si la RPC devuelve “INDIMEX TRADING”, el item ya no se filtra erróneamente y se mostrará.

2) Endurecer la UX del buscador para evitar falsos “sin resultados”
- Mantener el debounce actual.
- Limpiar espacios del término antes de consultar (`trim` ya está, se conserva).
- Validar que el estado `results` se alimente directo de la respuesta y que no haya filtrado adicional accidental.

3) Corregir warning de accesibilidad del diálogo (ya visible en consola)
- En `src/components/ui/command.tsx`, dentro de `CommandDialog`:
  - Agregar `DialogTitle` (puede ir oculto visualmente con clase sr-only o VisuallyHidden).
  - Agregar `DialogDescription` breve.
- Esto elimina los warnings:
  - “DialogContent requires a DialogTitle…”
  - “Missing Description…”

4) Actualizar changelog
- En `src/pages/Changelog.tsx`, agregar al inicio una nueva entrada (v7.4.6, fecha actual) indicando:
  - corrección de visibilidad de resultados en búsqueda global por ajuste de `CommandItem.value`
  - mejora de accesibilidad del diálogo de búsqueda.

5) Verificación funcional (manual)
- Abrir Ctrl/Cmd+K y buscar:
  - `indimex`
  - `INDIMEX`
  - fragmentos como `indi`, `itr180`
- Confirmar:
  - aparece resultado de cliente “INDIMEX TRADING”
  - al seleccionar navega a `/clientes/{id}`
  - no reaparecen warnings de DialogTitle/Description en consola.

Detalle técnico clave
```text
RPC busqueda_global: devuelve resultado correcto (verificado por request 200 con cliente INDIMEX).
Falla real: filtrado client-side de cmdk al no definir `value` en CommandItem.
Fix: setear `value` explícito en cada resultado para alinear filtro interno con los datos mostrados.
```
