import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDuration, formatPrice } from '@veline/shared'
import { api, type PanelService } from '../../lib/api'
import { Button, Card, ErrorNote, Spinner, cx } from '../../components/ui'

interface Draft {
  name: string
  durationMin: string
  bufferMin: string
  price: string
  description: string
}

const emptyDraft: Draft = {
  name: '',
  durationMin: '30',
  bufferMin: '0',
  price: '',
  description: '',
}

/** "59,50" o "59.50" → 5950 céntimos */
const toCents = (v: string) => Math.round(Number(v.replace(',', '.')) * 100)

function ServiceForm({
  draft,
  setDraft,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSubmit: () => void
  onCancel?: () => void
  submitLabel: string
  pending: boolean
}) {
  const input =
    'rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand'
  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
      <input
        className={input}
        placeholder="Nombre del servicio"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <input
        className={input}
        placeholder="Duración (min)"
        inputMode="numeric"
        value={draft.durationMin}
        onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })}
      />
      <input
        className={input}
        placeholder="Margen (min)"
        inputMode="numeric"
        value={draft.bufferMin}
        onChange={(e) => setDraft({ ...draft, bufferMin: e.target.value })}
      />
      <input
        className={input}
        placeholder="Precio €"
        inputMode="decimal"
        value={draft.price}
        onChange={(e) => setDraft({ ...draft, price: e.target.value })}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit} disabled={pending}>
          {pending ? '…' : submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}

export function PanelServices() {
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)

  const { data: services, isLoading } = useQuery({
    queryKey: ['panel', slug, 'services'],
    queryFn: () => api.panelServices(slug),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    queryClient.invalidateQueries({ queryKey: ['business', slug] })
  }

  const create = useMutation({
    mutationFn: () =>
      api.createService(slug, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        durationMin: Number(draft.durationMin),
        bufferMin: Number(draft.bufferMin || 0),
        priceCents: toCents(draft.price || '0'),
        active: true,
      }),
    onSuccess: () => {
      setDraft(emptyDraft)
      setCreating(false)
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: (id: string) =>
      api.updateService(slug, id, {
        name: editDraft.name.trim(),
        durationMin: Number(editDraft.durationMin),
        bufferMin: Number(editDraft.bufferMin || 0),
        priceCents: toCents(editDraft.price || '0'),
      }),
    onSuccess: () => {
      setEditingId(null)
      invalidate()
    },
  })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateService(slug, id, { active }),
    onSuccess: invalidate,
  })

  const startEdit = (s: PanelService) => {
    setEditingId(s.id)
    setEditDraft({
      name: s.name,
      durationMin: String(s.durationMin),
      bufferMin: String(s.bufferMin),
      price: (s.priceCents / 100).toString().replace('.', ','),
      description: s.description ?? '',
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Servicios</h1>
        {!creating && <Button onClick={() => setCreating(true)}>Añadir servicio</Button>}
      </div>

      {creating && (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-[12.5px] font-semibold text-body">Nuevo servicio</div>
          <ServiceForm
            draft={draft}
            setDraft={setDraft}
            onSubmit={() => create.mutate()}
            onCancel={() => {
              setCreating(false)
              setDraft(emptyDraft)
            }}
            submitLabel="Guardar"
            pending={create.isPending}
          />
          {create.isError && (
            <div className="mt-3">
              <ErrorNote>{(create.error as Error).message}</ErrorNote>
            </div>
          )}
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          {services?.map((s) => (
            <div key={s.id} className="border-b border-line px-5 py-4 last:border-b-0">
              {editingId === s.id ? (
                <ServiceForm
                  draft={editDraft}
                  setDraft={setEditDraft}
                  onSubmit={() => update.mutate(s.id)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Guardar"
                  pending={update.isPending}
                />
              ) : (
                <div className={cx('flex flex-wrap items-center gap-4', !s.active && 'opacity-50')}>
                  <div className="min-w-[200px] flex-1">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {formatDuration(s.durationMin)}
                      {s.bufferMin > 0 && ` + ${s.bufferMin} min de margen`}
                      {!s.active && ' · desactivado'}
                    </div>
                  </div>
                  <div className="w-[100px] text-right font-semibold text-ink">
                    {formatPrice(s.priceCents)}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="text-[12.5px] font-semibold text-brand underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
                      className="text-[12.5px] font-semibold text-muted underline hover:text-brand"
                    >
                      {s.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {services?.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Todavía no hay servicios. Añade el primero para poder recibir reservas.
            </p>
          )}
        </Card>
      )}

      <p className="mt-4 text-[12.5px] text-subtle">
        El margen es el tiempo que se bloquea después de cada cita (limpieza, papeleo…). No se le
        muestra al cliente, pero sí se descuenta de los huecos disponibles.
      </p>
    </div>
  )
}
