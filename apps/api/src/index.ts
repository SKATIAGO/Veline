import Fastify from 'fastify'
import cors from '@fastify/cors'
import { prisma } from './prisma.js'
import { businessRoutes } from './routes/businesses.js'
import { bookingRoutes } from './routes/bookings.js'
import { panelRoutes } from './routes/panel.js'

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, { origin: true })

app.get('/api/health', async () => {
  await prisma.$queryRaw`SELECT 1`
  return { ok: true, tz: process.env.TZ ?? 'sin TZ', now: new Date().toISOString() }
})

await app.register(businessRoutes)
await app.register(bookingRoutes)
await app.register(panelRoutes)

app.setErrorHandler((error, _req, reply) => {
  const err = error as Error & { statusCode?: number }
  app.log.error(err)
  const status = err.statusCode ?? 500
  reply.code(status >= 400 && status < 600 ? status : 500).send({
    error: status === 500 ? 'Error interno del servidor' : err.message,
  })
})

const port = Number(process.env.PORT ?? 3001)

try {
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`Veline API en http://localhost:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  })
}
