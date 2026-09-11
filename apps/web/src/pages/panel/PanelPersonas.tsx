import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../lib/api'
import {
  Badge,
  Button,
  Card,
  ConfirmAction,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  cx,
} from '../../components/ui'
import { Texto, useIdioma, usePlural } from '../../i18n/idioma'

/**
 * Las personas que atienden las citas.
 *
 * No confundir con «Equipo», que son las cuentas para entrar al panel: alguien
 * puede atender clientes sin tener usuario (el chico de los sábados) y alguien
 * puede administrar sin atender a nadie (el dueño que solo mira números).
 * Esto es además lo que se cuenta para la cuota: el plan Negocio incluye dos.
 */
export function PanelPersonas() {
  const { t } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const id = useId()

  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')

  /* Con varios locales hay que poder decir dónde atiende cada persona: de eso
     depende en qué local sale su hueco. Sin elegir = atiende en todos, que es
     lo que hace falta para quien va rotando. */
  const { data: locales } = useQuery({
    queryKey: ['panel', slug, 'locales'],
    queryFn: () => api.panelLocales(slug),
  })
  const varios = (locales?.length ?? 0) > 1
  const [localNuevo, setLocalNuevo] = useState('')

  const { data: personas, isLoading } = useQuery({
    queryKey: ['panel', slug, 'staff'],
    queryFn: () => api.panelStaff(slug),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    queryClient.invalidateQueries({ queryKey: ['business', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const crear = useMutation({
    mutationFn: () => api.createStaff(slug, nombre.trim(), varios ? localNuevo || null : undefined),
    onSuccess: () => {
      setNombre('')
      invalidate()
    },
  })

  const renombrar = useMutation({
    mutationFn: (personaId: string) =>
      api.updateStaff(slug, personaId, { name: nombreEdit.trim() }),
    onSuccess: () => {
      setEditando(null)
      invalidate()
    },
  })

  const cambiarEstado = useMutation({
    mutationFn: ({ personaId, active }: { personaId: string; active: boolean }) =>
      api.updateStaff(slug, personaId, { active }),
    onSuccess: invalidate,
  })

  const activas = personas?.filter((p) => p.active).length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.personas')}
        hint={
          personas
            ? [
                plural(activas, 'pers.unaAtiende', 'pers.variasAtienden'),
                ...(personas.length > activas
                  ? [t('pers.deBajaCuenta', { n: personas.length - activas })]
                  : []),
              ].join(' · ')
            : undefined
        }
      />

      <Card padded>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (nombre.trim().length >= 2) crear.mutate()
          }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <Field
            label={t('pers.anadirUna')}
            htmlFor={`${id}-nueva`}
            hint={t('pers.anadirPista')}
            className="flex-1"
          >
            <Input
              id={`${id}-nueva`}
              placeholder={t('pers.nombreEjemplo')}
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          {varios && (
            <Field label={t('pers.dondeAtiende')} htmlFor={`${id}-local`} className="sm:w-[220px]">
              <Select
                id={`${id}-local`}
                value={localNuevo}
                onChange={(e) => setLocalNuevo(e.target.value)}
              >
                <option value="">{t('pers.enTodos')}</option>
                {locales?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button type="submit" loading={crear.isPending} disabled={nombre.trim().length < 2}>
            {t('pers.anadir')}
          </Button>
        </form>
        {crear.isError && (
          <div className="mt-4">
            <ErrorNote>
              {crear.error instanceof ApiError ? crear.error.message : t('pers.noSePudoAnadir')}
            </ErrorNote>
          </div>
        )}
      </Card>

      {cambiarEstado.isError && (
        <ErrorNote>
          {cambiarEstado.error instanceof ApiError
            ? cambiarEstado.error.message
            : t('pers.noSePudoCambiar')}
        </ErrorNote>
      )}

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !personas?.length ? (
        <EmptyState title={t('pers.todaviaNadie')} hint={t('pers.todaviaNadiePista')} />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {personas.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
              >
                <span
                  aria-hidden
                  className={cx(
                    'grid size-10 shrink-0 place-items-center rounded-full text-body font-bold',
                    p.active ? 'bg-brand text-white' : 'bg-line text-muted',
                  )}
                >
                  {p.name.trim().charAt(0).toUpperCase()}
                </span>

                {editando === p.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (nombreEdit.trim().length >= 2) renombrar.mutate(p.id)
                    }}
                    className="flex flex-1 flex-wrap items-center gap-2"
                  >
                    <Input
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                      aria-label={t('pers.nuevoNombre', { nombre: p.name })}
                      className="max-w-xs flex-1"
                      autoFocus
                    />
                    <Button type="submit" size="sm" loading={renombrar.isPending}>
                      {t('pers.guardar')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="quiet"
                      onClick={() => setEditando(null)}
                    >
                      {t('pers.cancelar')}
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className={cx('min-w-[160px] flex-1', !p.active && 'opacity-60')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ui font-semibold text-ink">{p.name}</span>
                        {!p.active && <Badge tone="off">{t('pers.deBaja')}</Badge>}
                      </div>
                      <p className="mt-0.5 text-meta text-muted">
                        {varios && (
                          <>
                            {locales?.find((l) => l.id === p.locationId)?.name ??
                              t('pers.enTodosLosLocales')}
                            {' · '}
                          </>
                        )}
                        {p.upcomingBookings
                          ? plural(
                              p.upcomingBookings,
                              'pers.unaCitaPorDelante',
                              'pers.variasCitasPorDelante',
                            )
                          : t('pers.sinCitasPendientes')}
                      </p>
                    </div>

                    <div className="ml-auto flex flex-wrap justify-end gap-1 sm:ml-0">
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          setEditando(p.id)
                          setNombreEdit(p.name)
                        }}
                      >
                        {t('pers.renombrar')}
                      </Button>
                      {p.active ? (
                        <ConfirmAction
                          label={t('pers.darDeBaja')}
                          confirmLabel={t('pers.siDeBaja')}
                          loading={
                            cambiarEstado.isPending && cambiarEstado.variables?.personaId === p.id
                          }
                          onConfirm={() => cambiarEstado.mutate({ personaId: p.id, active: false })}
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="quiet"
                          loading={
                            cambiarEstado.isPending && cambiarEstado.variables?.personaId === p.id
                          }
                          onClick={() => cambiarEstado.mutate({ personaId: p.id, active: true })}
                        >
                          {t('pers.volverAActivar')}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-meta text-subtle">
        <Texto
          clave="pers.aviso"
          partes={{
            negrita: (
              <strong className="font-semibold text-body-2">{t('pers.avisoNegrita')}</strong>
            ),
          }}
        />
      </p>
    </div>
  )
}
