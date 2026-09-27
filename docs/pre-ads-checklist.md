# Checklist de preparación para campañas

Documento de planificación, no reporte de campaña ni auditoría de producción.
Revisado el **2026-09-26**; las afirmaciones del 2026-08-29 se conservan en Git.

## Antes de invertir

- [ ] Verificar landing, formulario/demo y signup en el deploy actual.
- [ ] Confirmar qué campos se capturan y su consentimiento/aviso de privacidad.
- [ ] Validar persistencia de lead y atribución UTM/referrer.
- [ ] Revisar IDs/configuración reales de analítica y eventos de conversión.
- [ ] Probar que eventos no se duplican y no envían PII.
- [ ] Confirmar entrega de correo y dominio verificado.
- [ ] Revisar SEO/og:image/FAQ y evitar logos/testimonios no autorizados.
- [ ] Medir rendimiento publicado en dispositivo/red representativos.
- [ ] Aprobar presupuesto, responsables y objetivos fuera del repo.

No presentar GA4/Meta como instalados o ausentes sin verificar el deploy.
No decir que cada visitante convertirá ni prescribir presupuesto a partir
de una lista técnica antigua. Configurar proveedores requiere aprobación.

Una prueba signup/demo puede crear usuarios/leads: usar entorno y mocks
autorizados, no ejecutarla como comprobación de documentación.
