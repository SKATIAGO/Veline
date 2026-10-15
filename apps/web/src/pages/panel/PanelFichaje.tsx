import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDaysKey, hoyMadrid, madridDateKey } from '@veline/shared'
import { api, ApiError, type Fichaje } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Card, ErrorNote, PageHeader, Skeleton, cx } from '../../components/ui'
import { PestanasSeccion } from '../../components/PestanasSeccion'
import { useIdioma } from '../../i18n/idioma'
import { aviso } from '../../components/Avisos'
import { useFormatosFichaje } from './fichajeComun'

/**
 * Fichar: lo que hace un empleado en dos segundos al llegar y al irse.
 *
 * Una sola cosa en pantalla: el estado («Estás fuera», «Dentro desde las
 * 09:02», «En pausa desde las 14:00»), cuánto llevas hoy en vivo, y el botón
 * grande. Con la jornada abierta, Pausa y Reanudar: las pausas se registran
 * y se descuentan, que es lo que pide el registro de jornada. El histórico,
 * las correcciones y el archivo están en la otra pestaña.
 */

/** Minutos trabajados de una jornada hasta `ahora`, pausas descontadas. */
function minutosHasta(f: Fichaje, ahora: number) {
  const fin = f.salida ? new Date(f.salida).getTime() : ahora
  const total = Math.max(0, Math.round((fin - new Date(f.entrada).getTime()) / 60000))
  const pausas = f.pausas.reduce((suma, p) => {
    const pf = p.fin ? new Date(p.fin).getTime() : ahora
    return suma + Math.max(0, Math.round((pf - new Date(p.inicio).getTime()) / 60000))
  }, 0)
  return { trabajado: Math.max(0, total - pausas), pausas }
}

export function PanelFichaje() {
  const { t } = useIdioma()
  const { hora, dia, duracion } = useFormatosFichaje()
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: abierto, isLoading } = useQuery({
    queryKey: ['fichaje', slug, 'abierto'],
    queryFn: () => api.fichajeAbierto(slug),
  })

  // Lo de hoy (para el acumulado) y la última jornada cerrada de la semana.
  const hoy = hoyMadrid()
  const { data: recientes } = useQuery({
    queryKey: ['fichaje', slug, 'lista', addDaysKey(hoy, -7), hoy],
    queryFn: () => api.fichajes(slug, { desde: addDaysKey(hoy, -7), hasta: hoy }),
  })

  // El reloj avanza solo: el acumulado se mira sin recargar.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['fichaje', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const fichar = useMutation({
    mutationFn: (que: 'entrada' | 'salida' | 'pausa' | 'reanudar') =>
      que === 'entrada'
        ? api.ficharEntrada(slug)
        : que === 'salida'
          ? api.ficharSalida(slug)
          : que === 'pausa'
            ? api.ficharPausa(slug)
            : api.ficharReanudar(slug),
    onSuccess: (_r, que) => {
      refrescar()
      setAhora(Date.now())
      const clave =
        que === 'entrada'
          ? 'fic.entradaHecha'
          : que === 'salida'
            ? 'fic.salidaHecha'
            : que === 'pausa'
              ? 'fic.pausaHecha'
              : 'fic.reanudadoHecho'
      aviso.ok(t(clave, { hora: hora(new Date().toISOString()) }))
    },
  })

  const jornada = abierto?.fichaje ?? null
  const dentro = !!jornada
  const enPausa = !!jornada?.enPausa
  const pausaAbierta = jornada?.pausas.find((p) => !p.fin)

  // Hoy: las jornadas cerradas de hoy más la abierta.
  const mias = useMemo(
    () => (recientes?.fichajes ?? []).filter((f) => !user || f.userId === user.id),
    [recientes, user],
  )
  const deHoy = mias.filter((f) => madridDateKey(f.entrada) === hoy && f.salida)
  const acumulado = deHoy.reduce(
    (acc, f) => {
      const m = minutosHasta(f, ahora)
      return { trabajado: acc.trabajado + m.trabajado, pausas: acc.pausas + m.pausas }
    },
    jornada ? minutosHasta(jornada, ahora) : { trabajado: 0, pausas: 0 },
  )
  const ultima = mias.find((f) => f.salida && madridDateKey(f.entrada) !== hoy)

  const estado =
    enPausa && pausaAbierta
      ? t('fic.enPausaDesde', { hora: hora(pausaAbierta.inicio) })
      : jornada
        ? t('fic.dentroDesde', { hora: hora(jornada.entrada) })
        : t('fic.estasFuera')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('panel.fichaje')} hint={t('fic.pistaMio')} />
      <PestanasSeccion seccion="fichaje" />

      <Card padded className="flex flex-col gap-6">
        {isLoading ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-14 w-full max-w-sm rounded-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <p
                className={cx(
                  'font-display text-heading-sm font-semibold',
                  enPausa ? 'text-body-2' : dentro ? 'text-brand-text' : 'text-ink',
                )}
                aria-live="polite"
              >
                {estado}
              </p>
              <p className="text-body text-muted">
                {dentro || acumulado.trabajado > 0 ? (
                  <>
                    {t('fic.hoyLlevas')}{' '}
                    <span className="font-semibold text-ink tabular-nums">
                      {duracion(acumulado.trabajado)}
                    </span>
                    {acumulado.pausas > 0 && (
                      <>
                        {' · '}
                        {t('fic.enPausaTotal', { tiempo: duracion(acumulado.pausas) })}
                      </>
                    )}
                  </>
                ) : (
                  t('fic.fichaAlEmpezar')
                )}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                variant={dentro ? 'secondary' : 'primary'}
                loading={
                  fichar.isPending &&
                  fichar.variables !== 'pausa' &&
                  fichar.variables !== 'reanudar'
                }
                disabled={fichar.isPending}
                onClick={() => fichar.mutate(dentro ? 'salida' : 'entrada')}
                className="sm:min-w-56"
              >
                {dentro ? t('fic.ficharSalida') : t('fic.ficharEntrada')}
              </Button>
              {dentro && (
                <Button
                  size="lg"
                  variant={enPausa ? 'primary' : 'secondary'}
                  loading={
                    fichar.isPending &&
                    (fichar.variables === 'pausa' || fichar.variables === 'reanudar')
                  }
                  disabled={fichar.isPending}
                  onClick={() => fichar.mutate(enPausa ? 'reanudar' : 'pausa')}
                  className="sm:min-w-44"
                >
                  {enPausa ? t('fic.reanudar') : t('fic.pausa')}
                </Button>
              )}
            </div>
            {dentro && <p className="text-meta text-subtle">{t('fic.pausasPista')}</p>}

            {fichar.isError && (
              <ErrorNote>
                {fichar.error instanceof ApiError ? fichar.error.message : t('fic.noSePudoFichar')}
              </ErrorNote>
            )}
          </>
        )}
      </Card>

      {ultima && (
        <Card padded>
          <h2 className="text-meta font-semibold tracking-[0.04em] text-muted uppercase">
            {t('fic.ultimaJornada')}
          </h2>
          <p className="mt-2 text-body text-ink first-letter:uppercase">
            {dia(ultima.entrada)} · {hora(ultima.entrada)} – {hora(ultima.salida!)}
            {' · '}
            <span className="font-semibold tabular-nums">{duracion(ultima.minutos ?? 0)}</span>
            {ultima.minutosPausa > 0 &&
              ` · ${t('fic.enPausaTotal', { tiempo: duracion(ultima.minutosPausa) })}`}
          </p>
          <Link
            to={`/panel/${slug}/fichaje/historial`}
            className="mt-2 inline-flex min-h-10 items-center text-meta font-semibold text-brand-text hover:underline"
          >
            {t('fic.verHistorial')}
          </Link>
        </Card>
      )}

      <p className="text-meta text-subtle">{t('fic.normativa')}</p>
    </div>
  )
}
