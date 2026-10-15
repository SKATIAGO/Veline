# Cierre del rediseño — revisión global y checklist de aceptación

Qué se pidió (encargo de octubre de 2026), qué se hizo, cómo se comprobó y
qué queda. Los detalles de cada fase están en `16` (auditoría y plan), `17`
(componentes), `18` (reserva), `19` (panel), `20` (web pública) y `21`
(correos). Capturas en `docs/capturas/`.

## Checklist por tarea

| Tarea                         | Pedido                                                                                                                                                                              | Hecho                                                                                                                  | Comprobado con                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 Selector de empresas      | `<select>` nativo, sin librería, accesible, sin desbordes                                                                                                                           | Sí: `SelectorNegocio` es un `<select>` con filtro de texto encima cuando hay muchos                                    | Prueba de anchos (sin desbordes), axe; funciona en iOS por ser nativo                                                                             |
| 3.2 Modal «Descartar cambios» | Cerrarlo sin decidir no bloquea; mismo patrón en todas las confirmaciones                                                                                                           | Sí: `Sheet.puedeCerrar`; afecta a Wizard, FormDialog y todas las fichas                                                | `e2e/descartar-cambios.spec.ts` (X, Esc, fuera, «atrás») en Chromium, móvil, iPhone y Firefox                                                     |
| 3.3 Flujo de reserva          | Paso a paso, progreso, atrás, resumen persistente, calendario mensual, profesional unificado con «Sin preferencia», servicio obligatorio, pie mínimo, escritorio propio             | Sí: `MarcoReserva`, `Stepper`, `CalendarioMes` (2 meses), `SelectorProfesional`, `SinServicio`, `PieMinimo`            | `e2e/reserva.spec.ts` (ficha → extras → fecha → datos → hecha) en 4 navegadores; anchos y axe                                                     |
| 3.4 Landing                   | Resumir; entender qué es en 10 s; un CTA                                                                                                                                            | Sí: 5 secciones, ~15 frases, un botón principal                                                                        | Anchos/axe; revisión manual de copia                                                                                                              |
| 3.5 Alta de negocio           | Paso a paso, progreso, borrador, validación, resumen; idioma por debajo de modales                                                                                                  | Sí: 4 pasos, borrador en localStorage, resumen con «Editar»; capa `elevado`                                            | `e2e/alta.spec.ts` (validación, recarga con borrador, resumen, empezar de cero)                                                                   |
| 3.6 Precios                   | 2–3 formas; inequívoco; móvil y escritorio                                                                                                                                          | Sí: dos planes + calculadora + «qué va aparte»; Equipo como franja                                                     | Anchos/axe; revisión manual                                                                                                                       |
| 3.7 Marketplace               | Tarjeta entera clicable, CTA secundario, foco/hover                                                                                                                                 | Sí: enlace estirado, aro de foco en la tarjeta                                                                         | Anchos/axe                                                                                                                                        |
| 3.8 Correos                   | Rediseño con la marca, HTML robusto, modo oscuro, texto plano, preheader, capturas                                                                                                  | Marco nuevo (tablas, MSO, VML, oscuro, preheader, texto plano); capturas del navegador en claro/oscuro y 375/1024      | Pruebas de escape e idioma (`templates.test.ts`, `idioma.test.ts`); **render en Gmail/Outlook/Apple Mail pendiente** (sin herramienta ni buzones) |
| 3.9 Fichaje                   | Sin solape Desde/Hasta; fichar en una pantalla, histórico en otra con corrección trazable; escritorio; normativa                                                                    | Sí: Fichar / Historial, pausas, historial de correcciones, descarga para el empleado, tabla en escritorio              | `e2e/fichaje.spec.ts`; anchos/axe; nota normativa en `19`                                                                                         |
| 3.10 Fotos                    | Subida clara con progreso por archivo, previsualización, reordenar, portada, eliminar con confirmación, validación y compresión, cuadrícula responsive; segmentado a ancho completo | Sí: `GestorFotos` en negocio, servicios y extras; `Segmentado` en Ficha pública · Fotos                                | `e2e/fotos.spec.ts`; anchos/axe                                                                                                                   |
| 3.11 Agenda                   | Auditar datos, 2–3 variantes, carrusel de tarjetas con scroll-snap, escritorio en columnas, accesible                                                                               | Sí: `TarjetasAgenda` (Hoy · Próximos · Incidencias · Equipo), puntos y flechas, anuncio en vivo; rejilla en escritorio | Medido en 390 (4 tarjetas, snap, sin desborde); anchos/axe                                                                                        |
| Componentes compartidos       | Stepper, selector de profesionales, calendario, modal, segmentado, card, botón, pie mínimo; documentados                                                                            | Sí, más GestorFotos, MarcoReserva y TarjetasAgenda; `docs/17` y el Design System de Claude Design                      | —                                                                                                                                                 |

## Requisitos transversales

- **Capas**: escala global de siete niveles (`--z-index-*`), documentada en
  `index.css` y en el Design System. El selector de idioma, los toasts y los
  modales no se pisan.
- **Estados**: cargando (esqueletos con `aria-busy`), vacío, error y hecho en
  las pantallas tocadas; `HuecosDelDia`, `GestorFotos` y `TarjetasAgenda`
  traen los suyos.
- **Rendimiento**: carga por rutas (ya hecha), fotos comprimidas en cliente,
  sin saltos de layout en lo nuevo (esqueletos del tamaño de lo que viene).
- **Consistencia**: tokens únicos (`index.css` → `brand/tokens.css` →
  Design System), escala tipográfica con nombre, botones píldora, campos con
  radio pequeño, 44 px en lo táctil.
- **Accesibilidad**: axe (WCAG 2 A/AA) en 18 pantallas × 5 anchos sin fallos
  serios; foco visible; teclado en calendario, segmentados y carrusel;
  `prefers-reduced-motion` respetado.
- **Pruebas**: 3 262 unitarias (vitest) + 7 ficheros E2E (Playwright) en
  Chromium, Pixel 7, iPhone 14 (WebKit) y Firefox en local; Chromium y WebKit
  en CI contra un Postgres del job. Bloquean el despliegue.

## Cómo se prueba

```bash
npm test                      # unitarias
npm run e2e -w @veline/web    # interfaz, con el Docker local levantado
```

## Lo que queda (no se ha podido cerrar aquí)

1. **Render de correos en clientes reales** (Gmail, Outlook, Apple Mail,
   Yahoo): hace falta una herramienta o buzones de prueba. El HTML sigue las
   reglas de cada cliente; la captura por cliente está pendiente.
2. **Dispositivos reales**: todo se ha probado con motores reales (Chromium,
   WebKit, Firefox) pero no en un iPhone o Android físicos. Recomendado: una
   pasada con el móvil por la reserva, el fichaje y la agenda.
3. **Registro de jornada**: lo construido cubre el borrador del Real Decreto
   (pausas, correcciones inalterables, acceso del trabajador); cuando se
   publique el texto definitivo habrá que contrastarlo.
4. **Logo en los correos**: va en texto; cuando haya un PNG del logotipo se
   pone con `width`, `height` y `alt`.
5. **Usabilidad real de la agenda**: el reparto de tarjetas parte del criterio
   acordado, no de datos de uso; conviene mirar con dos negocios reales qué
   tarjeta abren y cuál no.
