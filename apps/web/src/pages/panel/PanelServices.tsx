import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDuration, formatPrice } from '@veline/shared'
import { api, type PanelService } from '../../lib/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
  cx,
} from '../../components/ui'
import { Texto, useIdioma, usePlural, type Clave } from '../../i18n/idioma'

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

/** Qué impide guardar. Devuelve la clave del aviso, no el aviso: quien lo
    pinta sabe en qué idioma está mirando; esta función, no. */
function validar(d: Draft): Clave | null {
  if (d.name.trim().length < 2) return 'serv.errNombre'
  const dur = Number(d.durationMin)
  if (!Number.isFinite(dur) || dur < 5) return 'serv.errDuracionMin'
  if (dur > 480) return 'serv.errDuracionMax'
  const margen = Number(d.bufferMin || 0)
  if (!Number.isFinite(margen) || margen < 0) return 'serv.errMargen'
  const cents = toCents(d.price || '0')
  if (!Number.isFinite(cents) || cents < 0) return 'serv.errPrecio'
  return null
}

function ServiceForm({
  draft,
  setDraft,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  error,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSubmit: () => void
  onCancel?: () => void
  submitLabel: string
  pending: boolean
  error?: string | null
}) {
  const { t } = useIdioma()
  const id = useId()
  // Se avisa al intentar guardar, no mientras se escribe: corregir a alguien
  // en mitad de una palabra es molesto y no ayuda.
  const [tocado, setTocado] = useState(false)
  const problema = validar(draft)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTocado(true)
        if (!problema) onSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('serv.nombre')} htmlFor={`${id}-name`} required className="sm:col-span-2">
          <Input
            id={`${id}-name`}
            placeholder={t('serv.nombreEjemplo')}
            value={draft.name}
            autoComplete="off"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field
          label={t('serv.duracion')}
          htmlFor={`${id}-dur`}
          hint={t('serv.duracionPista')}
          required
        >
          <Input
            id={`${id}-dur`}
            inputMode="numeric"
            placeholder="30"
            value={draft.durationMin}
            onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })}
          />
        </Field>
        <Field
          label={t('serv.precio')}
          htmlFor={`${id}-price`}
          hint={t('serv.precioPista')}
          required
        >
          <Input
            id={`${id}-price`}
            inputMode="decimal"
            placeholder={t('serv.precioEjemplo')}
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
        </Field>
        <Field
          label={t('serv.margen')}
          htmlFor={`${id}-buffer`}
          hint={t('serv.margenPista')}
          className="sm:col-span-1"
        >
          <Input
            id={`${id}-buffer`}
            inputMode="numeric"
            placeholder="0"
            value={draft.bufferMin}
            onChange={(e) => setDraft({ ...draft, bufferMin: e.target.value })}
          />
        </Field>
        <Field
          label={t('serv.descripcion')}
          htmlFor={`${id}-desc`}
          hint={t('serv.descripcionPista')}
          className="sm:col-span-2 lg:col-span-3"
        >
          <Textarea
            id={`${id}-desc`}
            rows={2}
            maxLength={300}
            placeholder={t('serv.descripcionEjemplo')}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </Field>
      </div>

      {tocado && problema && <ErrorNote>{t(problema)}</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('serv.cancelar')}
          </Button>
        )}
      </div>
    </form>
  )
}

export function PanelServices() {
  const { t, idioma } = useIdioma()
  const plural = usePlural()
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
        description: editDraft.description.trim(),
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

  const activos = services?.filter((s) => s.active).length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.servicios')}
        hint={
          services
            ? [
                plural(activos, 'serv.unoActivo', 'serv.variosActivos'),
                ...(services.length > activos
                  ? [t('serv.sinPublicarCuenta', { n: services.length - activos })]
                  : []),
              ].join(' · ')
            : undefined
        }
        actions={
          !creating && (
            <Button onClick={() => setCreating(true)}>
              <span aria-hidden>+</span> {t('serv.anadir')}
            </Button>
          )
        }
      />

      {creating && (
        <Card padded>
          <h2 className="mb-4 text-ui font-semibold text-ink">{t('serv.nuevo')}</h2>
          <ServiceForm
            draft={draft}
            setDraft={setDraft}
            onSubmit={() => create.mutate()}
            onCancel={() => {
              setCreating(false)
              setDraft(emptyDraft)
            }}
            submitLabel={t('serv.guardar')}
            pending={create.isPending}
            error={create.isError ? (create.error as Error).message : null}
          />
        </Card>
      )}

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !services?.length ? (
        <EmptyState
          title={t('serv.todaviaNoHay')}
          hint={t('serv.todaviaNoHayPista')}
          action={
            !creating && (
              <Button onClick={() => setCreating(true)}>{t('serv.anadirPrimero')}</Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {services.map((s) => (
              <li key={s.id} className="border-b border-line last:border-b-0">
                {editingId === s.id ? (
                  <div className="p-5">
                    <ServiceForm
                      draft={editDraft}
                      setDraft={setEditDraft}
                      onSubmit={() => update.mutate(s.id)}
                      onCancel={() => setEditingId(null)}
                      submitLabel={t('serv.guardarCambios')}
                      pending={update.isPending}
                      error={update.isError ? (update.error as Error).message : null}
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                    <div className={cx('min-w-[200px] flex-1', !s.active && 'opacity-55')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ui font-semibold text-ink">{s.name}</span>
                        {!s.active && <Badge tone="off">{t('serv.sinPublicar')}</Badge>}
                      </div>
                      <p className="mt-0.5 text-meta text-muted">
                        {formatDuration(s.durationMin, idioma)}
                        {s.bufferMin > 0 && ` ${t('serv.masMargen', { n: s.bufferMin })}`}
                      </p>
                      {s.description && (
                        <p className="mt-1 line-clamp-1 text-meta text-subtle">{s.description}</p>
                      )}
                    </div>

                    <div
                      className={cx(
                        'text-ui font-semibold text-ink tabular-nums',
                        !s.active && 'opacity-55',
                      )}
                    >
                      {formatPrice(s.priceCents, idioma)}
                    </div>

                    <div className="flex gap-1">
                      <Button size="sm" variant="quiet" onClick={() => startEdit(s)}>
                        {t('serv.editar')}
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        loading={toggle.isPending && toggle.variables?.id === s.id}
                        onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
                      >
                        {s.active ? t('serv.ocultar') : t('serv.publicar')}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {toggle.isError && <ErrorNote>{(toggle.error as Error).message}</ErrorNote>}

      <p className="text-meta text-subtle">
        <Texto
          clave="serv.aviso"
          partes={{
            ocultar: (
              <strong className="font-semibold text-body-2">{t('serv.avisoOcultar')}</strong>
            ),
            margen: <strong className="font-semibold text-body-2">{t('serv.avisoMargen')}</strong>,
          }}
        />
      </p>
    </div>
  )
}
