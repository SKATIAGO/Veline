import { useId, useRef, useState, type DragEvent } from 'react'
import { prepararFoto, subirImagenConProgreso } from '../lib/imagen'
import { ApiError } from '../lib/api'
import { ConfirmDialog } from './Confirmar'
import { Photo } from './Photo'
import { cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Las fotos de algo —el negocio, un servicio, un extra— y cómo se suben.
 *
 * Lo que había: un archivo cada vez, un spinner en la casilla y nada más; ni
 * se veía cuánto quedaba ni qué había fallado, y no se podían reordenar. Esto
 * es lo que se espera de subir fotos desde el móvil en 2026:
 *
 *   - Se arrastran encima o se eligen varias. Se comprueba el formato y el
 *     peso ANTES de subir, y se reducen en el navegador (1600 px, JPEG).
 *   - Cada archivo con su barra de progreso real, su «subida» o su error.
 *   - Se reordenan arrastrando (ratón) o con las flechas (teclado y dedo); la
 *     primera es la portada y cualquiera se puede poner de portada.
 *   - Quitar pide confirmación: con un toque de más se perdía la portada.
 *
 * La lista `fotos` es la verdad: quien lo usa la guarda como quiera (al
 * momento o con el formulario). Aquí solo se sube y se avisa del cambio.
 */

const PESO_MAXIMO_ORIGINAL = 15 * 1024 * 1024

interface Subida {
  id: number
  nombre: string
  preview: string
  estado: 'preparando' | 'subiendo' | 'hecha' | 'error'
  progreso: number
  error?: string
}

let siguienteId = 1

export function GestorFotos({
  slug,
  fotos,
  onChange,
  max,
  titulo,
  pista,
}: {
  slug: string
  fotos: string[]
  onChange: (fotos: string[]) => void | Promise<void>
  max: number
  /** La cabecera del grupo («Fotos del local»), si hace falta. */
  titulo?: string
  pista?: string
}) {
  const { t } = useIdioma()
  const id = useId()
  const selector = useRef<HTMLInputElement>(null)
  const [subidas, setSubidas] = useState<Subida[]>([])
  const [arrastrandoEncima, setArrastrandoEncima] = useState(false)
  const [arrastrada, setArrastrada] = useState<number | null>(null)
  const [quitando, setQuitando] = useState<string | null>(null)
  const cola = useRef<Promise<void>>(Promise.resolve())
  // La lista actual, para encadenar subidas sin pisarse.
  const actuales = useRef(fotos)
  actuales.current = fotos

  const quedan = Math.max(
    0,
    max - fotos.length - subidas.filter((s) => s.estado !== 'error').length,
  )

  const actualizar = (sid: number, cambios: Partial<Subida>) =>
    setSubidas((lista) => lista.map((s) => (s.id === sid ? { ...s, ...cambios } : s)))

  const subirUna = (archivo: File) => {
    const sid = siguienteId++
    const preview = URL.createObjectURL(archivo)
    const nueva: Subida = {
      id: sid,
      nombre: archivo.name,
      preview,
      estado: 'preparando',
      progreso: 0,
    }
    setSubidas((lista) => [...lista, nueva])

    if (archivo.type && !archivo.type.startsWith('image/')) {
      actualizar(sid, { estado: 'error', error: t('fotos.noEsImagen', { nombre: archivo.name }) })
      return
    }
    if (archivo.size > PESO_MAXIMO_ORIGINAL) {
      actualizar(sid, {
        estado: 'error',
        error: t('fotos.demasiadoGrande', { nombre: archivo.name }),
      })
      return
    }

    // De una en una, en orden: la lista final queda como se eligieron.
    cola.current = cola.current.then(async () => {
      try {
        const datos = await prepararFoto(archivo)
        actualizar(sid, { estado: 'subiendo', progreso: 0 })
        const url = await subirImagenConProgreso(slug, datos, (p) =>
          actualizar(sid, { progreso: p }),
        )
        if (!actuales.current.includes(url)) {
          actuales.current = [...actuales.current, url]
          await onChange(actuales.current)
        }
        actualizar(sid, { estado: 'hecha', progreso: 100 })
        window.setTimeout(() => {
          setSubidas((lista) => lista.filter((s) => s.id !== sid))
          URL.revokeObjectURL(preview)
        }, 1200)
      } catch (e) {
        actualizar(sid, {
          estado: 'error',
          error:
            e instanceof ApiError ? e.message : t('fotos.errorArchivo', { nombre: archivo.name }),
        })
      }
    })
  }

  const recibir = (lista: FileList | File[]) => {
    const archivos = [...lista].slice(0, quedan)
    archivos.forEach(subirUna)
  }

  const mover = (desde: number, hasta: number) => {
    if (desde === hasta || hasta < 0 || hasta >= fotos.length) return
    const copia = [...fotos]
    const [f] = copia.splice(desde, 1)
    copia.splice(hasta, 0, f!)
    void onChange(copia)
  }

  const alSoltarArchivos = (e: DragEvent) => {
    e.preventDefault()
    setArrastrandoEncima(false)
    if (e.dataTransfer.files?.length) recibir(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-3">
      {titulo && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-meta font-semibold text-body-2">{titulo}</h2>
          <span className="text-meta text-subtle">
            {t('fotos.cuantas', { n: fotos.length, max })}
          </span>
        </div>
      )}

      {(fotos.length > 0 || subidas.length > 0) && (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3"
          aria-label={titulo ?? t('fotos.titulo')}
        >
          {fotos.map((url, i) => (
            <li
              key={url}
              draggable
              onDragStart={(e) => {
                setArrastrada(i)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (arrastrada !== null) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (arrastrada !== null) mover(arrastrada, i)
                setArrastrada(null)
              }}
              onDragEnd={() => setArrastrada(null)}
              className={cx(
                'group relative aspect-square overflow-hidden rounded-xl border bg-canvas',
                arrastrada === i ? 'border-brand opacity-60' : 'border-line',
              )}
            >
              <Photo src={url} alt="" width={320} height={320} className="size-full" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-ink/75 px-2 py-0.5 text-caption font-semibold text-cream">
                  {t('fotos.portada')}
                </span>
              )}
              {/* Acciones: a la vista con el dedo, al pasar el ratón o con el foco. */}
              <div
                className={cx(
                  'absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink/75 to-transparent p-1.5',
                  'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
                )}
              >
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={t('fotos.moverAntes')}
                    disabled={i === 0}
                    onClick={() => mover(i, i - 1)}
                    className="grid size-9 place-items-center rounded-full bg-surface/90 text-ink hover:bg-surface disabled:opacity-40"
                  >
                    <span aria-hidden>‹</span>
                  </button>
                  <button
                    type="button"
                    aria-label={t('fotos.moverDespues')}
                    disabled={i === fotos.length - 1}
                    onClick={() => mover(i, i + 1)}
                    className="grid size-9 place-items-center rounded-full bg-surface/90 text-ink hover:bg-surface disabled:opacity-40"
                  >
                    <span aria-hidden>›</span>
                  </button>
                </div>
                <div className="flex gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      aria-label={t('fotos.hacerPrincipal')}
                      title={t('fotos.hacerPrincipal')}
                      onClick={() => mover(i, 0)}
                      className="grid size-9 place-items-center rounded-full bg-surface/90 text-ink hover:bg-surface"
                    >
                      <span aria-hidden>★</span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t('fotos.quitar')}
                    title={t('fotos.quitar')}
                    onClick={() => setQuitando(url)}
                    className="grid size-9 place-items-center rounded-full bg-surface/90 text-ui leading-none text-ink hover:bg-surface"
                  >
                    <span aria-hidden>×</span>
                  </button>
                </div>
              </div>
            </li>
          ))}

          {subidas.map((s) => (
            <li
              key={s.id}
              className="relative aspect-square overflow-hidden rounded-xl border border-line bg-canvas"
              aria-live="polite"
            >
              <img src={s.preview} alt="" className="size-full object-cover opacity-70" />
              <div className="absolute inset-x-0 bottom-0 bg-surface/95 p-1.5">
                <p className="truncate text-caption font-semibold text-ink">
                  {s.estado === 'error'
                    ? s.error
                    : s.estado === 'hecha'
                      ? t('fotos.subida')
                      : s.estado === 'preparando'
                        ? t('fotos.preparando')
                        : `${s.progreso} %`}
                </p>
                {s.estado !== 'error' && (
                  <div
                    role="progressbar"
                    aria-label={t('fotos.subiendo', { nombre: s.nombre })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={s.estado === 'hecha' ? 100 : s.progreso}
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"
                  >
                    <div
                      className={cx(
                        'h-full rounded-full transition-[width] duration-200',
                        s.estado === 'hecha' ? 'bg-ink' : 'bg-brand',
                      )}
                      style={{ width: `${s.estado === 'hecha' ? 100 : s.progreso}%` }}
                    />
                  </div>
                )}
                {s.estado === 'error' && (
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(s.preview)
                      setSubidas((l) => l.filter((x) => x.id !== s.id))
                    }}
                    className="mt-1 text-caption font-semibold text-danger underline"
                  >
                    {t('comun.cerrar')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {quedan > 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrandoEncima(true)
          }}
          onDragLeave={() => setArrastrandoEncima(false)}
          onDrop={alSoltarArchivos}
          className={cx(
            'flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
            arrastrandoEncima ? 'border-brand bg-brand/5' : 'border-line-strong bg-canvas',
          )}
        >
          <p className="text-body text-body-2">
            {t('fotos.arrastra')}{' '}
            <button
              type="button"
              onClick={() => selector.current?.click()}
              className="inline-flex min-h-11 items-center font-semibold text-brand-text underline-offset-2 hover:underline"
            >
              {t('fotos.elegir')}
            </button>
          </p>
          <p className="text-meta text-subtle">{t('fotos.formatos')}</p>
          <input
            ref={selector}
            id={`${id}-archivos`}
            type="file"
            accept="image/*"
            multiple
            tabIndex={-1}
            aria-label={t('fotos.elegir')}
            className="sr-only"
            onChange={(e) => {
              const archivos = e.target.files
              // Se vacía: si no, elegir las mismas fotos otra vez no hace nada.
              if (archivos?.length) recibir(archivos)
              e.target.value = ''
            }}
          />
        </div>
      ) : (
        <p className="text-meta text-subtle">{t('fotos.maximo', { max })}</p>
      )}

      {(pista || fotos.length > 1) && (
        <p className="text-meta text-subtle">{pista ?? t('fotos.reordenarPista')}</p>
      )}

      <ConfirmDialog
        open={!!quitando}
        onClose={() => setQuitando(null)}
        title={t('fotos.quitarTitulo')}
        consecuencias={[t('fotos.quitarTexto')]}
        confirmLabel={t('fotos.quitar')}
        tono="destruir"
        onConfirm={() => {
          const url = quitando
          setQuitando(null)
          if (url) void onChange(fotos.filter((f) => f !== url))
        }}
      />
    </div>
  )
}
