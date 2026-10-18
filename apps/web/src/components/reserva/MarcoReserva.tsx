import type { ReactNode } from 'react'
import { formatPrice, type BusinessDTO, type ServiceDTO } from '@veline/shared'
import { Link } from 'react-router-dom'
import { Card, cx } from '../ui'
import { Stepper } from '../Stepper'
import { AtajoFotos, Galeria } from '../Galeria'
import type { useFotosNegocio, useVisor } from '../../lib/galeria'
import { useIdioma } from '../../i18n/idioma'

/**
 * El marco de cada paso de la reserva: atrás, «Paso X de N», el contenido
 * del paso y el resumen de lo elegido con el botón de continuar.
 *
 * Antes cada pantalla montaba su propia columna, su tarjeta y su botón, y no
 * había indicador de progreso ni resumen en el móvil. Ahora el resumen está
 * siempre a la vista: en escritorio, una tarjeta pegada a la derecha; en el
 * móvil, una barra fija abajo con el total y el botón, y el detalle en un
 * desplegable encima del contenido. El contenido deja sitio a la barra
 * (`pb-28`) para que nada quede debajo.
 */
export function MarcoReserva({
  negocio,
  servicio,
  pasos,
  paso,
  volverA,
  salirA,
  titulo,
  resumen,
  resumenCorto,
  total,
  accion,
  error,
  fotos,
  children,
}: {
  negocio: { name: string; photos: string[] }
  servicio: { name: string; photos: string[] }
  /** Los nombres de los pasos, ya traducidos. Sin ellos no hay indicador
      (reprogramar es una sola pantalla). */
  pasos?: string[]
  /** Índice del paso actual, desde 0. */
  paso?: number
  volverA: string
  /** Adónde lleva «Salir de la reserva» (la ficha del negocio). */
  salirA?: string
  /** El título de la barra; si no, «negocio · servicio». */
  titulo?: string
  /** Las líneas del resumen (ResumenReserva). */
  resumen: ReactNode
  /** Una línea para la barra del móvil: «Cambio de aceite · vie 16 · 09:00». */
  resumenCorto: string
  /** Sin total aún (el primer paso): la barra solo lleva el texto. */
  total?: number
  /** El botón de continuar / confirmar. Se pinta en la tarjeta y en la barra. */
  accion?: ReactNode
  error?: ReactNode
  /** La galería: la crea la pantalla (que también la usa para los extras). */
  fotos?: { fotosDe: ReturnType<typeof useFotosNegocio>; visor: ReturnType<typeof useVisor> }
  children: ReactNode
}) {
  const { t, idioma } = useIdioma()
  const atajo = fotos && (
    <AtajoFotos
      fotosServicio={servicio.photos}
      nombreServicio={servicio.name}
      fotosLocal={negocio.photos.length}
      // Con galería, la pantalla pasa los DTO completos; reprogramar no la trae.
      onVerServicio={() => fotos.visor.abrir(fotos.fotosDe.deServicio(servicio as ServiceDTO))}
      onVerLocal={() => fotos.visor.abrir(fotos.fotosDe.deLocal(negocio as BusinessDTO))}
    />
  )

  return (
    <>
      {/* La barra de la reserva: atrás, dónde estás y una salida. En el móvil
          sustituye a la cabecera pública (la quita Layout), para que la
          reserva se sienta como una app y no como una página más. */}
      <div className="sticky top-0 z-cabecera border-b border-line bg-cream/95 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1440px] items-center gap-1 px-2 py-1.5 sm:px-4 lg:px-14">
          <Link
            to={volverA}
            aria-label={t('comun.volver')}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-subheading leading-none text-body-2 transition-colors duration-200 hover:bg-canvas hover:text-ink"
          >
            <span aria-hidden>‹</span>
          </Link>
          <p className="min-w-0 flex-1 truncate text-center text-body font-semibold text-ink lg:text-left">
            {titulo ?? `${negocio.name} · ${servicio.name}`}
          </p>
          {salirA ? (
            <Link
              to={salirA}
              aria-label={t('reserva.salir')}
              title={t('reserva.salir')}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-subheading leading-none text-body-2 transition-colors duration-200 hover:bg-canvas hover:text-ink"
            >
              <span aria-hidden>×</span>
            </Link>
          ) : (
            <span className="size-11 shrink-0" aria-hidden />
          )}
        </div>
      </div>

      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pt-5 pb-28 sm:px-6 lg:flex-row lg:gap-10 lg:px-16 lg:py-10">
        <div className="min-w-0 flex-[1.4]">
          {pasos && <Stepper pasos={pasos} actual={paso ?? 0} className="mb-6" />}

          {/* El resumen en el móvil: plegado, para no empujar el paso hacia abajo.
              En el primer paso aún no hay nada que resumir. */}
          {total !== undefined && (
            <details className="mb-6 rounded-xl border border-line bg-surface lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-body font-semibold text-ink [&::-webkit-details-marker]:hidden">
                <span>{t('reserva.verResumen')}</span>
                <span className="text-subtle" aria-hidden>
                  ▾
                </span>
              </summary>
              <div className="border-t border-line px-4 pt-3 pb-4">
                {atajo}
                {resumen}
              </div>
            </details>
          )}

          {children}
        </div>

        <aside className="hidden w-full shrink-0 lg:block lg:w-[360px]">
          <Card className="p-6 lg:sticky lg:top-24">
            <h2 className="mb-4 font-display text-ui font-semibold text-ink">
              {t('reserva.resumen')}
            </h2>
            {atajo}
            {resumen}
            {total !== undefined && (
              <div className="mt-4 mb-5 flex justify-between border-t border-line pt-4">
                <span className="text-body text-muted">{t('comun.total')}</span>
                <span className="text-ui font-semibold text-ink tabular-nums">
                  {formatPrice(total, idioma)}
                </span>
              </div>
            )}
            {error && <div className="mb-4">{error}</div>}
            {accion && <div className="[&>*]:w-full">{accion}</div>}
          </Card>
        </aside>
      </div>

      {/* La barra del móvil: total y botón, siempre a mano. Sin acción (el
          primer paso) no hace falta. */}
      {accion && (
        <div
          className={cx(
            'fixed inset-x-0 bottom-0 z-cabecera border-t border-line bg-surface/95 backdrop-blur lg:hidden',
            'px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          )}
        >
          {error && <div className="mb-3">{error}</div>}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-meta text-muted">{resumenCorto}</p>
              {total !== undefined && (
                <p className="text-ui font-semibold text-ink tabular-nums">
                  {formatPrice(total, idioma)}
                </p>
              )}
            </div>
            <div className="shrink-0">{accion}</div>
          </div>
        </div>
      )}

      {fotos && (
        <Galeria
          fotos={fotos.visor.estado?.fotos ?? []}
          index={fotos.visor.estado?.index ?? null}
          onIndex={fotos.visor.irA}
          onClose={fotos.visor.cerrar}
          titulo={negocio.name}
        />
      )}
    </>
  )
}
