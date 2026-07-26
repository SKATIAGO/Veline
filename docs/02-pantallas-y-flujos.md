# Veline — Inventario de pantallas y flujos

> Fuente: `Landing Web.dc.html`, `Precios.dc.html`, `Flujo Reserva Desktop.dc.html`, `Flujo Reserva Movil.dc.html`

Ancho de referencia desktop: **1440px** (contenido a 1440, padding lateral 64px).
Ancho de referencia mobile: **402×874** (iPhone, marco iOS en los mockups).
Los mockups del flujo de reserva usan un viewport de navegador de **1400×900**.

---

## 1. Landing (`/`)

Ruta de los mockups: `veline.es`

### 1.1 Nav — *sticky*, borde inferior `#E4D5BE`
- Logo "Veline" (izq.)
- Links: Cómo funciona · Categorías · **Precios** · Para negocios
- Derecha: "Iniciar sesión" (texto) + botón primario "Reservar"

### 1.2 Hero — 2 columnas, padding `80px 64px 88px`
- H1: *"Encontrá y reservá en cualquier negocio de tu zona"*
- Sub: *"Talleres, academias, veterinarias, tiendas y más — todos en un solo lugar, sin llamadas ni WhatsApp perdido."*
- **Buscador de 2 campos** en una card blanca: `¿Qué buscás?` | divisor | `Tu barrio o ciudad` + botón "Buscar"
- Microcopy: *"Sin costo para reservar · Confirmación al instante"*
- Columna derecha: placeholder 420px — **"Vista previa de la app — mapa de negocios cercanos"** (⚠️ implica mapa/geo, ver pendientes)

### 1.3 Categorías (`#categorias`)
- Eyebrow: "Cualquier rubro, un solo lugar"
- Fila de 9 chips (ver lista en [00-producto.md](00-producto.md))

### 1.4 Marketplace — "Negocios cerca tuyo"
- Header con link "Ver todos →"
- **Grid 3 columnas**, gap 20px. Card = foto 140px + nombre + `rubro · rating ★ · distancia` + botón ghost "Reservar" a ancho completo
- 6 negocios de ejemplo (Taller Mecánico Rivas, Academia de Inglés Central, Veterinaria Los Álamos, Estudio de Yoga Norte, Autoescuela Rápida, Ferretería El Tornillo)

### 1.5 Cómo funciona (`#como-funciona`)
3 columnas centradas, cada una con círculo numerado:
1. **Buscá tu negocio** — por rubro, nombre o ubicación
2. **Elegí día y horario** — disponibilidad en tiempo real, sin llamar
3. **Recibí la confirmación** — turno agendado al instante, para vos y para el negocio

### 1.6 Para negocios (`#negocios`) — **sección oscura** `#2E2119`
- Eyebrow mostaza "Para negocios"
- H2: *"Tu negocio, reservable en minutos"*
- 3 bullets con guión mostaza: sin conocimientos técnicos ni web propia · sin comisiones ocultas · tus clientes reservan solos, vos atendés
- CTA acento: **"Sumar mi negocio"**
- Placeholder 340px — **"Vista previa del panel del negocio"**

### 1.7 Footer
Marca + tagline *"Reservas online para cualquier negocio de barrio."* y 3 columnas:
- **Producto:** Cómo funciona · Categorías · Precios
- **Negocios:** Sumar mi negocio · Panel de gestión
- **Compañía:** Sobre nosotros · Contacto

---

## 2. Precios (`/precios`)

Mismo nav (con "Precios" activo en 600) y mismo footer.

- H1 centrado: *"Un precio simple, sin sorpresas"*
- Sub: *"Empezá gratis. Pagá solo cuando tu negocio empieza a crecer con nosotros — nunca por adelantado, nunca algo que no entendés."*
- **3 planes** lado a lado (ver [03-modelo-de-negocio.md](03-modelo-de-negocio.md)); el del medio destacado con borde 2px canela, sombra y badge "Más elegido"
- **Nota de comisión** en card blanca centrada (máx 1000px) con círculo oscuro "%"

---

## 3. Flujo de reserva — MOBILE (402×874)

4 pantallas, sin dinamismo en el mockup:

### Paso 1 — Perfil del negocio
Foto 180px → nombre (Bricolage 22) → `Taller · 4.8 ★ (126) · Av. San Martín 452` → tabs **Servicios** / Reseñas / Info (activo con subrayado canela 2px) → lista de servicios (`nombre` + `duración` / `precio`, separados por línea) → CTA primario "Reservar turno".

Servicios de ejemplo: Cambio de aceite (30 min, $8.500) · Alineación y balanceo (45 min, $12.000) · Revisión general (1 h, $15.000).

### Paso 2 — Fecha y hora
Header con back circular ← + "Elegí fecha y hora" → **carrusel horizontal de días** (chips 52×66: LUN 14, MAR 15 *activo*, MIÉ 16, JUE 17, VIE 18) → "HORARIOS DISPONIBLES" → grid 3×N de slots (09:00, 09:30, **10:00 activo**, 11:00, 11:30, 12:00 *ocupado*) → barra inferior con resumen `Cambio de aceite · Mar 15, 10:00 — $8.500` + CTA "Continuar".

### Paso 3 — Confirmá tus datos
Header + card de resumen (negocio / servicio·fecha / total) → campos **Nombre y apellido** y **Teléfono** → CTA "Confirmar reserva".
> Nota: en mobile son 2 campos; en desktop son 4 (ver abajo). Hay que unificar.

### Paso 4 — Reserva confirmada
Círculo oscuro 76px con check mostaza → *"¡Reserva confirmada!"* → *"Te esperan el martes 15 a las 10:00 en Taller Mecánico Rivas."* → card con Servicio / Fecha / Total → botón ghost "Agregar al calendario" + primario "Volver al inicio".

---

## 4. Flujo de reserva — DESKTOP (1400×900)

Mismo flujo, layout de 2 columnas con **topbar** propia (`‹ Taller Mecánico Rivas`) y el **widget de reserva fijo a la derecha en todo el recorrido**.

| Paso | URL del mockup | Izquierda (flex 1.4–1.6) | Derecha (340–360px) |
|---|---|---|---|
| 1 | `/taller-mecanico-rivas` | Galería 3 fotos (1 grande + 2 chicas, grid `2fr 1fr` × 2 filas de 140px) + nombre + tabs + servicios (cada uno con su propio botón ghost "Reservar") | Card **sticky** `top:40px`: "Reservar turno", Dirección, Hoy `09:00 – 18:00`, CTA "Ver horarios disponibles" |
| 2 | `/…/reservar/fecha` | **Calendario mensual completo** (Marzo 2026), grid 7×N, celdas 56px, nav ‹ ›; días pasados deshabilitados; **15 activo en canela** | Card: "Martes 15 de marzo", slots agrupados en **Mañana** (09:00, 09:30, **10:00**, 11:00, 11:30) y **Tarde** (14:00, 15:30, 16:00) + resumen + "Continuar" |
| 3 | `/…/reservar/confirmar` | "Confirmá tu reserva" + campos: **Nombre y apellido, Email, Teléfono, Notas para el negocio (opcional)** | Card "Resumen": Negocio / Servicio / Fecha / **Total** + "Confirmar reserva" |
| 4 | `/…/reservar/listo` | Card centrada 460px: check mostaza, "¡Reserva confirmada!", detalle, "Agregar al calendario" + "Volver al inicio" | — |

---

## Rutas implícitas en los mockups

```
/                                        landing
/precios
/{slug-negocio}                          perfil público  (ej. /taller-mecanico-rivas)
/{slug-negocio}/reservar/fecha
/{slug-negocio}/reservar/confirmar
/{slug-negocio}/reservar/listo
/buscar?q=…&donde=…                      resultados (⚠️ no diseñado)
/negocios                                landing de captación (⚠️ no diseñado como página propia)
/login  /registro                        (⚠️ no diseñado)
/panel                                   backoffice del negocio (⚠️ no diseñado)
```
