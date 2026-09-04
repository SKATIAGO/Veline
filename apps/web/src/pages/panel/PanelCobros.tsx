import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPrice, PLAN_INFO } from '@veline/shared'
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

/** El mes anterior, que es el que normalmente se cierra. */
function mesAnterior() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}

function Fila({ c, onDone }: { c: Charge; onDone: () => void }) {
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
            <Badge tone={TONO[c.status] ?? 'neutral'}>{ESTADO_LABEL[c.status]}</Badge>
          </div>
          <p className="mt-0.5 text-meta text-muted">
            {mesLargo(c.period)} · {PLAN_INFO[c.plan].label} · {c.seats}{' '}
            {c.seats === 1 ? 'persona' : 'personas'}
          </p>
        </div>

        <dl className="flex flex-wrap gap-5 text-meta text-muted">
          {[
            ['Cuota', c.subscriptionCents],
            ['Comisión', c.commissionCents],
            [`Mensajes${c.extraMessages ? ` (${c.extraMessages})` : ''}`, c.messagesCents],
          ].map(([label, cents]) => (
            <div key={label as string}>
              <dt className="text-caption">{label}</dt>
              <dd className="font-semibold text-body-2 tabular-nums">
                {formatPrice(cents as number)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="w-[104px] text-right">
          <div className="text-ui font-semibold text-ink tabular-nums">
            {formatPrice(c.totalCents)}
          </div>
          {c.paidAt && (
            <div className="text-caption text-subtle">
              {new Date(c.paidAt).toLocaleDateString('es-ES')}
            </div>
          )}
        </div>

        <div className="ml-auto flex gap-1 sm:ml-0">
          {c.status === 'PENDIENTE' ? (
            <>
              <Button
                size="sm"
                variant="quiet"
                loading={marcar.isPending && marcar.variables === 'COBRADO'}
                onClick={() => setAbierto((a) => !a)}
              >
                Marcar cobrado
              </Button>
              <ConfirmAction
                label="Anular"
                confirmLabel="Sí, anular"
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
              Volver a pendiente
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
            <span className="text-meta font-semibold text-body-2">Cómo se cobró</span>
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Transferencia del 4 de septiembre"
              autoFocus
            />
          </label>
          <Button type="submit" loading={marcar.isPending}>
            Marcar cobrado
          </Button>
          <Button type="button" variant="quiet" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
        </form>
      )}

      {marcar.isError && (
        <div className="px-4 pb-4 sm:px-5">
          <ErrorNote>
            {marcar.error instanceof ApiError ? marcar.error.message : 'No se ha podido marcar'}
          </ErrorNote>
        </div>
      )}
    </li>
  )
}

export function PanelCobros() {
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
        title="Cobros"
        hint="El cobro es manual: esto dice cuánto y guarda lo que ya está pagado."
        actions={
          <Button variant="secondary" loading={cerrar.isPending} onClick={() => cerrar.mutate()}>
            Cerrar {mesLargo(mesAnterior())}
          </Button>
        }
      />

      {cerrar.isError && (
        <ErrorNote>
          {cerrar.error instanceof ApiError ? cerrar.error.message : 'No se ha podido cerrar'}
        </ErrorNote>
      )}
      {cerrar.isSuccess && (
        <SuccessNote>
          {cerrar.data.creados === 0
            ? `${mesLargo(cerrar.data.period)} ya estaba cerrado: no hay cobros nuevos.`
            : `${mesLargo(cerrar.data.period)} cerrado: ${cerrar.data.creados} ${
                cerrar.data.creados === 1 ? 'cobro nuevo' : 'cobros nuevos'
              } de ${cerrar.data.negocios} negocios.`}
        </SuccessNote>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['Por cobrar', data?.totals.pendienteCents ?? 0, 'warn'],
          ['Cobrado', data?.totals.cobradoCents ?? 0, 'ok'],
        ].map(([label, cents, tono]) => (
          <Card key={label as string} className="p-5">
            <div className="text-meta font-medium text-muted">{label}</div>
            <div
              className={cx(
                'mt-1 font-display text-heading font-semibold tabular-nums',
                tono === 'warn' ? 'text-amber-800' : 'text-emerald-800',
              )}
            >
              {formatPrice(cents as number)}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['todos', 'Todos'],
            ['PENDIENTE', 'Pendientes'],
            ['COBRADO', 'Cobrados'],
          ] as const
        ).map(([key, label]) => (
          <FilterChip key={key} active={filtro === key} onClick={() => setFiltro(key)}>
            {label}
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
          title={data?.charges.length ? 'Nada con este filtro' : 'Todavía no hay cobros'}
          hint={
            data?.charges.length
              ? undefined
              : 'Los cobros se generan al cerrar un mes con el botón de arriba.'
          }
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
        Un mes se cierra <strong className="font-semibold text-body-2">una sola vez</strong>: las
        cifras se congelan al cerrarlo, así que si un negocio cambia de plan en octubre, septiembre
        no se mueve. Volver a cerrar el mismo mes no duplica nada.
      </p>
    </div>
  )
}
