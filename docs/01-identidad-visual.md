# Veline — Identidad visual

> Fuente: `Exploracion Marca.dc.html` (opción `2b` + `1e`), `Logotipos Veline.dc.html` (opción `2a` → aplicaciones `3a`/`3b`)

## Paleta — "Canela + Marrón oscuro" (opción 2b)

| Token | Hex | Nombre | Uso |
|---|---|---|---|
| `--brand` | `#A96A3E` | Canela | Color primario: botones, links, estados activos, día/hora seleccionada |
| `--ink` | `#2E2119` | Marrón oscuro | Texto principal, secciones oscuras, badges numerados |
| `--accent` | `#D9A441` | Mostaza | Acento puntual: CTA sobre fondo oscuro, check de confirmación, eyebrows en dark |
| `--cream` | `#F2E7D6` | Crema | Fondo general de toda la app |

**Racional (para no romperlo después):**
- Ni el canela ni el marrón pertenecen a un rubro — no leen "belleza" ni "SaaS".
- El marrón evoca comercio de barrio (cuero, madera, mostrador) sin caer en lo folclórico.
- La mostaza da un acento cálido tipo cartel "abierto", sin ser infantil.
- Todo el conjunto vive en la familia del marrón; **la mostaza es el único respiro de color** — usarla con moderación.

### Neutrales derivados (extraídos de los mockups, ya en uso)

| Token | Hex | Uso real en los diseños |
|---|---|---|
| `--surface` | `#FFFFFF` | Cards, inputs, slots de horario, planes de precio |
| `--cream-2` | `#EDE1CD` | Fondo del lienzo en las hojas de flujo |
| `--border` | `#E4D5BE` | Borde estándar de card / divisor |
| `--border-strong` | `#DCC9AC` | Borde de chips de categoría |
| `--fill-muted` | `#E4D5BE` | Chips de fecha no seleccionada, botón "volver", placeholders |
| `--text-body` | `#5C4A34` | Párrafos sobre crema |
| `--text-body-2` | `#4A3826` | Texto de listas / features |
| `--text-muted` | `#8A7255` | Texto secundario, labels de resumen |
| `--text-subtle` | `#9B8567` | Metadatos (rubro · rating · distancia), footer |
| `--text-disabled` | `#C4AE8D` | Horarios no disponibles, días fuera de mes |
| `--ink-2` | `#3B2A1F` | Superficie oscura secundaria (placeholder en sección dark) |
| `--on-dark` | `#F2E7D6` | Texto sobre marrón oscuro |
| `--on-dark-muted` | `#C9B698` / `#D8C6AD` | Texto secundario sobre marrón oscuro |
| `--on-dark-border` | `#4A3826` | Bordes dentro de secciones oscuras |
| `--ph-border` | `#B79A76` | Borde punteado de placeholders |
| `--ph-text` | `#7A664D` | Texto de placeholders |

## Tipografía (opción 1e)

| Rol | Familia | Pesos usados |
|---|---|---|
| Display / títulos | **Bricolage Grotesque** | 500, 600, 700 |
| Interfaz / cuerpo | **Public Sans** | 400, 500, 600, 700 |

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap">
```

**Racional:** Bricolage tiene carácter propio — no es la geométrica sans genérica de todo SaaS. Public Sans es interfaz clara y legible a cualquier tamaño. Un solo espíritu entre título e interfaz, no dos marcas distintas.

### Escala tipográfica observada

| Uso | Fuente / peso / tamaño |
|---|---|
| H1 landing | Bricolage 600 · 52px / 1.12 · `-.01em` |
| H1 precios | Bricolage 600 · 42px / 1.15 |
| H2 sección | Bricolage 600 · 30px |
| H2 dark ("Para negocios") | Bricolage 600 · 36px / 1.2 |
| Título de negocio (desktop) | Bricolage 600 · 30px |
| Título de negocio (mobile) | Bricolage 600 · 22px |
| Título de card / widget | Bricolage 600 · 16–17px |
| Precio grande (planes) | Bricolage 600 · 40px |
| Eyebrow (uppercase) | Public Sans 600 · 13px · `letter-spacing .06em` |
| Cuerpo hero | Public Sans 400 · 17px / 1.6 |
| Cuerpo general | Public Sans 400 · 14–15.5px / 1.55–1.6 |
| Botón | Public Sans 600 · 14–14.5px |
| Metadato | Public Sans 500 · 12.5–13px |
| Label de campo | Public Sans 600 · 12–12.5px |

## Logotipo — "Puertas gemelas" (2a) ✅ SELECCIONADO

Dos hojas de puerta apenas entornadas hacia afuera: el gesto exacto de **"abrir el local"**, sin dibujar una puerta literal. Sin calendarios ni relojes — era un requisito explícito.

**Geometría** (viewBox `0 0 60 56`):
- Hoja izquierda: `rect x=6 y=6 w=18 h=44 rx=4`, rotada `-9°` sobre `(15,28)`
- Hoja derecha: `rect x=36 y=6 w=18 h=44 rx=4`, rotada `+9°` sobre `(45,28)`

**Variantes de color:**

| Contexto | Hoja izq. | Hoja der. | Wordmark |
|---|---|---|---|
| Sobre crema (`#F2E7D6`) | `#A96A3E` canela | `#2E2119` marrón | `#2E2119` |
| Sobre marrón (`#2E2119`) | `#D9A441` mostaza | `#F2E7D6` crema | `#F2E7D6` |
| Ícono de app oscuro | `#A96A3E` canela | `#F2E7D6` crema | — |

**Aplicaciones aprobadas:**
- `3a` **Ícono de app / favicon** — solo las dos hojas, sin texto. Legible a 40px. Radio del contenedor: 20px sobre 150px (≈13%; en iOS usar el squircle del sistema).
- `3b` **Lockup horizontal** — ícono + "Veline" en Bricolage 600. Gap 14px a tamaño 30px de texto (ícono 34×32); gap 6px a tamaño 15px (ícono 17×16) para barra de navegación.

Los SVGs listos para usar están en [`brand/`](../brand/).

## Componentes de UI (ya definidos en los mockups)

| Componente | Especificación |
|---|---|
| **Botón primario** | bg `#A96A3E`, texto blanco, Public Sans 600 14px, radius 8px (9–10px en flujos), padding 13×24 |
| **Botón ghost** | borde 1.5px `#2E2119`, texto `#2E2119`, transparente, mismo radius |
| **Botón acento** (sobre dark) | bg `#D9A441`, texto `#2E2119` |
| **Card** | bg `#fff`, borde 1px `#E4D5BE`, radius 10–16px |
| **Chip de categoría** | bg `#fff`, borde 1px `#DCC9AC`, texto `#4A3826` 600 12.5px, radius 20px, padding 8×16 |
| **Input** | bg `#fff`, borde 1px `#E4D5BE`, radius 9px, padding 13–14px |
| **Slot de horario** | 3 columnas, radius 8–9px; libre = blanco+borde; **elegido = `#A96A3E` + texto blanco**; ocupado = `#F2E7D6` + texto `#C4AE8D` |
| **Chip de fecha** | 52×66, radius 12px; inactivo `#E4D5BE`; **activo `#A96A3E`** |
| **Paso numerado** | círculo 44px (22px en mobile) bg `#2E2119`, texto `#F2E7D6` |
| **Placeholder** | bg `#E4D5BE`, borde 1px **dashed** `#B79A76`, texto `#7A664D` 500 11px |
| **Éxito** | círculo 72–76px bg `#2E2119` con check de trazo `#D9A441` (stroke-width 4, linecap round) |
