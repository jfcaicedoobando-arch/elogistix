## Limpiar vínculo del usuario de prueba

**Analogía:** ahorita el usuario de prueba está sentado en la mesa de un cliente real (LONGSAIL). Lo movemos a una mesa de juguete (AGENTEPRUEBA) que sólo existe para pruebas.

### Pasos

1. **Crear proveedor `AGENTEPRUEBA`** tipo "Agente de Carga", país CN, en la organización principal.
2. **Crear agente de costeo `AGENTEPRUEBA`** vinculado a ese proveedor.
3. **Re-vincular** el registro de `agente_users` del usuario `agente.demo@librecarga.com` para que apunte al nuevo agente AGENTEPRUEBA (en vez de LONGSAIL).
4. No se borra ni se toca LONGSAIL.

### Resultado

- Al entrar con `agente.demo@librecarga.com` / `AgenteDemo2026!`, el usuario sólo verá tarifas/embarques de AGENTEPRUEBA (que están vacíos → portal limpio para pruebas).
- LONGSAIL queda intacto.
- Bumpeo `APP_VERSION` a `13.128.2` y agrego entrada al CHANGELOG.

### Una sola migración SQL hace todo el trabajo

INSERT proveedor + INSERT agente + UPDATE agente_users, en transacción.

¿Le doy?
