# Correo y SMS

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
MAIL_MODE=dry                 # off | dry | live (en el VPS: live)
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

## Estado en producción

`MAIL_MODE=live` desde el 24 de agosto de 2026. Verificado con un envío real: la recuperación
de contraseña llegó y Brevo registró `requests → delivered → opened`.

Al arrancar, la API escribe en el log qué está haciendo el correo de verdad:

```
correo ACTIVO desde reservas@veline.es
correo en PRUEBA (MAIL_MODE=dry): se registra pero NO se envía
correo en modo live pero SIN BREVO_API_KEY: no se enviará nada
```

Ese aviso existe porque el correo apagado es un fallo silencioso: las reservas se confirman
igual y nadie nota que los avisos no salen hasta que se queja un cliente.

### El remitente y el buzón de respuesta

Se envía desde **`desarrollo.cayab@gmail.com`**, una cuenta que no es de Veline, por decisión
tomada a sabiendas: verificar el dominio se deja para más adelante. Consecuencias que conviene
tener presentes:

- Los correos llegan como «Veline \<desarrollo.cayab@gmail.com\>», y muchos clientes de correo
  añaden un «enviado en nombre de».
- Sin SPF ni DKIM propios, la entrega es peor: parte acabará en spam.

Lo que sí está resuelto es **a dónde va una respuesta**. Todo correo de Veline lleva `Reply-To`
al buzón de contacto (`CONTACT_EMAIL` en `@veline/shared`), así que responder escribe a Veline
y no a la cuenta técnica. La única excepción es el aviso de cita nueva al negocio, que responde
al cliente que reservó — que es lo que el negocio quiere al darle a «Responder».

Si algún día se verifica el dominio, `veline.es` ya está dado de alta en Brevo y solo faltarían
tres registros TXT en Hostinger (DKIM en `mail._domainkey`, `brevo-code:…` en `@`, y DMARC en
`_dmarc`) más cambiar `MAIL_FROM_EMAIL` a `reservas@veline.es`.

### ⚠️ La clave es compartida

La cuenta de Brevo se comparte con otros proyectos (cayab, Voller Home, coolcan, runpedia,
Equipos Biomédicos). La misma clave que usa Veline da acceso a los envíos, los registros y los
contactos de todos ellos. Veline debería tener **su propia cuenta**, o al menos una clave
propia con permisos limitados a envío transaccional.

## Lo que falta

- **Recordatorio previo a la cita** — es lo que de verdad reduce las ausencias, y es lo que la
  home promete con "Recordatorios automáticos". Necesita un proceso programado, no vale con
  reaccionar a la petición.
- **SMS y WhatsApp** — prometidos en la misma tarifa en `/precios`.
- **Reintentos y registro de envíos** — hoy, si Brevo falla, queda en el log y nada más. No hay
  cola ni forma de reenviar.
- **Baja de comunicaciones** — para avisos transaccionales no es obligatorio, pero en cuanto se
  mande algo comercial hace falta.

## Un solo proveedor: Acumbamail

Desde septiembre de 2026 **el correo y los SMS salen los dos por Acumbamail**. Antes el correo
iba por Brevo; se unificó para tener una sola cuenta y una sola factura.

El proveedor se elige con `MAIL_PROVIDER` (`acumbamail` por defecto, `brevo` como vuelta atrás).
Todo el producto llama a `mail/enviar.ts` y es ahí donde se decide: **cambiar de proveedor es una
variable de entorno, no tocar cinco archivos**.

### Lo que se pierde con Acumbamail

Su API de correo (`sendOne`) admite `auth_token`, `from_email`, `to_email`, `cc_email`,
`bcc_email`, `subject`, `body`, `template_id`, `merge_tags`, `category` y `program_date`. **No
tiene** tres cosas que Brevo sí:

|                      | Brevo | Acumbamail |
| -------------------- | ----- | ---------- |
| HTML                 | sí    | sí         |
| Texto plano          | sí    | **no**     |
| Reply-To             | sí    | **no**     |
| Nombre del remitente | sí    | **no**     |

Qué significa cada una en la práctica:

- **Reply-To.** Responder a un correo de Veline ya no escribe al buzón de contacto, y —lo que
  más se nota— **responder al aviso de cita nueva ya no escribe al cliente**. Para compensarlo,
  ese correo lleva ahora el email y el teléfono del cliente como enlaces directos: un clic
  abre el correo o la llamada.
- **Texto plano.** Las plantillas siguen generando la versión en texto (Brevo la usa si se
  vuelve), pero Acumbamail solo manda el HTML. Un cliente que bloquee HTML verá menos.
- **Nombre del remitente.** Llega la dirección pelada en vez de «Veline \<…\>».

Si alguna de las tres acaba molestando, `MAIL_PROVIDER=brevo` y vuelve todo — la clave de Brevo
sigue en el `.env`.

### Configuración

```bash
MAIL_PROVIDER=acumbamail     # acumbamail | brevo
MAIL_MODE=dry                # off | dry | live
ACUMBAMAIL_TOKEN=            # sirve para el correo y para los SMS
MAIL_FROM_EMAIL=             # remitente verificado en Acumbamail
MAIL_OVERRIDE_TO=            # manda TODO aquí, sea quien sea el destinatario
BREVO_API_KEY=               # solo si se vuelve a MAIL_PROVIDER=brevo
```

Los frenos (`off`/`dry`/`live`, la redirección y el descarte de direcciones no entregables) viven
en `mail/tipos.ts` y se aplican **antes** de llegar a ningún proveedor: si cada transporte los
implementara por su cuenta, tarde o temprano uno se dejaría alguno.

### Las plantillas escapan lo que escribe el cliente

Todo lo que se pinta en un correo lo escribe alguien —el nombre del cliente, sus notas, el
nombre del servicio—, y hasta ahora entraba en el HTML tal cual. Un cliente llamado
`<img onerror=…>` inyectaba HTML en el correo que le llegaba al negocio. Ahora se escapa en el
marco y en las filas de detalle; hay una prueba que recorre las siete plantillas con un nombre
malicioso.

## SMS y recordatorios (Acumbamail)

Los SMS salen por Acumbamail, igual que el correo.

```bash
SMS_MODE=dry                 # off | dry | live
ACUMBAMAIL_TOKEN=            # panel de Acumbamail → API
SMS_SENDER=Veline            # alfanumérico, 11 caracteres como mucho
SMS_OVERRIDE_TO=             # manda TODO aquí, sea quien sea el destinatario
```

Los tres modos y los dos frenos funcionan igual que en el correo, y aquí importan más: un
correo a una dirección inventada rebota y ya, pero **un SMS a un número equivocado le llega a
alguien**, y además se cobra.

### El recordatorio

Un proceso dentro de la propia API se despierta **cada 15 minutos** y busca las citas que
empiezan dentro de **24 horas**. Manda correo (si hay dirección) y SMS.

Para no duplicar se apoya en `reminderSentAt` de la cita, y **se sella antes de enviar**: si el
envío falla se pierde ese recordatorio, que es mucho mejor que mandarle cinco al mismo cliente
porque el proceso se reinició.

Vive dentro del proceso de la API en vez de en un contenedor aparte porque con un solo servidor
no compensa la complejidad. **Si algún día hay más de una instancia hay que moverlo fuera o
poner un candado en la base**: dos procesos harían el trabajo dos veces.

### El contador

Cada envío se apunta en `MessageLog` con canal, destino, estado, motivo y coste. De ahí sale lo
que se le cobra al negocio a partir del mensaje 201.

El precio se calcula **en el momento del envío**, no al facturar: si el negocio cambia de plan a
mitad de mes, lo ya enviado mantiene el precio que tenía cuando salió.

No cuentan para el cupo del negocio ni el aviso que le llega a él mismo (es nuestro, no suyo) ni
los correos de restablecer contraseña.

### WhatsApp

**Fuera de la web.** Acumbamail no hace WhatsApp de empresa: eso exige un proveedor oficial de
Meta, verificar el número y que aprueben cada plantilla. Se quitó de la página de precios en vez
de dejar prometido algo que el producto no hace.
