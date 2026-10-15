# Fase 5 — Correos

Las once plantillas (confirmación al cliente, aviso al negocio, cancelación,
cambio de hora, recordatorio, petición de reseña, restablecer contraseña,
cuenta creada, verificar alta, alta nueva y local nuevo para el equipo)
comparten un único marco en `apps/api/src/mail/templates.ts`. Se rehizo el
marco; el contenido y el texto plano de cada plantilla no cambian.

## Lo que lleva el marco ahora

- **Tablas y CSS en línea**, 600 px de ancho máximo, con el bloque
  condicional `<!--[if mso]>` para que Outlook de escritorio respete el
  ancho y la fuente.
- **Botón a prueba de Outlook**: `<v:roundrect>` (VML) para Outlook y un `<a>`
  normal para el resto; en el móvil ocupa todo el ancho.
- **Modo oscuro**: `color-scheme: light dark`, y una hoja `@media
(prefers-color-scheme: dark)` que repinta fondo, tarjeta, texto y notas con
  `!important` (Gmail y Apple Mail reescriben los colores en línea si no).
- **Preheader** con relleno invisible para que la vista previa no siga
  leyendo el cuerpo.
- **Tipografía**: Public Sans primero por si algún día se embebe; Helvetica
  y Arial son las que se ven. Nada por debajo de 13 px; cuerpo a 15–16 px.
- **Colores de la marca** iguales a la app (el marrón del botón es el de
  pantalla, 4,63:1 con blanco).
- Sin imágenes: el logotipo va en texto con el bloque mostaza; no hay nada
  que cargar ni que bloquear. Cuando exista un PNG del logo, va con `width`,
  `height` y `alt`.
- Versión de **texto plano** en todas, como antes.

## Vistas previas

`docker compose exec -w /app/apps/api api npm run mail:preview` genera las
once en `apps/web/public/preview-correo/` (ignorado por git) y se ven en
`http://localhost:5173/preview-correo/`. Se comprobaron en el navegador a
375 y 1024 px, en claro y en oscuro.

## Lo que no se ha podido comprobar

El render real en Gmail, Outlook, Apple Mail y Yahoo (pregunta 8: no hay
Litmus ni Email on Acid). Lo que se ha hecho sigue las reglas que esos
clientes imponen (tablas, VML, `!important` en oscuro, 600 px), pero la
captura por cliente queda pendiente de tener buzones de prueba. Con `MAIL_MODE`
real y `MAIL_OVERRIDE_TO` se puede mandar cualquiera de las once a un buzón
y mirarla.
