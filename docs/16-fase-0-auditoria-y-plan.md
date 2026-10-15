# Fase 0 — Auditoría y plan del rediseño (octubre 2026)

Estado real del producto antes de tocar nada: qué hay, qué falla, qué se repite,
y el plan por fases con sus dependencias. Al final, las preguntas abiertas que
hay que contestar antes de empezar.

## 1. Cómo se ha auditado

- Entorno local con los datos de demostración, con sesión de administrador
  (`admin@taller.test`) y de superadmin (`super@veline.test`).
- Cada pantalla cargada a **360, 390, 768, 1280 y 1440 px** en un marco del
  mismo origen, midiendo con JS: desborde horizontal, zonas pulsables por
  debajo de 44 px, campos por debajo de 16 px, capas fijas y su `z-index`, y si
  el selector de idioma pisa alguna capa.
- Los fallos que describe el encargo se han **reproducido a mano** y se ha
  localizado la causa en el código.
- Lo que NO se ha podido comprobar: Safari/iOS y Android reales (solo
  Chromium), gestos táctiles, el render de los correos en clientes reales
  (Gmail, Outlook, Apple Mail). Ver preguntas 8 y 9.

## 2. Inventario

### 2.1 Superficies y rutas

| Superficie                      | Rutas                                                                                                                                                                                                                                    | Pantallas |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Pública (landing + marketplace) | `/`, `/buscar`, `/precios`, `/privacidad`, `/cookies`, `/:slug`, `/login`, `/recuperar`, `/restablecer`, `/alta`, `/verificar`                                                                                                           | 11        |
| Reserva del cliente             | `/:slug` (elegir servicio) → `/:slug/reservar/extras` → `/:slug/reservar/fecha` → `/:slug/reservar/confirmar` → `/reserva/:code` (+ `/reprogramar`), `/resena/:token`                                                                    | 6         |
| Panel del negocio               | `/panel/:slug` (agenda lista/calendario), `clientes`, `fichaje`, `contabilidad`, `servicios`, `servicios/extras`, `horario`, `cierres`, `locales`, `equipo`, `negocio`, `negocio/fotos`, `enlaces`, `facturacion`, `actividad`, `cuenta` | 17        |
| Plataforma (superadmin)         | `/panel/admin`, `usuarios`, `cobros`, `actividad`, `cuenta`                                                                                                                                                                              | 5         |

Asistentes y fichas que abren sobre esas pantallas (no tienen ruta): Apuntar
cita, Ficha de cita, Cerrar días, Cerrar mes, Abrir local, Alta de negocio
(plataforma), Crear cuenta, Primeros pasos, Corregir fichaje, Añadir fichaje
olvidado, Ficha del cliente, Ficha del negocio (plataforma), Galería/Visor.

### 2.2 Componentes compartidos (`apps/web/src/components`)

**Primitivos (`ui.tsx`, 1 193 líneas):** Button, ButtonLink, IconButton, Input,
Select (nativo), Textarea, Field, Card, EmptyState, ErrorNote, Skeleton,
Spinner, Stars, Contador, ConfirmAction (confirmación en línea), PageHeader,
Logo, **Sheet** (la ficha/modal base: pila de capas, foco atrapado, Esc,
«atrás» del móvil, arrastrar para cerrar).

**Compuestos:** ConfirmDialog, FormDialog, Wizard, DescartarCambios, Tabs,
PestanasSeccion, RowMenu, SlotPicker, CabeceraMes, SelectorLocal,
SelectorIdioma, CampoFotos, Galeria, Visor, Avisos (toasts), Reveal,
Ornaments, Photo, BusinessCard, FranjasSemanales, SelectorDuracion,
PrimerosPasos, Credencial, AvisoCookies, AvisoSuscripcion, Layout (cabecera +
pie públicos), TituloDePagina, ScrollToTop.

### 2.3 Lo que está repetido (y el encargo pide unificar)

| Pieza                       | Dónde está hoy                                                                                    | Diferencias                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Selección de profesional    | `BookingDate` (un `<select>` con «Sin preferencia») y `ApuntarCita` (píldoras con `aria-pressed`) | Dos diseños para lo mismo; el del administrador es mejor.                |
| Calendario mensual          | `CalendarioAgenda` + `CabeceraMes` (panel), `BookingDate`, `BookingReschedule`                    | Tres implementaciones; la pública no es mensual, es una tira de 14 días. |
| Elegir día y hora           | `SlotPicker` (panel: 14 días + huecos + hora a mano) y `BookingDate` (cliente)                    | El del panel es el bueno; el cliente no lo usa.                          |
| Subida de fotos             | `CampoFotos` (servicios/extras) y `FotosDelNegocio` dentro de `PanelNegocio`                      | Dos subidas, dos cuadrículas, sin progreso por archivo en ninguna.       |
| Control segmentado          | `Tabs` (lista/calendario) y `PestanasSeccion` (píldoras de sección)                               | Ninguno a ancho completo.                                                |
| Confirmación                | `ConfirmDialog` (ficha) y `ConfirmAction` (en línea «¿Seguro? Sí / No»)                           | Convivencia aceptable, pero sin regla de cuándo usar cada una.           |
| Desplegable de búsqueda     | Selector de negocio del superadmin (`PanelLayout`, combobox a mano)                               | Es el que falla en móvil (ver 4.2).                                      |
| Fecha para `datetime-local` | `SlotPicker` y `PanelFichaje`                                                                     | Resuelto ya con los helpers de Madrid; queda consolidar.                 |

### 2.4 Correos (`apps/api/src/mail/templates.ts`)

11 plantillas sobre un único `layout()`: confirmación al cliente, aviso al
negocio, cancelación, cambio de hora, recordatorio, petición de reseña,
restablecer contraseña, cuenta creada, verificar alta, aviso al equipo de alta
y de nuevo local. Lo que ya está bien: tablas, CSS en línea, 560 px, texto
plano, preheader, `role="presentation"`. Lo que falta para el estándar del
encargo: botones «a prueba de Outlook» (VML/MSO), modo oscuro, `width`/`height`
y `alt` en imágenes (no hay imágenes: el logo es texto), tipografía con
`fallback` declarado por bloque, y pruebas de render.

### 2.5 Marca y tokens

- Hay **dos fuentes de verdad**: `brand/tokens.css` (del proyecto de Claude
  Design) y el `@theme` de `apps/web/src/index.css`. Ya divergen: el marrón de
  marca en pantalla es `#a46639` (AA) y en `brand/` sigue `#a96a3e`; los grises
  `muted`/`subtle` se oscurecieron en la app por contraste y en `brand/` no.
- **No hay ningún «Design System» de Claude Design en esta cuenta** (lo he
  comprobado); lo que existe son los docs `01-identidad-visual.md` y
  `13-sistema-de-interfaz.md` y los SVG de `brand/`.
- Tamaños de texto fuera de la escala: **72 ocurrencias** de `text-[Npx]` con
  17 valores distintos (12,5 · 13 · 13,5 · 14 · 15 · 17 · 19 · 22 · 24 · 26 ·
  30 · 32 · 34 · 40 · 42 · 44 · 52). La escala con nombre (`caption…heading`)
  no cubre la web pública.
- Capas: `z-10` ×13, `z-20` ×3, `z-30`, `z-40` ×2, `z-50` ×2, `z-[55]`,
  `z-[60]`. **No hay escala documentada.** Hoy: cabecera pública `z-20`, barra
  inferior del panel `z-40`, aviso de cookies `z-50`, fichas/modales `z-50`,
  toasts `z-[60]`. Cookies y modales comparten nivel: gana el que se monta
  después.

## 3. Medición en los cinco anchos

20 pantallas × 5 anchos. Resumen:

| Criterio                              | Resultado                                                                                                                                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desborde horizontal                   | **0 px en todas** (360 a 1440).                                                                                                                                                                                                                                                   |
| Campos < 16 px en móvil               | Ninguno (no hay zoom en iPhone).                                                                                                                                                                                                                                                  |
| Zonas pulsables < 44 px en móvil      | Calendario del panel: celdas de **38 × 60** a 360 px; chips del buscador **37 px**; campos del buscador 43 px; avatar «Tu perfil» 40 × 44; «Volver» 40 × 40; menús de fila (⋯) 40 × 40; «Quitar franja» 40 × 40.                                                                  |
| Zonas pulsables < 44 px en escritorio | Navegación pública 40 px; ES/EN 40 × 40; «Añadir mi negocio» 36; «Salir» 36; filtros Hoy/7 días/Todo 36; pestañas de sección 36; «Corregir» 36; franjas del horario (29 controles de 36–40). El doc 13 fijó 36 como mínimo de fila; el encargo pide 44 en todo.                   |
| Selector de idioma sobre capas        | En estado estático **no pisa nada**. En `/alta` va `absolute z-10` sobre el fondo oscuro; en el panel vive en el menú lateral / ficha «Más»; en la web, en la cabecera `z-20`. Las fichas (`z-50`) quedan por encima. El riesgo real es la **falta de escala**, no un solape hoy. |
| Capas fijas por pantalla              | Pública: cabecera sticky + aviso de cookies. Panel móvil: barra inferior. Panel escritorio: menú lateral sticky. Reserva escritorio: resumen sticky.                                                                                                                              |

Nota sobre capturas: el navegador de pruebas con el visor redimensionado
devuelve las pantallas con las animaciones de entrada (`Reveal`) sin disparar,
así que salen «apagadas». Las medidas son fiables; las capturas antes/después
las haré con Playwright en la fase de QA (pregunta 9).

## 4. Fallos reproducidos y lo que se ha visto por tarea

### 4.1 Modal «Descartar cambios» bloquea la interfaz (tarea 3.2) — REPRODUCIDO

Pasos: Agenda → «+ Apuntar una cita» → elegir servicio → Siguiente → X →
«¿Descartar los cambios?» → Esc (o tocar fuera). Resultado: el asistente
desaparece de la vista, pero sigue montado como `dialog`, el velo sigue
puesto y `body { overflow: hidden }` se queda. Nada responde.

**Causa**, en [`Sheet`](../apps/web/src/components/ui.tsx): `cerrar()` anima
la ficha fuera de pantalla (`translateY(100%)`) y marca `cerrando = true`
**antes** de llamar a `onClose`. El `Wizard` recibe ese `onClose`, ve cambios y
en vez de cerrar abre la confirmación. La ficha nunca recibe `open=false`, así
que se queda desplazada e invisible, con `cerrando` a `true` (ni Esc ni
«atrás» vuelven a funcionar). Pulsar «Seguir editando» tampoco la recupera.

**Arreglo:** separar «pedir cerrar» de «cerrar». La ficha pregunta al padre
(`puedeCerrar?.() ?? true`) antes de animar; si el padre dice que no, no se
mueve. Se aplica a Wizard, FormDialog y a cualquier ficha con cambios. Prueba
automática con Playwright que reproduce los pasos de arriba.

### 4.2 Selector de negocios del superadmin (tarea 3.1) — CAUSA LOCALIZADA

Es un combobox a mano (`<input type="search">` + `<ul role="listbox">`) en
`PanelLayout`. La lista **se abre al enfocar y se cierra en `onBlur`**; elegir
una opción depende de `onMouseDown={preventDefault}` para que el `blur` no
cierre la lista antes del `click`. En iOS Safari y Samsung Internet el toque no
siempre genera `mousedown` antes del `blur`: la lista se cierra y la opción no
se elige. En escritorio funciona. Decisión del encargo: `<select>` nativo, que
además da el selector de rueda de iOS gratis. Con muchos negocios se puede
mantener un filtro de texto encima del `<select>`, pero el control que elige
es nativo. `SelectorLocal` no tiene este problema: abre una ficha.

### 4.3 Fichaje: «Desde / Hasta» (tarea 3.9)

El solape está **corregido desde el commit `dd4b7c6`** (dos columnas a ancho
completo en móvil). Verificado a 360 y 390: 2 × 152 px, sin pisarse. Queda el
rediseño: hoy es una sola pantalla con el estado («Estás fuera» + botón), el
filtro de fechas, la exportación y el histórico de todos; no hay separación
entre «fichar» (lo que hace un empleado en 2 s) y «revisar» (lo que hace quien
administra). La API ya cubre lo que pide el encargo: entrada, salida,
corrección con motivo obligatorio y auditoría, fichaje olvidado con motivo,
exportación CSV.

**Normativa (resumen; esto no es asesoría jurídica, conviene contrastarlo con
el BOE):** el art. 34.9 del Estatuto de los Trabajadores exige registro diario
con hora de inicio y fin, conservado **cuatro años** y accesible a la persona
trabajadora, sus representantes y la Inspección. El Real Decreto de registro
digital estaba en tramitación (dictamen del Consejo de Estado en marzo de
2026, publicación prevista en 2026); el borrador exige registro **íntegramente
digital, con trazabilidad e inalterabilidad** (nada de papel ni Excel), hora y
minuto de inicio, fin y pausas, acceso remoto de la Inspección y entrada en
vigor a los 20 días de su publicación. Lo que esto implica para Veline (ver
pregunta 7): las correcciones no deben sobrescribir, sino dejar el registro
original y el corregido con quién y por qué (hoy se sobrescribe con auditoría
aparte); pausas; que cada empleado pueda ver y descargar sus propios registros;
exportación con sello de tiempo.

### 4.4 Fotos del negocio (tarea 3.10)

- Subida: un archivo cada vez (`<input>` sin `multiple`), un único spinner en
  la casilla «+ Subir foto», sin progreso ni confirmación por archivo más allá
  del toast. No hay arrastrar y soltar. En servicios/extras (`CampoFotos`) sí
  es múltiple pero sube en serie con un solo spinner.
- Orden: la primera es la portada por convención; no se puede reordenar ni
  marcar portada.
- Borrar: sin confirmación pero con «Deshacer» en el toast (aceptable).
- Cuadrícula: casillas fijas de 112 px; a 360 px quedan 2 columnas con hueco;
  a 1440 una fila con mucho aire. No es un grid de verdad.
- Validación y compresión en cliente: existe `prepararFoto` (redimensiona);
  falta aviso de formato/peso antes de subir.
- El segmentado «Ficha pública | Fotos» son dos píldoras sueltas, no un
  control a ancho completo.

### 4.5 Agenda del administrador (tarea 3.11)

Lo que enseña hoy, por orden: título + «3 servicios · 6 empleados», botón
Apuntar, pestañas Lista/Calendario, cuatro tarjetas (citas hoy, próximos 7
días, clientes nuevos, ingresos de la semana), lista de citas agrupada por día
con filtros Hoy/7 días/Todo, y cada cita con hora, servicio, cliente,
teléfono, persona, precio, origen, Mover, Cancelar. El calendario a 360 px es
ilegible: celdas de 38 px con «1…» recortado. En escritorio todo cabe pero
no hay jerarquía: la lista de hoy, que es lo que se mira, va debajo de las
tarjetas.

### 4.6 Flujo de reserva del cliente (tarea 3.3)

Hoy: ficha del negocio (elegir servicio) → extras (si hay) → fecha (selector
de persona, selector de servicio otra vez, tira horizontal de **14 días**,
huecos) → confirmar (nombre, teléfono, email, notas) → hecha. Lo que falta
respecto al encargo: indicador de progreso, resumen persistente de la
selección (solo hay una tarjeta en escritorio), calendario mensual (el
servidor ya permite pedir hasta **62 días**), botón Atrás coherente (hay
`BackBar`, pero la ficha pública entera queda detrás), y el pie completo
aparece en todos los pasos. El servicio ya es obligatorio en servidor
(`serviceId: z.string().min(1)`) y la ruta `/reservar/fecha` sin servicio
muestra un vacío, no un mensaje.

### 4.7 Landing (tarea 3.4)

Siete secciones y unas 40 cadenas de texto: hero (titular, entradilla, 2 CTA,
«N días de prueba»), vídeo del panel, «Todo lo que tu negocio necesita» (5
ventajas + «¿Echas algo en falta?»), «Cómo funciona» (3 pasos), «Desde la
agenda hasta el último detalle» (8 extras «Plus»), «¿Quieres impulsar tu
negocio?» (servicios aparte), CTA final con precios. El vídeo ya cuenta las
ventajas; las secciones 3 y 5 las repiten en texto.

### 4.8 Precios (tarea 3.6)

Tres tarjetas (Prueba gratis, Negocio 18,95 €, Equipo 18,95 € + 10,95 €/persona
extra), cuatro «servicios aparte» (web desde 350 €, gestión de redes, reseñas,
recordatorios 200 msg), comisión del 15 % y 8 preguntas. **Negocio y Equipo
tienen el mismo precio base y las mismas plazas incluidas** (`PLAN_INFO`), y la
diferencia (ilimitados, multi-sucursal, agenda por empleado, soporte dedicado)
está en texto. Es la fuente principal de confusión (pregunta 2).

### 4.9 Formulario de alta (tarea 3.5)

Una sola pantalla con todo el formulario (`Alta.tsx`): sin pasos, sin
progreso, sin borrador. El selector de idioma va `absolute` arriba a la
derecha con `z-10`; no hay modales en esa pantalla, así que no pisa nada, pero
hay que meterlo en la escala global.

### 4.10 Marketplace (tarea 3.7)

En `BusinessCard` solo el botón «Reservar» es enlace; el resto de la tarjeta
no. Imágenes a 640 × 360 con `Photo` (lazy). Falta foco/hover de tarjeta
entera.

### 4.11 Lo que ya cumple

Sin desbordes; campos de 16 px; foco visible global; Esc/«atrás»/arrastrar
cierran las fichas; foco atrapado; contrastes AA tras la revisión de octubre;
títulos por pantalla; `prefers-reduced-motion` en el scroll de errores (falta
extenderlo a `Reveal` y a las animaciones de las fichas).

## 5. Deuda y riesgos transversales

1. Dos fuentes de tokens (brand/ e index.css) que ya no coinciden.
2. 72 tamaños de texto fuera de escala.
3. Sin escala de capas; cookies y modales al mismo nivel.
4. `Sheet` anima antes de saber si puede cerrar (4.1); afecta a todos los
   asistentes y formularios con cambios.
5. Tres calendarios, dos selectores de persona, dos subidas de fotos.
6. `Reveal` (animación de entrada) en 9 archivos sin `prefers-reduced-motion`.
7. Sin pruebas de interfaz: ninguno de los fallos de este documento habría
   saltado en CI.
8. `PanelLayout.tsx` (1 108 líneas) y `PanelEquipo.tsx` (1 592) concentran
   demasiado; el rediseño de la agenda y del selector obliga a partirlos.

## 6. Plan por fases

El orden sigue el sugerido en el encargo (componentes → reserva → admin →
público → correos → QA), con dos cambios: los dos fallos que bloquean hoy
(3.1 y 3.2) van en la primera fase, y las pruebas automáticas se montan
también al principio para que cada fase se entregue con captura y prueba.

| Fase | Contenido                                                                                                                                                                                                                                                                                                                                                                                         | Depende de | Entrega                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| 1    | **Cimientos.** Arreglo de `Sheet` (3.2) + prueba. Selector de negocio nativo (3.1). Escala de capas documentada. Tokens: una sola fuente (ver pregunta 1), escala tipográfica completa para la web pública. Componentes compartidos: segmentado a ancho completo, stepper (paso X de N), calendario mensual, selector de profesional, pie mínimo, modal. Playwright + axe con los 5 anchos en CI. | —          | Guía del sistema de componentes (doc), capturas de cada componente, CI verde.             |
| 2    | **Reserva del cliente** (3.3). Primero 2–3 propuestas de estructura y de escritorio; tras tu elección, implementación con los componentes de la fase 1. Servicio obligatorio con mensaje en interfaz. Pie mínimo en el flujo.                                                                                                                                                                     | 1          | Propuestas → reserva completa en móvil y escritorio, capturas antes/después, pruebas E2E. |
| 3    | **Panel.** Agenda (3.11): auditoría de datos + 2–3 variantes → implementación móvil (tarjetas con scroll-snap) y escritorio (paneles). Fichaje (3.9): fichar / histórico / escritorio, normativa. Fotos (3.10): subida con progreso, reordenar, portada, grid. Segmentados en todo el panel.                                                                                                      | 1          | Variantes de agenda → pantallas, capturas, pruebas (fichaje, fotos).                      |
| 4    | **Público.** Landing (3.4): 2–3 arquitecturas → implementación. Precios (3.6): 2–3 formas → implementación. Marketplace (3.7): tarjeta entera clicable. Alta (3.5): asistente con borrador, progreso y resumen.                                                                                                                                                                                   | 1          | Propuestas → pantallas, Lighthouse básico (rendimiento, SEO).                             |
| 5    | **Correos** (3.8). Diseño en Claude Design sobre la marca → 11 plantillas con botones MSO, modo oscuro, texto plano y preheader → pruebas de render.                                                                                                                                                                                                                                              | 1          | Capturas por cliente de correo (ver pregunta 8).                                          |
| 6    | **QA final.** Recorrido extremo a extremo, checklist de aceptación por tarea, 5 anchos, navegadores, accesibilidad (axe + teclado + lector).                                                                                                                                                                                                                                                      | 2–5        | Checklist firmada, documento de decisiones.                                               |

Dentro de cada fase, las propuestas (landing, precios, agenda, reserva) se
presentan **antes** de implementar, con pros y contras y recomendación, y se
espera tu respuesta.

## 7. Preguntas abiertas

Con mi recomendación en cada una. Se pueden contestar con un «ok» a las
recomendaciones y comentar solo las que no.

1. **Marca.** No hay un Design System de Claude Design en la cuenta y
   `brand/tokens.css` ya no coincide con la app. Propongo **crear el Design
   System en Claude Design a partir de la app actual** (tokens, tipografía,
   componentes) y que sea la única fuente; `brand/tokens.css` se regenera
   desde ahí. ¿Lo creo yo, o existe en otra cuenta y me lo compartes?
2. **Precios.** Negocio y Equipo cuestan lo mismo con las mismas plazas. ¿Es
   intencionado (Equipo = Negocio + multi-local/ilimitados, mismo precio) o
   hay que diferenciar precio? Recomendación: si el precio es el mismo,
   fundirlos en un plan con «multi-local» como característica; si no, Equipo
   necesita un precio distinto para que la tabla se entienda.
3. **Landing.** ¿El vídeo que se queda es `/video/promo.mp4` (el del panel) o
   habrá otro? ¿Hay prueba social real (negocios activos, reseñas) que se
   pueda enseñar? Recomendación: sin testimonios hasta que haya reales.
4. **Reserva — dónde empieza.** Hoy el servicio se elige en la ficha del
   negocio. Recomendación: la ficha es el paso 0 y el asistente (extras →
   fecha → datos → confirmación, «paso X de 3/4») arranca al elegir servicio.
   La alternativa es un botón «Reservar» que abra el asistente con el
   servicio como primer paso. ¿Cuál?
5. **Antelación.** El calendario mensual enseñará 2 meses (el servidor permite
   62 días). ¿Quieres que cada negocio pueda limitar la antelación máxima
   (p. ej. 30 días)? Recomendación: sí, con 60 por defecto, como ajuste del
   horario.
6. **Agenda — qué se mira.** Para proponer bien necesito saber de las piezas
   actuales (citas hoy, próximos 7 días, clientes nuevos, ingresos de la
   semana, lista por día, calendario) cuáles usas tú o los negocios a diario
   y cuáles nunca. Si no hay datos, parto de: hoy > huecos libres de hoy >
   próximas > incidencias (canceladas, no vino) > equipo, y escondo ingresos
   y clientes nuevos detrás de Contabilidad/Clientes.
7. **Fichaje y normativa.** ¿Preparo el fichaje para el borrador del Real
   Decreto (registros inalterables: una corrección crea un registro nuevo y
   conserva el anterior; pausas; acceso del empleado a sus propios registros
   y descarga)? Recomendación: sí ahora, es barato antes del rediseño y caro
   después.
8. **Correos — pruebas de render.** No tengo Litmus ni Email on Acid. Puedo
   probar en Gmail, Outlook.com y Apple Mail si me das (o creo) buzones de
   prueba, y en el navegador con las reglas de cada cliente. ¿Tienes cuenta
   en alguna herramienta, o vale con buzones reales?
9. **Navegadores y dispositivos.** Para «probar, no suponer» en Safari iOS,
   Chrome Android y Samsung Internet hacen falta dispositivos o BrowserStack.
   Recomendación: Playwright con los tres motores (Chromium, WebKit, Firefox)
   en CI, y tú pruebas en tu iPhone/Android cada entrega con un enlace de
   ngrok. ¿Tienes BrowserStack o similar?
10. **Alta — borrador.** ¿Borrador en el navegador (se recupera al volver en el
    mismo dispositivo) o en servidor (enlace por correo para continuar)?
    Recomendación: navegador ahora; servidor solo si vemos abandono.
11. **Zonas pulsables.** El encargo pide ≥ 44 px en todo. En escritorio eso
    engorda la navegación (hoy 40) y las acciones de fila (36). Recomendación:
    44 en todo lo táctil (móvil y tablet) y 40 mínimo en escritorio con ratón,
    que es lo que hacen las apps de referencia. ¿O 44 también en escritorio?
12. **Alcance del selector nativo.** ¿Solo el selector de negocios del
    superadmin, o también el de persona en la reserva y los demás
    desplegables? Recomendación: nativo en todo lo que sea «elegir uno de una
    lista corta»; ficha (Sheet) solo cuando la opción necesita más que un
    nombre.
