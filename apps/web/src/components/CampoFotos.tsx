import { useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MAX_FOTOS_POR_ITEM } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { prepararFoto } from '../lib/imagen'
import { ErrorNote, Spinner, cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Las fotos de un servicio o de un extra: se suben en cuanto se eligen, se
 * pueden quitar y una se puede poner como principal (la que sale en la lista).
 *
 * Cada foto sube sola y devuelve su dirección; guardar el formulario es lo que
 * las asocia. Se pueden elegir varias a la vez: en el móvil, de la galería, y
 * un negocio de belleza suele tener varias del mismo trabajo.
 */
export function CampoFotos({
  slug,
  fotos,
  onChange,
  max = MAX_FOTOS_POR_ITEM,
}: {
  slug: string
  fotos: string[]
  onChange: (fotos: string[]) => void
  max?: number
}) {
  const { t } = useIdioma()
  const selector = useRef<HTMLInputElement>(null)
  // Las fotos suben una detrás de otra: la lista que se devuelve tiene que
  // partir de lo ya subido, no de lo que había al elegirlas.
  const actuales = useRef(fotos)
  actuales.current = fotos

  const subir = useMutation({
    mutationFn: async (archivos: File[]) => {
      for (const archivo of archivos) {
        const { url } = await api.subirImagen(slug, await prepararFoto(archivo))
        if (!actuales.current.includes(url)) {
          actuales.current = [...actuales.current, url]
          onChange(actuales.current)
        }
      }
    },
  })

  const quedan = max - fotos.length

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-meta font-semibold text-body-2">
        {t('fotos.titulo')}{' '}
        <span className="font-normal text-subtle">
          {t('fotos.cuantas', { n: fotos.length, max })} · {t('comun.opcional')}
        </span>
      </legend>

      <ul className="flex flex-wrap gap-2">
        {fotos.map((url, i) => (
          <li key={url} className="relative size-24 overflow-hidden rounded-xl border border-line">
            <img src={url} alt="" className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1 left-1 rounded-full bg-ink/75 px-1.5 text-caption font-semibold text-cream">
                {t('fotos.principal')}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-ink/70 to-transparent p-1">
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => onChange([url, ...fotos.filter((f) => f !== url)])}
                  aria-label={t('fotos.hacerPrincipal')}
                  title={t('fotos.hacerPrincipal')}
                  className="grid size-7 place-items-center rounded-full bg-surface/90 text-[13px] text-ink hover:bg-surface"
                >
                  ★
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => onChange(fotos.filter((f) => f !== url))}
                aria-label={t('ext.quitarFoto')}
                title={t('ext.quitarFoto')}
                className="grid size-7 place-items-center rounded-full bg-surface/90 text-[15px] leading-none text-ink hover:bg-surface"
              >
                ×
              </button>
            </div>
          </li>
        ))}

        {subir.isPending && (
          <li className="grid size-24 place-items-center rounded-xl border border-line bg-surface">
            <Spinner />
          </li>
        )}

        {quedan > 0 && !subir.isPending && (
          <li>
            <button
              type="button"
              onClick={() => selector.current?.click()}
              className={cx(
                'grid size-24 place-items-center rounded-xl border border-dashed border-line-strong bg-canvas',
                'px-2 text-center text-meta font-semibold text-muted transition-colors duration-200',
                'hover:border-brand hover:text-brand-text',
              )}
            >
              + {fotos.length === 0 ? t('ext.subirFoto') : t('fotos.anadir')}
            </button>
          </li>
        )}
      </ul>

      <input
        ref={selector}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          const archivos = [...(e.target.files ?? [])].slice(0, quedan)
          // Se vacía: si no, elegir las mismas fotos otra vez no hace nada.
          e.target.value = ''
          if (archivos.length) subir.mutate(archivos)
        }}
      />

      {fotos.length > 1 && <p className="text-meta text-muted">{t('fotos.pista')}</p>}
      {subir.isError && (
        <ErrorNote>
          {subir.error instanceof ApiError ? subir.error.message : t('ext.errFoto')}
        </ErrorNote>
      )}
    </fieldset>
  )
}
