## Lectura de los PDF y XML privados de FP-000140, 151, 236, 051, 092 y 104

### Resultado: no tengo una herramienta oficial para leerlos

- Mis herramientas oficiales de backend pueden consultar la base de datos y la información de los archivos (`storage.objects`: ruta, tamaño, tipo), pero no el contenido de los archivos de un bucket privado.
- Solo puedo **subir** archivos, no descargarlos. La herramienta para leer documentos solo abre archivos locales o del proyecto, no los del bucket `facturas`.
- La única alternativa sería descargarlos con la sesión del usuario a través de la API de almacenamiento. Eso es improvisar el uso de una credencial y queda fuera de lo que autorizaste, así que no lo hice.

Por eso no puedo afirmar nada sobre moneda, subtotal, IVA, total, tipo de cambio escrito, descripciones ni referencias al costo o al embarque de estos documentos. Cualquier dato mío vendría solo de columnas de la base y no serviría como evidencia del documento.

### Opciones (tú decides; no se hará nada sin tu aprobación)
1. Que Codex o un usuario con permiso descargue los 6 PDF y XML desde la app y los suba al chat. Yo los leo y te entrego la tabla por folio, sin tocar nada.
2. Que autorices de forma explícita la descarga de solo lectura con la sesión del usuario, únicamente de esas 12 rutas. No se mostrarían ni el token ni las ligas firmadas.

Es una limitación de las herramientas, no un error del ERP. No cambié nada.
