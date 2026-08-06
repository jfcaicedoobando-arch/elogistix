# Estado de la auditoría visual: qué quedó y qué falta

La Ola 10 (versión 13.432.0) cerró lo grueso: tipografía, retícula 8/16/24, botones y 13 tablas migradas a `DetailTable`. Lo que sigue son residuales verificados hoy en el código, no una nueva auditoría.

## Lo que ya está cerrado
- Contrato tipográfico con tokens y un solo `h1` por pantalla.
- Retícula: 0 archivos con paddings/márgenes en píxeles arbitrarios (regla de lint activa).
- Botones: peso, radio, sombra, transición 150 ms, foco y estado `loading` unificados.
- Inputs/casillas/radios/switch tomando borde y aro de foco de `field.tokens`.

## Lo que falta (Ola 11 — cierre)

### Lote A — Tablas residuales (4 archivos)
Aún dibujan tablas a mano en vez de usar el contrato compartido, así que su encabezado, hover y densidad no coinciden con el resto:
- Estado de cuenta de facturación (tabla, encabezado, fila y agrupado por moneda).
- "Embarques relacionados" en el resumen del embarque.

Se migran a `DetailTable` conservando la lógica de totales y agrupación. Los archivos de infraestructura (`DataTable*`, `DetailTable`, VirtualTable) se quedan como están: son la base del contrato.

### Lote B — Enlaces disfrazados de texto (11 archivos)
Hay textos con `text-primary` + subrayado usados como botones. Se reemplazan por `<Button variant="link">` para que hereden foco, tamaño y transición estándar (además de ser accesibles por teclado).

### Lote C — Estilos en línea
De los 30 archivos con `style={{...}}`, la mayoría son anchos/porcentajes dinámicos (barras de progreso, kanban, steppers), que son válidos. Se revisan uno por uno y sólo se convierten los estáticos a clases; los dinámicos quedan documentados.

### Lote D — Verificación visual FullHD
Recorrido con navegador en 1920x1080 sobre las pantallas que no se revisaron en la ola anterior (compras/CxP, tesorería, CRM, costeo, auditoría, configuración): captura por pantalla, revisión de consola y confirmación de un solo título por página. Se corrige lo que aparezca.

## Detalles técnicos
- Migración a `DetailTable` sin tocar hooks ni queries; sólo capa de presentación.
- `bun run lint -- --max-warnings 0`, `tsgo` y la suite de tests (incluye `no-raw-table.test.ts`, cuyo allowlist se ajusta al terminar el Lote A).
- Cierre con bump de `APP_VERSION` a `13.433.0` y entrada en `CHANGELOG.md`.
