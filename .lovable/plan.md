

## Plan: Duplicar Embarque

### Cambios

**1. `src/hooks/useEmbarques.ts`** — Agregar `useDuplicarEmbarque`

Hook `useMutation` que recibe `{ embarqueOrigen: EmbarqueRow, copias: Array<{ num_contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas }> }`.

Para cada copia:
1. `supabase.rpc('generar_expediente', { tipo_op: embarqueOrigen.tipo })` → obtiene expediente
2. Inserta embarque nuevo copiando campos del origen (cliente_id, cliente_nombre, modo, tipo, incoterm, bl_master, bl_house, naviera, puerto_origen, puerto_destino, etc.) pero con expediente generado, contenedor/peso/volumen/piezas de la copia, estado `'Cotización'`
3. Copia `conceptos_venta` y `conceptos_costo` del origen al nuevo embarque_id
4. Retorna array de `{ id, expediente }` creados

`onSuccess`: `invalidateQueries(['embarques'])`

**2. `src/pages/EmbarqueDetalle.tsx`** — Botón + Dialog de duplicación

- Importar `Copy` de lucide, `Dialog` components, `useDuplicarEmbarque`
- Estado: `dialogDuplicarAbierto`, `cantidadCopias` (1-10), `filaCopias` (array editable)
- Botón "Duplicar" con ícono Copy junto a Editar/Imprimir, visible solo si `canEdit`
- Dialog con:
  - Header: "Duplicar Embarque" + subtítulo con expediente y BL
  - Control +/− para cantidad (1-10), sincroniza array de filas
  - Tabla editable: # | Contenedor | Tipo Contenedor | Peso | Volumen | Piezas
  - Valores iniciales copiados del embarque origen (contenedor vacío)
  - Nota informativa azul con campos que se copian automáticamente
  - Footer: Cancelar + "Crear N Embarques"
- `onSuccess`: toast con expedientes creados, cerrar dialog

**3. `src/pages/Changelog.tsx`** — entrada v4.14.0

