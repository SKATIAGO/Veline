import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { prisma } from './prisma.js'
import { adminRoutes } from './routes/admin.js'
import { authRoutes } from './routes/auth.js'
import { businessRoutes } from './routes/businesses.js'
import { bookingRoutes } from './routes/bookings.js'
import { panelRoutes } from './routes/panel.js'

const esProduccion = process.env.NODE_ENV === 'production'

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  // Ningún cuerpo legítimo se acerca a esto. Explícito para que quede claro
  // que no aceptamos cargas grandes.
  bodyLimit: 64 * 1024,
  // Detrás de Caddy: sin esto, el limitador vería siempre la IP del proxy y
  // limitaría a todos los visitantes como si fueran uno solo.
  trustProxy: true,
})

/**
 * CORS. En producción la web y la API comparten origen (Caddy sirve ambas
 * bajo el mismo dominio), así que no hace falta permitir orígenes externos.
 * En desarrollo se deja abierto para poder llamar a la API desde otro puerto.
 */
await app.register(cors, {
  origin: esProduccion ? [process.env.PUBLIC_WEB_URL ?? 'https://veline.es'] : true,
  credentials: true,
})

await app.register(cookie)

/**
 * Límite de peticiones. Sin esto, los endpoints públicos quedan abiertos a
 * abuso: crear reservas en masa o recorrer códigos de reserva hasta dar con
 * uno válido y leer los datos del cliente.
 */
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX ?? 120),
  timeWindow: '1 minute',
  // La salud la consulta el despliegue en bucle: no debe agotar el cupo.
  allowList: (req) => req.url === '/api/health',
  // Se devuelve statusCode y message, no solo el texto: sin ellos, el objeto
  // llega al manejador de errores sin código y se responde 500, como si el
  // servidor fallara. Un límite de peticiones es 429, no un error nuestro.
  errorResponseBuilder: () => ({
    statusCode: 429,
    message: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
  }),
})

app.get('/api/health', async () => {
  await prisma.$queryRaw`SELECT 1`
  return { ok: true, tz: process.env.TZ ?? 'sin TZ', now: new Date().toISOString() }
})

await app.register(authRoutes)
await app.register(businessRoutes)
await app.register(bookingRoutes)
await app.register(panelRoutes)
await app.register(adminRoutes)

app.setErrorHandler((error, req, reply) => {
  const err = error as Error & { statusCode?: number }
  const status = err.statusCode ?? 500

  // Los 5xx son fallos nuestros: se registran enteros. Los 4xx son peticiones
  // mal formadas del cliente y solo ensucian el log.
  if (status >= 500) app.log.error({ err, url: req.url }, 'error no controlado')

  reply.code(status >= 400 && status < 600 ? status : 500).send({
    // Nunca devolver el mensaje interno de un 500: puede filtrar rutas de
    // archivos, nombres de tablas o detalles de la base de datos.
    error: status === 500 ? 'Error interno del servidor' : err.message,
  })
})

const port = Number(process.env.PORT ?? 3001)

try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`recibido ${signal}, cerrando`)
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  })
}
