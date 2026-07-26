# Veline — Modelo de negocio y precios

> Fuente: `Precios.dc.html` + slide 9 de `Presentacion Decisiones.dc.html`

## Investigación previa (competencia, 2026)

Fresha y Booksy migraron a **suscripción mensual**: USD 19.95–29.99 de base, **+USD 9–20 por persona**, más una comisión de **20–30% sobre el primer turno de cada cliente nuevo** captado por el marketplace.

*Fuentes citadas en el deck: fresha.com/pricing · comparativas Pabau, GoodCall y SchedulingKit (2026).*

## Nuestra decisión

**Precio plano por negocio + comisión más baja (15%), explicada sin letra chica.**

### Planes — 2ª ronda (brief de Eli, 26 jul 2026)

> Sustituyen a los del diseño original. El cambio de fondo: **desaparece el plan gratuito
> permanente** y pasa a ser una **prueba de 8 días**.

| | **Prueba gratis** | **Negocio** ⭐ Más elegido | **Equipo** |
|---|---|---|---|
| Para | Sin compromiso | El día a día de tu local | Cuando sois más de dos |
| Precio | **Gratis**, 8 días | **18,95 €** /mes | **+10,95 €** /mes por persona de más |
| CTA | Empezar la prueba | Empezar prueba de 8 días | Hablar con ventas |

**Negocio** incluye **2 personas** en el calendario, reservas ilimitadas desde tu web, Instagram
o Google, recordatorios por SMS/email/WhatsApp, cobro de señales online, estadísticas, reseñas y
soporte prioritario.

**Equipo** añade personas y locales ilimitados, panel multi-sucursal y soporte dedicado.

### Servicios aparte

| Servicio | Precio | Qué incluye |
|---|---|---|
| Creación de web y app móvil | **Desde 250 €** (pago único) | Imagen propia, motor de reservas, administrador propio, gestión de varios locales. Correo corporativo *a consultar* |
| Gestión administrativa | **50 € /mes** | Cambios de horarios y precios, información del negocio, altas y bajas de personas y miembros |
| Reseñas | **Gratis** | Recogida y publicación de reseñas de clientes |
| Recordatorios | **Incluidos** | SMS, email y WhatsApp en la misma tarifa, sin coste por mensaje |

### Interpretaciones que hay que confirmar

El brief venía en notas sueltas. Se ha resuelto así, y conviene validarlo:

- **"250 el básico"** → precio de partida y **pago único** de la creación de web. No se decía si
  era único o mensual.
- **"Correo; preguntando"** → correo corporativo **a consultar**. Podía significar también que hay
  que preguntárselo al cliente.
- **"SMS/EMAILS/WHATSAPP La misma Tarifa"** → **incluidos** en la cuota, sin coste por mensaje.
  La otra lectura posible es que los tres cuesten lo mismo entre sí, pero aparte.
- **"Reseñas gratis"** → la función no se cobra, en ningún plan.

### Comisión de marketplace

> Cobramos **15% solo la primera vez** que un cliente nuevo te descubre y reserva a través de la plataforma. Si ya lo conocías, o llega por tu Instagram, Google o boca en boca — es gratis, siempre.

## Implicancias técnicas que se derivan de esto

Estas features están **vendidas en la página de precios**, así que el modelo de datos tiene que soportarlas desde el diseño inicial aunque no se construyan en la v1:

- **Multi-tenant con planes**: `negocio.plan ∈ {gratis, negocio, equipos}` y límites por plan.
- **Límite de personas por calendario** (2 incluidas, luego por persona) → el calendario es **por recurso/persona**, no por negocio, y hay que facturar por número de personas activas.
- **Multi-sucursal** en Equipos → un negocio puede tener N locales.
- **Atribución de origen de la reserva** — imprescindible para cobrar el 15%: hay que registrar si el cliente llegó por marketplace, por link propio, por Instagram/Google, y si es **primera reserva de ese cliente con ese negocio**. Esto no es un campo opcional, es el core del revenue.
- **Prueba de 8 días sin tarjeta**, y qué pasa con el perfil al terminar si no se contrata.
- **Cobro de señas online** → pasarela de pago (Stripe / Mercado Pago según mercado).
- **Recordatorios WhatsApp + SMS** → proveedor de mensajería y cola de jobs programados.
- **Notificaciones por email** ya en el plan gratis → transaccional desde el día 1.

## ⚠️ Ambigüedad de moneda

Los planes dicen `$19` / `$9` sin moneda, la competencia se citó en **USD**, los servicios de los mockups están en **pesos** (`$8.500` con separador de miles con punto) y el dominio es **`.es`** (España, donde correspondería €). **Hay que definir mercado y moneda antes de modelar precios.** Ver [04-pendientes.md](04-pendientes.md).
