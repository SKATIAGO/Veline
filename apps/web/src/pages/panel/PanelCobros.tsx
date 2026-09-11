import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPrice, planLabel } from '@veline/shared'
import { api, ApiError, type Charge } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  ConfirmAction,
  EmptyState,
  ErrorNote,
  FilterChip,
  Input,
  PageHeader,
  Skeleton,
  Spinner,
  SuccessNote,
  cx,
} from '../../components/ui'
import { Texto, useIdioma, usePlural, type Clave } from '../../i18n/idioma'

/**
 * Quién debe qué. El cobro es manual por ahora (transferencia o recibo), así
 * que esta pantalla no cobra nada: dice cuánto, y deja marcar lo que ya está
 * pagado. Cuando entre una pasarela el cálculo no cambia — solo cambia quién
 * lo ejecuta.
 */

const TONO: Record<string, 'ok' | 'warn' | 'off'> = {
  COBRADO: 'ok',
  PENDIENTE: 'warn',
  ANULADO: 'off',
}

const ESTADO_CLAVE: Record<string, Clave> = {
  COBRADO: 'cob.cobrado',
  PENDIENTE: 'cob.pendiente',
  ANULADO: 'cob.anulado',
}

/** El nombre del mes, en el idioma de quien mira. */
function useMesLargo() {
  const { locale } = useIdioma()
  return (period: string) =>
    new Date(`${period}-01T00:00:00`).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
    })
}

/** El mes anterior, que es el que normalmente se cierra. */
function mesAnterior() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}

function Fila({ c, onDone }: { c: Charge; onDone: () => void }) {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const mesLargo = useMesLargo()
  const [nota, setNota] = useState(c.paidNote ?? '')
  const [abierto, setAbierto] = useState(false)

  const marcar = useMutation({
    mutationFn: (status: 'PENDIENTE' | 'COBRADO' | 'ANULADO') =>
      api.markCharge(c.id, status, nota.trim() || undefined),
    onSuccess: onDone,
  })

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        <div className="min-w-[190px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui font-semibold text-ink">{c.business.name}</span>
            <Badge tone={TONO[c.status] ?? 'neutral'}>
              {ESTADO_CLAVE[c.status] ? t(ESTADO_CLAVE[c.status]) : c.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-meta text-muted">
            {mesLargo(c.period)} · {planLabel(c.plan, idioma)} ·{' '}
            {plural(c.seats, 'cob.unaPersona', 'cob.variasPersonas')}
          </p>
        </div>

        <dl className="flex flex-wrap gap-5 text-meta text-muted">
          {[
            [t('cob.cuota'), c.subscriptionCents],
            [t('cob.comision'), c.commissionCents],
            [
              c.extraMessages ? t('cob.mensajesCon', { n: c.extraMessages }) : t('cob.mensajes'),
              c.messagesCents,
            ],
          ].map(([label, cents]) => (
            <div key={label as string}>
              <dt className="text-caption">{label}</dt>
              <dd className="font-semibold text-body-2 tabular-nums">
                {formatPrice(cents as number, idioma)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="w-[104px] text-right">
          <div className="text-ui font-semibold text-ink tabular-nums">
            {formatPrice(c.totalCents, idioma)}
          </div>
          {c.paidAt && (
            <div className="text-caption text-subtle">
              {new Date(c.paidAt).toLocaleDateString(locale)}
            </div>
          )}
        </div>

        <div className="ml-auto flex flex-wrap justify-end gap-1 sm:ml-0">
          {c.status === 'PENDIENTE' ? (
            <>
              <Button
                size="sm"
                variant="quiet"
                loading={marcar.isPending && marcar.variables === 'COBRADO'}
                onClick={() => setAbierto((a) => !a)}
              >
                {t('cob.marcarCobrado')}
              </Button>
              <ConfirmAction
                label={t('cob.anular')}
                confirmLabel={t('cob.siAnular')}
                loading={marcar.isPending && marcar.variables === 'ANULADO'}
                onConfirm={() => marcar.mutate('ANULADO')}
              />
            </>
          ) : (
            <Button
              size="sm"
              variant="quiet"
              loading={marcar.isPending}
              onClick={() => marcar.mutate('PENDIENTE')}
            >
              {t('cob.volverPendiente')}
            </Button>
          )}
        </div>
      </div>

      {abierto && c.status === 'PENDIENTE' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            marcar.mutate('COBRADO')
          }}
          className="flex flex-wrap items-end gap-2 border-t border-line bg-canvas/50 px-4 py-4 sm:px-5"
        >
          <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <span className="text-meta font-semibold text-body-2">{t('cob.comoSeCobro')}</span>
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder={t('cob.comoSeCobroEjemplo')}
              autoFocus
            />
          </label>
          <Button type="submit" loading={marcar.isPending}>
            {t('cob.marcarCobrado')}
          </Button>
          <Button type="button" variant="quiet" onClick={() => setAbierto(false)}>
            {t('cob.cancelar')}
          </Button>
        </form>
      )}

      {marcar.isError && (
        <div className="px-4 pb-4 sm:px-5">
          <ErrorNote>
            {marcar.error instanceof ApiError ? marcar.error.message : t('cob.noSePudoMarcar')}
          </ErrorNote>
        </div>
      )}
    </li>
  )
}

export function PanelCobros() {
  const { t, idioma } = useIdioma()
  const mesLargo = useMesLargo()
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<'todos' | 'PENDIENTE' | 'COBRADO'>('todos')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'charges'],
    queryFn: () => api.adminCharges(),
    enabled: user?.role === 'SUPERADMIN',
  })

  const cerrar = useMutation({
    mutationFn: () => api.closeMonth(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'SUPERADMIN') return <Navigate to="/panel" replace />

  const filtrados = (data?.charges ?? []).filter((c) => filtro === 'todos' || c.status === filtro)
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['admin', 'charges'] })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.cobros')}
        hint={t('cob.pista')}
        actions={
          <Button variant="secondary" loading={cerrar.isPending} onClick={() => cerrar.mutate()}>
            {t('cob.cerrarMes', { mes: mesLargo(mesAnterior()) })}
          </Button>
        }
      />

      {cerrar.isError && (
        <ErrorNote>
          {cerrar.error instanceof ApiError ? cerrar.error.message : t('cob.noSePudoCerrar')}
        </ErrorNote>
      )}
      {cerrar.isSuccess && (
        <SuccessNote>
          {cerrar.data.creados === 0
            ? t('cob.yaCerrado', { mes: mesLargo(cerrar.data.period) })
            : t(cerrar.data.creados === 1 ? 'cob.cerradoUno' : 'cob.cerradoVarios', {
                mes: mesLargo(cerrar.data.period),
                n: cerrar.data.creados,
                negocios: cerrar.data.negocios,
              })}
        </SuccessNote>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          [t('cob.porCobrar'), data?.totals.pendienteCents ?? 0, 'warn'],
          [t('cob.cobrado'), data?.totals.cobradoCents ?? 0, 'ok'],
        ].map(([label, cents, tono]) => (
          <Card key={label as string} className="p-5">
            <div className="text-meta font-medium text-muted">{label}</div>
            <div
              className={cx(
                'mt-1 font-display text-heading font-semibold tabular-nums',
                tono === 'warn' ? 'text-amber-800' : 'text-emerald-800',
              )}
            >
              {formatPrice(cents as number, idioma)}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['todos', 'cob.todos'],
            ['PENDIENTE', 'cob.pendientes'],
            ['COBRADO', 'cob.cobrados'],
          ] as const satisfies readonly (readonly [string, Clave])[]
        ).map(([key, clave]) => (
          <FilterChip key={key} active={filtro === key} onClick={() => setFiltro(key)}>
            {t(clave)}
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </Card>
      ) : !filtrados.length ? (
        <EmptyState
          title={data?.charges.length ? t('cob.nadaConFiltro') : t('cob.todaviaNoHay')}
          hint={data?.charges.length ? undefined : t('cob.todaviaNoHayPista')}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {filtrados.map((c) => (
              <Fila key={c.id} c={c} onDone={refrescar} />
            ))}
          </ul>
        </Card>
      )}

      <p className="text-meta text-subtle">
        <Texto
          clave="cob.aviso"
          partes={{
            unaSolaVez: (
              <strong className="font-semibold text-body-2">{t('cob.unaSolaVez')}</strong>
            ),
          }}
        />
      </p>
    </div>
  )
}
