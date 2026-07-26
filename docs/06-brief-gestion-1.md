# Brief "GESTIÓN 1 VELINE" — Eli

> Documento recibido el 26 jul 2026. Es la primera aportación de contenido que **no** viene del
> proyecto de Claude Design, así que se registra aparte para no perder la trazabilidad de quién
> pidió qué.

## Inicio web

| Pedido | Estado |
|---|---|
| Apertura de inicio limpia y suave | ✅ Entrada escalonada en el hero (`.rise`), 0,75 s, anulada con `prefers-reduced-motion` |
| Tipografía más cuadrada que redonda | ⚠️ **Sin resolver** — hoy sigue Bricolage Grotesque, la decidida en el proyecto de marca |
| Eslogan de inicio | ✅ Se aplica el favorito: **"Donde cada cita encuentra su lugar"** |

### Esloganes del brief

1. "Gestiona tu negocio de forma inteligente" → usado como **titular de `/negocios`**
2. **"Donde cada cita encuentra su lugar"** ⭐ *(favorito)* → **eslogan de marca**: hero de la home, cierre de `/negocios` y pie
3. "Creado para cuidar cada detalle" → sin usar
4. "El lujo de la sencillez" → sin usar

## Información home — los cinco destacados

Implementados como sección propia, tanto en la home como en `/negocios`:

| Destacado | Texto | ¿Real hoy? |
|---|---|---|
| Reservas 24/7 | Tus clientes reservan incluso cuando el negocio está cerrado. | ✅ Sí |
| Recordatorios automáticos | Reduce las ausencias y cancelaciones de última hora. | ⛔ **No construido** |
| Gestión de clientes | Toda la información en un único lugar. | 🟡 Los clientes se guardan, pero no hay pantalla para gestionarlos |
| Gestión de empleados | Controla horarios, servicios y disponibilidad. | 🟡 Horarios y servicios sí; el alta/baja de empleados no |
| Informes y métricas | Conoce el rendimiento real de tu negocio. | 🟡 Métricas básicas de la semana en el panel |

⚠️ **Tres de los cinco se prometen por encima de lo que el producto hace hoy.** Está bien para
enseñar el boceto, pero antes de que la web sea pública hay que construirlos o suavizar el copy.

## Servicios para ofrecer a las empresas

Sección `Servicios para empresas` en [`/negocios`](../apps/web/src/pages/ForBusiness.tsx),
con distintivo **Plus** en lo que se contrata aparte.

| Servicio | Plus |
|---|---|
| Área administrativa cómoda y sencilla | — |
| Calendario adaptable | — |
| Gestión administrativa | Plus *(el brief dice "si quisieran")* |
| Soporte y atención | — |
| Web personalizada | Plus *(marcado en el brief)* |
| Aplicación para su local | Plus ⚠️ **asumido, no marcado en el brief** |
| Análisis de rendimiento y fidelidad | — |
| Herramientas de facturación | — |

El "Se puede añadir ideas" del brief se ha convertido en una tarjeta abierta —
*"¿Echas algo en falta?"*— al final de los destacados.

## Precios / tarifas

Se deja como está: los tres planes del diseño original siguen en `/precios`. El brief dice
**"a debatir de nuevo, lo dejaremos de último"**.

## Lo que este brief cambia respecto al diseño original

El proyecto de Claude Design definió Veline como un **marketplace de dos lados** con la home
apuntando al cliente final. El contenido de este brief es **íntegramente B2B**: los cinco
destacados y los ocho servicios hablan al dueño del negocio, no a quien reserva.

La lectura aplicada ha sido **ampliar el lado negocio sin quitarle la home al cliente**:

- La home mantiene el hero de búsqueda y el marketplace, y gana los cinco destacados.
- Nace `/negocios` como página de captación completa — que además tapa un hueco ya detectado
  en [04-pendientes.md](04-pendientes.md).
- "Para negocios" en el menú y en el pie ya no es un ancla, es una página.

**Pendiente de confirmar con Eli** — ver preguntas abiertas abajo.

## Preguntas abiertas

1. **¿La home sigue siendo del cliente final?** El brief la describe en clave de negocio. Hoy
   está a dos mitades: cliente arriba, negocio debajo.
2. **"Tipografía más cuadrada que redonda"** — Bricolage Grotesque es la aprobada en el proyecto
   de marca. ¿Se cambia la de titulares por una más cuadrada o se mantiene?
3. **El documento va en verde salvia con un titular en serif**, y la paleta aprobada es canela +
   marrón oscuro con Bricolage. ¿Es solo el estilo del documento o apunta a otra dirección de
   marca?
4. **"Aplicación para su local"** — ¿es Plus como la web personalizada?
