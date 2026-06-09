# Iteración 1 — Wizard de cotización terrestre

Objetivo: hacer que el wizard de cotización se adapte cuando `modo = "Terrestre"`, sin tocar todavía multi-ruta ni PDF. Multi-ruta y tabla comparativa quedan para la iteración 2.

## Cambios de comportamiento

1. **Tipo de operación** (`SeccionDatosGeneralesCotizacion`)
   - Si `modo = Terrestre`, las únicas opciones son `Nacional` y `Cross Trade`. Si el valor actual no encaja, auto-corregir a `Nacional`.
2. **Incoterm**
   - Ocultar el campo cuando `modo = Terrestre`. Persistir `incoterm = "N/A"` para no romper la BD (el enum ya lo soporta).
3. **Modalidad de equipo** (campo nuevo, solo terrestre)
   - Select obligatorio con: `Caja Seca`, `Porta Contenedor`, `Plataforma`, `Torton`, `Camión Full`, `Camión Sencillo`.
   - Se guarda en un campo nuevo `modalidad_equipo` (texto libre validado por catálogo en el front, sin enum nuevo en BD para mantener la migración mínima).
4. **Ruta**
   - `Tipo de movimiento` se oculta cuando `modo = Terrestre` (es marítimo). Persistir `tipo_movimiento = ""`.
   - Origen/Destino se quedan como `Input` libre (ya lo son cuando no es marítimo/multimodal).
   - Cuando `modalidad_equipo = Porta Contenedor`, mostrar un tercer campo **Punto de carga/descarga** entre Origen y Destino. Se guarda en un campo nuevo `punto_intermedio`.
   - Ocultar campos marítimos irrelevantes que hoy ya están condicionados a `esMaritimo` (no requiere cambios).
5. **Mercancía**
   - El wrapper de mercancía ya conmuta por modo; revisar que para Terrestre muestre la sección general (peso/volumen/piezas), sin LCL/FCL/aéreo.

## Cambios técnicos

- **BD (migración pequeña)**: agregar a `public.cotizaciones`:
  - `modalidad_equipo text null`
  - `punto_intermedio text null`
  
  Sin enum, sin backfill. Las RLS existentes cubren los nuevos campos.
- **Tipos del formulario** (`src/types/cotizacionForm.ts`, `src/types/cotizacion.ts`): agregar `modalidadEquipo: string` y `puntoIntermedio: string` con defaults `""`.
- **Mappers** (`src/lib/mappers/cotizacionForm.ts`, `src/services/cotizacion/mutations/payloadBuilders.ts`): leer/escribir los dos nuevos campos.
- **Constantes nuevas** (`src/constants/cotizacionTerrestre.ts`):
  - `MODALIDADES_EQUIPO_TERRESTRE` y helper `requiereTresPuntos(modalidad)`.
  - `TIPOS_OPERACION_TERRESTRE = ["Nacional", "Cross Trade"]`.
- **UI**:
  - `SeccionDatosGeneralesCotizacion.tsx`: filtrar opciones de Tipo según modo; ocultar Incoterm en terrestre; agregar select de Modalidad cuando terrestre. Auto-set `incoterm="N/A"` al cambiar a Terrestre.
  - `SeccionRutaCotizacion.tsx`: ocultar Tipo de movimiento en terrestre; mostrar Punto intermedio cuando modalidad lo requiera; etiqueta de Origen/Destino sin cambiar a "puerto".
- **Validación**: en el resolver/zod del wizard, exigir `modalidadEquipo` cuando `modo = Terrestre`, y `puntoIntermedio` cuando modalidad lo requiera.
- **Edición**: `EditarCotizacion` hereda automáticamente vía mappers.
- **Changelog + APP_VERSION**: nueva entrada `[12.67.0]` describiendo la adaptación del wizard terrestre. Bump en `src/constants/appVersion.ts`.

## Qué NO se toca en esta iteración

- Multi-ruta y tabla comparativa (queda para iteración 2 — implica modelo `cotizacion_rutas` y cambios al PDF / portal de aceptación).
- PDF de cotización (sigue mostrando un solo origen/destino; cuando hay punto intermedio se mostrará como parte de la ruta textual existente).
- Embarques: el flujo de conversión cotización→embarque se revisará cuando entremos a multi-ruta.

## Verificación

- Crear cotización terrestre Nacional con Caja Seca: Incoterm y Tipo de movimiento no aparecen, modalidad obligatoria, ruta de 2 puntos.
- Cambiar modalidad a Porta Contenedor: aparece campo de punto intermedio; al guardar persiste.
- Editar la cotización guardada: campos recuperan valores correctamente.
- Cotización marítima/aérea sigue funcionando igual (campo modalidad oculto, incoterm visible).
