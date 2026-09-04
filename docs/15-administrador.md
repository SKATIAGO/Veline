# El administrador

Lo que puede hacer cada rol, y lo que hay detrás de cada decisión. Construido en septiembre de
2026 sobre el plan de las cinco fases.

## Quién ve qué

| Pantalla   | Empleado | Administrador | Superadmin |
| ---------- | -------- | ------------- | ---------- |
| Agenda     | ✓        | ✓             | ✓          |
| Clientes   | ✓        | ✓             | ✓          |
| Servicios  | —        | ✓             | ✓          |
| Horario    | —        | ✓             | ✓          |
| Personas   | ver      | ✓             | ✓          |
| Equipo     | —        | ✓             | ✓          |
| El negocio | —        | ✓             | ✓          |
| Tu cuenta  | —        | ✓             | ✓          |
| Actividad  | —        | ✓             | ✓          |
| Negocios   | —        | —             | ✓          |
| Cuentas    | —        | —             | ✓          |
| Cobros     | —        | —             | ✓          |

El alcance lo fija **la sesión, no la petición**: a un administrador se le ignora el negocio que
mande y se le fuerza el suyo.

## Personas ≠ Equipo

Es la distinción que más confunde y por eso son dos pantallas:

- **Personas** son quienes atienden citas. El motor reparte cada cita entre las que están libres
  a esa hora, así que **cuantas más personas, más citas a la vez**. Es la unidad por la que se
  cobra: el plan Negocio incluye dos y cada una de más son 10,95 €.
- **Equipo** son las cuentas para entrar al panel.

Alguien puede atender sin tener usuario (el chico de los sábados) y alguien puede administrar sin
atender a nadie (el dueño que solo mira números).

Dar de baja a una persona con citas por delante **se rechaza**: primero hay que moverlas o
cancelarlas. Si no, esas citas quedarían huérfanas en la agenda.

## La agenda ya se puede tocar

Antes solo se podía mirar y cancelar. Ahora:

- **Apuntar una cita** a mano — la del teléfono o la del mostrador. Nace como `DIRECTO`, no como
  marketplace: la trajo el negocio, así que **no genera comisión**.
- **Mover** una cita de hora. Libera el hueco viejo dentro de la misma transacción antes de
  buscar quién queda libre; si no, la propia cita que se está moviendo se contaría como ocupada.
- **Marcar si vino o no vino**. «No vino» es un estado propio y no una cancelación: cancelar
  libera el hueco a tiempo, faltar se lo come. De ahí salen los avisos de la ficha del cliente.

Marcar una cita como atendida **pide la reseña sola**.

## Vacaciones

El modelo guarda **un día por fila**, que es como lo consulta el motor de huecos. De cara al
negocio eso no vale —unas vacaciones son un tramo, no quince filas—, así que la API acepta el
rango, guarda los días sueltos y al listarlos vuelve a juntar los seguidos con el mismo motivo.

Las citas ya reservadas dentro del cierre **no se tocan solas**: se avisa de cuántas hay para que
el negocio decida si las mueve o las cancela.

## Suscripciones

`Plan` dice qué contrató; `SubStatus` dice en qué punto está: `PRUEBA`, `ACTIVA`, `IMPAGADA`,
`SUSPENDIDA`, `CANCELADA`.

Lo que de verdad importa: **un negocio suspendido, dado de baja o con la prueba caducada deja de
aceptar reservas**. Se comprueba en el endpoint público, no solo al pintar la ficha — si no,
bastaría con llamar a la API directamente para saltárselo.

`IMPAGADA` **no corta**: primero se avisa. Cortar por un recibo devuelto sin hablar antes es la
forma más rápida de perder un cliente que iba a pagar.

Los precios viven en `@veline/shared`, no en la página de precios: los usan la web, lo que se
cobra y lo que el sistema deja hacer. Tres copias del mismo número acaban diciendo cosas
distintas.

El dueño solo ve aviso cuando **hay algo que decir**: quedan cinco días de prueba o menos, hay
una cuota pendiente, o ha dejado de aceptar reservas. Una suscripción al día no merece un cartel.

## Recordatorios y mensajes

Ver [08-correo.md](08-correo.md) para el detalle. Lo esencial:

- Un proceso dentro de la API se despierta cada 15 minutos y avisa de las citas de dentro de 24 h,
  por correo y SMS, los dos por Acumbamail.
- Se sella `reminderSentAt` **antes** de enviar: perder un recordatorio es mucho mejor que
  mandarle cinco al mismo cliente porque el proceso se reinició.
- Cada envío se apunta con su coste. El precio se calcula **al enviar**, no al facturar: si el
  negocio cambia de plan a mitad de mes, lo ya enviado mantiene su precio.
- **Con más de una instancia de la API hay que sacar este proceso fuera o poner un candado**: dos
  procesos harían el trabajo dos veces.

## El dinero

**El cobro es manual** (transferencia o recibo). El sistema calcula y guarda constancia; no cobra
nada. Cuando entre una pasarela, el cálculo no cambia — solo cambia quién lo ejecuta.

Tres conceptos: cuota del plan con las personas de más, comisiones del marketplace y mensajes
fuera de cupo.

**La atribución del origen** es la pieza que hace honesta la comisión. La página de precios
promete que si el cliente llega por tu Instagram no pagas nada, y eso era imposible de cumplir:
la web marcaba toda reserva como marketplace. Ahora cada negocio tiene sus enlaces
(`?origen=instagram`, `google`, `web`) desde su pantalla «Tu cuenta».

El origen lo manda el navegador, así que **no es a prueba de manipulación**. Pero quien lo
manipularía sería el propio negocio para pagar menos, y eso se ve en sus propios números; mirar
el `referer` se falsea igual de fácil.

El cierre de mes **congela** las cifras y es idempotente: volver a cerrarlo no duplica nada. Un
mes a cero no genera cobro, para no llenar la lista de importes de 0 €.

## Reseñas

Solo reseña quien tuvo la cita. Al marcarla atendida se genera un testigo y se manda el enlace;
del testigo se guarda **el hash**, igual que con las sesiones, y se consume al usarlo: una cita,
una reseña.

Un negocio sin reseñas enseña **«Nuevo en Veline»**, no «0,0 ★». Acabar de llegar no es lo mismo
que ser malo.

La nota se guarda en el negocio en vez de calcularse al vuelo porque el marketplace ordena por
ella: hacer una agregación por cada fila de cada búsqueda no sale a cuenta.

## Lo que sigue faltando

- **Pasarela de pago.** Decisión tomada: manual por ahora. A partir de cinco negocios, la hora al
  mes que se va persiguiendo cobros cuesta más que la comisión de Stripe.
- **Entrar como el negocio** para dar soporte. Hoy hay que pedirle la contraseña o tocar la base.
  Cuando se haga, tiene que quedar en el registro de auditoría.
- **Métricas de plataforma**: cuánto se factura al mes, altas y bajas, negocios en riesgo.
- **Fotos del negocio.** El endpoint acepta una lista de URLs pero no hay subida de archivos ni
  pantalla: hoy solo se pueden cambiar por API.
- **WhatsApp.** Fuera de la web a propósito: exige proveedor oficial de Meta.
- **Multi-sucursal real.** El plan Equipo lo promete y el modelo aguanta varios locales, pero
  hasta que haya un cliente con dos sedes es trabajo sin destinatario.
