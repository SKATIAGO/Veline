import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card, cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Lo que le falta a un negocio nuevo para poder recibir reservas.
 *
 * Un negocio recién creado no tenía guía: seis secciones en el menú y ninguna
 * pista de por dónde empezar. Sin servicios y sin horario no sale ni un hueco,
 * y el dueño lo descubría cuando un cliente le decía que no podía reservar.
 *
 * Aparece arriba de la Agenda mientras falte alguna de las dos cosas, y se va
 * sola al tenerlas. Solo la ve quien administra: es quien puede hacerlo.
 */
export function PrimerosPasos({
  slug,
  servicios,
  puedeConfigurar,
}: {
  slug: string
  /** Cuántos servicios tiene. Undefined mientras carga. */
  servicios: number | undefined
  puedeConfigurar: boolean
}) {
  const { t } = useIdioma()

  const { data: locales } = useQuery({
    queryKey: ['panel', slug, 'locales'],
    queryFn: () => api.panelLocales(slug),
    enabled: puedeConfigurar,
  })

  // Hasta saber las dos respuestas no se enseña nada: un parpadeo de «te falta
  // todo» antes de cargar asustaría a quien ya lo tiene todo.
  if (!puedeConfigurar || servicios === undefined || !locales) return null

  const pasos = [
    {
      id: 'servicios',
      hecho: servicios > 0,
      titulo: t('pp.servicios'),
      texto: t('pp.serviciosTexto'),
      to: `/panel/${slug}/servicios`,
      boton: t('pp.crearServicios'),
    },
    {
      id: 'horario',
      // Con varios locales, todos: uno sin horario no ofrece huecos.
      hecho: locales.length > 0 && locales.every((l) => l.tieneHorario),
      titulo: t('pp.horario'),
      texto: t('pp.horarioTexto'),
      to: `/panel/${slug}/horario`,
      boton: t('pp.ponerHorario'),
    },
  ]
  const hechos = pasos.filter((p) => p.hecho).length
  if (hechos === pasos.length) return null

  return (
    <Card padded className="border-brand/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-subheading font-semibold text-ink">{t('pp.titulo')}</h2>
        <p className="text-meta font-semibold text-muted tabular-nums">
          {t('pp.nDeN', { n: hechos, total: pasos.length })}
        </p>
      </div>
      <p className="mt-1 text-body text-muted">{t('pp.texto')}</p>

      <ol className="mt-4 flex flex-col gap-2">
        {pasos.map((p, i) => (
          <li
            key={p.id}
            className={cx(
              'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3',
              p.hecho ? 'border-line bg-cream' : 'border-line-strong bg-surface',
            )}
          >
            <span
              aria-hidden
              className={cx(
                'grid size-6 shrink-0 place-items-center rounded-full border text-caption font-bold tabular-nums',
                p.hecho ? 'border-ink bg-ink text-cream' : 'border-line-strong text-body-2',
              )}
            >
              {p.hecho ? '✓' : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cx(
                  'block text-[14px] font-semibold',
                  p.hecho ? 'text-muted' : 'text-ink',
                )}
              >
                {p.titulo}
                {p.hecho && <span className="sr-only"> — {t('pp.hecho')}</span>}
              </span>
              {!p.hecho && <span className="block text-meta text-muted">{p.texto}</span>}
            </span>
            {!p.hecho && (
              <Link
                to={p.to}
                className="inline-flex min-h-9 items-center rounded-full bg-brand px-3.5 text-meta font-semibold text-white transition-colors duration-200 hover:bg-brand-dark"
              >
                {p.boton}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}
