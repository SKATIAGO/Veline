/**
 * Vuelca las plantillas de correo a HTML para poder mirarlas en el navegador
 * sin enviar nada:
 *
 *   docker compose exec -w /app/apps/api api npm run mail:preview
 *
 * Deja los archivos en apps/web/public/preview-correo/ y se ven en
 * http://localhost:5173/preview-correo/reserva-confirmada.html
 */
import { mkdir, writeFile } from 'node:fs/promises'
import {
  bookingCancelled,
  bookingConfirmedToCustomer,
  bookingCreatedToBusiness,
  type BookingMailData,
} from './templates.js'

const OUT = '/app/apps/web/public/preview-correo'

const enTresDias = () => {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  d.setHours(10, 0, 0, 0)
  return d
}

const EJEMPLO: BookingMailData = {
  code: 'VL-7F3K2',
  startsAt: enTresDias(),
  priceCents: 5900,
  serviceName: 'Cambio de aceite y filtro',
  businessName: 'Taller Mecánico Rivas',
  businessSlug: 'taller-mecanico-rivas',
  staffName: 'Marta Gil',
  address: 'Calle de San Bernardo 42, Madrid',
  customerName: 'Marina López',
  customerPhone: '612 34 56 78',
  customerEmail: 'marina.lopez@mail.com',
  notes: 'Llego con el coche y dejo las llaves en recepción.',
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const salidas = [
    ['reserva-confirmada', bookingConfirmedToCustomer(EJEMPLO)],
    ['reserva-negocio', bookingCreatedToBusiness(EJEMPLO, 'reservas@taller.es')],
    [
      'cancelada-cliente',
      bookingCancelled(
        EJEMPLO,
        { email: 'marina.lopez@mail.com', name: 'Marina López' },
        'cliente',
      ),
    ],
    [
      'cancelada-negocio',
      bookingCancelled(
        EJEMPLO,
        { email: 'reservas@taller.es', name: 'Taller Mecánico Rivas' },
        'negocio',
      ),
    ],
  ] as const

  for (const [nombre, mensaje] of salidas) {
    await writeFile(`${OUT}/${nombre}.html`, mensaje.html, 'utf8')
    console.log(`✓ ${nombre}.html — asunto: ${mensaje.subject}`)
  }

  const indice = salidas
    .map(([n, m]) => `<li><a href="./${n}.html">${n}</a> — <code>${m.subject}</code></li>`)
    .join('')
  await writeFile(
    `${OUT}/index.html`,
    `<meta charset="utf-8"><title>Correos de Veline</title>
     <body style="font-family:system-ui;background:#F2E7D6;color:#2E2119;padding:40px">
     <h1>Vista previa de los correos</h1><ul style="line-height:2">${indice}</ul></body>`,
    'utf8',
  )
  console.log(`\nAbre http://localhost:5173/preview-correo/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
