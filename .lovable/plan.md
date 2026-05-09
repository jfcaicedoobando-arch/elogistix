## Reordenar tabla "Embarques del BL Master"

Ajustar el orden de los registros en la tarjeta de embarques relacionados (TabResumen) para que:

1. **El embarque actual aparezca siempre como primera fila** (independientemente de su número de contenedor).
2. **El resto se ordene ascendente por número de contenedor** (`contenedor`).

### Cambios

**`src/services/embarque/queries.ts`** — `fetchEmbarquesRelacionados`
- Cambiar `.order('expediente', { ascending: true })` por `.order('contenedor', { ascending: true, nullsFirst: false })` para que el orden base sea por contenedor.

**`src/components/embarque/TabResumen.tsx`**
- Antes de renderizar el `DataTable`, derivar `relacionadosOrdenados` aplicando un sort estable: el registro cuyo `id === embarque.id` va primero; los demás conservan el orden por contenedor que viene del backend.
- Pasar `relacionadosOrdenados` como `data` del `DataTable`. Los totales (peso, volumen, piezas) siguen calculándose sobre el array completo, así que no cambian.

**Changelog + versión**
- Bump `appVersion.ts` a `8.129.4`.
- Nueva entrada patch en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`: "Embarque actual ahora aparece como primer renglón en la tabla de Embarques del BL Master; el resto se ordena por contenedor."

### Notas técnicas

- Sort en cliente con `[...relacionados].sort((a, b) => (a.id === embarque.id ? -1 : b.id === embarque.id ? 1 : 0))` — estable en JS moderno, así que el orden secundario por contenedor (ya aplicado server-side) se preserva.
- No se toca lógica de negocio ni el cálculo de totales; solo el orden visual.
