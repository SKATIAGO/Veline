# Fase 3 — Panel: agenda, fichaje y fotos

Las alternativas, la decisión y lo construido para las tres pantallas del
panel que el encargo señala (3.11 agenda, 3.9 fichaje, 3.10 fotos), más el
control segmentado donde correspondía.

## Agenda

### Qué datos se usan de verdad

Lo que había en pantalla: título + «3 servicios · 6 empleados», botón de
apuntar, pestañas Lista/Calendario, cuatro tarjetas (citas hoy, próximos 7
días, ingresos de la semana, clientes nuevos), la lista de citas con filtros
Hoy / 7 días / Todo, y cada cita con hora, servicio, cliente, teléfono,
persona, precio, origen, Mover y Cancelar.

Sin datos de uso (pregunta 6, se aprobó el criterio por defecto), lo que un
mostrador necesita en una mirada es, por este orden: **qué toca ahora y
después hoy**, **qué queda libre hoy**, **qué viene esta semana**, **qué se ha
torcido** (canceladas, no vino) y **quién trabaja hoy**. Los ingresos y los
clientes nuevos son de contabilidad y de clientes, no del día a día: se van a
sus pantallas (siguen en Contabilidad y Clientes).

### Tres variantes

|            | A. Tarjetas a pantalla completa (elegida en móvil)                                                                                                              | B. Lista única con secciones                                            | C. Panel de columnas también en móvil              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| Móvil      | Un carrusel horizontal con `scroll-snap`: Hoy · Próximos · Incidencias · Equipo. Cada tarjeta llena la pantalla; puntos debajo y flechas para quien no desliza. | Todo en una columna larga: hoy, luego la semana, luego incidencias.     | Columnas apiladas: igual que B pero con más marco. |
| Escritorio | Las mismas tarjetas en rejilla de dos o tres columnas; se recorren con Tab.                                                                                     | Igual que en móvil, con más ancho.                                      | Tres columnas.                                     |
| Pros       | Lo esencial de hoy ocupa la pantalla entera; fluido con el dedo; cada tarjeta es una pregunta.                                                                  | Simple, nada se esconde.                                                | Mucha información de golpe.                        |
| Contras    | Lo que no está en la primera tarjeta hay que ir a buscarlo (los puntos lo dicen).                                                                               | Hay que desplazarse mucho para llegar a lo de la semana; sin jerarquía. | En el móvil es la pantalla actual: demasiado.      |

**Decisión: A en móvil, rejilla en escritorio** (`TarjetasAgenda`). La vista
Lista completa (todas las citas con filtros) y el Calendario siguen
disponibles en un segmentado: Hoy · Lista · Calendario.

## Fichaje

Dos pantallas (segmentado Fichar · Historial):

- **Fichar** (`/fichaje`): el estado en grande («Estás dentro desde las
  09:02»), el tiempo acumulado de hoy en vivo, un botón grande para entrar o
  salir, y Pausa / Reanudar cuando se está dentro. Es lo que hace un
  empleado en dos segundos al llegar.
- **Historial** (`/fichaje/historial`): el histórico con filtro de fechas,
  descarga del archivo (también el empleado, solo el suyo), y para quien
  administra, corregir en un panel lateral y añadir un fichaje olvidado. En
  escritorio, tabla con columnas; en el móvil, filas.

Normativa (aprobado en la pregunta 7): las correcciones ya no sobrescriben
sin dejar rastro: cada una es una fila de `FichajeCorreccion` (antes, después,
quién, cuándo, por qué) y se enseña entera; las pausas se registran
(`FichajePausa`) y se descuentan de los minutos; el archivo lleva pausas y
número de correcciones. Las columnas antiguas (`entradaOriginal`…) se
mantienen por compatibilidad y las correcciones previas se volcaron al
historial en la migración.

## Fotos

`GestorFotos`, un solo componente para las fotos del negocio y para las de
servicios y extras:

- Zona de subida clara: arrastrar aquí o elegir varias; validación de tipo y
  peso antes de subir; compresión en cliente (1600 px, JPEG).
- Cada archivo con su progreso real (XHR), su éxito o su error, y una
  vista previa inmediata.
- Reordenar con arrastrar y soltar y con botones (← →) para teclado; la
  primera es la portada y se puede marcar cualquiera.
- Eliminar con confirmación (y deshacer en las del negocio).
- Cuadrícula fluida (`auto-fill, minmax(112px, 1fr)`): sin huecos a 360 ni
  tarjetas perdidas a 1440.
