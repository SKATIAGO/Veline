# Veline — Huecos del diseño y decisiones pendientes

Esto es lo que **no** estaba resuelto en Claude Design. Ordenado por impacto.

> **Estado (26 jul 2026):** los cinco bloqueantes de arquitectura están resueltos e
> implementados — ver [05-stack.md](05-stack.md). Se dejan aquí con su resolución porque
> explican por qué el modelo de datos es como es.

## ✅ Bloqueantes de arquitectura — resueltos

### 1. Mercado y moneda → **España, EUR, es-ES**

El copy estaba en **voseo rioplatense**, con direcciones de CABA y precios en pesos. Reescrito a
tuteo peninsular, con el cambio clave **"turno" → "cita"**. Tabla completa de equivalencias en
[05-stack.md](05-stack.md).

### 2. El panel del negocio → **construido, básico**

Agenda agrupada por día con cancelación, métricas de la semana, CRUD de servicios y editor de
horario con jornada partida. Sigue siendo la mitad del producto y la que menos superficie tiene.

### 3. Cuentas y autenticación → **reserva sin cuenta**

El cliente se identifica por **teléfono** (`Customer.phone` es único). Apple y Google entran
después. ⚠️ El panel **no tiene autenticación todavía** — no exponerlo fuera de local.

### 4. Motor de disponibilidad → **implementado**

Huecos cada 30 min, duración + buffer por servicio, capacidad por plantilla, antelación mínima de
60 min y excepciones por día completo o parcial. Concurrencia resuelta con transacción
SERIALIZABLE en lugar de "el último que gana".

### 5. Atribución de comisión → **en el modelo desde el día uno**

`Booking.source`, `isFirstFromMarketplace` y `commissionCents`, calculados dentro de la
transacción de creación y anulados al cancelar.

## 🟡 Pantallas que el diseño dejó a medias

| Hueco                             | Estado                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Resultados de búsqueda**        | ✅ Construida (`/buscar`) con filtro por categoría, texto y ciudad. Nunca hubo mockup                            |
| **Mapa**                          | ⛔ Fuera de la v1 por decisión. El hero mantiene el placeholder; `Location` ya guarda `lat`/`lng`                |
| **Landing "Para negocios"**       | ✅ **Es la home**. Falta el flujo de alta: hoy los negocios solo entran por el seed                              |
| **Tabs Reseñas e Info**           | 🟡 Info construida (dirección, teléfono, horario semanal). Reseñas solo muestra la media — falta el sistema real |
| **"Añadir al calendario"**        | ✅ Resuelto con `.ics` generado en el navegador                                                                  |
| **Estados vacíos, carga y error** | ✅ Cubiertos: sin resultados, sin huecos, hueco recién ocupado (409 con enlace para elegir otra hora), 404       |
| **Mobile de landing y precios**   | ✅ Derivado a partir del diseño de 1440 px                                                                       |
| **Cancelar**                      | ✅ Cliente (desde `/reserva/:code`) y negocio (desde el panel). **Reprogramar sigue pendiente**                  |

## 🟢 Inconsistencias menores

1. ✅ **Campos del formulario**: unificado en nombre y teléfono obligatorios, email y notas opcionales.
2. ✅ **Radios de borde**: normalizados en `sm 8 / md 12 / lg 16`.
3. **Fecha de los mockups**: "Marzo 2026" y "Mar 15" eran datos de ejemplo, no una fecha de lanzamiento.
4. ⛔ **Iconografía**: sigue sin set elegido. Los chips son solo texto y se usan glifos sueltos (`‹`, `›`, `%`, `★`, `✓`). Falta elegir familia (Lucide, Phosphor…) coherente con Bricolage.
5. 🟡 **Fotografía**: los seis negocios de ejemplo llevan fotos de stock de Unsplash (portada + galería de 4). Falta la fotografía real de cada negocio y la subida de imágenes desde el panel. Siguen con placeholder el mapa del hero y la vista previa del panel.
6. ✅ **Accesibilidad de la mostaza**: `#D9A441` solo se usa sobre marrón oscuro o como acento gráfico, nunca como texto pequeño sobre crema.

## Lo siguiente, por orden de valor

1. **Autenticación** — Apple y Google. Sin ella el panel no puede salir de local.
2. **Notificaciones** — email transaccional al reservar y al cancelar; es lo mínimo que el
   cliente espera y ya está prometido en el plan gratuito.
3. **Reprogramar cita** — cancelar existe, mover no.
4. **Alta de negocio** — hoy los negocios solo entran por el seed.
5. **Fotos e iconografía** — lo único que separa la landing de parecer terminada.
6. **SEO / SSR** — antes de que las fichas de negocio tengan que posicionar en Google.
