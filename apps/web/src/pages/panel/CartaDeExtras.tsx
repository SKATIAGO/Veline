import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDuration, formatPrice } from '@veline/shared'
import { api, ApiError, type DatosExtra, type PanelExtra } from '../../lib/api'
import { prepararFoto } from '../../lib/imagen'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Skeleton,
  Spinner,
  Textarea,
  cx,
} from '../../components/ui'
import { Photo } from '../../components/Photo'
import { useIdioma, type Clave } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'
import { RowMenu } from '../../components/RowMenu'

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

/**
 * Crear o editar un extra, en su diálogo. Se monta al abrirlo (con `key`), así
 * que cada vez arranca con los datos del extra que se ha tocado.
 */
function DialogoExtra({
  slug,
  titulo,
  inicial,
  onGuardar,
  onCerrar,
  onQuitar,
  enviando,
  error,
  textoGuardar,
}: {
  slug: string
  titulo: string
  inicial: DatosExtra
  onGuardar: (d: DatosExtra) => void
  onCerrar: () => void
  /** Solo al editar: quitarlo de la carta, con su confirmación. */
  onQuitar?: () => void
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

  const cambiado =
    nombre !== inicial.name ||
    precio !== (inicial.name ? aTexto(inicial.priceCents) : '') ||
    minutos !== String(inicial.durationMin) ||
    descripcion !== (inicial.description ?? '') ||
    foto !== inicial.photo

  return (
    <FormDialog
      open
      onClose={onCerrar}
      title={titulo}
      submitLabel={textoGuardar}
      onSubmit={() => {
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
      loading={enviando}
      error={error}
      dirty={cambiado}
      borrar={onQuitar && { label: t('ext.quitar'), onClick: onQuitar }}
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

        <div className="grid flex-1 content-start gap-4 sm:grid-cols-2">
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
    </FormDialog>
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
  const [editando, setEditando] = useState<PanelExtra | null>(null)
  const [aQuitar, setAQuitar] = useState<PanelExtra | null>(null)

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
    onSuccess: (_r, d) => {
      setCreando(false)
      invalidar()
      aviso.ok(t('ext.creado', { nombre: d.name }))
    },
  })
  const guardar = useMutation({
    mutationFn: ({ extra, d }: { extra: PanelExtra; d: DatosExtra }) =>
      api.updateExtra(slug, extra.id, d),
    onSuccess: () => {
      setEditando(null)
      invalidar()
      aviso.ok(t('avisos.guardado'))
    },
  })
  // Ocultar o mostrar se deshace con el mismo botón: va directo, con aviso.
  const alternar = useMutation({
    mutationFn: (e: PanelExtra) => api.updateExtra(slug, e.id, { active: !e.active }),
    onSuccess: (_r, e) => {
      invalidar()
      aviso.ok(t(e.active ? 'ext.ocultado' : 'ext.mostrado', { nombre: e.name }), {
        texto: t('avisos.deshacer'),
        onClick: () =>
          api
            .updateExtra(slug, e.id, { active: e.active })
            .then(invalidar)
            .catch((err) => aviso.error(textoDeError(err, t('avisos.error')))),
      })
    },
    onError: (err) => aviso.error(textoDeError(err, t('avisos.error'))),
  })
  const quitar = useMutation({
    mutationFn: (e: PanelExtra) => api.deleteExtra(slug, e.id),
    onSuccess: (_r, e) => {
      setAQuitar(null)
      setEditando(null)
      invalidar()
      aviso.ok(t('ext.quitado', { nombre: e.name }))
    },
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
        <Button
          variant="secondary"
          onClick={() => {
            crear.reset()
            setCreando(true)
          }}
        >
          <span aria-hidden>+</span> {t('ext.anadir')}
        </Button>
      </div>

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !extras?.length ? (
        <EmptyState title={t('ext.vacio')} hint={t('ext.vacioPista')} />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {extras.map((e) => (
              <li key={e.id} className="flex items-center border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    guardar.reset()
                    setEditando(e)
                  }}
                  aria-label={t('ext.editarComillas', { nombre: e.name })}
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 py-4 pr-2 pl-5 text-left transition-colors duration-200 hover:bg-canvas/50"
                >
                  <Miniatura foto={e.photo} className={cx(!e.active && 'opacity-55')} />
                  <span className={cx('min-w-[160px] flex-1', !e.active && 'opacity-55')}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-ink">{e.name}</span>
                      {!e.active && <Badge tone="off">{t('ext.oculto')}</Badge>}
                    </span>
                    {e.description && (
                      <span className="mt-0.5 line-clamp-2 block text-meta text-muted">
                        {e.description}
                      </span>
                    )}
                  </span>
                  <span
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
                  </span>
                </button>
                <div className="pr-3">
                  <RowMenu
                    label={e.name}
                    acciones={[
                      {
                        label: t('ext.editar'),
                        onClick: () => {
                          guardar.reset()
                          setEditando(e)
                        },
                      },
                      {
                        label: e.active ? t('ext.ocultar') : t('ext.mostrar'),
                        onClick: () => alternar.mutate(e),
                      },
                      { label: t('ext.quitar'), onClick: () => setAQuitar(e), peligro: true },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {creando && (
        <DialogoExtra
          key="nuevo"
          slug={slug}
          titulo={t('ext.nuevo')}
          inicial={VACIO}
          onGuardar={(d) => crear.mutate(d)}
          onCerrar={() => setCreando(false)}
          enviando={crear.isPending}
          error={crear.isError ? mensaje(crear.error) : null}
          textoGuardar={t('ext.guardar')}
        />
      )}

      {editando && (
        <DialogoExtra
          key={editando.id}
          slug={slug}
          titulo={t('ext.editarComillas', { nombre: editando.name })}
          inicial={editando}
          onGuardar={(d) => guardar.mutate({ extra: editando, d })}
          onCerrar={() => setEditando(null)}
          // La confirmación se abre encima del diálogo: si se cancela, se vuelve
          // a la edición tal como estaba.
          onQuitar={() => setAQuitar(editando)}
          enviando={guardar.isPending}
          error={guardar.isError ? mensaje(guardar.error) : null}
          textoGuardar={t('ext.guardarCambios')}
        />
      )}

      <ConfirmDialog
        open={!!aQuitar}
        onClose={() => {
          quitar.reset()
          setAQuitar(null)
        }}
        title={t('ext.quitarPregunta', { nombre: aQuitar?.name ?? '' })}
        consecuencias={[t('ext.quitarC1'), t('ext.quitarC2'), t('ext.quitarC3')]}
        confirmLabel={t('ext.quitarExtra')}
        tono="destruir"
        onConfirm={() => aQuitar && quitar.mutate(aQuitar)}
        loading={quitar.isPending}
        error={quitar.isError ? textoDeError(quitar.error, t('avisos.error')) : null}
      />

      {!!extras?.length && <p className="text-meta text-subtle">{t('ext.aviso')}</p>}
    </section>
  )
}
