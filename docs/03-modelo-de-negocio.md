# Veline — Modelo de negocio y precios

> Fuente: `Precios.dc.html` + slide 9 de `Presentacion Decisiones.dc.html`

## Investigación previa (competencia, 2026)

Fresha y Booksy migraron a **suscripción mensual**: USD 19.95–29.99 de base, **+USD 9–20 por persona**, más una comisión de **20–30% sobre el primer turno de cada cliente nuevo** captado por el marketplace.

*Fuentes citadas en el deck: fresha.com/pricing · comparativas Pabau, GoodCall y SchedulingKit (2026).*

## Nuestra decisión

**Precio plano por negocio + comisión más baja (15%), explicada sin letra chica.**

### Planes

| | **Gratis** | **Negocio** ⭐ Más elegido | **Equipos** |
|---|---|---|---|
| Para | Probar sin compromiso | El día a día de tu local | Más de un local o equipo grande |
| Precio | **$0** /mes | **$19** /mes | **+$9** /mes por persona |
| CTA | Crear mi perfil (ghost) | Empezar prueba de 14 días (primario) | Hablar con ventas (ghost) |

**Gratis**
- Perfil en el marketplace
- Reservas ilimitadas desde tu web, Instagram o Google
- 1 persona en el calendario
- Notificaciones por email

**Negocio** — todo lo de Gratis, más:
- Hasta 3 personas en el calendario
- Recordatorios por **WhatsApp y SMS**
- **Cobro de señas online**
- Estadísticas del negocio
- Soporte prioritario

**Equipos** — todo lo de Negocio, más:
- Personas y locales ilimitados
- Panel multi-sucursal
- Soporte dedicado

### Comisión de marketplace

> Cobramos **15% solo la primera vez** que un cliente nuevo te descubre y reserva a través de la plataforma. Si ya lo conocías, o llega por tu Instagram, Google o boca en boca — es gratis, siempre.

## Implicancias técnicas que se derivan de esto

Estas features están **vendidas en la página de precios**, así que el modelo de datos tiene que soportarlas desde el diseño inicial aunque no se construyan en la v1:

- **Multi-tenant con planes**: `negocio.plan ∈ {gratis, negocio, equipos}` y límites por plan.
- **Límite de personas por calendario** (1 / 3 / ilimitado) → el calendario es **por recurso/persona**, no por negocio.
- **Multi-sucursal** en Equipos → un negocio puede tener N locales.
- **Atribución de origen de la reserva** — imprescindible para cobrar el 15%: hay que registrar si el cliente llegó por marketplace, por link propio, por Instagram/Google, y si es **primera reserva de ese cliente con ese negocio**. Esto no es un campo opcional, es el core del revenue.
- **Prueba de 14 días** en el plan Negocio.
- **Cobro de señas online** → pasarela de pago (Stripe / Mercado Pago según mercado).
- **Recordatorios WhatsApp + SMS** → proveedor de mensajería y cola de jobs programados.
- **Notificaciones por email** ya en el plan gratis → transaccional desde el día 1.

## ⚠️ Ambigüedad de moneda

Los planes dicen `$19` / `$9` sin moneda, la competencia se citó en **USD**, los servicios de los mockups están en **pesos** (`$8.500` con separador de miles con punto) y el dominio es **`.es`** (España, donde correspondería €). **Hay que definir mercado y moneda antes de modelar precios.** Ver [04-pendientes.md](04-pendientes.md).
