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
import { Texto, useIdioma, usePlural, type Clave } from '../../i18n/idioma'

/**
 * Los clientes del negocio y su historial.
 *
 * Los datos estaban guardados desde el primer día pero no había pantalla:
 * nadie podía saber quién repite, quién falta o a quién llamar cuando queda
 * un hueco libre.
 */

const FILTROS = [
  { key: 'todos', clave: 'clientes.todos' },
  { key: 'repiten', clave: 'clientes.repiten' },
  { key: 'proxima', clave: 'clientes.conCita' },
  { key: 'faltan', clave: 'clientes.hanFaltado' },
] as const satisfies readonly { key: string; clave: Clave }[]

type FiltroKey = (typeof FILTROS)[number]['key']

function cumple(c: PanelCustomer, filtro: FiltroKey) {
  if (filtro === 'repiten') return c.total > 1
  if (filtro === 'proxima') return c.proxima !== null
  if (filtro === 'faltan') return c.ausencias > 0
  return true
}

export function PanelClientes() {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroKey>('todos')

  const fecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '—'

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
        title={t('panel.clientes')}
        hint={
          clientes
            ? [
                t('clientes.enTotal', { n: clientes.length }),
                ...(repiten ? [t('clientes.hanRepetido', { n: repiten })] : []),
              ].join(' · ')
            : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <FilterChip key={f.key} active={filtro === f.key} onClick={() => setFiltro(f.key)}>
              {t(f.clave)}
            </FilterChip>
          ))}
        </div>
        <Input
          type="search"
          placeholder={t('clientes.buscar')}
          aria-label={t('clientes.buscarEtiqueta')}
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
          title={clientes?.length ? t('clientes.nadieCoincide') : t('clientes.todaviaNoHay')}
          hint={clientes?.length ? undefined : t('clientes.todaviaNoHayPista')}
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
                    {c.total > 1 && (
                      <Badge tone="ok">
                        {plural(c.total, 'clientes.unaCita', 'clientes.variasCitas')}
                      </Badge>
                    )}
                    {c.ausencias > 0 && (
                      <Badge tone="warn">
                        {plural(c.ausencias, 'clientes.unaAusencia', 'clientes.variasAusencias')}
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
                  {(
                    [
                      ['clientes.ultima', fecha(c.ultima)],
                      ['clientes.proxima', fecha(c.proxima)],
                      ['clientes.gastado', formatPrice(c.gastadoCents, idioma)],
                    ] as [Clave, string][]
                  ).map(([clave, valor]) => (
                    <div key={clave}>
                      <dt className="text-caption">{t(clave)}</dt>
                      <dd
                        className={cx(
                          'font-semibold text-body-2 tabular-nums',
                          clave === 'clientes.proxima' && c.proxima && 'text-brand-text',
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
        <Texto
          clave="clientes.aviso"
          partes={{
            tuNegocio: (
              <strong className="font-semibold text-body-2">{t('clientes.tuNegocio')}</strong>
            ),
          }}
        />
      </p>
    </div>
  )
}
