import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  ConfirmAction,
  EmptyState,
  ErrorNote,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  Skeleton,
  cx,
} from '../../components/ui'

/**
 * Equipo del negocio: los usuarios que pueden entrar a este panel.
 * Solo lo ve el ADMIN (y el superadmin). El EMPLEADO ni siquiera tiene la
 * pestaña, y la API lo rechazaría igualmente.
 */

const ROL_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  EMPLEADO: 'Equipo',
  SUPERADMIN: 'Superadmin',
}

const ROL_AYUDA: Record<string, string> = {
  ADMIN: 'Agenda, servicios, horario y equipo',
  EMPLEADO: 'Solo la agenda',
  SUPERADMIN: 'Toda la plataforma',
}

interface Draft {
  name: string
  email: string
  password: string
  role: 'ADMIN' | 'EMPLEADO'
}

const emptyDraft: Draft = { name: '', email: '', password: '', role: 'EMPLEADO' }

/** Contraseña legible por teléfono: sin caracteres confundibles. */
function generarPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(14)))
    .map((n) => abc[n % abc.length])
    .join('')
}

export function PanelUsers() {
  const { slug = '' } = useParams()
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const id = useId()

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [creada, setCreada] = useState<{ email: string; password: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const { data: users, isLoading } = useQuery({
    queryKey: ['panel', slug, 'users'],
    queryFn: () => api.panelUsers(slug),
  })

  const create = useMutation({
    mutationFn: () => api.createPanelUser(slug, draft),
    onSuccess: () => {
      // La contraseña se enseña UNA vez, al crear: no se puede recuperar después.
      setCreada({ email: draft.email, password: draft.password })
      setCopiado(false)
      setDraft(emptyDraft)
      setCreating(false)
      queryClient.invalidateQueries({ queryKey: ['panel', slug, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const toggle = useMutation({
    mutationFn: ({ id: uid, active }: { id: string; active: boolean }) =>
      api.setPanelUserActive(slug, uid, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', slug, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const problema =
    draft.name.trim().length < 2
      ? 'Escribe el nombre completo.'
      : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())
        ? 'El email no tiene un formato válido.'
        : draft.password.length < 10
          ? 'La contraseña debe tener al menos 10 caracteres.'
          : null

  const abrirAlta = () => {
    setCreada(null)
    setDraft({ ...emptyDraft, password: generarPassword() })
    setCreating(true)
  }

  const activos = users?.filter((u) => u.active).length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipo"
        hint={
          users
            ? `${activos} con acceso${users.length > activos ? ` · ${users.length - activos} desactivados` : ''}`
            : undefined
        }
        actions={!creating && <Button onClick={abrirAlta}>+ Añadir persona</Button>}
      />

      {creada && (
        <Card className="border-brand/40 bg-brand/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ui font-semibold text-ink">Cuenta creada</p>
              <p className="mt-1 text-body text-body">
                Pásale estos datos a <strong>{creada.email}</strong>:
              </p>
              <code className="mt-2 inline-block rounded-lg bg-cream px-3 py-2 text-body font-semibold break-all text-ink">
                {creada.password}
              </code>
              <p className="mt-2 text-meta text-muted">
                Guárdala ahora: por seguridad no se puede volver a consultar. Quien entre podrá
                cambiarla desde su cuenta.
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(creada.password).then(() => setCopiado(true))
                }}
              >
                {copiado ? 'Copiada' : 'Copiar'}
              </Button>
              <IconButton label="Cerrar el aviso" onClick={() => setCreada(null)}>
                <span aria-hidden className="text-subheading leading-none">
                  ×
                </span>
              </IconButton>
            </div>
          </div>
        </Card>
      )}

      {creating && (
        <Card padded>
          <h2 className="mb-4 text-ui font-semibold text-ink">Nueva persona</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!problema) create.mutate()
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" htmlFor={`${id}-name`} required>
                <Input
                  id={`${id}-name`}
                  placeholder="Marta Gil"
                  autoComplete="off"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field
                label="Email"
                htmlFor={`${id}-email`}
                hint="Con esto entrará al panel"
                required
              >
                <Input
                  id={`${id}-email`}
                  type="email"
                  placeholder="marta@negocio.es"
                  autoComplete="off"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </Field>
              <Field
                label="Contraseña inicial"
                htmlFor={`${id}-pass`}
                hint="Generada al azar. Podrá cambiarla al entrar."
                required
              >
                <div className="flex gap-2">
                  <Input
                    id={`${id}-pass`}
                    autoComplete="new-password"
                    value={draft.password}
                    onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDraft({ ...draft, password: generarPassword() })}
                  >
                    Otra
                  </Button>
                </div>
              </Field>
              <Field label="Permisos" htmlFor={`${id}-role`} hint={ROL_AYUDA[draft.role]} required>
                <Select
                  id={`${id}-role`}
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value as Draft['role'] })}
                >
                  <option value="EMPLEADO">Equipo</option>
                  <option value="ADMIN">Administrador</option>
                </Select>
              </Field>
            </div>

            {create.isError && (
              <ErrorNote>
                {create.error instanceof ApiError ? create.error.message : 'No se ha podido crear'}
              </ErrorNote>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={create.isPending} disabled={!!problema}>
                Crear cuenta
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              {problema && <span className="text-meta text-muted">{problema}</span>}
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !users?.length ? (
        <EmptyState
          title="Todavía no hay nadie en el equipo"
          hint="Añade a la primera persona para que pueda entrar al panel y trabajar la agenda."
          action={!creating && <Button onClick={abrirAlta}>Añadir a la primera persona</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
              >
                <span
                  aria-hidden
                  className={cx(
                    'grid size-10 shrink-0 place-items-center rounded-full text-body font-bold',
                    u.active ? 'bg-brand text-white' : 'bg-line text-muted',
                  )}
                >
                  {u.name.trim().charAt(0).toUpperCase()}
                </span>

                <div className={cx('min-w-[180px] flex-1', !u.active && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ui font-semibold text-ink">{u.name}</span>
                    {u.id === me?.id && <Badge>Tú</Badge>}
                    {!u.active && <Badge tone="off">Sin acceso</Badge>}
                  </div>
                  <p className="mt-0.5 text-meta text-muted">{u.email}</p>
                </div>

                <div className={cx('w-[150px]', !u.active && 'opacity-60')}>
                  <div className="text-meta font-semibold text-body-2">
                    {ROL_LABEL[u.role] ?? u.role}
                  </div>
                  <div className="text-caption text-subtle">{ROL_AYUDA[u.role]}</div>
                </div>

                <div className="ml-auto flex justify-end sm:ml-0 sm:w-[170px]">
                  {u.id === me?.id ? (
                    <span className="text-meta text-subtle">No puedes desactivarte</span>
                  ) : u.active ? (
                    <ConfirmAction
                      label="Quitar acceso"
                      question="¿Seguro?"
                      confirmLabel="Sí, quitar"
                      loading={toggle.isPending && toggle.variables?.id === u.id}
                      onConfirm={() => toggle.mutate({ id: u.id, active: false })}
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="quiet"
                      loading={toggle.isPending && toggle.variables?.id === u.id}
                      onClick={() => toggle.mutate({ id: u.id, active: true })}
                    >
                      Devolver acceso
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {toggle.isError && <ErrorNote>{(toggle.error as Error).message}</ErrorNote>}

      <p className="text-meta text-subtle">
        <strong className="font-semibold text-body-2">Equipo</strong> ve y gestiona la agenda.{' '}
        <strong className="font-semibold text-body-2">Administrador</strong> además configura
        servicios, horario y este equipo. Quitar el acceso cierra sus sesiones abiertas al momento.
      </p>
    </div>
  )
}
