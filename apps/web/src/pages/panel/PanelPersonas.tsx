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
  Skeleton,
  cx,
} from '../../components/ui'

/**
 * Las personas que atienden las citas.
 *
 * No confundir con «Equipo», que son las cuentas para entrar al panel: alguien
 * puede atender clientes sin tener usuario (el chico de los sábados) y alguien
 * puede administrar sin atender a nadie (el dueño que solo mira números).
 * Esto es además lo que se cuenta para la cuota: el plan Negocio incluye dos.
 */
export function PanelPersonas() {
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const id = useId()

  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')

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
    mutationFn: () => api.createStaff(slug, nombre.trim()),
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
        title="Personas"
        hint={
          personas
            ? `${activas} ${activas === 1 ? 'atiende' : 'atienden'} citas${
                personas.length > activas ? ` · ${personas.length - activas} de baja` : ''
              }`
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
            label="Añadir una persona"
            htmlFor={`${id}-nueva`}
            hint="El nombre que verá el cliente al reservar"
            className="flex-1"
          >
            <Input
              id={`${id}-nueva`}
              placeholder="Marta Gil"
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={crear.isPending} disabled={nombre.trim().length < 2}>
            Añadir
          </Button>
        </form>
        {crear.isError && (
          <div className="mt-4">
            <ErrorNote>
              {crear.error instanceof ApiError ? crear.error.message : 'No se ha podido añadir'}
            </ErrorNote>
          </div>
        )}
      </Card>

      {cambiarEstado.isError && (
        <ErrorNote>
          {cambiarEstado.error instanceof ApiError
            ? cambiarEstado.error.message
            : 'No se ha podido cambiar'}
        </ErrorNote>
      )}

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !personas?.length ? (
        <EmptyState
          title="Todavía no hay nadie que atienda"
          hint="Sin al menos una persona no se pueden repartir las citas: el buscador no ofrecerá ningún hueco."
        />
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
                      aria-label={`Nuevo nombre para ${p.name}`}
                      className="max-w-xs flex-1"
                      autoFocus
                    />
                    <Button type="submit" size="sm" loading={renombrar.isPending}>
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="quiet"
                      onClick={() => setEditando(null)}
                    >
                      Cancelar
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className={cx('min-w-[160px] flex-1', !p.active && 'opacity-60')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ui font-semibold text-ink">{p.name}</span>
                        {!p.active && <Badge tone="off">De baja</Badge>}
                      </div>
                      <p className="mt-0.5 text-meta text-muted">
                        {p.upcomingBookings
                          ? `${p.upcomingBookings} ${p.upcomingBookings === 1 ? 'cita' : 'citas'} por delante`
                          : 'Sin citas pendientes'}
                      </p>
                    </div>

                    <div className="ml-auto flex gap-1 sm:ml-0">
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          setEditando(p.id)
                          setNombreEdit(p.name)
                        }}
                      >
                        Renombrar
                      </Button>
                      {p.active ? (
                        <ConfirmAction
                          label="Dar de baja"
                          confirmLabel="Sí, de baja"
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
                          Volver a activar
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
        Cada cita se asigna a una persona libre a esa hora, así que{' '}
        <strong className="font-semibold text-body-2">
          cuantas más personas, más citas a la vez
        </strong>
        . Dar de baja a alguien con citas por delante no se permite: primero hay que moverlas o
        cancelarlas. Esto no son las cuentas para entrar al panel — eso está en Equipo.
      </p>
    </div>
  )
}
