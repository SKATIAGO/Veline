# Veline — Bases tecnológicas

## Decisiones de producto que fijan el resto

| Pregunta         | Respuesta                                                                   |
| ---------------- | --------------------------------------------------------------------------- |
| Mercado y moneda | **España** · EUR · locale `es-ES` · zona `Europe/Madrid`                    |
| Alcance v1       | **Flujo completo pero básico**, incluido el panel del negocio               |
| Cuentas          | **Reserva sin cuenta** (se identifica por teléfono). Apple y Google después |
| Mapa             | **Fuera de la v1** — el hero mantiene el placeholder del mockup             |

### Consecuencia lingüística: voseo → tuteo

Los mockups estaban escritos en **voseo rioplatense** con direcciones de CABA y precios en
pesos. Al fijar España se ha reescrito todo el copy:

| Diseño original            | Implementación (es-ES)                               |
| -------------------------- | ---------------------------------------------------- |
| "Encontrá y reservá…"      | "Encuentra y reserva…"                               |
| "Buscá / Elegí / Recibí"   | "Busca / Elige / Recibe"                             |
| "vos atendés"              | "tú atiendes"                                        |
| **"turno"**                | **"cita"** ← el cambio de vocabulario más importante |
| "Sumar mi negocio"         | "Añadir mi negocio"                                  |
| "Sin costo"                | "No cuesta nada"                                     |
| "boca en boca"             | "boca a boca"                                        |
| "$8.500"                   | "59,00 €"                                            |
| "Av. San Martín 452, CABA" | "Calle de San Bernardo 42, Madrid"                   |
| "Alineación y balanceo"    | "Alineación y equilibrado"                           |

## Stack

```
Veline/                     npm workspaces · Node 22 · TypeScript en todo
├── apps/web                Vite 6 + React 19 + React Router 7 + TanStack Query 5
│                           Tailwind v4 (tokens de marca vía @theme)
├── apps/api                Fastify 5 + Prisma 6 + Zod
├── packages/shared         Tipos, esquemas Zod y formateadores es-ES
└── docker-compose.yml      db (Postgres 16) · api · web
```

**Por qué así:**

- **Un solo lenguaje y un solo `zod`** entre cliente y servidor: el esquema
  `createBookingSchema` valida el formulario en el navegador y la petición en el servidor.
  Imposible que se desincronicen.
- **Sin build en `packages/shared`**: el paquete exporta TypeScript en crudo y lo compilan
  Vite y tsx. Un paso menos que mantener.
- **Migraciones versionadas también en desarrollo.** Local y producción arrancan igual, con
  `prisma migrate deploy`. Durante un tiempo desarrollo usó `db push` por comodidad, y el
  resultado fue que la base local derivó sin historial mientras producción estaba limpia: el
  desfase no se veía hasta intentar migrar. Un esquema nuevo se crea con
  `prisma migrate dev --name lo-que-sea`, y el archivo generado se sube al repo.
- **Vite hace de proxy de `/api`** hacia el contenedor de la API, así el navegador ve un solo
  origen y no hay CORS en desarrollo.

### Lo que todavía NO es

- **SPA sin SSR.** Para un marketplace el SEO de las fichas de negocio acabará importando:
  Google no indexa bien lo que se pinta en cliente. Cuando toque, la salida natural es SSR
  con Vite o migrar a un framework con render en servidor. No es urgente en local.

## Cómo se levanta

```bash
docker compose up --build
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/health
- Postgres: `localhost:5432` (`veline` / `veline`)

Al arrancar, el contenedor de la API aplica el esquema, genera el cliente de Prisma y
siembra los datos. El seed es **idempotente**: si ya hay negocios, no toca nada.

```bash
docker compose down -v && docker compose up --build   # empezar de cero
docker compose logs -f api                            # ver la API
docker compose exec db psql -U veline -d veline       # entrar a la base
```

Hot reload activo en los dos lados (bind mount + `usePolling`, necesario en macOS).

## Motor de disponibilidad

Está en [`apps/api/src/availability.ts`](../apps/api/src/availability.ts) y es el corazón del producto:

- Huecos cada **30 minutos** dentro de cada franja de atención.
- Una cita ocupa la agenda **duración + buffer del servicio** (`blockedTo`), así el margen de
  limpieza o papeleo no se puede reservar.
- El hueco tiene que **caber entero** dentro de la franja: un servicio de 60 min no aparece a
  las 13:30 si se cierra a las 14:00.
- Un hueco está libre si **al menos una persona activa** no tiene nada solapado — la capacidad
  del negocio es su plantilla, no una sola agenda.
- **60 minutos de antelación mínima**; nada de reservar para dentro de diez minutos.
- Excepciones de día completo o parcial vía `Closure` (festivos, vacaciones).

### Concurrencia

Dos personas pidiendo el mismo hueco a la vez se resuelven con una transacción
**SERIALIZABLE**: Postgres detecta el write-skew y aborta una, que recibe un `409` con
_"Ese hueco acaba de ocuparse"_.

No se usa un índice único `[staffId, startsAt]` a propósito: dejaría el hueco bloqueado
para siempre después de cancelar una cita.

## Atribución de la comisión

La regla comercial (15 % la primera vez que un cliente nuevo llega por el marketplace) está
implementada en el modelo, no parcheada encima:

- `Booking.source` — MARKETPLACE / DIRECTO / INSTAGRAM / GOOGLE
- `Booking.isFirstFromMarketplace` — se calcula dentro de la transacción de creación
- `Booking.commissionCents` — se congela en el momento de reservar y se pone a 0 al cancelar

Comprobado: primera reserva → 8,85 € sobre 59,00 €; segunda reserva del mismo cliente en el
mismo negocio → 0 €.

## Verificado en local

- Flujo completo cliente: landing → búsqueda → perfil → fecha y hora → datos → confirmación
- Reserva persistida y hueco retirado de la disponibilidad, con el buffer aplicado
- Dos personas en plantilla ⇒ dos citas simultáneas; la tercera devuelve 409
- Cancelar libera el hueco y anula la comisión
- Validación de teléfono español rechazando entradas inválidas (400 con detalle por campo)
- Panel: agenda agrupada por día, métricas, cancelar, CRUD de servicios, edición de horario
- `.ics` generado en el navegador desde la pantalla de confirmación
- Responsive: calendario mensual en desktop, carrusel de días en móvil
- `tsc --noEmit` limpio en API y web; sin errores en consola

## Limitaciones conocidas

- **La home promete más de lo que hay.** Los cinco destacados del brief de Eli
  ([06-brief-gestion-1.md](06-brief-gestion-1.md)) incluyen recordatorios automáticos, gestión de
  clientes y gestión de empleados, que hoy no existen o están a medias. Vale para enseñar el
  boceto; no para publicar.
- **Panel sin autenticación**: el negocio se elige en un desplegable. Es deliberado hasta que
  entre el login con Apple/Google, pero significa que **cualquiera puede ver y cancelar citas
  de cualquier negocio**. No exponer fuera de local.
- **Sin notificaciones**: los emails, SMS y WhatsApp que promete la página de precios no
  existen todavía.
- **Sin pagos**: el cobro de señales del plan Negocio está vendido pero no implementado.
- **Reseñas**: hay nota media y número de reseñas en los datos, pero la pestaña no tiene
  contenido real.
- **`<input type="time">`** muestra am/pm si el navegador está en locale inglés; en un
  navegador en español sale en 24 h.
- **Las fotos son de stock y externas.** `Business.photos` guarda URLs base de Unsplash y el
  front pide el recorte al CDN (`?auto=format&fit=crop&w=…`). Sirve para el boceto, pero
  depende de un tercero: no hay subida de imágenes desde el panel ni copia propia.
- **Una sola sede por negocio** en la práctica: el modelo soporta varias (`Location`), pero el
  front siempre usa la primera.
