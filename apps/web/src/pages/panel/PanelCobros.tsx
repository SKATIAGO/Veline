import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPrice, planLabel } from '@veline/shared'
import { api, type Charge } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FilterChip,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Spinner,
  cx,
} from '../../components/ui'
import { Texto, useIdioma, usePlural, type Clave } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'

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
  const [anulando, setAnulando] = useState(false)

  const deQuien = { negocio: c.business.name, mes: mesLargo(c.period) }
  const volverAPendiente = () =>
    api
      .markCharge(c.id, 'PENDIENTE')
      .then(onDone)
      .catch((e) => aviso.error(textoDeError(e, t('cob.noSePudoMarcar'))))

  const marcar = useMutation({
    mutationFn: (status: 'PENDIENTE' | 'COBRADO' | 'ANULADO') =>
      api.markCharge(c.id, status, nota.trim() || undefined),
    onSuccess: (_r, status) => {
      setAbierto(false)
      setAnulando(false)
      onDone()
      if (status === 'PENDIENTE') {
        aviso.ok(t('cob.vuelvePendiente', deQuien))
        return
      }
      aviso.ok(t(status === 'COBRADO' ? 'cob.cobradoHecho' : 'cob.anuladoHecho', deQuien), {
        texto: t('avisos.deshacer'),
        onClick: volverAPendiente,
      })
    },
    // Anular falla dentro de su confirmación; lo demás, en un aviso.
    onError: (err, status) => {
      if (status === 'PENDIENTE') aviso.error(textoDeError(err, t('cob.noSePudoMarcar')))
    },
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
              <Button size="sm" variant="quiet" onClick={() => setAbierto(true)}>
                {t('cob.marcarCobrado')}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setAnulando(true)}>
                {t('cob.anular')}
              </Button>
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

      {/* «Cómo se cobró» en su diálogo: antes se desplegaba bajo la fila. */}
      <FormDialog
        open={abierto}
        onClose={() => setAbierto(false)}
        title={t('cob.marcarTitulo', deQuien)}
        hint={t('cob.marcarPista', { importe: formatPrice(c.totalCents, idioma) })}
        submitLabel={t('cob.marcarCobrado')}
        onSubmit={() => marcar.mutate('COBRADO')}
        loading={marcar.isPending && marcar.variables === 'COBRADO'}
        error={
          marcar.isError && marcar.variables === 'COBRADO'
            ? textoDeError(marcar.error, t('cob.noSePudoMarcar'))
            : null
        }
        dirty={nota.trim() !== (c.paidNote ?? '')}
      >
        <Field
          label={t('cob.comoSeCobro')}
          htmlFor={`nota-${c.id}`}
          hint={t('cob.comoSeCobroPista')}
        >
          <Input id={`nota-${c.id}`} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={anulando}
        onClose={() => {
          marcar.reset()
          setAnulando(false)
        }}
        title={t('cob.anularTitulo', deQuien)}
        consecuencias={[
          t('cob.anularC1', { importe: formatPrice(c.totalCents, idioma) }),
          t('cob.anularC2'),
        ]}
        confirmLabel={t('cob.anularCobro')}
        onConfirm={() => marcar.mutate('ANULADO')}
        loading={marcar.isPending}
        error={
          marcar.isError && marcar.variables === 'ANULADO'
            ? textoDeError(marcar.error, t('cob.noSePudoMarcar'))
            : null
        }
      />
    </li>
  )
}

export function PanelCobros() {
  const { t, idioma } = useIdioma()
  const mesLargo = useMesLargo()
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<'todos' | 'PENDIENTE' | 'COBRADO'>('todos')
  const [cerrando, setCerrando] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'charges'],
    queryFn: () => api.adminCharges(),
    enabled: user?.role === 'SUPERADMIN',
  })

  const cerrar = useMutation({
    mutationFn: () => api.closeMonth(),
    onSuccess: (r) => {
      setCerrando(false)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      aviso.ok(
        r.creados === 0
          ? t('cob.yaCerrado', { mes: mesLargo(r.period) })
          : t(r.creados === 1 ? 'cob.cerradoUno' : 'cob.cerradoVarios', {
              mes: mesLargo(r.period),
              n: r.creados,
              negocios: r.negocios,
            }),
      )
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
          <Button variant="secondary" onClick={() => setCerrando(true)}>
            {t('cob.cerrarMes', { mes: mesLargo(mesAnterior()) })}
          </Button>
        }
      />

      {/* Cerrar el mes crea los cobros de todos los negocios de golpe. Antes
          era un botón sin pregunta: un clic de más en la cabecera. */}
      <ConfirmDialog
        open={cerrando}
        onClose={() => {
          cerrar.reset()
          setCerrando(false)
        }}
        title={t('cob.cerrarTitulo', { mes: mesLargo(mesAnterior()) })}
        consecuencias={[t('cob.cerrarC1'), t('cob.cerrarC2'), t('cob.cerrarC3')]}
        confirmLabel={t('cob.cerrarElMes')}
        onConfirm={() => cerrar.mutate()}
        loading={cerrar.isPending}
        error={cerrar.isError ? textoDeError(cerrar.error, t('cob.noSePudoCerrar')) : null}
      />

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
