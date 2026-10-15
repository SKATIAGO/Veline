# Fase 2 — Flujo de reserva del cliente

Las propuestas que se barajaron, la decisión y lo que se construyó. El encargo
pedía un flujo paso a paso con una decisión por pantalla, progreso visible,
resumen persistente, calendario mensual, selector de profesional unificado y
pie mínimo.

## Lo que había

Ficha del negocio (elegir servicio) → extras (si hay carta) → fecha (con
selectores de persona **y de servicio otra vez**, una tira de 14 días en el
móvil y un calendario solo en escritorio) → datos → hecha. Sin «paso X de N»,
sin resumen en el móvil, con el pie completo en cada paso y sin forma de
reservar a más de dos semanas desde el móvil.

## Tres estructuras

|                            | A. Ficha = paso 0 (elegida)                                                                                                              | B. Asistente en ficha (Sheet)                                                                                                      | C. Página `/reservar` propia                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Dónde se elige el servicio | En la ficha, como ahora; al elegir arranca el asistente con «Paso 2 de N».                                                               | En una ficha modal sobre la ficha del negocio, con el servicio como paso 1.                                                        | En una página nueva con el servicio como paso 1, la ficha solo informa. |
| Pros                       | Cada paso tiene URL (se comparte, se recarga, «atrás» funciona); la ficha sigue siendo la landing del negocio; el cambio es incremental. | Sensación de app, no se pierde el contexto de la ficha.                                                                            | Flujo autocontenido, fácil de medir.                                    |
| Contras                    | El paso 1 vive en otra pantalla; hay que decirlo («Paso 1 de 4») en la ficha.                                                            | Las fichas no tienen URL por paso; un asistente largo con teclado en el móvil se queda sin sitio; «atrás» y recargar se complican. | Duplica la lista de servicios; un paso más antes de ver nada.           |

**Decisión: A.** Es lo que mejor casa con URLs compartibles, con el historial
y con lo que ya existe. La ficha enseña «Paso 1 de N · Elige un servicio para
reservar» sobre la lista de servicios; el resto de pasos llevan el `Stepper`.

## Calendario y horas

|          | Tira de 14 días + calendario en escritorio (antes)                                                                                                                                               | Mes en cuadrícula en todo (elegido)       | Lista de días con sus horas |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------- |
| Alcance  | 14 días en el móvil                                                                                                                                                                              | 2 meses (60 días; el servidor permite 62) | el que se cargue            |
| Lectura  | rápida, pero corta                                                                                                                                                                               | de un vistazo se ve qué días hay hueco    | larga, hay que desplazarse  |
| Decisión | `CalendarioMes` en móvil y escritorio: días con hueco en blanco, completos tachados, cerrados atenuados; teclado completo. Las horas del día elegido debajo, en Mañana y Tarde (`HuecosDelDia`). |                                           |                             |

## Escritorio

Pasos a la izquierda (columna principal, 640 px de ancho de lectura) y el
resumen de la reserva fijo a la derecha (`MarcoReserva`), con el botón de
continuar dentro del resumen. En el móvil el resumen va plegado encima del
paso (`<details>`) y la barra fija de abajo lleva el total y el botón.

## Lo construido

- `components/reserva/MarcoReserva.tsx`: atrás, `Stepper`, contenido, resumen
  fijo (escritorio) / plegado + barra inferior (móvil), galería.
- `components/reserva/ResumenReserva.tsx`: servicio, extras, local, persona,
  fecha y hora, duración, con «Cambiar» a cada paso.
- `components/reserva/HuecosDelDia.tsx`: las horas en Mañana y Tarde.
- `components/reserva/SinServicio.tsx`: llegar a un paso sin servicio ya no
  coge el primero en silencio; se dice y se vuelve a la ficha.
- `BookingExtras`, `BookingDate`, `BookingConfirm` y `BookingReschedule`
  reescritos sobre esas piezas; `SelectorProfesional` sustituye al `<select>`
  de persona; el selector de servicio desaparece del paso de fecha.
- `Layout`: `PieMinimo` en `/:slug/reservar/*` y en reprogramar.
- Prueba E2E `e2e/reserva.spec.ts`: ficha → extras → fecha → datos → hecha,
  en móvil y escritorio, y el guardado de servicio obligatorio.

## Lo que no cambia

El servidor ya exigía el servicio (`serviceId` obligatorio en el esquema) y
valida los huecos; la URL sigue llevando lo elegido para que recargar o
compartir no pierda nada.
