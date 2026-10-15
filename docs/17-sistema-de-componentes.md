# Sistema de componentes y decisiones del rediseño

Guía corta de las piezas compartidas que salieron de la fase 1 del rediseño
(octubre 2026) y de las decisiones que las acompañan. El libro de marca
completo, con los tokens y las vistas previas, está en Claude Design:
**https://claude.ai/artifact/KMDJyG3FdqrVSjE7aBWVMa** (privado hasta que se
comparta desde la página).

## Una sola fuente para los tokens

`apps/web/src/index.css` (`@theme`) es la única fuente de verdad: colores,
escala tipográfica, capas, radios y sombras. `brand/tokens.css` ya no se edita
a mano: lo regenera `node scripts/tokens-marca.mjs`. El Design System de
Claude Design se escribió desde esos mismos valores (`tokens.json`).

Lo que cambió: el marrón de marca en pantalla es `#a46639` (4,63:1 con blanco;
el logo conserva `#a96a3e`); `ph-text` pasó a `#665238`; la escala tipográfica
incorpora `lead`, `title`, `display-sm`, `display` y `display-lg` para la web
pública (antes había 72 tamaños escritos a mano).

## Capas (`z-index`)

Siete niveles, en `index.css` como `--z-index-*` y en Tailwind como
`z-elevado`, `z-flotante`, `z-cabecera`, `z-aviso`, `z-capa`, `z-emergente`,
`z-toast`. Nada lleva un número suelto. Las fichas tapan el aviso de cookies;
los toasts tapan todo.

## Componentes compartidos

| Componente                                                                                                                                                                                                                | Para qué                                                                                                 | Dónde se usa ya                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`Sheet`](../apps/web/src/components/ui.tsx) (`puedeCerrar`)                                                                                                                                                              | La ficha/modal base. Con `puedeCerrar` pregunta antes de moverse: el fallo del modal bloqueado está ahí. | Todas las fichas, `Wizard`, `FormDialog`, `ConfirmDialog`.                                  |
| [`Segmentado`](../apps/web/src/components/Segmentado.tsx)                                                                                                                                                                 | Control segmentado a ancho completo, botones o enlaces.                                                  | `PestanasSeccion` (Servicios · Extras, Horario · Cierres · Locales, Ficha pública · Fotos). |
| [`Stepper`](../apps/web/src/components/Stepper.tsx)                                                                                                                                                                       | «Paso X de N» con nombres en escritorio y barra en el móvil.                                             | `Wizard` (todos los asistentes del panel).                                                  |
| [`SelectorProfesional`](../apps/web/src/components/SelectorProfesional.tsx)                                                                                                                                               | Píldoras con inicial o foto y «Sin preferencia».                                                         | `ApuntarCita`; la reserva del cliente en la fase 2.                                         |
| [`CalendarioMes`](../apps/web/src/components/CalendarioMes.tsx)                                                                                                                                                           | Un mes en cuadrícula con estado por día, teclado completo.                                               | La reserva del cliente y reprogramar en la fase 2.                                          |
| [`PieMinimo`](../apps/web/src/components/PieMinimo.tsx)                                                                                                                                                                   | Pie de ayuda y legal para el flujo de reserva.                                                           | Fase 2.                                                                                     |
| [`MarcoReserva`](../apps/web/src/components/reserva/MarcoReserva.tsx) + [`ResumenReserva`](../apps/web/src/components/reserva/ResumenReserva.tsx) + [`HuecosDelDia`](../apps/web/src/components/reserva/HuecosDelDia.tsx) | El marco de cada paso de la reserva con el resumen fijo; las horas de un día.                            | Reserva del cliente y reprogramar (fase 2).                                                 |
| [`GestorFotos`](../apps/web/src/components/GestorFotos.tsx)                                                                                                                                                               | Subida con progreso por archivo, arrastrar, reordenar, portada, quitar con confirmación.                 | Fotos del negocio, de servicios y de extras (`CampoFotos`).                                 |
| [`TarjetasAgenda`](../apps/web/src/pages/panel/TarjetasAgenda.tsx)                                                                                                                                                        | Hoy · Próximos · Incidencias · Equipo en carrusel (móvil) o rejilla (escritorio).                        | Agenda, vista «Hoy».                                                                        |
| `Select` nativo ([`ui.tsx`](../apps/web/src/components/ui.tsx))                                                                                                                                                           | Elegir uno de una lista corta.                                                                           | Selector de negocio del superadmin (antes un combobox a mano que fallaba en iOS).           |

Regla para elegir: un desplegable corto es un `<select>` nativo; dos o tres
vistas excluyentes, un `Segmentado`; partes de un mismo registro dentro de una
ficha, `Tabs` subrayadas; filtros de una lista, chips.

## Pruebas de interfaz

`apps/web/e2e` con Playwright (Chromium, WebKit/iPhone y Firefox en local;
Chromium y WebKit en CI, contra un Postgres del propio job):

- `descartar-cambios.spec.ts`: reproduce el fallo del modal (X, Esc, tocar
  fuera, «atrás») y comprueba que no vuelve.
- `anchos-y-accesibilidad.spec.ts`: 18 pantallas a 360, 390, 768, 1280 y
  1440 px: sin desbordes, campos de 16 px en móvil y cero fallos serios o
  críticos de axe (WCAG 2 A/AA).

Se ejecutan en `.github/workflows/deploy.yml` (job «Probar la interfaz») y
bloquean el despliegue. En local: `npm run e2e -w @veline/web` con el entorno
de Docker levantado.

## Decisiones tomadas en la fase 1

- **Zonas pulsables:** 44 px en todo lo táctil; 40 px en escritorio con ratón
  para navegación y acciones de fila.
- **Opacidad no es un estado:** lo oculto o sin publicar lo dice una insignia
  y el texto pasa a `muted`; atenuar una fila entera rompía el contraste.
- **`disabled` solo para controles deshabilitados**; el texto informativo
  («cerrado») va en `subtle`.
- **Movimiento:** `Reveal` y las fichas respetan `prefers-reduced-motion`;
  las pruebas corren con movimiento reducido para medir la pantalla quieta.
