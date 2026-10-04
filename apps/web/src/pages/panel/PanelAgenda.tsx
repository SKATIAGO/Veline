import { useId, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatLongDate, formatPrice, toDateKey } from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { AvisoSuscripcion } from '../../components/AvisoSuscripcion'
import { Button, Card, EmptyState, FilterChip, PageHeader, Skeleton } from '../../components/ui'
import { useIdioma, usePlural, type Clave } from '../../i18n/idioma'
import { Tabs, panelProps } from '../../components/Tabs'
import { BookingRow } from './FilaCita'
import { CalendarioAgenda } from './CalendarioAgenda'
import { ApuntarCita } from './ApuntarCita'

/** Rangos que de verdad se miran: lo de hoy, la semana, y todo. */
const RANGOS = [
  { key: 'hoy', clave: 'agenda.hoy', dias: 0 },
  { key: 'semana', clave: 'agenda.proximos7', dias: 7 },
  { key: 'todo', clave: 'agenda.todo', dias: null },
] as const satisfies readonly { key: string; clave: Clave; dias: number | null }[]

type RangoKey = (typeof RANGOS)[number]['key']

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-meta font-medium text-muted">{label}</div>
      <div className="mt-1.5 font-display text-heading font-semibold text-ink">{value}</div>
      {hint && <div className="mt-1 text-meta text-subtle">{hint}</div>}
    </Card>
  )
}

type Vista = 'lista' | 'calendario'

/**
 * La agenda: la lista de las próximas citas y, en otra pestaña, el calendario
 * del mes con sus notas. Eran dos entradas del menú —el calendario, agrupado
 * con la configuración— para mirar las mismas citas.
 *
 * Lo que se está haciendo vive en la dirección, para que el botón «+» de la
 * barra del móvil, el «Ver» de un aviso o la ficha de un cliente lleven justo
 * ahí: ?vista=calendario&dia=AAAA-MM-DD, ?nueva=1 (apuntar) y ?para=<cliente>.
 */
export function PanelAgenda() {
  const { t, idioma } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const idBase = useId()
  const [params, setParams] = useSearchParams()
  const [rango, setRango] = useState<RangoKey>('hoy')

  const vista: Vista = params.get('vista') === 'calendario' ? 'calendario' : 'lista'
  const dia = params.get('dia')
  const apuntando = params.get('nueva') === '1'
  const paraCliente = params.get('para')

  const cambiar = (cambios: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const siguiente = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(cambios)) {
          if (v === null) siguiente.delete(k)
          else siguiente.set(k, v)
        }
        return siguiente
      },
      { replace: true },
    )

  const { data: summary } = useQuery({
    queryKey: ['panel', slug, 'summary'],
    queryFn: () => api.panelSummary(slug),
  })

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['panel', slug, 'bookings'],
    queryFn: () => api.panelBookings(slug),
  })

  // «Nueva cita para…» desde la ficha de un cliente: sus datos, ya rellenos.
  const { data: clientes } = useQuery({
    queryKey: ['panel', slug, 'customers'],
    queryFn: () => api.panelCustomers(slug),
    enabled: !!paraCliente,
  })
  const cliente = paraCliente ? clientes?.find((c) => c.id === paraCliente) : null

  /* El filtro se aplica en el cliente porque la consulta ya trae los próximos
     14 días: pedir de nuevo al servidor para acortar la lista sería un viaje
     de ida y vuelta para no traer nada nuevo. */
  const grupos = useMemo(() => {
    const dias = RANGOS.find((r) => r.key === rango)?.dias
    const hoy = toDateKey(new Date())
    const limite =
      dias === null || dias === undefined
        ? null
        : toDateKey(new Date(Date.now() + dias * 86_400_000))

    const map = new Map<string, PanelBooking[]>()
    for (const b of bookings ?? []) {
      const key = toDateKey(new Date(b.startsAt))
      if (key < hoy) continue
      if (limite && key > limite) continue
      map.set(key, [...(map.get(key) ?? []), b])
    }
    return [...map.entries()]
  }, [bookings, rango])

  const total = grupos.reduce((n, [, filas]) => n + filas.length, 0)

  /** Adónde lleva el «Ver» del aviso de una cita recién apuntada. */
  const verCita = (fecha: Date) => {
    const key = toDateKey(fecha)
    const dias = Math.floor(
      (new Date(fecha).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000,
    )
    if (vista === 'lista') {
      const seVe = rango === 'todo' ? dias <= 14 : rango === 'semana' ? dias <= 7 : dias === 0
      if (seVe) return undefined
      // «Todo» son 14 días: más allá, el calendario de ese mes.
      if (dias <= 14) return () => setRango(dias <= 7 ? 'semana' : 'todo')
    } else if (dia === key) {
      return undefined
    }
    return () => cambiar({ vista: 'calendario', dia: key })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* El marco ya dice en qué negocio estás —en el menú lateral y en la
          cabecera del móvil—, así que repetirlo aquí gastaba una línea para
          no decir nada. El título es la pantalla, no el negocio. */}
      <PageHeader
        title={t('panel.agenda')}
        hint={
          // Dos plurales sueltos y no una frase con dos huecos: «1 personas»
          // era lo que salía antes, y en inglés «1 people» sería lo mismo.
          summary
            ? [
                plural(summary.serviceCount, 'agenda.unServicio', 'agenda.variosServicios'),
                plural(summary.staffCount, 'agenda.unaPersona', 'agenda.variasPersonas'),
              ].join(' · ')
            : undefined
        }
        actions={<Button onClick={() => cambiar({ nueva: '1' })}>{t('agenda.apuntarUna')}</Button>}
      />

      <AvisoSuscripcion sub={summary?.subscription ?? null} />

      <Tabs
        idBase={idBase}
        tabs={[
          { id: 'lista', label: t('agenda.vistaLista') },
          { id: 'calendario', label: t('panel.calendario') },
        ]}
        activa={vista}
        onCambiar={(v) => cambiar({ vista: v === 'lista' ? null : v, dia: null })}
        label={t('agenda.vistas')}
      />

      <div {...panelProps(idBase, vista)} className="flex flex-col gap-6 outline-none">
        {vista === 'calendario' ? (
          <CalendarioAgenda
            slug={slug}
            dia={dia}
            onDia={(d) => cambiar({ dia: d })}
            onApuntar={(d) => cambiar({ nueva: '1', dia: d })}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t('agenda.citasHoy')} value={String(summary?.todayCount ?? 0)} />
              <Stat label={t('agenda.proximos7')} value={String(summary?.weekCount ?? 0)} />
              <Stat
                label={t('agenda.ingresos7')}
                value={formatPrice(summary?.weekRevenueCents ?? 0, idioma)}
                hint={
                  summary?.weekCommissionCents
                    ? t('agenda.comision', {
                        importe: formatPrice(summary.weekCommissionCents, idioma),
                      })
                    : t('agenda.sinComision')
                }
              />
              <Stat
                label={t('agenda.clientesNuevos')}
                value={String(summary?.newFromMarketplace ?? 0)}
                hint={t('agenda.viaMarketplace')}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-subheading font-semibold text-ink">
                {t('agenda.proximasCitas')}
                {!isLoading && total > 0 && (
                  <span className="ml-2 text-body font-normal text-muted">({total})</span>
                )}
              </h2>
              <div className="flex flex-wrap gap-2">
                {RANGOS.map((r) => (
                  <FilterChip key={r.key} active={rango === r.key} onClick={() => setRango(r.key)}>
                    {t(r.clave)}
                  </FilterChip>
                ))}
              </div>
            </div>

            {isLoading ? (
              <Card className="flex flex-col gap-3 p-5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </Card>
            ) : grupos.length === 0 ? (
              <EmptyState
                title={rango === 'hoy' ? t('agenda.hoySinCitas') : t('agenda.sinCitasPeriodo')}
                hint={rango === 'todo' ? t('agenda.apareceránSolas') : t('agenda.ampliaPeriodo')}
                action={
                  <Button variant="secondary" onClick={() => cambiar({ nueva: '1' })}>
                    {t('agenda.apuntarUna')}
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-6">
                {grupos.map(([key, filas]) => (
                  <section key={key}>
                    <h3 className="mb-2 text-meta font-semibold tracking-[0.04em] text-muted uppercase">
                      {formatLongDate(new Date(`${key}T00:00:00`), idioma)}
                    </h3>
                    <Card className="overflow-hidden">
                      <ul>
                        {filas.map((b) => (
                          <BookingRow key={b.id} booking={b} slug={slug} />
                        ))}
                      </ul>
                    </Card>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Montado solo mientras se apunta: cada vez empieza en limpio. Con
          «Nueva cita para…», espera a tener los datos del cliente. */}
      {apuntando && (!paraCliente || clientes) && (
        <ApuntarCita
          key={`${dia ?? ''}-${paraCliente ?? ''}`}
          slug={slug}
          open
          onClose={() => cambiar({ nueva: null, para: null })}
          diaInicial={dia ?? undefined}
          clienteInicial={cliente ?? null}
          alApuntar={verCita}
        />
      )}
    </div>
  )
}
