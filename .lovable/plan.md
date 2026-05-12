Objetivo: cuando un embarque obtiene una fecha de arribo real (`fecha_llegada_real`), su estado debe pasar automáticamente a "Arribo".

Comportamiento:
- Aplica al guardar la ATA desde el panel de tracking JSONCargo ("Actualizar embarque") y también a cualquier escritura manual futura de `fecha_llegada_real`.
- Solo cambia el estado si el embarque está en una etapa previa: `Confirmado` o `En Tránsito`.
- Nunca retrocede ni sobreescribe estados posteriores (`En Aduana`, `Entregado`, `EIR`, `Cerrado`) ni ciclos cancelados.
- Registra el cambio como evento de tracking "Arribo a Puerto" en la línea de tiempo, igual que cuando se avanza el estado manualmente, para mantener la trazabilidad.

Implementación:
1. En `useApplyJsonCargoFechas`, cuando se aplique ATA y el estado actual sea `Confirmado` o `En Tránsito`, incluir `estado = 'Arribo'` en el mismo UPDATE.
2. Insertar un registro en `eventos_embarque` con tipo "Arribo a Puerto" usando la fecha ATA y descripción estándar (`descripcionEventoCambioEstado('Arribo')`), evitando duplicados si ya existe uno para ese embarque/fecha.
3. Invalidar las cachés de detalle, lista y eventos del embarque.
4. Agregar entrada al changelog (patch).