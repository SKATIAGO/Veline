import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDuration, formatPrice } from '@veline/shared'
import { api, ApiError, type DatosExtra, type PanelExtra } from '../../lib/api'
import { prepararFoto } from '../../lib/imagen'
import {
  Badge,
  Button,
  Card,
  ConfirmAction,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Skeleton,
  Spinner,
  Textarea,
  cx,
  useALaVista,
} from '../../components/ui'
import { Photo } from '../../components/Photo'
import { useIdioma, type Clave } from '../../i18n/idioma'

/** "12,50" o "12.50" → 1250 céntimos */
const aCentimos = (v: string) => Math.round(Number(v.replace(',', '.')) * 100)
const aTexto = (cents: number) => (cents / 100).toString().replace('.', ',')

const VACIO: DatosExtra = { name: '', description: '', priceCents: 0, durationMin: 0, photo: null }

/** Miniatura de la carta: la foto si la hay, y si no un hueco discreto. */
function Miniatura({ foto, className }: { foto: string | null; className?: string }) {
  if (!foto) {
    return (
      <div
        aria-hidden
        className={cx('size-14 shrink-0 rounded-lg border border-dashed border-line', className)}
      />
    )
  }
  return (
    <Photo
      src={foto}
      alt=""
      width={112}
      height={112}
      className={cx('size-14 shrink-0 rounded-lg', className)}
      fallback=""
    />
  )
}

function FormularioExtra({
  slug,
  inicial,
  onGuardar,
  onCancelar,
  enviando,
  error,
  textoGuardar,
}: {
  slug: string
  inicial: DatosExtra
  onGuardar: (d: DatosExtra) => void
  onCancelar: () => void
  enviando: boolean
  error: string | null
  textoGuardar: string
}) {
  const { t } = useIdioma()
  const id = useId()
  const [nombre, setNombre] = useState(inicial.name)
  const [precio, setPrecio] = useState(inicial.name ? aTexto(inicial.priceCents) : '')
  /* Arranca en 0 y no vacío: casi ningún extra alarga la cita, y un 0 a la
     vista explica el campo mejor que un hueco con una pista debajo. */
  const [minutos, setMinutos] = useState(String(inicial.durationMin))
  const [descripcion, setDescripcion] = useState(inicial.description ?? '')
  const [foto, setFoto] = useState<string | null>(inicial.photo)
  // Se avisa al intentar guardar, no mientras se escribe.
  const [tocado, setTocado] = useState(false)
  const selector = useRef<HTMLInputElement>(null)

  const subir = useMutation({
    mutationFn: async (archivo: File) => api.subirImagen(slug, await prepararFoto(archivo)),
    onSuccess: (r) => setFoto(r.url),
  })

  const cents = aCentimos(precio || '0')
  const mins = Number(minutos)
  const problema: Clave | null =
    nombre.trim().length < 2
      ? 'ext.errNombre'
      : precio.trim() === '' || !Number.isFinite(cents) || cents < 0
        ? 'ext.errPrecio'
        : !Number.isInteger(mins) || mins < 0 || mins > 480
          ? 'ext.errDuracion'
          : null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTocado(true)
        if (problema || subir.isPending) return
        onGuardar({
          name: nombre.trim(),
          description: descripcion.trim(),
          priceCents: cents,
          durationMin: mins,
          photo: foto,
        })
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 flex-col items-start gap-1.5">
          <span className="text-meta font-semibold text-body-2">
            {t('ext.foto')} <span className="font-normal text-subtle">{t('comun.opcional')}</span>
          </span>
          {/* Un botón grande y no un campo de archivo: en el móvil abre la
              cámara o la galería, y se ve la foto en cuanto se elige. */}
          <button
            type="button"
            onClick={() => selector.current?.click()}
            disabled={subir.isPending}
            aria-label={foto ? t('ext.cambiarFoto') : t('ext.subirFoto')}
            className={cx(
              'relative grid size-28 place-items-center overflow-hidden rounded-xl text-meta font-semibold',
              'transition-colors duration-200',
              foto
                ? 'border border-line'
                : 'border border-dashed border-line-strong bg-canvas text-muted hover:border-brand hover:text-brand-text',
            )}
          >
            {foto ? (
              <img src={foto} alt="" className="size-full object-cover" />
            ) : (
              !subir.isPending && <span className="px-3 text-center">+ {t('ext.subirFoto')}</span>
            )}
            {subir.isPending && (
              <span className="absolute inset-0 grid place-items-center bg-surface/80">
                <Spinner />
              </span>
            )}
          </button>
          <input
            ref={selector}
            type="file"
            accept="image/*"
            tabIndex={-1}
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              // Se vacía: si no, elegir la misma foto otra vez no hace nada.
              e.target.value = ''
              if (archivo) subir.mutate(archivo)
            }}
          />
          {foto && (
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="quiet"
                onClick={() => selector.current?.click()}
              >
                {t('ext.cambiarFoto')}
              </Button>
              <Button type="button" size="sm" variant="quiet" onClick={() => setFoto(null)}>
                {t('ext.quitarFoto')}
              </Button>
            </div>
          )}
        </div>

        <div className="grid flex-1 content-start gap-4 sm:grid-cols-3">
          <Field
            label={t('ext.nombre')}
            htmlFor={`${id}-nombre`}
            required
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-nombre`}
              autoComplete="off"
              maxLength={80}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          <Field
            label={t('ext.precio')}
            htmlFor={`${id}-precio`}
            hint={t('ext.precioPista')}
            required
          >
            <Input
              id={`${id}-precio`}
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </Field>
          <Field label={t('ext.duracion')} htmlFor={`${id}-minutos`} hint={t('ext.duracionPista')}>
            <Input
              id={`${id}-minutos`}
              type="number"
              inputMode="numeric"
              min={0}
              max={480}
              step={5}
              value={minutos}
              onChange={(e) => setMinutos(e.target.value)}
            />
          </Field>
          <Field label={t('ext.descripcion')} htmlFor={`${id}-desc`} className="sm:col-span-2">
            <Textarea
              id={`${id}-desc`}
              rows={2}
              maxLength={200}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {subir.isError && (
        <ErrorNote>
          {subir.error instanceof ApiError ? subir.error.message : t('ext.errFoto')}
        </ErrorNote>
      )}
      {tocado && problema && <ErrorNote>{t(problema)}</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={enviando} disabled={subir.isPending}>
          {textoGuardar}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancelar}>
          {t('ext.cancelar')}
        </Button>
      </div>
    </form>
  )
}

/**
 * La carta de extras, debajo de los servicios.
 *
 * Una sola para todo el negocio: lo que se añade aquí se ofrece con cualquier
 * servicio al confirmar la reserva. Por eso vive en la misma pantalla que los
 * servicios, que es donde se piensa en qué se ofrece y a cuánto.
 */
export function CartaDeExtras({
  slug,
  creando,
  setCreando,
}: {
  slug: string
  creando: boolean
  setCreando: (v: boolean) => void
}) {
  const { t, idioma } = useIdioma()
  const id = useId()
  const queryClient = useQueryClient()
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const vistaNuevo = useALaVista<HTMLDivElement>(creando)

  const { data: extras, isLoading } = useQuery({
    queryKey: ['panel', slug, 'extras'],
    queryFn: () => api.panelExtras(slug),
  })

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug, 'extras'] })
    queryClient.invalidateQueries({ queryKey: ['business', slug] })
  }
  const mensaje = (e: unknown) => (e instanceof Error ? e.message : null)

  const crear = useMutation({
    mutationFn: (d: DatosExtra) => api.createExtra(slug, d),
    onSuccess: () => {
      setCreando(false)
      invalidar()
    },
  })
  const guardar = useMutation({
    mutationFn: ({ extra, d }: { extra: PanelExtra; d: DatosExtra }) =>
      api.updateExtra(slug, extra.id, d),
    onSuccess: () => {
      setEditandoId(null)
      invalidar()
    },
  })
  const alternar = useMutation({
    mutationFn: (e: PanelExtra) => api.updateExtra(slug, e.id, { active: !e.active }),
    onSuccess: invalidar,
  })
  const quitar = useMutation({
    mutationFn: (e: PanelExtra) => api.deleteExtra(slug, e.id),
    onSuccess: invalidar,
  })

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-4 border-t border-line pt-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="font-display text-subheading font-semibold text-ink">
            {t('ext.titulo')}
          </h2>
          <p className="mt-1 max-w-[600px] text-body text-muted">{t('ext.pista')}</p>
        </div>
        {!creando && (
          <Button variant="secondary" onClick={() => setCreando(true)}>
            <span aria-hidden>+</span> {t('ext.anadir')}
          </Button>
        )}
      </div>

      {creando && (
        <div ref={vistaNuevo} className="scroll-mt-4">
          <Card padded>
            <h3 className="mb-4 text-ui font-semibold text-ink">{t('ext.nuevo')}</h3>
            <FormularioExtra
              slug={slug}
              inicial={VACIO}
              onGuardar={(d) => crear.mutate(d)}
              onCancelar={() => setCreando(false)}
              enviando={crear.isPending}
              error={crear.isError ? mensaje(crear.error) : null}
              textoGuardar={t('ext.guardar')}
            />
          </Card>
        </div>
      )}

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !extras?.length ? (
        !creando && <EmptyState title={t('ext.vacio')} hint={t('ext.vacioPista')} />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {extras.map((e) => (
              <li key={e.id} className="border-b border-line last:border-b-0">
                {editandoId === e.id ? (
                  <div className="p-5">
                    <FormularioExtra
                      slug={slug}
                      inicial={e}
                      onGuardar={(d) => guardar.mutate({ extra: e, d })}
                      onCancelar={() => setEditandoId(null)}
                      enviando={guardar.isPending}
                      error={guardar.isError ? mensaje(guardar.error) : null}
                      textoGuardar={t('ext.guardarCambios')}
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                    <Miniatura foto={e.photo} className={cx(!e.active && 'opacity-55')} />
                    <div className={cx('min-w-[160px] flex-1', !e.active && 'opacity-55')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ui font-semibold text-ink">{e.name}</span>
                        {!e.active && <Badge tone="off">{t('ext.oculto')}</Badge>}
                      </div>
                      {e.description && (
                        <p className="mt-0.5 line-clamp-2 text-meta text-muted">{e.description}</p>
                      )}
                    </div>
                    <div
                      className={cx(
                        'text-ui font-semibold text-ink tabular-nums',
                        !e.active && 'opacity-55',
                      )}
                    >
                      +{formatPrice(e.priceCents, idioma)}
                      {e.durationMin > 0 && (
                        <span className="ml-2 text-meta font-normal text-muted">
                          +{formatDuration(e.durationMin, idioma)}
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex flex-wrap justify-end gap-1 sm:ml-0">
                      <Button size="sm" variant="quiet" onClick={() => setEditandoId(e.id)}>
                        {t('ext.editar')}
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        loading={alternar.isPending && alternar.variables?.id === e.id}
                        onClick={() => alternar.mutate(e)}
                      >
                        {e.active ? t('ext.ocultar') : t('ext.mostrar')}
                      </Button>
                      <ConfirmAction
                        label={t('ext.quitar')}
                        question={t('ext.quitarPregunta', { nombre: e.name })}
                        confirmLabel={t('ext.siQuitar')}
                        loading={quitar.isPending && quitar.variables?.id === e.id}
                        onConfirm={() => quitar.mutate(e)}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {alternar.isError && <ErrorNote>{mensaje(alternar.error)}</ErrorNote>}
      {quitar.isError && <ErrorNote>{mensaje(quitar.error)}</ErrorNote>}

      {!!extras?.length && <p className="text-meta text-subtle">{t('ext.aviso')}</p>}
    </section>
  )
}
