import { useEffect, useId, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CATEGORIES } from '@veline/shared'
import { api, ApiError, type PanelProfile } from '../../lib/api'
import { prepararFoto } from '../../lib/imagen'
import {
  BarraGuardar,
  Button,
  Card,
  ConfirmAction,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
  SuccessNote,
  Textarea,
} from '../../components/ui'
import { Photo } from '../../components/Photo'
import { Texto, useIdioma, usePlural } from '../../i18n/idioma'
import { useCambiosSinGuardar } from '../../lib/cambios'

/**
 * La ficha pública del negocio y sus cierres.
 *
 * Hasta ahora un negocio se creaba una vez y se quedaba congelado: no había
 * forma de corregir ni un teléfono. Los cierres tampoco tenían pantalla, así
 * que un local no podía cerrar por vacaciones aunque el motor de huecos ya
 * sabía respetarlos.
 */

/** El mismo tope que acepta el servidor: aquí evita subir una foto de más
    para que el guardado la rechace después. */
const MAX_FOTOS = 10

/**
 * Las fotos de la ficha pública: las que ve quien mira el negocio en el
 * marketplace, antes de reservar. Hasta ahora esta pantalla no tenía dónde
 * subirlas —el negocio solo podía enseñar fotos si alguien se las cargaba a
 * mano en la base de datos—, así que la ficha se quedaba con las que traía de
 * fábrica o sin ninguna.
 *
 * Cada foto se sube y se guarda al momento, igual que en la carta de extras:
 * no hay un botón de «guardar fotos» aparte que se pueda olvidar pulsar.
 */
function FotosDelNegocio({ slug, fotos }: { slug: string; fotos: string[] }) {
  const { t } = useIdioma()
  const queryClient = useQueryClient()
  const selector = useRef<HTMLInputElement>(null)

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug, 'profile'] })
    queryClient.invalidateQueries({ queryKey: ['business', slug] })
    queryClient.invalidateQueries({ queryKey: ['businesses'] })
  }

  const guardar = useMutation({
    mutationFn: (nuevas: string[]) => api.savePhotos(slug, nuevas),
    onSuccess: invalidar,
  })

  const subir = useMutation({
    mutationFn: async (archivo: File) => {
      const { url } = await api.subirImagen(slug, await prepararFoto(archivo))
      return url
    },
    onSuccess: (url) => guardar.mutate([...fotos, url]),
  })

  const quitar = (url: string) => guardar.mutate(fotos.filter((f) => f !== url))

  const enBusca = subir.isPending || guardar.isPending

  return (
    <div>
      <h2 className="mb-1 font-display text-subheading font-semibold text-ink">{t('neg.fotos')}</h2>
      <p className="mb-4 text-body text-muted">{t('neg.fotosPista')}</p>

      <Card padded>
        <div className="flex flex-wrap gap-3">
          {fotos.map((url) => (
            <div key={url} className="group relative size-28 shrink-0">
              <Photo src={url} alt="" width={224} height={224} className="size-full rounded-xl" />
              <button
                type="button"
                onClick={() => quitar(url)}
                disabled={enBusca}
                aria-label={t('neg.quitarFoto')}
                className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-ink/70 text-body-2 text-white backdrop-blur transition-colors duration-200 hover:bg-ink disabled:pointer-events-none disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          ))}

          {fotos.length < MAX_FOTOS && (
            <button
              type="button"
              onClick={() => selector.current?.click()}
              disabled={enBusca}
              aria-label={t('neg.subirFoto')}
              className="relative grid size-28 shrink-0 place-items-center rounded-xl border border-dashed border-line-strong bg-canvas text-meta font-semibold text-muted transition-colors duration-200 hover:border-brand hover:text-brand-text disabled:pointer-events-none disabled:opacity-60"
            >
              {subir.isPending ? (
                <Spinner />
              ) : (
                <span className="px-3 text-center">+ {t('neg.subirFoto')}</span>
              )}
            </button>
          )}
        </div>

        <p className="mt-3 text-meta text-subtle">
          {t('neg.fotosContador', { n: fotos.length, max: MAX_FOTOS })}
        </p>

        {(subir.isError || guardar.isError) && (
          <ErrorNote>
            {guardar.error instanceof ApiError ? guardar.error.message : t('neg.errFoto')}
          </ErrorNote>
        )}

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
      </Card>
    </div>
  )
}

const hoy = () => new Date().toISOString().slice(0, 10)

export function PanelNegocio() {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()

  const formatoDia = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  const queryClient = useQueryClient()
  const id = useId()

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['panel', slug, 'profile'],
    queryFn: () => api.panelProfile(slug),
  })

  const { data: cierres } = useQuery({
    queryKey: ['panel', slug, 'closures'],
    queryFn: () => api.panelClosures(slug),
  })

  const [form, setForm] = useState<PanelProfile | null>(null)
  const [tocado, setTocado] = useState(false)
  // Antes no avisaba nunca: ni al cambiar de sección ni al cerrar la pestaña.
  useCambiosSinGuardar(tocado)

  // El formulario arranca con lo que hay guardado y solo se rehace cuando
  // llegan datos nuevos del servidor, no en cada render.
  useEffect(() => {
    if (perfil) {
      setForm(perfil)
      setTocado(false)
    }
  }, [perfil])

  const guardar = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('Sin datos')
      const { slug: _s, photos: _p, ...resto } = form
      return api.saveProfile(slug, resto)
    },
    onSuccess: () => {
      setTocado(false)
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['business', slug] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const [desde, setDesde] = useState(hoy())
  const [hasta, setHasta] = useState(hoy())
  const [motivo, setMotivo] = useState('')

  const invalidarCierres = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug, 'closures'] })
    queryClient.invalidateQueries({ queryKey: ['availability', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const crearCierre = useMutation({
    mutationFn: () =>
      api.createClosure(slug, { from: desde, to: hasta, reason: motivo.trim() || undefined }),
    onSuccess: () => {
      setMotivo('')
      invalidarCierres()
    },
  })

  const borrarCierre = useMutation({
    mutationFn: (ids: string[]) => api.deleteClosure(slug, ids),
    onSuccess: invalidarCierres,
  })

  const set = <K extends keyof PanelProfile>(campo: K, valor: PanelProfile[K]) => {
    setForm((f) => (f ? { ...f, [campo]: valor } : f))
    setTocado(true)
  }

  if (isLoading || !form) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('panel.elNegocio')} />
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Card>
      </div>
    )
  }

  const problema =
    form.name.trim().length < 2
      ? t('neg.errNombre')
      : form.street.trim().length < 3
        ? t('neg.errCalle')
        : form.city.trim().length < 2
          ? t('neg.errCiudad')
          : !/^\d{5}$/.test(form.postalCode.trim())
            ? t('neg.errCp')
            : form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)
              ? t('neg.errEmail')
              : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.elNegocio')}
        hint={t('neg.pista')}
        actions={
          <>
            {tocado && <span className="text-meta text-muted">{t('neg.sinGuardar')}</span>}
            <Button
              onClick={() => guardar.mutate()}
              loading={guardar.isPending}
              disabled={!tocado || !!problema}
            >
              {t('neg.guardar')}
            </Button>
          </>
        }
      />

      <BarraGuardar visible={tocado}>
        <span className="min-w-0 truncate text-meta text-muted">
          {problema ?? t('neg.sinGuardar')}
        </span>
        <Button
          size="sm"
          onClick={() => guardar.mutate()}
          loading={guardar.isPending}
          disabled={!!problema}
        >
          {t('neg.guardar')}
        </Button>
      </BarraGuardar>

      {guardar.isError && (
        <ErrorNote>
          {guardar.error instanceof ApiError ? guardar.error.message : t('neg.noSePudoGuardar')}
        </ErrorNote>
      )}
      {guardar.isSuccess && !tocado && <SuccessNote>{t('neg.guardada')}</SuccessNote>}

      <Card padded>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('neg.nombre')} htmlFor={`${id}-name`} required>
            <Input
              id={`${id}-name`}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>

          <Field
            label={t('neg.categoria')}
            htmlFor={`${id}-cat`}
            hint={t('neg.categoriaPista')}
            required
          >
            <Select
              id={`${id}-cat`}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {idioma === 'en' ? c.labelEn : c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('neg.descripcion')}
            htmlFor={`${id}-desc`}
            hint={t('neg.descripcionPista')}
            className="sm:col-span-2"
          >
            <Textarea
              id={`${id}-desc`}
              rows={3}
              maxLength={600}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>

          <Field label={t('neg.telefono')} htmlFor={`${id}-tel`} hint={t('neg.telefonoPista')}>
            <Input
              id={`${id}-tel`}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>

          <Field label={t('neg.email')} htmlFor={`${id}-mail`} hint={t('neg.emailPista')}>
            <Input
              id={`${id}-mail`}
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>

          <Field label={t('neg.calle')} htmlFor={`${id}-calle`} required className="sm:col-span-2">
            <Input
              id={`${id}-calle`}
              value={form.street}
              onChange={(e) => set('street', e.target.value)}
            />
          </Field>

          <Field label={t('neg.ciudad')} htmlFor={`${id}-ciudad`} required>
            <Input
              id={`${id}-ciudad`}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
          </Field>

          <Field label={t('neg.cp')} htmlFor={`${id}-cp`} required>
            <Input
              id={`${id}-cp`}
              inputMode="numeric"
              maxLength={5}
              value={form.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
            />
          </Field>
        </div>

        {problema && <p className="mt-4 text-meta text-brand-text">{problema}</p>}

        <p className="mt-5 border-t border-line pt-4 text-meta text-subtle">
          <Texto
            clave="neg.direccionWeb"
            partes={{
              slug: <strong className="font-semibold text-body-2">/{form.slug}</strong>,
            }}
          />
        </p>
      </Card>

      <FotosDelNegocio slug={slug} fotos={form.photos} />

      <div>
        <h2 className="mb-1 font-display text-subheading font-semibold text-ink">
          {t('neg.vacaciones')}
        </h2>
        <p className="mb-4 text-body text-muted">{t('neg.vacacionesPista')}</p>

        <Card padded>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (hasta >= desde) crearCierre.mutate()
            }}
            className="grid gap-4 sm:grid-cols-[repeat(3,1fr)_auto] sm:items-end"
          >
            <Field label={t('neg.desde')} htmlFor={`${id}-desde`} required>
              <Input
                id={`${id}-desde`}
                type="date"
                value={desde}
                min={hoy()}
                onChange={(e) => {
                  setDesde(e.target.value)
                  if (hasta < e.target.value) setHasta(e.target.value)
                }}
              />
            </Field>
            <Field label={t('neg.hasta')} htmlFor={`${id}-hasta`} required>
              <Input
                id={`${id}-hasta`}
                type="date"
                value={hasta}
                min={desde}
                invalid={hasta < desde}
                onChange={(e) => setHasta(e.target.value)}
              />
            </Field>
            <Field label={t('neg.motivo')} htmlFor={`${id}-motivo`} hint={t('neg.motivoPista')}>
              <Input
                id={`${id}-motivo`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={crearCierre.isPending} disabled={hasta < desde}>
              {t('neg.cerrarEsosDias')}
            </Button>
          </form>

          {crearCierre.isError && (
            <div className="mt-4">
              <ErrorNote>
                {crearCierre.error instanceof ApiError
                  ? crearCierre.error.message
                  : t('neg.noSePudoCerrar')}
              </ErrorNote>
            </div>
          )}

          {crearCierre.isSuccess && crearCierre.data.affectedBookings > 0 && (
            <div className="mt-4">
              <ErrorNote>
                {plural(crearCierre.data.affectedBookings, 'neg.ojoUnaCita', 'neg.ojoVariasCitas')}{' '}
                {t('neg.ojoCola')}
              </ErrorNote>
            </div>
          )}
        </Card>

        {cierres && cierres.length > 0 && (
          <Card className="mt-4 overflow-hidden">
            <ul>
              {cierres.map((c) => (
                <li
                  key={c.ids[0]}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
                >
                  <div className="min-w-[220px] flex-1">
                    <div className="text-ui font-semibold text-ink">
                      {c.from === c.to
                        ? formatoDia(c.from)
                        : t('neg.delAl', {
                            desde: formatoDia(c.from),
                            hasta: formatoDia(c.to),
                          })}
                    </div>
                    <p className="mt-0.5 text-meta text-muted">
                      {plural(c.ids.length, 'neg.unDia', 'neg.variosDias')}
                      {c.reason && ` · ${c.reason}`}
                    </p>
                  </div>
                  <div className="ml-auto sm:ml-0">
                    <ConfirmAction
                      label={t('neg.quitar')}
                      confirmLabel={t('neg.siAbrir')}
                      loading={borrarCierre.isPending}
                      onConfirm={() => borrarCierre.mutate(c.ids)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {borrarCierre.isError && (
          <div className="mt-4">
            <ErrorNote>{t('neg.noSePudoQuitar')}</ErrorNote>
          </div>
        )}
      </div>
    </div>
  )
}
