import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoryLabel, formatPrice, planLabel, subStatusLabel } from '@veline/shared'
import { api, type AdminBusiness } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  Spinner,
  cx,
} from '../../components/ui'
import { Texto, useIdioma, type Clave } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'
import { RowMenu } from '../../components/RowMenu'
import { ESTADO_TONO, FichaNegocio, diasHasta } from './FichaNegocio'
import { AltaNegocio } from './AltaNegocio'
import { CrearCuentaAdmin } from './CrearCuentaAdmin'

/**
 * Los negocios de la plataforma — SOLO superadmin.
 *
 * Arriba, las cifras que importan para atenderlos, y cada una filtra la lista:
 * antes eran números sueltos («Sin aprobar: 2») que no llevaban a ningún
 * sitio, y para encontrar esos dos había que recorrer la lista entera. Cada
 * fila abre la ficha del negocio al lado, con su suscripción, sus cuentas, sus
 * cobros y su actividad; lo demás está en «···».
 */

/** Las cifras de arriba, que a la vez son los filtros de la lista. */
const FILTROS = [
  {
    key: 'todos',
    clave: 'fneg.filtroTodos',
    // Los dados de baja no hace falta atenderlos a diario: tienen su cifra.
    cumple: (b: AdminBusiness) => b.subStatus !== 'CANCELADA',
  },
  {
    key: 'revisar',
    clave: 'fneg.filtroRevisar',
    // Se dieron de alta solos, o abrieron un local, y nadie lo ha mirado.
    // Mientras tanto no salen en el marketplace.
    cumple: (b: AdminBusiness) => !b.approvedAt || b.pendingLocations.length > 0,
    aviso: true,
  },
  {
    key: 'prueba',
    clave: 'fneg.filtroPrueba',
    cumple: (b: AdminBusiness) => b.subStatus === 'PRUEBA',
  },
  {
    key: 'impagados',
    clave: 'fneg.filtroImpagados',
    cumple: (b: AdminBusiness) => b.subStatus === 'IMPAGADA',
    aviso: true,
  },
  {
    key: 'suspendidos',
    clave: 'fneg.filtroSuspendidos',
    cumple: (b: AdminBusiness) => b.subStatus === 'SUSPENDIDA',
  },
  {
    key: 'baja',
    clave: 'fneg.filtroBaja',
    cumple: (b: AdminBusiness) => b.subStatus === 'CANCELADA',
  },
] as const satisfies readonly {
  key: string
  clave: Clave
  cumple: (b: AdminBusiness) => boolean
  aviso?: boolean
}[]

type FiltroKey = (typeof FILTROS)[number]['key']

/** Una cifra que se pulsa para ver esos negocios. */
function Cifra({
  label,
  n,
  activa,
  aviso,
  onClick,
}: {
  label: string
  n: number
  activa: boolean
  aviso?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cx(
        'flex min-w-0 flex-col items-start rounded-xl border bg-surface px-3 py-2.5 text-left sm:px-4 sm:py-3',
        'transition-colors duration-200',
        activa ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong',
      )}
    >
      <span className="max-w-full truncate text-meta font-medium text-muted">{label}</span>
      <span
        className={cx(
          'mt-0.5 font-display text-heading-sm font-semibold tabular-nums',
          aviso && n > 0 ? 'text-brand-text' : 'text-ink',
        )}
      >
        {n}
      </span>
    </button>
  )
}

export function PanelAdmin() {
  const { t, idioma } = useIdioma()
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [dandoDeAlta, setDandoDeAlta] = useState(false)
  // Para qué negocio se está creando una cuenta (y con qué correo de partida).
  const [cuentaPara, setCuentaPara] = useState<{ businessId: string; email: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroKey>('todos')
  // El id y no el negocio: así la ficha enseña lo último tras cada cambio.
  const [fichaId, setFichaId] = useState<string | null>(null)
  const [aAprobar, setAAprobar] = useState<AdminBusiness | null>(null)

  const { data: businesses, isLoading } = useQuery({
    queryKey: ['admin', 'businesses'],
    queryFn: api.adminBusinesses,
    enabled: user?.role === 'SUPERADMIN',
  })

  const aprobar = useMutation({
    mutationFn: (b: AdminBusiness) => api.approveBusiness(b.id),
    onSuccess: (_r, b) => {
      setAAprobar(null)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      aviso.ok(t('adm.aprobadoHecho', { nombre: b.name }))
    },
  })

  const cuantos = useMemo(
    () =>
      Object.fromEntries(
        FILTROS.map((f) => [f.key, (businesses ?? []).filter(f.cumple).length]),
      ) as Record<FiltroKey, number>,
    [businesses],
  )

  const filtrados = useMemo(() => {
    const cumple = FILTROS.find((f) => f.key === filtro)!.cumple
    const q = busqueda.trim().toLowerCase()
    return (businesses ?? []).filter(
      (b) =>
        cumple(b) &&
        (!q ||
          b.name.toLowerCase().includes(q) ||
          b.slug.includes(q) ||
          (b.email ?? '').toLowerCase().includes(q) ||
          categoryLabel(b.category).toLowerCase().includes(q)),
    )
  }, [businesses, filtro, busqueda])

  const ficha = businesses?.find((b) => b.id === fichaId) ?? null

  // Antes de cualquier return: un hook detrás de uno cambia de orden entre
  // renders y React deja de saber cuál es cuál.
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'SUPERADMIN') return <Navigate to="/panel" replace />

  const abrirCuenta = (b: AdminBusiness) =>
    setCuentaPara({ businessId: b.id, email: b.email ?? '' })

  const filtroActivo = FILTROS.find((f) => f.key === filtro)!

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.negocios')}
        hint={t('adm.pista')}
        actions={<Button onClick={() => setDandoDeAlta(true)}>{t('adm.darDeAlta')}</Button>}
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        {FILTROS.map((f) => (
          <Cifra
            key={f.key}
            label={t(f.clave)}
            n={cuantos[f.key]}
            activa={filtro === f.key}
            aviso={'aviso' in f && f.aviso}
            onClick={() => setFiltro(f.key)}
          />
        ))}
      </div>

      <Input
        type="search"
        aria-label={t('adm.buscarEtiqueta')}
        placeholder={t('fneg.buscar')}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </Card>
      ) : !businesses?.length ? (
        <EmptyState
          title={t('adm.aunNoHay')}
          hint={t('adm.aunNoHayPista')}
          action={<Button onClick={() => setDandoDeAlta(true)}>{t('adm.darDeAltaUno')}</Button>}
        />
      ) : !filtrados.length ? (
        <EmptyState
          title={
            busqueda.trim()
              ? t('adm.ningunoCoincide', { q: busqueda.trim() })
              : t('fneg.ningunoEn', { filtro: t(filtroActivo.clave) })
          }
          action={
            filtro !== 'todos' ? (
              <Button variant="secondary" onClick={() => setFiltro('todos')}>
                {t('fneg.verTodos')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {filtrados.map((b) => (
              /* La fila entera abre la ficha. Es un botón estirado por encima
                 y no un botón que lo envuelve todo: dentro hay una lista y
                 etiquetas, que un botón no puede contener. */
              <li
                key={b.id}
                className="relative flex items-center border-b border-line transition-colors duration-200 last:border-b-0 hover:bg-canvas/50"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3 py-4 pr-2 pl-4 sm:pl-5">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFichaId(b.id)}
                        className="text-left text-ui font-semibold text-ink after:absolute after:inset-0 after:content-['']"
                      >
                        {b.name}
                      </button>
                      <Badge tone={ESTADO_TONO[b.subStatus] ?? 'neutral'}>
                        {subStatusLabel(b.subStatus, idioma)}
                        {b.subStatus === 'PRUEBA' && b.trialEndsAt
                          ? ` · ${Math.max(0, diasHasta(b.trialEndsAt))} d`
                          : ''}
                      </Badge>
                      {!b.approvedAt && <Badge tone="warn">{t('adm.sinAprobar')}</Badge>}
                      {b.pendingLocations.length > 0 && (
                        <Badge tone="warn">
                          {t(
                            b.pendingLocations.length === 1
                              ? 'adm.unLocalSinAprobar'
                              : 'adm.variosLocalesSinAprobar',
                            { n: b.pendingLocations.length },
                          )}
                        </Badge>
                      )}
                      {!b.accepting && b.subStatus !== 'CANCELADA' && (
                        <Badge tone="off">{t('adm.noAceptaReservas')}</Badge>
                      )}
                      {b.counts.services === 0 && (
                        <Badge tone="warn">{t('adm.sinServicios')}</Badge>
                      )}
                      {b.counts.users === 0 && <Badge tone="off">{t('adm.sinAcceso')}</Badge>}
                    </div>
                    <p className="mt-0.5 text-meta text-muted">
                      {categoryLabel(b.category, idioma)} · {planLabel(b.plan, idioma)} ·{' '}
                      {t('adm.alMes', { importe: formatPrice(b.monthlyCents, idioma) })}
                      {b.email && ` · ${b.email}`}
                    </p>
                  </div>

                  <dl className="flex gap-5 text-meta text-muted">
                    {[
                      [t('adm.citas'), b.counts.bookings],
                      [t('adm.servicios'), b.counts.services],
                      [t('adm.equipo'), b.counts.users],
                    ].map(([label, n]) => (
                      <div key={label as string}>
                        <dt className="text-caption">{label}</dt>
                        <dd className="font-semibold text-body-2 tabular-nums">{n}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="relative z-10 pr-3">
                  <RowMenu
                    label={b.name}
                    acciones={[
                      { label: t('equipo.verFichaCorto'), onClick: () => setFichaId(b.id) },
                      {
                        label: t('fneg.abrirSuPanel'),
                        onClick: () => navigate(`/panel/${b.slug}`),
                      },
                      { label: t('adm.crearCuenta'), onClick: () => abrirCuenta(b) },
                      ...(!b.approvedAt
                        ? [{ label: t('adm.aprobar'), onClick: () => setAAprobar(b) }]
                        : []),
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <FichaNegocio
        negocio={ficha}
        onClose={() => setFichaId(null)}
        onAprobar={setAAprobar}
        onCrearCuenta={abrirCuenta}
      />

      <AltaNegocio open={dandoDeAlta} onClose={() => setDandoDeAlta(false)} />

      {cuentaPara && (
        <CrearCuentaAdmin
          negocios={businesses ?? []}
          inicial={cuentaPara}
          onClose={() => setCuentaPara(null)}
        />
      )}

      <ConfirmDialog
        open={!!aAprobar}
        onClose={() => {
          aprobar.reset()
          setAAprobar(null)
        }}
        title={t('adm.aprobarTitulo', { nombre: aAprobar?.name ?? '' })}
        consecuencias={[t('adm.aprobarC1'), t('adm.aprobarC2'), t('adm.aprobarC3')]}
        confirmLabel={t('adm.aprobarYPublicar')}
        onConfirm={() => aAprobar && aprobar.mutate(aAprobar)}
        loading={aprobar.isPending}
        error={aprobar.isError ? textoDeError(aprobar.error, t('adm.noSePudoAprobar')) : null}
      />

      <p className="text-meta text-subtle">
        <Texto
          clave="adm.avisoAprobar"
          partes={{
            sinAprobar: (
              <strong className="font-semibold text-body-2">{t('adm.sinAprobar')}</strong>
            ),
          }}
        />
      </p>
    </div>
  )
}
