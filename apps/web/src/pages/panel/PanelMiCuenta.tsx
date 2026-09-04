import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatPrice, PLAN_INFO, SUB_STATUS_LABEL } from '@veline/shared'
import { api } from '../../lib/api'
import { enlacesDeOrigen } from '../../lib/origen'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, cx } from '../../components/ui'

/**
 * Lo que el negocio paga y por qué, más los enlaces que le ahorran comisión.
 *
 * Los enlaces son la pieza que faltaba para poder cumplir lo que promete la
 * página de precios: hasta ahora toda reserva contaba como marketplace, así
 * que se habría cobrado el 15 % de clientes que traía el propio negocio.
 */

const TONO: Record<string, 'ok' | 'warn' | 'off'> = {
  COBRADO: 'ok',
  PENDIENTE: 'warn',
  ANULADO: 'off',
}

const ESTADO_LABEL: Record<string, string> = {
  COBRADO: 'Cobrado',
  PENDIENTE: 'Pendiente',
  ANULADO: 'Anulado',
}

const mesLargo = (period: string) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })

function Linea({
  label,
  hint,
  cents,
  fuerte,
}: {
  label: string
  hint?: string
  cents: number
  fuerte?: boolean
}) {
  return (
    <div
      className={cx(
        'flex items-baseline justify-between gap-4 py-2.5',
        fuerte && 'border-t border-line pt-3.5',
      )}
    >
      <div>
        <span className={cx('text-body', fuerte ? 'font-semibold text-ink' : 'text-body-2')}>
          {label}
        </span>
        {hint && <p className="text-meta text-subtle">{hint}</p>}
      </div>
      <span
        className={cx(
          'shrink-0 tabular-nums',
          fuerte ? 'text-subheading font-semibold text-ink' : 'text-body text-body-2',
        )}
      >
        {formatPrice(cents)}
      </span>
    </div>
  )
}

export function PanelMiCuenta() {
  const { slug = '' } = useParams()
  const [copiado, setCopiado] = useState<string | null>(null)

  const { data: cuenta, isLoading } = useQuery({
    queryKey: ['panel', slug, 'cuenta'],
    queryFn: () => api.panelCuenta(slug),
  })

  const { data: summary } = useQuery({
    queryKey: ['panel', slug, 'summary'],
    queryFn: () => api.panelSummary(slug),
  })

  const sub = summary?.subscription
  const base = window.location.origin
  const enlaces = enlacesDeOrigen(base, slug)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tu cuenta" hint="Lo que pagas, por qué, y cómo pagar menos comisión." />

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          {/* [&>*]:min-w-0 — sin esto, la tarjeta de los enlaces se niega a
              encoger: las URLs van con truncate (no cortan línea) y una hija
              de rejilla no baja de su contenido mínimo, así que estiraba la
              página entera y en el móvil salía scroll horizontal. */}
          <Card padded>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-subheading font-semibold text-ink">
                {cuenta?.current ? `Este mes · ${mesLargo(cuenta.current.period)}` : 'Este mes'}
              </h2>
              {sub && (
                <Badge tone={sub.status === 'ACTIVA' ? 'ok' : 'neutral'}>
                  {SUB_STATUS_LABEL[sub.status]}
                </Badge>
              )}
            </div>

            {cuenta?.current ? (
              <div className="mt-3">
                <Linea
                  label={`Plan ${PLAN_INFO[cuenta.current.plan].label}`}
                  hint={`${cuenta.current.seats} ${cuenta.current.seats === 1 ? 'persona' : 'personas'} · ${PLAN_INFO[cuenta.current.plan].seatsIncluded} incluidas`}
                  cents={cuenta.current.subscriptionCents}
                />
                <Linea
                  label="Comisión del marketplace"
                  hint="15 % del primer cliente que te descubre en Veline"
                  cents={cuenta.current.commissionCents}
                />
                <Linea
                  label="Mensajes de más"
                  hint={
                    sub
                      ? `${sub.messages.enviados} enviados · ${sub.messages.incluidos} incluidos`
                      : undefined
                  }
                  cents={cuenta.current.messagesCents}
                />
                <Linea label="Total del mes" cents={cuenta.current.totalCents} fuerte />
                <p className="mt-3 text-meta text-subtle">
                  El mes todavía está corriendo: esta cifra sube si entran más citas del marketplace
                  o se pasan los mensajes incluidos.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-body text-muted">Todavía no hay nada que cobrar este mes.</p>
            )}
          </Card>

          <Card padded>
            <h2 className="font-display text-subheading font-semibold text-ink">
              Tus enlaces para no pagar comisión
            </h2>
            <p className="mt-1 mb-4 text-body text-muted">
              Comparte estos enlaces en vez del normal. Los clientes que entren por ellos cuentan
              como tuyos, no del marketplace, y{' '}
              <strong className="font-semibold text-body-2">no generan comisión</strong>.
            </p>

            <ul className="flex flex-col gap-2.5">
              {enlaces.map((e) => (
                <li
                  key={e.param}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas/40 px-3 py-2.5"
                >
                  <span className="w-[76px] shrink-0 text-meta font-semibold text-body-2">
                    {e.label}
                  </span>
                  {/* En el móvil se parte en varias líneas en vez de recortarse: lo
                      que se recortaba era el final —«?origen=instagram»—, que es
                      justo lo que distingue un enlace de otro. */}
                  <code className="min-w-0 flex-1 basis-full text-meta break-all text-subtle sm:basis-0 sm:truncate">
                    {e.url}
                  </code>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => {
                      void navigator.clipboard.writeText(e.url).then(() => setCopiado(e.param))
                    }}
                  >
                    {copiado === e.param ? 'Copiado' : 'Copiar'}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-subheading font-semibold text-ink">
          Meses anteriores
        </h2>
        {!cuenta?.history.length ? (
          <EmptyState
            title="Todavía no hay meses cerrados"
            hint="Al acabar cada mes aparecerá aquí el resumen de lo que tocaba pagar."
          />
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {cuenta.history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
                >
                  <div className="min-w-[150px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-ink capitalize">
                        {mesLargo(h.period)}
                      </span>
                      <Badge tone={TONO[h.status] ?? 'neutral'}>{ESTADO_LABEL[h.status]}</Badge>
                    </div>
                    <p className="mt-0.5 text-meta text-muted">
                      {PLAN_INFO[h.plan].label} · {h.seats} {h.seats === 1 ? 'persona' : 'personas'}
                      {h.extraMessages > 0 && ` · ${h.extraMessages} mensajes de más`}
                    </p>
                  </div>
                  <span className="text-ui font-semibold text-ink tabular-nums">
                    {formatPrice(h.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <p className="text-meta text-subtle">
        El cobro es por transferencia o recibo: no te pedimos tarjeta ni se te cobra nada
        automáticamente. Si algo no cuadra, escríbenos antes de pagar.
      </p>
    </div>
  )
}
