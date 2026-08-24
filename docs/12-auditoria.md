# Registro de auditoría

Responde a la pregunta que llega semanas después: **¿quién canceló esa cita? ¿quién cambió ese
precio? ¿quién dio de alta a esa persona?** Sin registro, la única respuesta posible es «no se
sabe», y en un panel donde varias personas del mismo negocio tocan la agenda eso acaba en
discusión.

## Qué se registra

| Acción                    | Cuándo                                              |
| ------------------------- | --------------------------------------------------- |
| `SESION_INICIADA`         | Alguien entra al panel                              |
| `SESION_FALLIDA`          | Intento de acceso con contraseña o email erróneos   |
| `SESION_CERRADA`          | Alguien sale                                        |
| `CONTRASENA_CAMBIADA`     | Cambio desde el panel, sabiendo la actual           |
| `CONTRASENA_OLVIDADA`     | Se pide el enlace de restablecimiento               |
| `CONTRASENA_RESTABLECIDA` | Se usa el enlace y se elige una nueva               |
| `USUARIO_CREADO`          | Alta de una persona del equipo                      |
| `USUARIO_ACTIVADO`        | Se le vuelve a dar acceso                           |
| `USUARIO_DESACTIVADO`     | Se le quita el acceso                               |
| `NEGOCIO_CREADO`          | Alta de un negocio (solo superadmin)                |
| `SERVICIO_CREADO`         | Nuevo servicio                                      |
| `SERVICIO_EDITADO`        | Cambio de nombre, precio, duración, margen o estado |
| `SERVICIO_ELIMINADO`      | Baja lógica de un servicio                          |
| `HORARIO_EDITADO`         | Cambio del horario de apertura                      |
| `RESERVA_CREADA`          | Se crea una cita                                    |
| `RESERVA_CANCELADA`       | Se cancela, desde el panel o por el propio cliente  |

Los nombres se guardan tal cual en la base de datos: **renombrar uno reescribe el pasado**.

## Qué guarda cada entrada

Quién (id, y copia del email, nombre y rol), a qué negocio afecta, sobre qué entidad, una frase
en español lista para leer, un detalle libre en JSON, la IP y el navegador.

El email y el nombre se **copian** a propósito. Si el usuario se borra, `actorId` se queda a
null pero el registro sigue diciendo quién fue; con solo la referencia, borrar a alguien
borraría su rastro, que es justo lo contrario de lo que hace falta.

En los cambios se guarda **solo lo que cambió**, no la fila entera:

```json
{ "priceCents": { "antes": 5900, "despues": 4500 }, "durationMin": { "antes": 30, "despues": 45 } }
```

## Quién lo ve

| Rol          | Alcance                     |
| ------------ | --------------------------- |
| `SUPERADMIN` | Toda la plataforma, con IP  |
| `ADMIN`      | Solo su negocio, **sin IP** |
| `EMPLEADO`   | Nada — la API responde 403  |

La IP se le oculta al admin del negocio a propósito: es un dato personal de su equipo que no
necesita para gestionar la agenda.

El alcance lo fija **la sesión, no la petición**: a un admin se le ignora el `businessId` que
mande y se le fuerza el suyo.

En el panel está en la pestaña **Actividad** (`/panel/:slug/actividad`, y
`/panel/admin/actividad` para el superadmin).

## Dos reglas que gobiernan el código

Están en [`apps/api/src/audit/log.ts`](../apps/api/src/audit/log.ts):

**1. Registrar nunca puede tumbar la operación.** `audit()` no se espera: se dispara y se
olvida, con el error capturado. Si la base falla al escribir el registro, la cita ya está
cancelada y quien la canceló tiene que ver que se canceló.

**2. Nunca entra un secreto.** Las contraseñas y los tokens pasan por los mismos endpoints que
se auditan. `redactar()` sustituye por `[oculto]` el valor de cualquier clave que contenga
`password`, `contraseña`, `token`, `secret`, `apikey`, `hash` o `cookie`, a cualquier nivel de
anidamiento — en vez de confiar en que quien llame se acuerde de no pasarla. Hay pruebas en
[`audit.test.ts`](../apps/api/src/audit/audit.test.ts) porque es un fallo que no se ve: el
registro se sigue escribiendo, solo que con la contraseña dentro.

## Solo se escribe y se lee

No hay endpoint que edite ni borre entradas. Un registro que el propio sistema puede reescribir
no sirve para lo que existe.

Lo que sí lo borra: **dar de baja un negocio** (`onDelete: Cascade`) se lleva su registro por
delante. Es deliberado —los datos del negocio se van con el negocio— pero conviene saberlo
antes de borrar uno.

## Lo que falta

- **Caducidad.** El registro crece sin límite. Con el volumen de hoy no es problema, pero hace
  falta decidir cuánto se guarda (¿un año?) y un proceso que borre lo más viejo.
- **Exportar.** Un CSV para el negocio que quiera llevárselo.
- **Filtrar por persona y por fechas.** Hoy solo hay filtros rápidos por tipo de acción.
- **Cambios de datos del negocio y del equipo (Staff).** Todavía no se auditan porque aún no
  hay endpoints que los editen.
