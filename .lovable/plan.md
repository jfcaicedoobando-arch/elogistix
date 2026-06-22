## Objetivo

Para embarques ya cerrados, el checklist debe mostrarse como **informativo**: visible pero sin badges rojos de "incompleto", sin alertas, y con una nota explícita de que las reglas pueden no aplicar porque el embarque se cerró antes de que existieran.

## Diagnóstico

Hoy, en `TabCierre.tsx`, cuando un embarque está `Cerrado` se muestra un alert ("Embarque cerrado") y debajo el mismo `CierreChecklistCard` con los ítems en rojo si faltan datos. Esto genera "ruido visual" en embarques antiguos donde nunca hubo oportunidad de cumplir las reglas nuevas.

No se toca el RPC ni los datos: el cierre ya está hecho, las reglas son moot. Solo cambia la presentación.

## Cambios

### 1. `CierreChecklistCard.tsx`
- Nueva prop opcional `informativo?: boolean`.
- Si es `true`:
  - Título cambia a `"Checklist de cierre (informativo)"`.
  - Se agrega una nota muted arriba de la lista: *"Este embarque se cerró antes de que existieran algunas de estas reglas. La lista es solo referencial."*
  - Se pasa `informativo` a cada `CierreCheckItem`.

### 2. `CierreCheckItem.tsx`
- Nueva prop opcional `informativo?: boolean`.
- Cuando `informativo` y `!ok`: usar ícono y color **muted** (gris/`text-muted-foreground`) en lugar del rojo destructivo. Ocultar el botón CTA "Ir a…" para que no invite a acciones inútiles. El texto del detalle se mantiene pero en muted.
- Cuando `ok`: sin cambios (check verde).

### 3. `TabCierre.tsx`
- Pasar `informativo={esCerrado}` al `CierreChecklistCard`.

### 4. Tests
- Agregar 2 casos en `cierreCheckMeta.test.ts` o un test nuevo del componente verificando que `informativo` oculta el CTA y aplica la clase muted.

### 5. Versionado y changelog
- Bump `APP_VERSION` (patch → `13.106.1`).
- Entrada en `CHANGELOG.md` describiendo el cambio.

## Notas

- No se requiere migración ni cambios al RPC `validar_cierre_embarque`.
- Aplica automáticamente a todos los embarques históricos cerrados; no hace falta marcar nada manualmente.
- Embarques abiertos antiguos no se ven afectados: si quieres también ocultar bloqueo ahí, se hace en un siguiente paso con una fecha de corte configurable.
