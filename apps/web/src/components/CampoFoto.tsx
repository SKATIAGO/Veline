import { useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { prepararFoto } from '../lib/imagen'
import { Button, ErrorNote, Spinner, cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Elegir la foto de algo (un servicio, un extra) y subirla al momento.
 *
 * Un botón grande y no un campo de archivo: en el móvil abre la cámara o la
 * galería, y se ve la foto en cuanto se elige. La foto se sube en cuanto se
 * elige (no al guardar el formulario) y devuelve su dirección; guardar el
 * formulario es lo que la asocia al servicio o al extra.
 */
export function CampoFoto({
  slug,
  foto,
  onChange,
}: {
  slug: string
  foto: string | null
  onChange: (url: string | null) => void
}) {
  const { t } = useIdioma()
  const selector = useRef<HTMLInputElement>(null)

  const subir = useMutation({
    mutationFn: async (archivo: File) => api.subirImagen(slug, await prepararFoto(archivo)),
    onSuccess: (r) => onChange(r.url),
  })

  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5">
      <span className="text-meta font-semibold text-body-2">
        {t('ext.foto')} <span className="font-normal text-subtle">{t('comun.opcional')}</span>
      </span>
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
          <Button type="button" size="sm" variant="quiet" onClick={() => selector.current?.click()}>
            {t('ext.cambiarFoto')}
          </Button>
          <Button type="button" size="sm" variant="quiet" onClick={() => onChange(null)}>
            {t('ext.quitarFoto')}
          </Button>
        </div>
      )}
      {subir.isError && (
        <ErrorNote>
          {subir.error instanceof ApiError ? subir.error.message : t('ext.errFoto')}
        </ErrorNote>
      )}
    </div>
  )
}
