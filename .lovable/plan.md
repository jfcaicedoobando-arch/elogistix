


## v8.12.0 — Asociar embarques a expediente existente

### Implementado

- Hook `useExpedientesCliente(clienteId)` que agrupa embarques abiertos por expediente
- RadioGroup en StepDatosGenerales: "Crear nuevo expediente" / "Asociar a expediente existente"
- Combobox con búsqueda para seleccionar expediente existente con badge de conteo
- NuevoEmbarque usa expediente existente directamente sin llamar a `resolverExpediente()`
- Props opcionales para que EditarEmbarque siga funcionando sin cambios
- Reset automático al cambiar de cliente
