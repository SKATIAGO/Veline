import { ButtonLink, Card } from '../components/ui'

const PLANS = [
  {
    name: 'Gratis',
    tagline: 'Para probar sin compromiso',
    price: '0 €',
    period: '/mes',
    cta: { label: 'Crear mi perfil', variant: 'ghost' as const },
    features: [
      'Perfil en el marketplace',
      'Reservas ilimitadas desde tu web, Instagram o Google',
      '1 persona en el calendario',
      'Notificaciones por email',
    ],
  },
  {
    name: 'Negocio',
    tagline: 'Para el día a día de tu local',
    price: '19 €',
    period: '/mes',
    popular: true,
    cta: { label: 'Empezar prueba de 14 días', variant: 'primary' as const },
    features: [
      'Todo lo de Gratis',
      'Hasta 3 personas en el calendario',
      'Recordatorios por WhatsApp y SMS',
      'Cobro de señales online',
      'Estadísticas del negocio',
      'Soporte prioritario',
    ],
  },
  {
    name: 'Equipos',
    tagline: 'Para más de un local o equipo grande',
    price: '+9 €',
    period: '/mes por persona',
    cta: { label: 'Hablar con ventas', variant: 'ghost' as const },
    features: [
      'Todo lo de Negocio',
      'Personas y locales ilimitados',
      'Panel multi-sucursal',
      'Soporte dedicado',
    ],
  },
]

export function Pricing() {
  return (
    <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
      <div className="text-center">
        <h1 className="text-[32px] leading-tight font-semibold text-ink sm:text-[42px]">
          Un precio simple, sin sorpresas
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-base leading-relaxed text-body">
          Empieza gratis. Paga solo cuando tu negocio empieza a crecer con nosotros — nunca por
          adelantado, nunca algo que no entiendes.
        </p>
      </div>

      <div className="mt-14 flex flex-col items-stretch gap-6 lg:flex-row">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={
              'relative flex flex-1 flex-col p-8 ' +
              (plan.popular ? 'border-2 border-brand shadow-pop' : '')
            }
          >
            {plan.popular && (
              <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-[11.5px] font-semibold text-white">
                Más elegido
              </span>
            )}
            <div className="font-display text-lg font-semibold text-ink">{plan.name}</div>
            <div className="mt-1.5 mb-6 text-[13.5px] text-subtle">{plan.tagline}</div>
            <div className="mb-6 flex items-baseline gap-1.5">
              <span className="font-display text-[40px] font-semibold text-ink">{plan.price}</span>
              <span className="text-sm font-medium text-subtle">{plan.period}</span>
            </div>
            <ButtonLink to="/panel" variant={plan.cta.variant} className="mb-7 w-full">
              {plan.cta.label}
            </ButtonLink>
            <ul className="flex flex-col gap-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-body-2">
                  <span className="shrink-0 font-bold text-brand">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mx-auto mt-8 flex max-w-[1000px] items-center gap-6 p-8">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xl font-semibold text-accent">
          %
        </div>
        <p className="text-[14.5px] leading-relaxed text-body-2">
          Sobre el marketplace: cobramos <strong className="text-ink">15 % solo la primera vez</strong>{' '}
          que un cliente nuevo te descubre y reserva a través de la plataforma. Si ya lo conocías, o
          llega por tu Instagram, Google o boca a boca — es gratis, siempre.
        </p>
      </Card>
    </div>
  )
}
