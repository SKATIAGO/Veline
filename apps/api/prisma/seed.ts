import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Franja horaria en minutos desde medianoche. */
const h = (hours: number, minutes = 0) => hours * 60 + minutes

/** Jornada partida de lunes a viernes. */
const weekdays = (m1: number, m2: number, t1: number, t2: number) =>
  [1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startMin: m1, endMin: m2 },
    { weekday, startMin: t1, endMin: t2 },
  ])

/** Jornada continua para un día concreto. */
const day = (weekday: number, from: number, to: number) => ({
  weekday,
  startMin: from,
  endMin: to,
})

const SEED = [
  {
    slug: 'taller-mecanico-rivas',
    name: 'Taller Mecánico Rivas',
    category: 'talleres',
    description:
      'Taller de barrio de toda la vida. Mecánica general, revisiones y pre-ITV sin cita telefónica.',
    phone: '915 55 01 92',
    rating: 4.8,
    reviewCount: 126,
    plan: 'NEGOCIO' as const,
    location: {
      street: 'Calle de San Bernardo 42',
      city: 'Madrid',
      postalCode: '28015',
      lat: 40.4283,
      lng: -3.7065,
    },
    hours: [...weekdays(h(9), h(14), h(16), h(19)), day(6, h(9), h(13))],
    staff: ['Andrés Rivas', 'Marta Gil'],
    services: [
      { name: 'Cambio de aceite y filtro', durationMin: 30, priceCents: 5900, bufferMin: 10 },
      { name: 'Alineación y equilibrado', durationMin: 45, priceCents: 4500, bufferMin: 10 },
      { name: 'Revisión pre-ITV', durationMin: 60, priceCents: 8900, bufferMin: 15 },
    ],
  },
  {
    slug: 'academia-de-ingles-central',
    name: 'Academia de Inglés Central',
    category: 'academias',
    description: 'Clases particulares y preparación de exámenes oficiales de Cambridge.',
    phone: '914 22 18 40',
    rating: 4.9,
    reviewCount: 84,
    plan: 'NEGOCIO' as const,
    location: {
      street: 'Calle de Fuencarral 78',
      city: 'Madrid',
      postalCode: '28004',
      lat: 40.4266,
      lng: -3.7013,
    },
    hours: weekdays(h(10), h(14), h(16), h(21)),
    staff: ['Laura Méndez'],
    services: [
      { name: 'Clase de prueba', durationMin: 60, priceCents: 0, bufferMin: 0 },
      { name: 'Clase particular', durationMin: 60, priceCents: 3000, bufferMin: 0 },
      { name: 'Preparación B2 / C1', durationMin: 90, priceCents: 4500, bufferMin: 0 },
    ],
  },
  {
    slug: 'clinica-veterinaria-los-alamos',
    name: 'Clínica Veterinaria Los Álamos',
    category: 'veterinarias',
    description: 'Consulta, vacunación y peluquería canina. Urgencias concertadas.',
    phone: '915 71 33 20',
    rating: 4.7,
    reviewCount: 203,
    plan: 'EQUIPOS' as const,
    location: {
      street: 'Avenida de Brasil 15',
      city: 'Madrid',
      postalCode: '28020',
      lat: 40.4553,
      lng: -3.6942,
    },
    hours: [...weekdays(h(9, 30), h(14), h(17), h(20, 30)), day(6, h(10), h(14))],
    staff: ['Dra. Elena Prats', 'Dr. Iván Soto'],
    services: [
      { name: 'Consulta general', durationMin: 30, priceCents: 4000, bufferMin: 5 },
      { name: 'Vacunación', durationMin: 20, priceCents: 3500, bufferMin: 5 },
      { name: 'Peluquería canina', durationMin: 60, priceCents: 4500, bufferMin: 15 },
    ],
  },
  {
    slug: 'estudio-de-yoga-norte',
    name: 'Estudio de Yoga Norte',
    category: 'bienestar',
    description: 'Hatha y Vinyasa en grupos reducidos, con sesiones privadas bajo demanda.',
    phone: '910 45 66 71',
    rating: 4.9,
    reviewCount: 57,
    plan: 'GRATIS' as const,
    location: {
      street: 'Calle de Bravo Murillo 210',
      city: 'Madrid',
      postalCode: '28020',
      lat: 40.4611,
      lng: -3.7027,
    },
    hours: [...weekdays(h(8), h(11), h(18), h(21, 30)), day(6, h(10), h(13))],
    staff: ['Nuria Vidal'],
    services: [
      { name: 'Clase de Hatha', durationMin: 60, priceCents: 1400, bufferMin: 15 },
      { name: 'Clase de Vinyasa', durationMin: 75, priceCents: 1600, bufferMin: 15 },
      { name: 'Sesión privada', durationMin: 60, priceCents: 4500, bufferMin: 15 },
    ],
  },
  {
    slug: 'autoescuela-rapida',
    name: 'Autoescuela Rápida',
    category: 'autoescuelas',
    description: 'Prácticas del permiso B con recogida en el centro de Madrid.',
    phone: '913 08 77 12',
    rating: 4.6,
    reviewCount: 312,
    plan: 'EQUIPOS' as const,
    location: {
      street: 'Calle de Alcalá 320',
      city: 'Madrid',
      postalCode: '28027',
      lat: 40.4383,
      lng: -3.6382,
    },
    hours: weekdays(h(8), h(14), h(15, 30), h(20)),
    staff: ['Paco Herrera', 'Silvia Roldán'],
    services: [
      { name: 'Clase práctica', durationMin: 45, priceCents: 3200, bufferMin: 15 },
      { name: 'Clase de maniobras', durationMin: 60, priceCents: 4000, bufferMin: 15 },
      { name: 'Test teórico guiado', durationMin: 30, priceCents: 1500, bufferMin: 0 },
    ],
  },
  {
    slug: 'ferreteria-el-tornillo',
    name: 'Ferretería El Tornillo',
    category: 'tiendas',
    description: 'Copias de llaves, afilado y asesoramiento a domicilio con cita previa.',
    phone: '913 66 90 05',
    rating: 4.8,
    reviewCount: 41,
    plan: 'GRATIS' as const,
    location: {
      street: 'Calle del Olivar 9',
      city: 'Madrid',
      postalCode: '28012',
      lat: 40.4098,
      lng: -3.7018,
    },
    hours: [...weekdays(h(9), h(14), h(17), h(20)), day(6, h(9, 30), h(13, 30))],
    staff: ['Jose Luis Cano'],
    services: [
      { name: 'Copia de llaves', durationMin: 15, priceCents: 800, bufferMin: 0 },
      { name: 'Afilado de herramientas', durationMin: 30, priceCents: 1200, bufferMin: 5 },
      { name: 'Asesoramiento a domicilio', durationMin: 60, priceCents: 3500, bufferMin: 30 },
    ],
  },
]

/** Fecha local (Europe/Madrid en el contenedor) a N días vista. */
function atDay(offsetDays: number, hour: number, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, minute, 0, 0)
  return d
}

/** Empuja la fecha al siguiente día laborable si cae en fin de semana. */
function nextWeekday(offsetDays: number, hour: number, minute = 0) {
  let d = atDay(offsetDays, hour, minute)
  while (d.getDay() === 0 || d.getDay() === 6) {
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  }
  return d
}

async function main() {
  const existing = await prisma.business.count()
  if (existing > 0) {
    console.log(`· Seed omitido: ya hay ${existing} negocios en la base.`)
    return
  }

  for (const b of SEED) {
    const business = await prisma.business.create({
      data: {
        slug: b.slug,
        name: b.name,
        category: b.category,
        description: b.description,
        phone: b.phone,
        rating: b.rating,
        reviewCount: b.reviewCount,
        plan: b.plan,
        locations: {
          create: {
            ...b.location,
            openingHours: { create: b.hours },
          },
        },
        services: {
          create: b.services.map((s, i) => ({ ...s, position: i })),
        },
      },
      include: { locations: true },
    })

    const locationId = business.locations[0]!.id
    await prisma.staff.createMany({
      data: b.staff.map((name) => ({ businessId: business.id, locationId, name })),
    })

    console.log(`✓ ${b.name}`)
  }

  // Festivo de ejemplo: el taller cierra dentro de 10 días
  const rivas = await prisma.business.findUniqueOrThrow({
    where: { slug: 'taller-mecanico-rivas' },
    include: { locations: true, services: true, staff: true },
  })
  const rivasLocation = rivas.locations[0]!
  const festivo = atDay(10, 0)
  await prisma.closure.create({
    data: {
      locationId: rivasLocation.id,
      date: new Date(Date.UTC(festivo.getFullYear(), festivo.getMonth(), festivo.getDate())),
      reason: 'Festivo local',
    },
  })

  // Dos citas ya ocupadas para que la agenda y los huecos no salgan vacíos
  const cliente = await prisma.customer.create({
    data: { name: 'Marina López', phone: '612 34 56 78', email: 'marina.lopez@mail.com' },
  })

  const servicio = rivas.services[0]!
  const tecnico = rivas.staff[0]!
  for (const [i, start] of [nextWeekday(1, 10), nextWeekday(1, 11, 30)].entries()) {
    const end = new Date(start.getTime() + servicio.durationMin * 60_000)
    await prisma.booking.create({
      data: {
        code: `VL-SEED${i + 1}`,
        businessId: rivas.id,
        locationId: rivasLocation.id,
        serviceId: servicio.id,
        staffId: tecnico.id,
        customerId: cliente.id,
        startsAt: start,
        endsAt: end,
        blockedTo: new Date(end.getTime() + servicio.bufferMin * 60_000),
        priceCents: servicio.priceCents,
        source: 'DIRECTO',
      },
    })
  }

  console.log('✓ Seed completado')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
