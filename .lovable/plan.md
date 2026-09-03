# Mejorar el acomodo de las proformas (PDF)

## Problema observado

En la proforma `PRO-2026-1044` (3 conceptos, un solo bloque de moneda) el documento sale en 2 páginas: la página 1 termina con el título "CONCEPTOS" y la tabla, los totales y el pie se van a la página 2. Un documento así debería caber cómodamente en una sola página.

Causas identificadas en el código de generación:

1. `ProformaDocument.tsx` envuelve todo el bloque de conceptos en un `View minPresenceAhead={140}`, y cada grupo de conceptos es `wrap={false}`. Si no queda ese espacio, el bloque entero salta de página aunque el título ya se imprimió arriba.
2. Los bloques del encabezado consumen mucho alto vertical: `h3` con `marginTop: 16`, `Condiciones de pago` con `marginTop: 14` más la tarjeta de "Datos bancarios" (que en este caso solo dice "Solicitar datos al área de cobranza"), y el grid del embarque a 3 columnas con una fila casi vacía.
3. Información repetida que gasta espacio: `Origen`, `Destino` y además `Ruta` (que es la concatenación de los dos), y `Vigencia` aparece tanto en el encabezado como en Condiciones de pago.
4. El separador de ruta usa el carácter `→`, que no está garantizado en la fuente embebida y sale como un glifo raro ("SHANGHAI ’GUADALAJARA").
5. El subtítulo "Conceptos en USD" es redundante cuando la proforma tiene una sola moneda, ya que cada importe ya viene etiquetado con la divisa.

## Cambios propuestos (solo presentación del PDF)

### 1. Que el flujo de páginas respete los bloques
- Quitar el `minPresenceAhead` global del contenedor de conceptos y aplicarlo al encabezado de cada sección, para que el título nunca quede huérfano al final de una página.
- Mantener los grupos de conceptos como bloque no partible, pero permitir que una tabla larga se parta por filas en vez de saltar completa.
- Agrupar el último bloque de conceptos con la caja de totales mediante `minPresenceAhead`, para que los totales no queden solos en una página.

### 2. Compactar el encabezado para ganar una página
- Reducir márgenes verticales de los títulos de sección y del bloque de condiciones de pago (valores de `h3`, `h4` y `PaymentTermsBlock`), sin cambiar tipografías ni colores.
- Cuando no hay datos bancarios configurados, mostrar el aviso "Solicitar datos al área de cobranza" como una línea discreta en lugar de una tarjeta con relleno.
- Ajustar el grid de "Datos del embarque" para que no queden celdas vacías cuando hay pocos datos.

### 3. Quitar redundancias
- Eliminar la fila "Ruta" del bloque de embarque (ya está en Origen/Destino) y reemplazar el carácter `→` por un separador seguro en los lugares donde se conserve una ruta.
- Dejar "Vigencia" en un solo lugar (Condiciones de pago).
- Ocultar el subtítulo "Conceptos en …" cuando la proforma tiene una sola moneda; mantenerlo cuando hay USD y MXN.

### 4. Cobertura
- Ajustar/añadir pruebas focalizadas de los componentes de PDF de proforma para verificar: que no se rinde la fila "Ruta", que el subtítulo de moneda aparece solo con dos monedas, y que el título de conceptos sigue presente.

### 5. Registro
- Bullet breve en `[Unreleased]` del `CHANGELOG.md`. Sin cambiar `APP_VERSION` ni el manifest.

## Fuera de alcance
Sin cambios en datos, cálculos, IVA, servicios, RLS ni en la proforma consolidada más allá de heredar los estilos compartidos. No se ejecutan CI, RLS, build ni suites globales desde aquí.

## Archivos previstos
- `src/pdf/documents/ProformaDocument.tsx`
- `src/pdf/documents/ProformaHeader.tsx`
- `src/pdf/documents/ProformaConceptosSection.tsx`
- `src/pdf/components/PaymentTermsBlock.tsx`
- `src/pdf/theme/stylesContent.ts`
- pruebas en `src/pdf/documents/__tests__/`
- `CHANGELOG.md`
