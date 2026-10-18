# Fase 7 — La misma estética y el mismo funcionamiento en toda la plataforma

Tras las seis fases, parte de la plataforma sigue con el aspecto y los
patrones de antes. Este documento recorre cada pantalla que quedó fuera,
dice qué le falta respecto a lo nuevo y qué se hace. El criterio es el de
`docs/17`: segmentado para elegir una vista entre pocas, pestañas subrayadas
para partes de un mismo registro, chips solo para filtros múltiples, 44 px
en lo táctil, esqueletos/vacío/error en todas, asistente paso a paso para
cualquier cosa de más de una pantalla.

## 1. La reserva del cliente, de verdad paso a paso

Lo que había tras la fase 2: la ficha del negocio hacía de «paso 1» (una
página larga con fotos, pestañas, lista de servicios y un widget), y el
asistente solo empezaba al elegir un servicio. No se parece al del
administrador, que es un asistente a pantalla completa desde el primer paso.

**Ahora:**

- La ficha del negocio es solo la ficha (fotos, nombre, servicios como
  información, reseñas, info) con un único botón «Reservar cita» (barra fija
  abajo en el móvil, tarjeta a la derecha en escritorio). Tocar un servicio
  de la lista también arranca la reserva con ese servicio ya elegido.
- `/:slug/reservar` es el **paso 1: «¿Qué quieres reservar?»**, una pantalla
  limpia con los servicios como tarjetas grandes; tocar una pasa al paso
  siguiente. Luego extras (si hay), fecha y hora, tus datos: los mismos
  pasos, con «Paso X de N» desde el primero.
- En el móvil, la reserva se ve como una app: sin la cabecera pública, con
  su propia barra (atrás · nombre del negocio · salir), el indicador de
  pasos, el contenido y la barra inferior con el total y el botón. En
  escritorio, cabecera normal, pasos a la izquierda y resumen a la derecha.

## 2. Panel del negocio

| Pantalla                     | Qué le faltaba                             | Qué se hace                                                                                                                                                  |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agenda › Lista               | Filtros Hoy/7 días/Todo como chips sueltos | Segmentado pequeño                                                                                                                                           |
| Clientes                     | Filtros como chips; buscador aparte        | Segmentado (Todos · Repiten · Con cita · Han faltado) + buscador en la misma fila; ficha lateral sin cambios (pestañas subrayadas: partes del mismo cliente) |
| Contabilidad                 | Cabecera de mes propia                     | Misma cabecera de mes que el calendario; tarjetas de cifra con el estilo de la agenda                                                                        |
| Servicios · Extras           | Ya en segmentado                           | Sin cambios de estructura; 44 px en acciones de fila en el móvil                                                                                             |
| Equipo                       | Fichas y asistentes ya nuevos              | Sin cambios                                                                                                                                                  |
| Horario · Cierres · Locales  | Ya en segmentado                           | Sin cambios                                                                                                                                                  |
| El negocio · Fotos           | Hecho en fase 3                            | —                                                                                                                                                            |
| Enlaces, Suscripción, Cuenta | Tarjetas y tipografía correctas            | Pequeños ajustes de tamaño (nada por debajo de 44 px en táctil)                                                                                              |
| Actividad                    | Pestañas + chips de tipo                   | Segmentado para el tipo; pestañas se quedan para «Negocio · Plataforma»                                                                                      |

## 3. Plataforma (superadmin)

| Pantalla          | Qué se hace                                              |
| ----------------- | -------------------------------------------------------- |
| Negocios          | Lista con filas estiradas, sin cambios de estructura     |
| Cuentas           | Filtros → segmentado                                     |
| Cobros            | Filtros → segmentado                                     |
| Ficha del negocio | Pestañas subrayadas (partes del mismo negocio): correcto |

## 4. Web pública

| Pantalla                    | Qué se hace                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Ficha del negocio           | Pestañas Servicios · Reseñas · Info → segmentado; botón único de reservar; servicios como lista informativa que también arranca la reserva  |
| Buscador                    | Campos a 16 px, chips de sector a 44 px en el móvil, cabecera de resultados en `title`                                                      |
| Reserva hecha               | Tarjeta como último paso («Hecho»), cancelar con la confirmación estándar (con consecuencias y foco en «Mantener»), no la pregunta en línea |
| Login, recuperar, verificar | Mismo marco que el alta; tipografía de la escala                                                                                            |
| Legal                       | Sin cambios                                                                                                                                 |

## Estado

Hecho y desplegado en esta fase: la reserva como asistente desde el servicio
(`/:slug/reservar`, `BookingService`, barra propia en `MarcoReserva`, cabecera
pública oculta en el móvil durante la reserva), la ficha del negocio con
segmentado y un solo botón de reservar, los filtros exclusivos de Agenda ›
Lista, Clientes, Actividad, Cuentas y Cobros en segmentado, la cancelación de
la reserva hecha con la confirmación estándar, y el buscador con campos de
16 px y chips de 44 px en el móvil. Pruebas E2E actualizadas al nuevo primer
paso y `/:slug/reservar` añadida al barrido de anchos y axe.
