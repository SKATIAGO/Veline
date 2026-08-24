# Panel de superadministrador

Qué puede hacer quien lleva Veline, y desde dónde. El ámbito de plataforma vive en
`/panel/admin` y solo lo ve el rol `SUPERADMIN`; la API responde 403 a cualquier otro.

## Las tres pestañas

### Negocios (`/panel/admin`)

Alta de negocios y de sus cuentas de acceso, con cuatro cifras arriba: negocios, citas totales,
cuentas de acceso y **cuántos negocios están sin servicios**.

Ese último dato es el que de verdad importa: un negocio sin servicios **no puede recibir
reservas**. Cada fila avisa de lo mismo con etiquetas:

- `Sin servicios` — está dado de alta pero no puede vender nada.
- `Sin acceso` — nadie del negocio puede entrar al panel todavía.

De cada negocio se ven las citas, los servicios y el tamaño del equipo, y hay dos acciones
directas: **crear cuenta** y **abrir panel**. El buscador aparece a partir de siete negocios.

### Cuentas (`/panel/admin/usuarios`)

Todas las cuentas de acceso de la plataforma en una lista, con filtros por rol y por «sin
acceso», y búsqueda por nombre, email o negocio.

Existe porque antes **solo se podían ver negocio a negocio**: responder a «¿quién tiene acceso a
Veline?» obligaba a entrar en cada uno. La API ya servía estos datos (`GET /api/admin/users` y
`PATCH /api/admin/users/:id`), pero ninguna pantalla los usaba.

Quitar el acceso cierra al momento las sesiones abiertas de esa persona y le impide entrar. No
borra nada de lo que haya hecho, y queda registrado en Actividad.

Nadie puede desactivarse a sí mismo — lo impide la API, no solo la interfaz: es lo que evita
quedarse fuera de la plataforma sin forma de volver a entrar.

### Actividad (`/panel/admin/actividad`)

El registro de auditoría de toda la plataforma, con las IP. Ver
[12-auditoria.md](12-auditoria.md).

## Moverse entre ámbitos

Dentro de un negocio, la cabecera trae un selector para saltar a otro y un botón **Plataforma**.
En la plataforma, el botón cambia a **Ir a un negocio**. La barra de pestañas cambia de contenido
según dónde estés: son dos ámbitos distintos y mezclarlos en una fila confunde sobre qué estás
mirando.

## Contraseñas de alta

Al crear una cuenta se genera una contraseña al azar, sin caracteres confundibles (nada de `l`,
`1`, `O`, `0`), para poder dictarla por teléfono. **Se enseña una sola vez**, con un botón de
copiar: no se guarda en claro en ningún sitio, así que no hay forma de volver a consultarla.
Quien entre puede cambiarla desde su cuenta, y si se pierde queda el enlace de recuperación por
correo.

## Entrar como superadmin

En producción la cuenta se crea desde `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` del `.env` del
VPS, y **solo si no existe ya**: el seed nunca pisa una contraseña puesta, así que cambiarla
desde el panel no se revierte en el siguiente despliegue.

En desarrollo el seed crea además `super@veline.test` con la contraseña `veline-demo-1234`, con
la misma guarda que los demás usuarios de prueba (`NODE_ENV !== 'production'`). Sin eso, probar
estas pantallas en local obligaba a tocar la base de datos a mano.

## Lo que todavía no hay

- **Editar un negocio.** Se da de alta pero no se pueden cambiar después su nombre, categoría,
  dirección ni plan desde el panel.
- **Cambiar de plan.** Todos nacen en Gratis y no hay forma de moverlos.
- **Dar de baja un negocio.** No existe el endpoint, y conviene pensarlo despacio: borrar un
  negocio se lleva por delante sus citas y su registro de auditoría.
- **Cambiar el rol de una cuenta.** Solo se puede activar y desactivar, no pasar de Equipo a
  Administrador.
