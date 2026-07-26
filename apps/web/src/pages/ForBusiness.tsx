import { ButtonLink, Card, Eyebrow } from '../components/ui'
import { DESTACADOS, ESLOGAN, ESLOGAN_NEGOCIO, SERVICIOS_EMPRESA } from '../content/negocio'

function Check() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-brand text-[11px] font-bold text-brand"
    >
      ✓
    </span>
  )
}

export function ForBusiness() {
  return (
    <>
      {/* HERO */}
      <section className="bg-ink">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-14 px-6 py-20 lg:flex-row lg:px-16 lg:py-24">
          <div className="flex-1 rise">
            <Eyebrow tone="accent">Para negocios</Eyebrow>
            <h1 className="text-[32px] leading-[1.14] font-semibold text-ondark sm:text-[44px]">
              {ESLOGAN_NEGOCIO}
            </h1>
            <p className="mt-5 mb-8 max-w-[480px] text-[17px] leading-relaxed text-ondark-muted-2">
              Veline se encarga de las citas, los recordatorios y los números para que tú te
              dediques a atender. Sin conocimientos técnicos y sin comisiones ocultas.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/precios" variant="accent">
                Añadir mi negocio
              </ButtonLink>
              <ButtonLink
                to="/panel"
                variant="ghost"
                className="border-ondark-muted text-ondark hover:bg-ondark hover:text-ink"
              >
                Ver el panel
              </ButtonLink>
            </div>
          </div>
          <div
            className="ph h-[260px] w-full flex-1 rounded-2xl border-line-dark bg-ink-2 text-ph-border lg:h-[360px] rise"
            style={{ animationDelay: '120ms' }}
          >
            Vista previa del panel del negocio
          </div>
        </div>
      </section>

      {/* DESTACADOS */}
      <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
        <Eyebrow>Todo lo que tu negocio necesita</Eyebrow>
        <h2 className="mb-10 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
          Las citas dejan de ser un problema el primer día
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DESTACADOS.map((d) => (
            <Card key={d.title} className="p-6">
              <div className="mb-2 font-display text-lg font-semibold text-ink">{d.title}</div>
              <p className="text-sm leading-relaxed text-muted">{d.text}</p>
            </Card>
          ))}
          <Card className="flex flex-col justify-center border-dashed bg-transparent p-6">
            <div className="mb-2 font-display text-lg font-semibold text-ink">
              ¿Echas algo en falta?
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Cuéntanoslo y lo estudiamos. La lista está abierta a propósito.
            </p>
          </Card>
        </div>
      </section>

      {/* SERVICIOS */}
      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
          <Eyebrow>Servicios para empresas</Eyebrow>
          <h2 className="mb-4 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
            Desde la agenda hasta la factura
          </h2>
          <p className="mb-10 max-w-[560px] text-[15.5px] leading-relaxed text-body">
            Lo básico entra con la suscripción. Lo marcado como{' '}
            <span className="font-semibold text-ink">Plus</span> se contrata aparte, según lo que
            cada negocio necesite.
          </p>

          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {SERVICIOS_EMPRESA.map((s) => (
              <div key={s.title} className="flex gap-3.5">
                <Check />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{s.title}</span>
                    {'plus' in s && s.plus && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-ink uppercase">
                        Plus
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section className="mx-auto max-w-[1440px] px-6 py-24 text-center lg:px-16">
        <p className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[34px]">
          {ESLOGAN}
        </p>
        <p className="mx-auto mt-4 mb-8 max-w-[460px] text-[15.5px] leading-relaxed text-muted">
          Empieza gratis y súbete de plan solo cuando tu negocio lo pida.
        </p>
        <ButtonLink to="/precios">Ver planes y precios</ButtonLink>
      </section>
    </>
  )
}
