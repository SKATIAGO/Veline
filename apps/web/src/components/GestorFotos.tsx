import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as EventoPuntero,
} from 'react'
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
 *   - Se reordenan arrastrando: con el ratón, sin más; con el dedo, tras
 *     mantener la foto pulsada un momento, para no robarle el gesto al
 *     desplazamiento de la página. La primera es la portada. Con el teclado,
 *     flechas para mover, Inicio para portada y Suprimir para quitar.
 *   - Una × pequeña en la esquina para quitar, con confirmación.
 *
 * Antes cada foto llevaba cuatro botones redondos de 36 px (‹ › ★ ×) encima
 * de la imagen: tapaban media foto, en el móvil no cabían y, más pequeños, no
 * se acertaban. Arrastrar es lo que todo el mundo intenta primero.
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

/** Cuánto hay que mantener el dedo antes de que la foto se despegue. */
const PULSACION_MS = 250
/** Lo que se puede mover el dedo durante la pulsación sin que cuente como desplazar. */
const HOLGURA_PX = 8

/** El gesto de arrastrar una foto, de pointerdown a pointerup. */
interface Gesto {
  url: string
  puntero: number
  tipo: string
  x0: number
  y0: number
  /** Dónde se cogió la foto, respecto a su esquina. */
  offX: number
  offY: number
  activo: boolean
  temporizador?: number
}

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
  const [quitando, setQuitando] = useState<string | null>(null)
  /* Mientras se arrastra, el orden provisional; al soltar se guarda. */
  const [orden, setOrden] = useState<string[] | null>(null)
  const ordenRef = useRef<string[] | null>(null)
  ordenRef.current = orden
  const [cogida, setCogida] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const lista = useRef<HTMLUListElement>(null)
  const gesto = useRef<Gesto | null>(null)
  const ultimoPuntero = useRef({ x: 0, y: 0 })
  const rectsAntes = useRef<Map<string, DOMRect> | null>(null)
  const enfocarTras = useRef<string | null>(null)
  const vista = orden ?? fotos
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
    setAnuncio(t('fotos.movida', { n: hasta + 1, total: fotos.length }))
    enfocarTras.current = f!
    void onChange(copia)
  }

  /* ── Arrastrar con el puntero (ratón o dedo) ── */

  const nodoDe = (url: string) =>
    lista.current?.querySelector<HTMLElement>(`[data-foto="${CSS.escape(url)}"]`) ?? null

  /** Coloca la foto cogida bajo el puntero, contando desde su hueco actual. */
  const seguirPuntero = () => {
    const g = gesto.current
    const el = g && nodoDe(g.url)
    if (!g || !el || !lista.current) return
    const caja = lista.current.getBoundingClientRect()
    const x = ultimoPuntero.current.x - g.offX - (caja.left + el.offsetLeft)
    const y = ultimoPuntero.current.y - g.offY - (caja.top + el.offsetTop)
    el.style.transform = `translate(${x}px, ${y}px) scale(1.04)`
  }

  const fotografiarPosiciones = () => {
    const mapa = new Map<string, DOMRect>()
    lista.current
      ?.querySelectorAll<HTMLElement>('[data-foto]')
      .forEach((el) => mapa.set(el.dataset.foto!, el.getBoundingClientRect()))
    rectsAntes.current = mapa
  }

  /* Tras cada cambio de orden: la cogida sigue al puntero y las demás se
     deslizan a su sitio nuevo en vez de saltar (FLIP). */
  useLayoutEffect(() => {
    seguirPuntero()
    const antes = rectsAntes.current
    rectsAntes.current = null
    if (!antes || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    lista.current?.querySelectorAll<HTMLElement>('[data-foto]').forEach((el) => {
      const url = el.dataset.foto!
      if (url === gesto.current?.url) return
      const a = antes.get(url)
      if (!a) return
      const b = el.getBoundingClientRect()
      const dx = a.left - b.left
      const dy = a.top - b.top
      if (!dx && !dy) return
      el.style.transition = 'none'
      el.style.transform = `translate(${dx}px, ${dy}px)`
      void el.offsetWidth
      el.style.transition = 'transform 160ms ease-out'
      el.style.transform = ''
    })
  }, [orden])

  // Con el teclado, el foco se queda en la foto que se ha movido.
  useLayoutEffect(() => {
    const url = enfocarTras.current
    if (!url) return
    enfocarTras.current = null
    nodoDe(url)?.focus()
  }, [fotos])

  /* Con el dedo, una vez despegada la foto, la página no se desplaza. Tiene
     que ser un oyente no pasivo: el de React lo es. */
  useEffect(() => {
    const el = lista.current
    if (!el) return
    const frenar = (e: TouchEvent) => {
      if (gesto.current?.activo) e.preventDefault()
    }
    el.addEventListener('touchmove', frenar, { passive: false })
    return () => el.removeEventListener('touchmove', frenar)
  }, [fotos.length > 0])

  const terminar = (guardar: boolean) => {
    const g = gesto.current
    if (!g) return
    window.clearTimeout(g.temporizador)
    window.removeEventListener('pointermove', alMover)
    window.removeEventListener('pointerup', alSoltar)
    window.removeEventListener('pointercancel', alCancelar)
    const el = nodoDe(g.url)
    if (el) {
      el.style.transition = ''
      el.style.transform = ''
    }
    const final = ordenRef.current
    gesto.current = null
    setCogida(null)
    setOrden(null)
    if (guardar && final && final.join('|') !== fotos.join('|')) {
      const n = final.indexOf(g.url)
      setAnuncio(t('fotos.movida', { n: n + 1, total: final.length }))
      void onChange(final)
    }
  }

  const despegar = () => {
    const g = gesto.current
    if (!g || g.activo) return
    g.activo = true
    setCogida(g.url)
    setOrden(fotos)
    navigator.vibrate?.(8)
    requestAnimationFrame(seguirPuntero)
  }

  function alMover(e: PointerEvent) {
    const g = gesto.current
    if (!g || e.pointerId !== g.puntero) return
    ultimoPuntero.current = { x: e.clientX, y: e.clientY }
    if (!g.activo) {
      const distancia = Math.hypot(e.clientX - g.x0, e.clientY - g.y0)
      if (g.tipo === 'mouse') {
        if (distancia > 4) despegar()
      } else if (distancia > HOLGURA_PX) {
        // El dedo se movió antes de tiempo: era desplazar la página.
        terminar(false)
      }
      return
    }
    e.preventDefault()
    seguirPuntero()
    /* ¿Sobre el hueco de qué foto está el puntero? Esa es la posición nueva.
       Se mira el hueco (offsetLeft/Top), no dónde se pinta la foto: mientras
       las demás se deslizan a su sitio, su dibujo está a medio camino. */
    const caja = lista.current?.getBoundingClientRect()
    let destino: string | undefined
    if (caja) {
      lista.current!.querySelectorAll<HTMLElement>('[data-foto]').forEach((el) => {
        if (el.dataset.foto === g.url) return
        const x = caja.left + el.offsetLeft
        const y = caja.top + el.offsetTop
        if (
          e.clientX >= x &&
          e.clientX <= x + el.offsetWidth &&
          e.clientY >= y &&
          e.clientY <= y + el.offsetHeight
        ) {
          destino = el.dataset.foto
        }
      })
    }
    const actual = ordenRef.current
    if (!destino || !actual) return
    const desde = actual.indexOf(g.url)
    const hasta = actual.indexOf(destino)
    if (desde < 0 || hasta < 0 || desde === hasta) return
    const copia = [...actual]
    copia.splice(desde, 1)
    copia.splice(hasta, 0, g.url)
    fotografiarPosiciones()
    setOrden(copia)
  }
  function alSoltar(e: PointerEvent) {
    if (gesto.current && e.pointerId === gesto.current.puntero) terminar(true)
  }
  function alCancelar(e: PointerEvent) {
    if (gesto.current && e.pointerId === gesto.current.puntero) terminar(true)
  }

  const alPulsar = (e: EventoPuntero<HTMLLIElement>, url: string) => {
    if (gesto.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('button')) return
    const caja = e.currentTarget.getBoundingClientRect()
    gesto.current = {
      url,
      puntero: e.pointerId,
      tipo: e.pointerType,
      x0: e.clientX,
      y0: e.clientY,
      offX: e.clientX - caja.left,
      offY: e.clientY - caja.top,
      activo: false,
    }
    ultimoPuntero.current = { x: e.clientX, y: e.clientY }
    if (e.pointerType !== 'mouse') {
      gesto.current.temporizador = window.setTimeout(despegar, PULSACION_MS)
    }
    window.addEventListener('pointermove', alMover, { passive: false })
    window.addEventListener('pointerup', alSoltar)
    window.addEventListener('pointercancel', alCancelar)
  }

  const alTeclear = (e: KeyboardEvent<HTMLLIElement>, i: number, url: string) => {
    if (e.target !== e.currentTarget) return
    const accion: Record<string, () => void> = {
      ArrowLeft: () => mover(i, i - 1),
      ArrowUp: () => mover(i, i - 1),
      ArrowRight: () => mover(i, i + 1),
      ArrowDown: () => mover(i, i + 1),
      Home: () => mover(i, 0),
      Delete: () => setQuitando(url),
      Backspace: () => setQuitando(url),
    }
    const hacer = accion[e.key]
    if (!hacer) return
    e.preventDefault()
    hacer()
  }

  const alSoltarArchivos = (e: DragEvent) => {
    e.preventDefault()
    setArrastrandoEncima(false)
    if (e.dataTransfer.files?.length) recibir(e.dataTransfer.files)
  }

  const pistaId = `${id}-pista`
  const hayAlgo = fotos.length > 0 || subidas.length > 0

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

      {/* ── Añadir: arriba, y toda la zona se pulsa ── */}
      {quedan > 0 ? (
        <>
          <button
            type="button"
            onClick={() => selector.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrandoEncima(true)
            }}
            onDragLeave={() => setArrastrandoEncima(false)}
            onDrop={alSoltarArchivos}
            className={cx(
              'flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed px-4 text-center transition-colors duration-200',
              hayAlgo ? 'min-h-16 py-3' : 'min-h-32 py-6',
              arrastrandoEncima
                ? 'border-brand bg-brand/5'
                : 'border-line-strong bg-canvas hover:border-brand',
            )}
          >
            {/* Arrastrar archivos solo existe con ratón: en el móvil, «Añadir fotos». */}
            <span className="hidden text-body text-body-2 [@media(hover:hover)]:inline">
              <span aria-hidden className="mr-1 font-semibold text-brand-text">
                +
              </span>
              {t('fotos.arrastra')}{' '}
              <span className="font-semibold text-brand-text underline-offset-2">
                {t('fotos.elegir')}
              </span>
            </span>
            <span className="text-body font-semibold text-brand-text [@media(hover:hover)]:hidden">
              <span aria-hidden className="mr-1">
                +
              </span>
              {t('fotos.anadir')}
            </span>
            <span className="text-meta text-subtle">{t('fotos.formatos')}</span>
          </button>
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
        </>
      ) : (
        <p className="text-meta text-subtle">{t('fotos.maximo', { max })}</p>
      )}

      {/* ── La galería ── */}
      {hayAlgo && (
        <ul
          ref={lista}
          className="relative grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3"
          aria-label={titulo ?? t('fotos.titulo')}
        >
          {vista.map((url, i) => (
            <li
              key={url}
              data-foto={url}
              tabIndex={0}
              aria-label={
                i === 0
                  ? t('fotos.fotoNPortada', { n: i + 1, total: vista.length })
                  : t('fotos.fotoN', { n: i + 1, total: vista.length })
              }
              aria-describedby={pistaId}
              onPointerDown={(e) => alPulsar(e, url)}
              onKeyDown={(e) => alTeclear(e, i, url)}
              onContextMenu={(e) => e.preventDefault()}
              className={cx(
                'relative aspect-square touch-manipulation overflow-hidden rounded-xl border bg-canvas select-none',
                '[-webkit-touch-callout:none] [&_img]:pointer-events-none',
                'outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
                cogida === url
                  ? 'z-elevado cursor-grabbing border-brand shadow-pop'
                  : 'cursor-grab border-line',
              )}
            >
              <Photo src={url} alt="" width={320} height={320} className="size-full" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-ink/75 px-2 py-0.5 text-caption font-semibold text-cream">
                  {t('fotos.portada')}
                </span>
              )}
              {/* Quitar: la × se ve pequeña pero el toque ocupa 44 px. */}
              {cogida !== url && (
                <button
                  type="button"
                  aria-label={t('fotos.quitar')}
                  title={t('fotos.quitar')}
                  onClick={() => setQuitando(url)}
                  className="group absolute top-0 right-0 grid size-11 place-items-center"
                >
                  <span
                    aria-hidden
                    className="grid size-7 place-items-center rounded-full bg-ink/70 text-body leading-none text-cream shadow-sm transition-colors group-hover:bg-ink group-focus-visible:ring-2 group-focus-visible:ring-cream"
                  >
                    ×
                  </span>
                </button>
              )}
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

      {fotos.length > 0 && (
        <p
          id={pistaId}
          className={cx('text-meta text-subtle', !(fotos.length > 1 || pista) && 'sr-only')}
        >
          {fotos.length > 1 ? (pista ?? t('fotos.reordenarPista')) : pista}
          <span className="sr-only"> {t('fotos.teclas')}</span>
        </p>
      )}
      {fotos.length === 0 && pista && <p className="text-meta text-subtle">{pista}</p>}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>

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
