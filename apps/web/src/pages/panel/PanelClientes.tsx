import { useEffect, useId, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatLongDate, formatPrice, madridDay, TIMEZONE } from '@veline/shared'
import { api, type NotaDeCliente, type PanelCustomer } from '../../lib/api'
import { useLocal } from '../../lib/local'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Textarea,
  Input,
  PageHeader,
  Sheet,
  Skeleton,
  cx,
} from '../../components/ui'
import { Texto, useIdioma, usePlural, type Clave } from '../../i18n/idioma'
import { Tabs, panelProps } from '../../components/Tabs'
import { Segmentado } from '../../components/Segmentado'
import { aviso, textoDeError } from '../../components/Avisos'
import { ConfirmDialog } from '../../components/Confirmar'

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

const ESTADO_CITA = {
  CONFIRMADA: { clave: 'cont.confirmada', tono: 'neutral' },
  COMPLETADA: { clave: 'agenda.atendida', tono: 'ok' },
  NO_ASISTIO: { clave: 'agenda.noVinoEstado', tono: 'warn' },
  CANCELADA: { clave: 'agenda.cancelada', tono: 'off' },
} as const satisfies Record<string, { clave: Clave; tono: 'neutral' | 'ok' | 'warn' | 'off' }>

/** Sus citas en este negocio, de la más reciente a la más antigua. */
function Historial({ slug, cliente }: { slug: string; cliente: PanelCustomer }) {
  const { t, idioma, locale } = useIdioma()
  const { actual: local } = useLocal()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['panel', slug, 'customers', cliente.id, 'citas', local],
    queryFn: () => api.customerBookings(slug, cliente.id, local),
  })

  if (isLoading)
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    )
  if (isError) return <ErrorNote>{t('fcli.noSeCargo')}</ErrorNote>
  if (!data?.length) return <p className="text-body text-body-2">{t('fcli.sinCitas')}</p>

  return (
    <ul className="flex flex-col">
      {data.map((c) => {
        const d = new Date(c.startsAt)
        const estado = ESTADO_CITA[c.status]
        return (
          <li
            key={c.id}
            className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink first-letter:uppercase">
                {formatLongDate(madridDay(d), idioma)} ·{' '}
                {d.toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: TIMEZONE,
                })}
              </p>
              <p className="text-meta text-muted">
                {c.servicio}
                {c.extras.length > 0 &&
                  ` + ${c.extras.map((e) => (e.quantity > 1 ? `${e.name} ×${e.quantity}` : e.name)).join(', ')}`}
                {c.persona && ` · ${c.persona}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-body font-semibold text-ink tabular-nums">
                {formatPrice(c.priceCents, idioma)}
              </span>
              <Badge tone={estado.tono}>{t(estado.clave)}</Badge>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Lo que el negocio apunta de esta persona, por ejemplo la mezcla de tinte. */
function Notas({ slug, cliente }: { slug: string; cliente: PanelCustomer }) {
  const { t, locale } = useIdioma()
  const queryClient = useQueryClient()
  const clave = ['panel', slug, 'customers', cliente.id, 'notas']
  const { data, isLoading, isError } = useQuery({
    queryKey: clave,
    queryFn: () => api.customerNotes(slug, cliente.id),
  })
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState<NotaDeCliente | null>(null)
  const [aBorrar, setABorrar] = useState<NotaDeCliente | null>(null)
  const idTexto = useId()
  useEffect(() => {
    setTexto('')
    setEditando(null)
    setABorrar(null)
  }, [cliente.id])

  const refrescar = () => queryClient.invalidateQueries({ queryKey: clave })

  const guardar = useMutation({
    mutationFn: async () => {
      if (editando) await api.updateCustomerNote(slug, cliente.id, editando.id, texto)
      else await api.addCustomerNote(slug, cliente.id, texto)
    },
    onSuccess: () => {
      aviso.ok(t('fcli.notaGuardada'))
      setTexto('')
      setEditando(null)
      refrescar()
    },
    onError: (err) => aviso.error(textoDeError(err, t('fcli.notaError'))),
  })

  const borrar = useMutation({
    mutationFn: (n: NotaDeCliente) => api.deleteCustomerNote(slug, cliente.id, n.id),
    onSuccess: () => {
      aviso.ok(t('fcli.notaBorrada'))
      setABorrar(null)
      refrescar()
    },
    onError: (err) => aviso.error(textoDeError(err, t('fcli.notaError'))),
  })

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (texto.trim()) guardar.mutate()
        }}
      >
        <Field
          label={editando ? t('fcli.notaEditar') : t('fcli.notaNueva')}
          htmlFor={idTexto}
          hint={t('fcli.notaPista')}
        >
          <Textarea
            id={idTexto}
            value={texto}
            maxLength={2000}
            onChange={(e) => setTexto(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" loading={guardar.isPending} disabled={!texto.trim()}>
            {editando ? t('fcli.notaGuardarCambios') : t('fcli.notaGuardar')}
          </Button>
          {editando && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditando(null)
                setTexto('')
              }}
            >
              {t('fcli.notaCancelar')}
            </Button>
          )}
        </div>
      </form>

      {isLoading ? (
        <Skeleton className="h-16" />
      ) : isError ? (
        <ErrorNote>{t('fcli.notaNoCarga')}</ErrorNote>
      ) : !data?.length ? (
        <p className="text-body text-body-2">{t('fcli.notaSin')}</p>
      ) : (
        <ul className="flex flex-col">
          {data.map((n) => (
            <li key={n.id} className="border-t border-line py-3 first:border-t-0">
              <p className="text-body break-words whitespace-pre-wrap text-ink">{n.texto}</p>
              <p className="mt-1 text-meta text-muted">
                {n.autor} ·{' '}
                {new Date(n.createdAt).toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: TIMEZONE,
                })}
                {n.editada && ` · ${t('fcli.notaEditada')}`}
              </p>
              <div className="mt-1 flex gap-1">
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    setEditando(n)
                    setTexto(n.texto)
                  }}
                >
                  {t('fcli.notaEditar')}
                </Button>
                <Button variant="quiet" size="sm" onClick={() => setABorrar(n)}>
                  {t('fcli.notaBorrar')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!aBorrar}
        onClose={() => setABorrar(null)}
        title={t('fcli.notaBorrarTitulo')}
        consecuencias={[t('fcli.notaBorrarAviso')]}
        confirmLabel={t('fcli.notaBorrarSi')}
        tono="destruir"
        loading={borrar.isPending}
        onConfirm={() => aBorrar && borrar.mutate(aBorrar)}
      />
    </div>
  )
}

/**
 * La ficha de un cliente: cómo localizarle, cómo le va con el negocio y su
 * historial, al lado de la lista. Antes la lista era todo lo que había, y
 * para darle otra cita había que ir a la agenda y escribirle entero.
 */
function FichaCliente({
  slug,
  cliente,
  onClose,
}: {
  slug: string
  cliente: PanelCustomer | null
  onClose: () => void
}) {
  const { t, idioma, locale } = useIdioma()
  const navigate = useNavigate()
  const idBase = useId()
  const [pestana, setPestana] = useState<'resumen' | 'historial' | 'notas'>('resumen')
  useEffect(() => setPestana('resumen'), [cliente?.id])

  const fecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: TIMEZONE,
        })
      : '—'
  const pila = cliente?.name.split(' ')[0] ?? ''

  return (
    <Sheet open={!!cliente} onClose={onClose} title={cliente?.name ?? ''} lado="derecha">
      {cliente && (
        <div className="flex min-h-[calc(100%-3rem)] flex-col">
          <div className="flex items-center gap-3 pr-10">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-ui font-bold text-white"
            >
              {cliente.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-subheading font-semibold text-ink">
                {cliente.name}
              </h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {cliente.proxima && <Badge tone="ok">{t('clientes.conCita')}</Badge>}
                {cliente.ausencias > 0 && (
                  <Badge tone="warn">
                    {t(
                      cliente.ausencias === 1 ? 'clientes.unaAusencia' : 'clientes.variasAusencias',
                      {
                        n: cliente.ausencias,
                      },
                    )}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Tabs
              idBase={idBase}
              tabs={[
                { id: 'resumen', label: t('fneg.resumen') },
                { id: 'historial', label: t('fcli.historial'), contador: cliente.total },
                { id: 'notas', label: t('fcli.notas') },
              ]}
              activa={pestana}
              onCambiar={setPestana}
              label={t('fcli.pestanas')}
            />
          </div>

          <div
            {...panelProps(idBase, pestana)}
            className="flex flex-1 flex-col gap-4 py-5 outline-none"
          >
            {pestana === 'resumen' ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-body">
                <dt className="text-muted">{t('agenda.telefono')}</dt>
                <dd className="text-right">
                  <a
                    href={`tel:${cliente.phone}`}
                    className="-my-2 inline-flex min-h-11 items-center font-semibold text-brand-text tabular-nums hover:underline"
                  >
                    {cliente.phone}
                  </a>
                </dd>
                <dt className="text-muted">{t('agenda.email')}</dt>
                <dd className="text-right font-semibold break-all text-ink">
                  {cliente.email ?? '—'}
                </dd>
                <dt className="text-muted">{t('fcli.proxima')}</dt>
                <dd className="text-right font-semibold text-ink first-letter:uppercase">
                  {fecha(cliente.proxima)}
                </dd>
                <dt className="text-muted">{t('fcli.ultima')}</dt>
                <dd className="text-right font-semibold text-ink first-letter:uppercase">
                  {fecha(cliente.ultima)}
                </dd>
                <dt className="text-muted">{t('fcli.vino')}</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">
                  {t('fcli.deTotal', { n: cliente.completadas, total: cliente.total })}
                </dd>
                <dt className="text-muted">{t('fcli.noVino')}</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">
                  {cliente.ausencias}
                </dd>
                <dt className="text-muted">{t('fcli.cancelo')}</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">
                  {cliente.canceladas}
                </dd>
                <dt className="text-muted">{t('clientes.gastado')}</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">
                  {formatPrice(cliente.gastadoCents, idioma)}
                </dd>
              </dl>
            ) : pestana === 'historial' ? (
              <Historial slug={slug} cliente={cliente} />
            ) : (
              <Notas slug={slug} cliente={cliente} />
            )}
          </div>

          <div className="sticky bottom-[calc(-1*max(1.5rem,env(safe-area-inset-bottom)))] -mx-5 -mb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-wrap gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:-mb-6 sm:-bottom-6 sm:px-6 sm:pb-5">
            <Button
              onClick={() =>
                navigate(`/panel/${slug}?nueva=1&para=${encodeURIComponent(cliente.id)}`)
              }
            >
              {t('fcli.nuevaCitaPara', { nombre: pila })}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

export function PanelClientes() {
  const { t, idioma, locale } = useIdioma()
  const { actual: local } = useLocal()
  const plural = usePlural()
  const { slug = '' } = useParams()

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroKey>('todos')
  const [fichaId, setFichaId] = useState<string | null>(null)

  const fecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          timeZone: TIMEZONE,
        })
      : '—'

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['panel', slug, 'customers', local],
    queryFn: () => api.panelCustomers(slug, local),
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
        <Segmentado
          label={t('panel.clientes')}
          tamano="sm"
          className="sm:max-w-lg"
          opciones={FILTROS.map((f) => ({ id: f.key, label: t(f.clave) }))}
          valor={filtro}
          onCambiar={setFiltro}
        />
        <Input
          type="search"
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
              /* La fila entera abre la ficha: un botón estirado por encima,
                 porque dentro hay una lista que un botón no puede contener.
                 El teléfono queda por encima para poder llamar. */
              <li
                key={c.id}
                className="relative flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 transition-colors duration-200 last:border-b-0 hover:bg-canvas/50 sm:px-5"
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-body font-bold text-white"
                >
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>

                <div className="min-w-[170px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFichaId(c.id)}
                      className="text-left text-ui font-semibold text-ink after:absolute after:inset-0 after:content-['']"
                    >
                      {c.name}
                    </button>
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
                      className="relative z-elevado -my-3 inline-flex min-h-11 items-center rounded-lg px-1 hover:text-brand hover:underline"
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

      <FichaCliente
        slug={slug}
        cliente={clientes?.find((c) => c.id === fichaId) ?? null}
        onClose={() => setFichaId(null)}
      />

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
