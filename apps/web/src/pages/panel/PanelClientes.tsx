import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatPrice } from '@veline/shared'
import { api, type PanelCustomer } from '../../lib/api'
import {
  Badge,
  Card,
  EmptyState,
  FilterChip,
  Input,
  PageHeader,
  Skeleton,
  cx,
} from '../../components/ui'

/**
 * Los clientes del negocio y su historial.
 *
 * Los datos estaban guardados desde el primer día pero no había pantalla:
 * nadie podía saber quién repite, quién falta o a quién llamar cuando queda
 * un hueco libre.
 */

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'repiten', label: 'Repiten' },
  { key: 'proxima', label: 'Con cita' },
  { key: 'faltan', label: 'Han faltado' },
] as const

type FiltroKey = (typeof FILTROS)[number]['key']

function cumple(c: PanelCustomer, filtro: FiltroKey) {
  if (filtro === 'repiten') return c.total > 1
  if (filtro === 'proxima') return c.proxima !== null
  if (filtro === 'faltan') return c.ausencias > 0
  return true
}

export function PanelClientes() {
  const { slug = '' } = useParams()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroKey>('todos')

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['panel', slug, 'customers'],
    queryFn: () => api.panelCustomers(slug),
  })

  const q = busqueda.trim().toLowerCase()
  const filtrados = (clientes ?? []).filter(
    (c) => cumple(c, filtro) && (!q || c.name.toLowerCase().includes(q) || c.phone.includes(q)),
  )

  const repiten = clientes?.filter((c) => c.total > 1).length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        hint={
          clientes
            ? `${clientes.length} en total${repiten ? ` · ${repiten} han repetido` : ''}`
            : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <FilterChip key={f.key} active={filtro === f.key} onClick={() => setFiltro(f.key)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
        <Input
          type="search"
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar clientes"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="ml-auto max-w-xs"
        />
      </div>

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !filtrados.length ? (
        <EmptyState
          title={clientes?.length ? 'Nadie coincide con esta búsqueda' : 'Todavía no hay clientes'}
          hint={
            clientes?.length
              ? undefined
              : 'En cuanto entre la primera cita, el cliente aparecerá aquí con su historial.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {filtrados.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-body font-bold text-white"
                >
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>

                <div className="min-w-[170px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ui font-semibold text-ink">{c.name}</span>
                    {c.total > 1 && <Badge tone="ok">{c.total} citas</Badge>}
                    {c.ausencias > 0 && (
                      <Badge tone="warn">
                        {c.ausencias} {c.ausencias === 1 ? 'ausencia' : 'ausencias'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-meta text-muted">
                    <a
                      href={`tel:${c.phone}`}
                      className="-my-1.5 inline-flex min-h-8 items-center rounded-lg px-1 py-1.5 hover:text-brand hover:underline"
                    >
                      {c.phone}
                    </a>
                    {c.email && ` · ${c.email}`}
                  </p>
                </div>

                <dl className="flex gap-5 text-meta text-muted">
                  {[
                    ['Última', fecha(c.ultima)],
                    ['Próxima', fecha(c.proxima)],
                    ['Gastado', formatPrice(c.gastadoCents)],
                  ].map(([label, valor]) => (
                    <div key={label}>
                      <dt className="text-caption">{label}</dt>
                      <dd
                        className={cx(
                          'font-semibold text-body-2 tabular-nums',
                          label === 'Próxima' && c.proxima && 'text-brand-text',
                        )}
                      >
                        {valor}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-meta text-subtle">
        El historial es solo de <strong className="font-semibold text-body-2">tu negocio</strong>:
        un cliente que también reserva en otro sitio de Veline no comparte con él ni sus citas ni
        sus datos. «Han faltado» son las citas que marcaste como que el cliente no vino.
      </p>
    </div>
  )
}
