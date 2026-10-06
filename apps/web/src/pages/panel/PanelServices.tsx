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
import { CampoDuracion } from '../../components/SelectorDuracion'
import { Texto, useIdioma, usePlural, type Clave } from '../../i18n/idioma'
import { PestanasSeccion } from '../../components/PestanasSeccion'
import { aviso, textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'
import { RowMenu } from '../../components/RowMenu'
import { CampoFotos } from '../../components/CampoFotos'
import { Photo } from '../../components/Photo'

interface Draft {
  name: string
  durationMin: string
  bufferMin: string
  price: string
  description: string
  photos: string[]
}

const emptyDraft: Draft = {
  name: '',
  durationMin: '30',
  bufferMin: '0',
  price: '',
  description: '',
  photos: [],
}

/** Lo que dura un servicio, de menos a más. La rueda apaga lo que se sale de
    aquí, así que los avisos de abajo solo saltan si el dato llega por otro
    camino —un servicio viejo, un formulario a medio migrar—. */
export const MIN_DURACION = 5
export const MAX_DURACION = 480

/** "59,50" o "59.50" → 5950 céntimos */
const toCents = (v: string) => Math.round(Number(v.replace(',', '.')) * 100)

/** Qué impide guardar. Devuelve la clave del aviso, no el aviso: quien lo
    pinta sabe en qué idioma está mirando; esta función, no. */
function validar(d: Draft): Clave | null {
  if (d.name.trim().length < 2) return 'serv.errNombre'
  const dur = Number(d.durationMin)
  if (!Number.isFinite(dur) || dur < MIN_DURACION) return 'serv.errDuracionMin'
  if (dur > MAX_DURACION) return 'serv.errDuracionMax'
  const margen = Number(d.bufferMin || 0)
  if (!Number.isFinite(margen) || margen < 0) return 'serv.errMargen'
  const cents = toCents(d.price || '0')
  if (!Number.isFinite(cents) || cents < 0) return 'serv.errPrecio'
  return null
}

/**
 * Los campos de un servicio. Van dentro del diálogo de crear o editar; antes
 * eran un formulario que sustituía a la fila (editar) o una tarjeta arriba de
 * la página (crear), y cada uno se comportaba distinto.
 */
function CamposServicio({
  slug,
  draft,
  setDraft,
  problema,
}: {
  slug: string
  draft: Draft
  setDraft: (d: Draft) => void
  /** Solo después de intentar guardar: corregir a alguien en mitad de una
      palabra es molesto y no ayuda. */
  problema: Clave | null
}) {
  const { t } = useIdioma()
  const id = useId()

  return (
    <>
      <Field label={t('serv.nombre')} htmlFor={`${id}-name`} required>
        <Input
          id={`${id}-name`}
          value={draft.name}
          autoComplete="off"
          invalid={problema === 'serv.errNombre'}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* A rueda y no escribiendo el número: quien monta su carta piensa en
            «hora y media», no en 90, y la cuenta a mano es donde se cuela un 9
            en lugar de un 90. */}
        <CampoDuracion
          label={t('serv.duracion')}
          required
          minutos={Number(draft.durationMin) || 0}
          min={MIN_DURACION}
          max={MAX_DURACION}
          etiquetaHoras={t('serv.horas')}
          etiquetaMinutos={t('serv.minutos')}
          onCambiar={(m) => setDraft({ ...draft, durationMin: String(m) })}
        />
        <Field
          label={t('serv.precio')}
          htmlFor={`${id}-price`}
          hint={t('serv.precioPista')}
          required
        >
          <Input
            id={`${id}-price`}
            inputMode="decimal"
            value={draft.price}
            invalid={problema === 'serv.errPrecio'}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t('serv.margen')} htmlFor={`${id}-buffer`} hint={t('serv.margenPista')}>
        <Input
          id={`${id}-buffer`}
          inputMode="numeric"
          value={draft.bufferMin}
          invalid={problema === 'serv.errMargen'}
          onChange={(e) => setDraft({ ...draft, bufferMin: e.target.value })}
          className="sm:max-w-[160px]"
        />
      </Field>
      <Field label={t('serv.descripcion')} htmlFor={`${id}-desc`} hint={t('serv.descripcionPista')}>
        <Textarea
          id={`${id}-desc`}
          rows={2}
          maxLength={300}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </Field>
      {/* En belleza o estética, ver cómo queda decide la reserva: la foto sale
          en la ficha, y ampliada al reservar. */}
      <CampoFotos
        slug={slug}
        fotos={draft.photos}
        onChange={(photos) => setDraft({ ...draft, photos })}
      />
      {problema && <ErrorNote>{t(problema)}</ErrorNote>}
    </>
  )
}

/** Lo que hay en el diálogo: crear (desde cero o duplicando) o editar uno. */
type Dialogo =
  { modo: 'nuevo'; inicial: Draft } | { modo: 'editar'; servicio: PanelService; inicial: Draft }

const aDraft = (s: PanelService): Draft => ({
  name: s.name,
  durationMin: String(s.durationMin),
  bufferMin: String(s.bufferMin),
  price: (s.priceCents / 100).toString().replace('.', ','),
  description: s.description ?? '',
  photos: s.photos,
})

export function PanelServices() {
  const { t, idioma } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [intentado, setIntentado] = useState(false)

  const abrir = (d: Dialogo) => {
    create.reset()
    update.reset()
    setIntentado(false)
    setDraft(d.inicial)
    setDialogo(d)
  }
  const nuevo = () => abrir({ modo: 'nuevo', inicial: emptyDraft })
  const editar = (s: PanelService) => abrir({ modo: 'editar', servicio: s, inicial: aDraft(s) })
  const duplicar = (s: PanelService) =>
    abrir({ modo: 'nuevo', inicial: { ...aDraft(s), name: t('serv.copiaDe', { nombre: s.name }) } })

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
        photos: draft.photos,
        durationMin: Number(draft.durationMin),
        bufferMin: Number(draft.bufferMin || 0),
        priceCents: toCents(draft.price || '0'),
        active: true,
      }),
    onSuccess: () => {
      aviso.ok(t('serv.creado', { nombre: draft.name.trim() }))
      setDialogo(null)
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: (id: string) =>
      api.updateService(slug, id, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        photos: draft.photos,
        durationMin: Number(draft.durationMin),
        bufferMin: Number(draft.bufferMin || 0),
        priceCents: toCents(draft.price || '0'),
      }),
    onSuccess: () => {
      setDialogo(null)
      invalidate()
      aviso.ok(t('avisos.guardado'))
    },
  })

  const guardar = () => {
    setIntentado(true)
    if (validar(draft) || !dialogo) return
    if (dialogo.modo === 'editar') update.mutate(dialogo.servicio.id)
    else create.mutate()
  }
  const enCurso = dialogo?.modo === 'editar' ? update : create

  // Ocultar o publicar se deshace con el mismo botón: va directo, con aviso.
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; name: string; active: boolean }) =>
      api.updateService(slug, id, { active }),
    onSuccess: (_r, v) => {
      invalidate()
      aviso.ok(t(v.active ? 'serv.publicado' : 'serv.ocultado', { nombre: v.name }), {
        texto: t('avisos.deshacer'),
        onClick: () =>
          api
            .updateService(slug, v.id, { active: !v.active })
            .then(invalidate)
            .catch((e) => aviso.error(textoDeError(e, t('avisos.error')))),
      })
    },
    onError: (err) => aviso.error(textoDeError(err, t('avisos.error'))),
  })

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
          <Button onClick={nuevo}>
            <span aria-hidden>+</span> {t('serv.anadir')}
          </Button>
        }
      />

      <PestanasSeccion seccion="servicios" />

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
          action={<Button onClick={nuevo}>{t('serv.anadirPrimero')}</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {services.map((s) => (
              <li key={s.id} className="flex items-center border-b border-line last:border-b-0">
                {/* La fila entera abre la edición: es lo que se hace con un
                    servicio el 90 % de las veces. Lo demás, en «···». */}
                <button
                  type="button"
                  onClick={() => editar(s)}
                  aria-label={t('serv.editarComillas', { nombre: s.name })}
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 py-4 pr-2 pl-5 text-left transition-colors duration-200 hover:bg-canvas/50"
                >
                  {s.photos[0] && (
                    <span className={cx('relative size-12 shrink-0', !s.active && 'opacity-55')}>
                      <Photo
                        src={s.photos[0]}
                        alt=""
                        width={96}
                        height={96}
                        className="size-full rounded-lg"
                        fallback=""
                      />
                      {s.photos.length > 1 && (
                        <span className="absolute -right-1 -bottom-1 rounded-full bg-ink px-1.5 text-caption font-bold text-cream">
                          {s.photos.length}
                        </span>
                      )}
                    </span>
                  )}
                  <span className={cx('min-w-[180px] flex-1', !s.active && 'opacity-55')}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-ink">{s.name}</span>
                      {!s.active && <Badge tone="off">{t('serv.sinPublicar')}</Badge>}
                    </span>
                    <span className="mt-0.5 block text-meta text-muted">
                      {formatDuration(s.durationMin, idioma)}
                      {s.bufferMin > 0 && ` ${t('serv.masMargen', { n: s.bufferMin })}`}
                    </span>
                    {s.description && (
                      <span className="mt-1 line-clamp-1 block text-meta text-subtle">
                        {s.description}
                      </span>
                    )}
                  </span>
                  <span
                    className={cx(
                      'text-ui font-semibold text-ink tabular-nums',
                      !s.active && 'opacity-55',
                    )}
                  >
                    {formatPrice(s.priceCents, idioma)}
                  </span>
                </button>
                <div className="pr-3">
                  <RowMenu
                    label={s.name}
                    acciones={[
                      { label: t('serv.editar'), onClick: () => editar(s) },
                      {
                        label: s.active ? t('serv.ocultar') : t('serv.publicar'),
                        onClick: () => toggle.mutate({ id: s.id, name: s.name, active: !s.active }),
                      },
                      { label: t('serv.duplicar'), onClick: () => duplicar(s) },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

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

      <FormDialog
        open={!!dialogo}
        onClose={() => setDialogo(null)}
        title={
          dialogo?.modo === 'editar'
            ? t('serv.editarComillas', { nombre: dialogo.servicio.name })
            : t('serv.nuevo')
        }
        hint={dialogo?.modo === 'editar' ? t('serv.editarPista') : undefined}
        submitLabel={dialogo?.modo === 'editar' ? t('serv.guardarCambios') : t('serv.guardar')}
        onSubmit={guardar}
        loading={enCurso.isPending}
        error={enCurso.isError ? textoDeError(enCurso.error, t('avisos.error')) : null}
        dirty={!!dialogo && JSON.stringify(draft) !== JSON.stringify(dialogo.inicial)}
      >
        <CamposServicio
          slug={slug}
          draft={draft}
          setDraft={setDraft}
          problema={intentado ? validar(draft) : null}
        />
      </FormDialog>
    </div>
  )
}
