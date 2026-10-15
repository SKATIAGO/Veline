import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  addDaysKey,
  diffDaysKey,
  formatLongDate,
  formatPrice,
  fromDateKey,
  hoyMadrid,
  madridDateKey,
} from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { useLocal } from '../../lib/local'
import { AvisoSuscripcion } from '../../components/AvisoSuscripcion'
import { PrimerosPasos } from '../../components/PrimerosPasos'
import { Segmentado } from '../../components/Segmentado'
import { useAuth } from '../../lib/auth'
import { Button, Card, EmptyState, FilterChip, PageHeader, Skeleton, cx } from '../../components/ui'
import { useIdioma, usePlural, type Clave } from '../../i18n/idioma'
import { BookingRow } from './FilaCita'
import { CalendarioAgenda } from './CalendarioAgenda'
import { ApuntarCita } from './ApuntarCita'
import { TarjetasAgenda } from './TarjetasAgenda'

/** Rangos que de verdad se miran en la lista: lo de hoy, la semana, y todo. */
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

type Vista = 'hoy' | 'lista' | 'calendario'

/**
 * La agenda, en tres vistas: Hoy (las tarjetas con lo esencial del día), la
 * Lista completa de citas con filtros y cifras, y el Calendario del mes.
 *
 * Lo que se está haciendo vive en la dirección, para que el botón «+» de la
 * barra del móvil, el «Ver» de un aviso o la ficha de un cliente lleven justo
 * ahí: ?vista=lista|calendario&dia=AAAA-MM-DD, ?nueva=1 (apuntar) y
 * ?para=<cliente>.
 */
export function PanelAgenda() {
  const { t, idioma } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  // El local elegido en el menú; null = todos los que se pueden ver.
  const { actual: local } = useLocal()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [rango, setRango] = useState<RangoKey>('hoy')

  const vistaParam = params.get('vista')
  const vista: Vista =
    vistaParam === 'calendario' ? 'calendario' : vistaParam === 'lista' ? 'lista' : 'hoy'
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
    queryKey: ['panel', slug, 'summary', local],
    queryFn: () => api.panelSummary(slug, local),
  })

  // De hace una semana a dentro de dos: lo que necesitan las tarjetas (hoy,
  // próximos, incidencias) y la lista (próximos 14 días).
  const hoy = hoyMadrid()
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['panel', slug, 'bookings', 'agenda', hoy, local],
    queryFn: () =>
      api.panelBookings(slug, { from: addDaysKey(hoy, -7), to: addDaysKey(hoy, 14), local }),
  })

  // «Nueva cita para…» desde la ficha de un cliente: sus datos, ya rellenos.
  const { data: clientes } = useQuery({
    queryKey: ['panel', slug, 'customers'],
    queryFn: () => api.panelCustomers(slug),
    enabled: !!paraCliente,
  })
  const cliente = paraCliente ? clientes?.find((c) => c.id === paraCliente) : null

  /* El filtro se aplica en el cliente porque la consulta ya trae los días
     que hacen falta: pedir de nuevo al servidor sería un viaje para nada. */
  const grupos = useMemo(() => {
    const dias = RANGOS.find((r) => r.key === rango)?.dias
    const limite = dias === null || dias === undefined ? null : addDaysKey(hoy, dias)
    const map = new Map<string, PanelBooking[]>()
    for (const b of bookings ?? []) {
      if (b.status === 'CANCELADA') continue
      const key = madridDateKey(b.startsAt)
      if (key < hoy) continue
      if (limite && key > limite) continue
      map.set(key, [...(map.get(key) ?? []), b])
    }
    return [...map.entries()]
  }, [bookings, rango, hoy])

  const total = grupos.reduce((n, [, filas]) => n + filas.length, 0)
  // El servidor no se los manda al empleado: ve la agenda, no la caja.
  const verIngresos = summary ? summary.weekRevenueCents !== null : false

  /** Adónde lleva el «Ver» del aviso de una cita recién apuntada. */
  const verCita = (fecha: Date) => {
    const key = madridDateKey(fecha)
    const dias = diffDaysKey(hoyMadrid(), key)
    if (vista === 'hoy') {
      if (dias <= 7) return undefined
    } else if (vista === 'lista') {
      const seVe = rango === 'todo' ? dias <= 14 : rango === 'semana' ? dias <= 7 : dias === 0
      if (seVe) return undefined
      if (dias <= 14) return () => setRango(dias <= 7 ? 'semana' : 'todo')
    } else if (dia === key) {
      return undefined
    }
    return () => cambiar({ vista: 'calendario', dia: key })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.agenda')}
        hint={
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

      <PrimerosPasos
        slug={slug}
        servicios={summary?.serviceCount}
        puedeConfigurar={user?.role === 'ADMIN' || user?.role === 'SUPERADMIN'}
      />

      <Segmentado
        label={t('agenda.vistas')}
        className="sm:max-w-md"
        opciones={[
          { id: 'hoy' as Vista, label: t('agenda.vistaHoy') },
          { id: 'lista' as Vista, label: t('agenda.vistaLista2') },
          { id: 'calendario' as Vista, label: t('panel.calendario') },
        ]}
        valor={vista}
        onCambiar={(v) => cambiar({ vista: v === 'hoy' ? null : v, dia: null })}
      />

      {vista === 'hoy' && (
        <TarjetasAgenda
          slug={slug}
          bookings={bookings ?? []}
          cargando={isLoading}
          staffCount={summary?.staffCount ?? 0}
          onApuntar={() => cambiar({ nueva: '1' })}
          onVerDia={(d) => cambiar({ vista: 'calendario', dia: d })}
        />
      )}

      {vista === 'calendario' && (
        <CalendarioAgenda slug={slug} dia={dia} onDia={(d) => cambiar({ dia: d })} />
      )}

      {vista === 'lista' && (
        <>
          <div
            className={cx(
              'grid gap-4 sm:grid-cols-2',
              verIngresos ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
            )}
          >
            <Stat label={t('agenda.citasHoy')} value={String(summary?.todayCount ?? 0)} />
            <Stat label={t('agenda.proximos7')} value={String(summary?.weekCount ?? 0)} />
            {verIngresos && (
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
            )}
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
            <Card className="flex flex-col gap-3 p-5" aria-busy="true">
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
                    {formatLongDate(fromDateKey(key), idioma)}
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
