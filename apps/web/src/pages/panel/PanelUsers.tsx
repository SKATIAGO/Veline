import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Card, ErrorNote, Spinner, cx } from '../../components/ui'

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

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [creada, setCreada] = useState<{ email: string; password: string } | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['panel', slug, 'users'],
    queryFn: () => api.panelUsers(slug),
  })

  const create = useMutation({
    mutationFn: () => api.createPanelUser(slug, draft),
    onSuccess: () => {
      // La contraseña se enseña UNA vez, al crear: no se puede recuperar después.
      setCreada({ email: draft.email, password: draft.password })
      setDraft(emptyDraft)
      setCreating(false)
      queryClient.invalidateQueries({ queryKey: ['panel', slug, 'users'] })
    },
  })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.setPanelUserActive(slug, id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['panel', slug, 'users'] }),
  })

  const input =
    'rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Equipo</h1>
        {!creating && (
          <Button
            onClick={() => {
              setCreada(null)
              setDraft({ ...emptyDraft, password: generarPassword() })
              setCreating(true)
            }}
          >
            Añadir persona
          </Button>
        )}
      </div>

      {creada && (
        <Card className="mb-6 border-brand/40 bg-brand/5 p-5">
          <div className="mb-1 font-semibold text-ink">Cuenta creada</div>
          <p className="text-sm text-body">
            Pásale estos datos: <strong>{creada.email}</strong> · contraseña{' '}
            <code className="rounded bg-cream px-1.5 py-0.5 font-semibold">{creada.password}</code>
          </p>
          <p className="mt-2 text-[12.5px] text-muted">
            Guárdala ahora: por seguridad no se puede volver a consultar.
          </p>
        </Card>
      )}

      {creating && (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-[12.5px] font-semibold text-body">Nueva persona</div>
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1.6fr_1.2fr_auto_auto]">
            <input
              className={input}
              placeholder="Nombre"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className={input}
              type="email"
              placeholder="email@negocio.es"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <input
              className={input}
              placeholder="Contraseña"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
            <select
              className={input}
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as Draft['role'] })}
            >
              <option value="EMPLEADO">Equipo (solo agenda)</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? '…' : 'Crear'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
          {create.isError && (
            <div className="mt-3">
              <ErrorNote>
                {create.error instanceof ApiError ? create.error.message : 'No se ha podido crear'}
              </ErrorNote>
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-subtle">
            «Equipo» ve y gestiona la agenda. «Administrador» además configura servicios, horario y
            este equipo.
          </p>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          {users?.map((u) => (
            <div
              key={u.id}
              className={cx(
                'flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-b-0',
                !u.active && 'opacity-50',
              )}
            >
              <div className="min-w-[200px] flex-1">
                <div className="font-semibold text-ink">
                  {u.name}
                  {u.id === me?.id && <span className="ml-2 text-[11px] text-subtle">(tú)</span>}
                </div>
                <div className="mt-0.5 text-[13px] text-muted">{u.email}</div>
              </div>
              <div className="w-[140px] text-[13px] font-medium text-body">
                {ROL_LABEL[u.role] ?? u.role}
              </div>
              <div className="w-[110px] text-right">
                {u.id !== me?.id && (
                  <button
                    type="button"
                    onClick={() => toggle.mutate({ id: u.id, active: !u.active })}
                    className="text-[12.5px] font-semibold text-muted underline hover:text-brand"
                  >
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {users?.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Todavía no hay nadie en el equipo. Añade a la primera persona para que pueda entrar al
              panel.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
