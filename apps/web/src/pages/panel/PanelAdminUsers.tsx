import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FilterChip,
  Input,
  PageHeader,
  Skeleton,
  Spinner,
  cx,
} from '../../components/ui'
import { Texto, useIdioma, type Clave } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'

/**
 * Todas las cuentas de acceso de la plataforma, de un vistazo — solo
 * superadmin. Antes solo se podían ver negocio a negocio, así que responder a
 * «¿quién tiene acceso a Veline?» obligaba a recorrerlos todos.
 */

const ROL_CLAVE = {
  SUPERADMIN: 'panel.rolSuperadmin',
  ADMIN: 'panel.rolAdmin',
  EMPLEADO: 'panel.rolEmpleado',
} as const satisfies Record<string, Clave>

const FILTROS = [
  { key: 'todos', clave: 'ctas.todos' },
  { key: 'SUPERADMIN', clave: 'ctas.superadmins' },
  { key: 'ADMIN', clave: 'ctas.administradores' },
  { key: 'EMPLEADO', clave: 'ctas.equipo' },
  { key: 'inactivos', clave: 'ctas.sinAcceso' },
] as const satisfies readonly { key: string; clave: Clave }[]

type FiltroKey = (typeof FILTROS)[number]['key']

export function PanelAdminUsers() {
  const { t, locale } = useIdioma()
  const { user: me, loading } = useAuth()

  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<FiltroKey>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [aQuitar, setAQuitar] = useState<{ id: string; name: string; role: string } | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: api.adminUsers,
    enabled: me?.role === 'SUPERADMIN',
  })

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['panel'] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; name: string; active: boolean }) =>
      api.setAdminUserActive(id, active),
    onSuccess: (_r, v) => {
      refrescar()
      if (v.active) {
        aviso.ok(t('eq.accesoDevuelto', { nombre: v.name }))
        return
      }
      setAQuitar(null)
      aviso.ok(t('eq.accesoQuitado', { nombre: v.name }), {
        texto: t('avisos.deshacer'),
        onClick: () =>
          api
            .setAdminUserActive(v.id, true)
            .then(refrescar)
            .catch((e) => aviso.error(textoDeError(e, t('avisos.error')))),
      })
    },
    onError: (err, v) => {
      if (v.active) aviso.error(textoDeError(err, t('avisos.error')))
    },
  })

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (users ?? []).filter((u) => {
      if (filtro === 'inactivos' && u.active) return false
      if (filtro !== 'todos' && filtro !== 'inactivos' && u.role !== filtro) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.business?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [users, filtro, busqueda])

  const sinAcceso = users?.filter((u) => !u.active).length ?? 0

  if (loading) return <Spinner />
  if (!me) return <Navigate to="/login" replace />
  if (me.role !== 'SUPERADMIN') return <Navigate to="/panel" replace />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('ctas.titulo')}
        hint={
          users
            ? [
                t('ctas.enTotal', { n: users.length }),
                ...(sinAcceso ? [t('ctas.sinAccesoCuenta', { n: sinAcceso })] : []),
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
          aria-label={t('ctas.buscarEtiqueta')}
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
          title={busqueda ? t('ctas.ningunaCoincide', { q: busqueda }) : t('ctas.ningunaAqui')}
          hint={busqueda ? undefined : t('ctas.pruebaOtroFiltro')}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {filtrados.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
              >
                <span
                  aria-hidden
                  className={cx(
                    'grid size-10 shrink-0 place-items-center rounded-full text-body font-bold',
                    !u.active
                      ? 'bg-line text-muted'
                      : u.role === 'SUPERADMIN'
                        ? 'bg-ink text-cream'
                        : 'bg-brand text-white',
                  )}
                >
                  {u.name.trim().charAt(0).toUpperCase()}
                </span>

                <div className={cx('min-w-[180px] flex-1', !u.active && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ui font-semibold text-ink">{u.name}</span>
                    {u.id === me.id && <Badge>{t('ctas.tu')}</Badge>}
                    {!u.active && <Badge tone="off">{t('ctas.sinAcceso')}</Badge>}
                  </div>
                  <p className="mt-0.5 text-meta text-muted">{u.email}</p>
                </div>

                <div className={cx('w-[150px]', !u.active && 'opacity-60')}>
                  <div className="text-meta font-semibold text-body-2">{t(ROL_CLAVE[u.role])}</div>
                  {u.business ? (
                    <Link
                      to={`/panel/${u.business.slug}`}
                      className="-my-1 inline-flex min-h-8 items-center py-1 text-meta text-subtle hover:text-brand hover:underline"
                    >
                      {u.business.name}
                    </Link>
                  ) : (
                    <span className="text-meta text-subtle">{t('ctas.todaLaPlataforma')}</span>
                  )}
                </div>

                <div className="hidden w-[110px] text-meta text-subtle lg:block">
                  {t('ctas.altaFecha', { fecha: fecha(u.createdAt) })}
                </div>

                <div className="ml-auto flex justify-end sm:ml-0 sm:w-[170px]">
                  {u.id === me.id ? (
                    <span className="text-meta text-subtle">{t('ctas.noPuedesDesactivarte')}</span>
                  ) : u.active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setAQuitar({ id: u.id, name: u.name, role: u.role })}
                    >
                      {t('ctas.quitarAcceso')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="quiet"
                      loading={toggle.isPending && toggle.variables?.id === u.id}
                      onClick={() => toggle.mutate({ id: u.id, name: u.name, active: true })}
                    >
                      {t('ctas.devolverAcceso')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={!!aQuitar}
        onClose={() => {
          toggle.reset()
          setAQuitar(null)
        }}
        title={t('eq.quitarTitulo', { nombre: aQuitar?.name ?? '' })}
        consecuencias={[
          t('eq.quitarC1'),
          // El superadmin no ficha: no pertenece a ningún negocio.
          ...(aQuitar?.role === 'SUPERADMIN' ? [] : [t('eq.quitarC2')]),
          t('eq.quitarC3'),
        ]}
        confirmLabel={t('ctas.quitarAcceso')}
        onConfirm={() => aQuitar && toggle.mutate({ ...aQuitar, active: false })}
        loading={toggle.isPending}
        error={
          toggle.isError && toggle.variables?.active === false
            ? textoDeError(toggle.error, t('avisos.error'))
            : null
        }
      />

      <p className="text-meta text-subtle">
        <Texto
          clave="ctas.aviso"
          partes={{
            actividad: (
              <Link
                to="/panel/admin/actividad"
                className="font-semibold text-brand-text hover:underline"
              >
                {t('ctas.actividad')}
              </Link>
            ),
          }}
        />
      </p>
    </div>
  )
}
