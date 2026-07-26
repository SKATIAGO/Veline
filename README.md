# Veline

Plataforma de reservas online para comercios locales de cualquier sector. Mercado España.
Estado: **flujo completo funcionando en local** — cliente y panel del negocio.

## Arrancar

```bash
docker compose up --build
```

- Web → http://localhost:5173
- API → http://localhost:3001/api/health
- Postgres → `localhost:5432` (`veline` / `veline`)

El esquema, el cliente de Prisma y los datos de ejemplo se cargan solos al arrancar.
Para empezar de cero: `docker compose down -v && docker compose up --build`.

## Documentación

| Doc | Qué hay adentro |
|---|---|
| [docs/00-producto.md](docs/00-producto.md) | Qué es Veline, posicionamiento frente a la competencia, tono de voz, estado de cada decisión |
| [docs/01-identidad-visual.md](docs/01-identidad-visual.md) | Paleta, tipografía, logo seleccionado y especificaciones de componentes |
| [docs/02-pantallas-y-flujos.md](docs/02-pantallas-y-flujos.md) | Inventario completo de pantallas diseñadas y rutas implícitas |
| [docs/03-modelo-de-negocio.md](docs/03-modelo-de-negocio.md) | Planes, comisión del marketplace y lo que eso obliga en el modelo de datos |
| [docs/04-pendientes.md](docs/04-pendientes.md) | Qué se ha resuelto, qué sigue abierto y por dónde continuar |
| [docs/05-stack.md](docs/05-stack.md) | Stack, motor de disponibilidad, comisión, verificación y limitaciones |
| [docs/06-brief-gestion-1.md](docs/06-brief-gestion-1.md) | Brief de Eli: eslogan, destacados de la home y servicios para empresas |
| [docs/07-ngrok.md](docs/07-ngrok.md) | Enseñar el boceto fuera de localhost con un túnel — y qué mirar antes |

## Código

```
apps/web         Vite 6 + React 19 + React Router 7 + TanStack Query + Tailwind v4
apps/api         Fastify 5 + Prisma 6 + Zod + Postgres 16
packages/shared  Tipos, esquemas Zod y formateadores es-ES compartidos
```

## Marca

`brand/` — SVGs del logo (ícono, ícono dark, ícono de app, lockup claro y oscuro) y `tokens.css` con toda la paleta y tipografía como custom properties.

## Fuente de los diseños

Proyecto Claude Design `2698b1d9-c4c4-4f8f-9d0a-40aa8891d7e7`:

- `Exploracion Marca.dc.html` — rondas de paleta y tipografía
- `Logotipos Veline.dc.html` — 20 propuestas de logo + aplicaciones
- `Landing Web.dc.html` — landing desktop 1440
- `Precios.dc.html` — página de precios
- `Flujo Reserva Desktop.dc.html` — 4 pantallas, 1400×900
- `Flujo Reserva Movil.dc.html` — 4 pantallas, 402×874
- `Presentacion Decisiones.dc.html` — deck que resume todo lo anterior
