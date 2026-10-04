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
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
  Textarea,
} from '../../components/ui'
import { PestanasSeccion } from '../../components/PestanasSeccion'
import { Photo } from '../../components/Photo'
import { Texto, useIdioma } from '../../i18n/idioma'
import { useCambiosSinGuardar } from '../../lib/cambios'
import { aviso, textoDeError } from '../../components/Avisos'

/**
 * La ficha pública del negocio y sus fotos.
 *
 * Hasta ahora un negocio se creaba una vez y se quedaba congelado: no había
 * forma de corregir ni un teléfono. Los cierres vivían aquí también; ahora
 * están con el horario, que es lo que cambian (PanelCierres).
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
    onSuccess: (url) =>
      guardar.mutate([...fotos, url], { onSuccess: () => aviso.ok(t('neg.fotoAnadida')) }),
  })

  /* Quitar una foto va directo —antes también—, pero ahora se puede deshacer:
     con un toque de más en la ✕ se perdía la portada sin remedio. */
  const quitar = (url: string) => {
    const antes = fotos
    guardar.mutate(
      fotos.filter((f) => f !== url),
      {
        onSuccess: () =>
          aviso.ok(t('neg.fotoQuitada'), {
            texto: t('avisos.deshacer'),
            onClick: () =>
              api
                .savePhotos(slug, antes)
                .then(invalidar)
                .catch((e) => aviso.error(textoDeError(e, t('avisos.error')))),
          }),
      },
    )
  }

  const enBusca = subir.isPending || guardar.isPending

  return (
    <div>
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

export function PanelNegocio() {
  const { t, idioma } = useIdioma()
  const { slug = '' } = useParams()

  const queryClient = useQueryClient()
  const id = useId()

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['panel', slug, 'profile'],
    queryFn: () => api.panelProfile(slug),
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
      aviso.ok(t('neg.guardada'))
    },
  })

  const set = <K extends keyof PanelProfile>(campo: K, valor: PanelProfile[K]) => {
    setForm((f) => (f ? { ...f, [campo]: valor } : f))
    setTocado(true)
  }

  if (isLoading || !form) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('panel.elNegocio')} />
        <PestanasSeccion seccion="negocio" />
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

      <PestanasSeccion seccion="negocio" />

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
    </div>
  )
}

/** La pestaña Fotos de El negocio: antes iban debajo de la ficha, y había que
    bajar media pantalla para encontrarlas. */
export function PanelFotos() {
  const { t } = useIdioma()
  const { slug = '' } = useParams()
  const { data: perfil, isLoading } = useQuery({
    queryKey: ['panel', slug, 'profile'],
    queryFn: () => api.panelProfile(slug),
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('panel.elNegocio')} hint={t('neg.fotosPista')} />
      <PestanasSeccion seccion="negocio" />
      {isLoading || !perfil ? (
        <Skeleton className="h-40" />
      ) : (
        <FotosDelNegocio slug={slug} fotos={perfil.photos} />
      )}
    </div>
  )
}
