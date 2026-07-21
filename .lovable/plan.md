Mejorar el copy de la carta "Demoras por contenedor" en `src/features/embarques/components/TabDemoras.tsx` para que sea más claro, conciso y amigable para el usuario operativo.

**Copy actual (líneas 94-100):**
> Captura la fecha real de descarga y devolución de cada contenedor para que el sistema calcule las demoras con el tabulador escalonado de la naviera. Si los campos quedan vacíos se usan las fechas del timeline del embarque. El override de días libres sobreescribe el default configurado en la naviera. Al guardar, los conceptos de demoras automáticos se recalculan.

**Problemas detectados:**
- Oraciones largas y densas.
- Lenguaje técnico innecesario ("override", "default", "tabulador escalonado").
- No explica qué pasa si se deja vacío el campo de días libres (sobreescribe vs. solo si se captura).
- Falta claridad sobre la acción automática al guardar.

**Copy propuesto:**
> Captura la fecha real de descarga y devolución de cada contenedor para calcular las demoras con el tabulador de la naviera. Si dejas un campo vacío, usamos las fechas del timeline del embarque. El campo "Días libres" solo sobreescribe el default de la naviera cuando lo capturas. Al guardar, recalculamos automáticamente los conceptos de demora.

**Cambios técnicos:**
- Reemplazar el `<p>` en `TabDemoras.tsx` por el copy propuesto.
- Verificar que el texto no rompa la estructura de la card ni exceda el espacio visual en la preview.
- Actualizar `APP_VERSION` y `CHANGELOG.md` según el flujo del proyecto.

**Validación:**
- Revisar visualmente en la preview que el copy se lea completo y no se sature la card.