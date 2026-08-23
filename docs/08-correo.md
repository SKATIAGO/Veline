# Correo transaccional (Brevo) — fase 1

Primera fase de comunicaciones: **solo email**. SMS y WhatsApp, que la página de precios
promete dentro de la misma tarifa, quedan para más adelante.

## Qué se envía hoy

| Cuándo              | A quién | Asunto                                          |
| ------------------- | ------- | ----------------------------------------------- |
| Se crea una reserva | Cliente | _Tu cita en {negocio} — {fecha} a las {hora}_   |
| Se crea una reserva | Negocio | _Nueva cita: {servicio} — {fecha} a las {hora}_ |
| Se cancela          | Cliente | _Cita cancelada: {servicio} — …_                |
| Se cancela          | Negocio | _Cita cancelada: {servicio} — …_                |

Todos llevan versión HTML con la marca (marrón, canela, mostaza, el lockup de Veline) **y
versión en texto plano**, que es lo que se ve en clientes que bloquean HTML.

El correo al cliente enlaza a `/reserva/{código}` para consultar o cancelar. El del negocio
enlaza al panel y lleva `Reply-To` del cliente, así que responder al aviso le escribe
directamente a quien reservó.

**El envío nunca tumba una reserva.** Se dispara sin esperar respuesta y con los errores
capturados: si Brevo falla, la cita ya está confirmada y el cliente ve su confirmación igual.

## Configuración

Todo en `.env` (que **no** se sube al repo):

```bash
BREVO_API_KEY=xkeysib-...
MAIL_MODE=dry                 # off | dry | live
MAIL_FROM_EMAIL=              # tiene que ser un remitente verificado en Brevo
MAIL_FROM_NAME=Veline
MAIL_OVERRIDE_TO=             # manda TODO aquí, sea quien sea el destinatario
PUBLIC_WEB_URL=http://localhost:5173
```

### Los tres modos

- **`off`** — no se envía ni se registra nada.
- **`dry`** _(por defecto)_ — se construye el correo y se escribe en el log, pero no sale.
  Es el valor por defecto a propósito: con la app expuesta por ngrok, cualquiera que reserve
  escribe un email real en el formulario.
- **`live`** — se envía de verdad.

### Dos frenos de seguridad

1. **`MAIL_OVERRIDE_TO`** redirige todos los destinatarios a una única dirección y deja el
   original en el asunto (`[para cliente@x.com] Tu cita en…`). Es la forma de probar el envío
   real sin escribir a nadie más.
2. En modo `live` **se descartan las direcciones no entregables** (`.test`, `.invalid`,
   `.example`, `example.com`). Los negocios de ejemplo llevan correos `@…test` justamente por
   eso: rebotarían y ensuciarían la reputación del remitente.

## Ver las plantillas sin enviar nada

```bash
docker compose exec -w /app/apps/api api npm run mail:preview
```

Genera los cuatro correos en `http://localhost:5173/preview-correo/`. Los archivos están en
`.gitignore`.

## ⚠️ Antes de poner `MAIL_MODE=live`

**No hay remitente de Veline verificado.** La cuenta de Brevo se comparte con otros proyectos
(cayab, Voller Home, coolcan, runpedia, Equipos Biomédicos) y ni `veline.es` ni ningún correo
de Veline están dados de alta. Los remitentes verificados hoy pertenecen a esos otros
proyectos.

Consecuencias:

- Enviar desde un Gmail personal (`desarrollo.cayab@gmail.com`) **funciona para probar**, pero
  llega como "enviado en nombre de" y tiene bastantes papeletas de acabar en spam.
- Para producción hay que **verificar el dominio `veline.es` en Brevo** (registros SPF, DKIM y
  DMARC) y enviar desde algo tipo `reservas@veline.es`. Sin eso, la entrega es mala y la marca
  del correo no es la de Veline.
- Conviene que **Veline tenga su propia cuenta de Brevo**, o al menos una clave propia: hoy la
  misma clave da acceso a los envíos de todos los demás proyectos.

## Lo que falta

- **Recordatorio previo a la cita** — es lo que de verdad reduce las ausencias, y es lo que la
  home promete con "Recordatorios automáticos". Necesita un proceso programado, no vale con
  reaccionar a la petición.
- **SMS y WhatsApp** — prometidos en la misma tarifa en `/precios`.
- **Reintentos y registro de envíos** — hoy, si Brevo falla, queda en el log y nada más. No hay
  cola ni forma de reenviar.
- **Baja de comunicaciones** — para avisos transaccionales no es obligatorio, pero en cuanto se
  mande algo comercial hace falta.
