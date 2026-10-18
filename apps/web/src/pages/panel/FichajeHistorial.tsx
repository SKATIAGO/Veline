import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hoyMadrid, madridLocalAInstante } from '@veline/shared'
import { api, type Fichaje } from '../../lib/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  cx,
} from '../../components/ui'
import { PestanasSeccion } from '../../components/PestanasSeccion'
import { Texto, useIdioma } from '../../i18n/idioma'
import { aviso, textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'
import { paraInput, useFormatosFichaje } from './fichajeComun'

/**
 * El histórico del registro de jornada.
 *
 * Un empleado ve solo lo suyo y puede descargarlo; quien administra ve el de
 * todos, corrige y añade lo olvidado. Cada corrección se enseña entera —lo
 * de antes, lo de después, quién y por qué— porque un registro que no deje
 * ver que se ha tocado no vale como registro.
 *
 * En escritorio es una tabla; en el móvil, filas apiladas con lo mismo.
 */

function Corregir({
  f,
  slug,
  onHecho,
  onCancelar,
}: {
  f: Fichaje
  slug: string
  onHecho: () => void
  onCancelar: () => void
}) {
  const { t, hora, dia } = useFormatosFichaje()
  const id = useId()
  const [intentado, setIntentado] = useState(false)
  const [entrada, setEntrada] = useState(paraInput(f.entrada))
  const [salida, setSalida] = useState(f.salida ? paraInput(f.salida) : '')
  const [motivo, setMotivo] = useState('')

  const corregir = useMutation({
    mutationFn: () =>
      api.corregirFichaje(slug, f.id, {
        entrada: madridLocalAInstante(entrada).toISOString(),
        salida: salida ? madridLocalAInstante(salida).toISOString() : null,
        motivo: motivo.trim(),
      }),
    onSuccess: () => {
      aviso.ok(t('fic.corregidoHecho'))
      onHecho()
    },
  })

  const problema =
    motivo.trim().length < 3
      ? t('fic.errMotivo')
      : salida && madridLocalAInstante(salida) <= madridLocalAInstante(entrada)
        ? t('fic.errSalida')
        : null

  return (
    <FormDialog
      open
      onClose={onCancelar}
      title={t('fic.corregirTitulo', { quien: f.persona })}
      hint={t('fic.corregirPista', {
        dia: dia(f.entrada),
        desde: hora(f.entrada),
        hasta: f.salida ? hora(f.salida) : '…',
      })}
      submitLabel={t('fic.guardarCorreccion')}
      onSubmit={() => {
        setIntentado(true)
        if (!problema) corregir.mutate()
      }}
      loading={corregir.isPending}
      error={corregir.isError ? textoDeError(corregir.error, t('fic.noSePudoCorregir')) : null}
      dirty={
        entrada !== paraInput(f.entrada) ||
        salida !== (f.salida ? paraInput(f.salida) : '') ||
        motivo.trim() !== ''
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fic.entrada')} htmlFor={`${id}-e`} required>
          <Input
            id={`${id}-e`}
            type="datetime-local"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
          />
        </Field>
        <Field label={t('fic.salida')} htmlFor={`${id}-s`} hint={t('fic.salidaPista')}>
          <Input
            id={`${id}-s`}
            type="datetime-local"
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
          />
        </Field>
        <Field
          label={t('fic.motivo')}
          htmlFor={`${id}-m`}
          hint={t('fic.motivoPista')}
          required
          className="sm:col-span-2"
        >
          <Input id={`${id}-m`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
      </div>

      {intentado && problema && <ErrorNote>{problema}</ErrorNote>}
    </FormDialog>
  )
}

function Anadir({
  slug,
  onHecho,
  onCancelar,
}: {
  slug: string
  onHecho: () => void
  onCancelar: () => void
}) {
  const { t } = useIdioma()
  const id = useId()
  const [intentado, setIntentado] = useState(false)
  const [userId, setUserId] = useState('')
  const [entrada, setEntrada] = useState('')
  const [salida, setSalida] = useState('')
  const [motivo, setMotivo] = useState('')

  const { data: personas } = useQuery({
    queryKey: ['panel', slug, 'users'],
    queryFn: () => api.panelUsers(slug),
  })
  const elegida = userId || personas?.[0]?.id || ''

  const anadir = useMutation({
    mutationFn: () =>
      api.anadirFichaje(slug, {
        userId: elegida,
        entrada: madridLocalAInstante(entrada).toISOString(),
        salida: madridLocalAInstante(salida).toISOString(),
        motivo: motivo.trim(),
      }),
    onSuccess: () => {
      aviso.ok(t('fic.anadidoHecho'))
      onHecho()
    },
  })

  const problema = !elegida
    ? t('fic.errPersona')
    : !entrada || !salida
      ? t('fic.errFechas')
      : madridLocalAInstante(salida) <= madridLocalAInstante(entrada)
        ? t('fic.errSalida')
        : madridLocalAInstante(salida) > new Date()
          ? t('fic.errFuturo')
          : motivo.trim().length < 3
            ? t('fic.errMotivoAnadir')
            : null

  return (
    <FormDialog
      open
      onClose={onCancelar}
      title={t('fic.anadirTitulo')}
      hint={t('fic.anadirPista')}
      submitLabel={t('fic.guardarAnadido')}
      onSubmit={() => {
        setIntentado(true)
        if (!problema) anadir.mutate()
      }}
      loading={anadir.isPending}
      error={anadir.isError ? textoDeError(anadir.error, t('fic.noSePudoAnadir')) : null}
      dirty={!!entrada || !!salida || motivo.trim() !== ''}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fic.persona')} htmlFor={`${id}-p`} required className="sm:col-span-2">
          <Select id={`${id}-p`} value={elegida} onChange={(e) => setUserId(e.target.value)}>
            {(personas ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('fic.entrada')} htmlFor={`${id}-e`} required>
          <Input
            id={`${id}-e`}
            type="datetime-local"
            value={entrada}
            max={paraInput(new Date().toISOString())}
            onChange={(e) => setEntrada(e.target.value)}
          />
        </Field>
        <Field label={t('fic.salida')} htmlFor={`${id}-s`} required>
          <Input
            id={`${id}-s`}
            type="datetime-local"
            value={salida}
            min={entrada || undefined}
            max={paraInput(new Date().toISOString())}
            onChange={(e) => setSalida(e.target.value)}
          />
        </Field>
        <Field
          label={t('fic.motivo')}
          htmlFor={`${id}-m`}
          hint={t('fic.motivoPista')}
          required
          className="sm:col-span-2"
        >
          <Input id={`${id}-m`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
      </div>

      {intentado && problema && <ErrorNote>{problema}</ErrorNote>}
    </FormDialog>
  )
}

/** Las correcciones de una jornada, todas, en orden. */
function Correcciones({ f }: { f: Fichaje }) {
  const { t, hora, diaCorto } = useFormatosFichaje()
  if (f.correcciones.length === 0) return null
  const tramo = (e: string | null, s: string | null) =>
    e ? `${hora(e)}–${s ? hora(s) : '…'}` : '—'
  return (
    <details className="text-meta text-subtle">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-semibold text-body-2 [&::-webkit-details-marker]:hidden">
        {t('fic.correcciones')} ({f.correcciones.length})<span aria-hidden>▾</span>
      </summary>
      <ul className="mt-1 flex flex-col gap-1">
        {f.correcciones.map((c, i) => (
          <li key={i}>
            {t(c.entradaAntes ? 'fic.correccionLinea' : 'fic.anadidoLinea', {
              quien: c.por,
              cuando: diaCorto(c.cuando),
              antes: tramo(c.entradaAntes, c.salidaAntes),
              despues: tramo(c.entradaDespues, c.salidaDespues),
            })}
            {' · '}
            <span className="italic">{c.motivo}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export function FichajeHistorial() {
  const { t, hora, dia, diaCorto, duracion } = useFormatosFichaje()
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [corrigiendo, setCorrigiendo] = useState<Fichaje | null>(null)
  const [anadiendo, setAnadiendo] = useState(false)

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['fichaje', slug, 'lista', desde, hasta],
    queryFn: () => api.fichajes(slug, { desde: desde || undefined, hasta: hasta || undefined }),
    // Al cambiar de mes o de filtro se queda lo anterior, atenuado, hasta que
    // llega lo nuevo: la pantalla no se vacía ni cambia de alto.
    placeholderData: keepPreviousData,
  })

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['fichaje', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const puedeVerTodos = data?.puedeVerTodos ?? false

  const exportar = () => {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const qs = params.toString()
    window.location.assign(`/api/panel/${slug}/fichajes/export${qs ? `?${qs}` : ''}`)
  }

  const insignias = (f: Fichaje) => (
    <>
      {!f.salida && <Badge tone="ok">{t('fic.dentroAhora')}</Badge>}
      {f.correcciones.length > 0 && (
        <Badge tone="warn">
          {f.correcciones[0]?.entradaAntes ? t('fic.corregido') : t('fic.anadidoBadge')}
        </Badge>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.fichaje')}
        hint={puedeVerTodos ? t('fic.pistaTodos') : t('fic.pistaMio')}
        actions={
          puedeVerTodos && (
            <Button variant="secondary" onClick={() => setAnadiendo(true)}>
              {t('fic.anadir')}
            </Button>
          )
        }
      />
      <PestanasSeccion seccion="fichaje" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-meta font-semibold text-body-2">{t('fic.desde')}</span>
            <Input
              type="date"
              value={desde}
              max={hasta || hoyMadrid()}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full min-w-0"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-meta font-semibold text-body-2">{t('fic.hasta')}</span>
            <Input
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full min-w-0"
            />
          </label>
        </div>
        {(desde || hasta) && (
          <Button
            variant="quiet"
            onClick={() => {
              setDesde('')
              setHasta('')
            }}
          >
            {t('fic.quitarFiltro')}
          </Button>
        )}
        <Button variant="secondary" className="sm:ml-auto" onClick={exportar}>
          {puedeVerTodos ? t('fic.descargar') : t('fic.descargarMio')}
        </Button>
      </div>

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !data?.fichajes.length ? (
        <EmptyState title={t('fic.todaviaNoHay')} hint={t('fic.todaviaNoHayPista')} />
      ) : (
        <div
          aria-busy={isPlaceholderData || undefined}
          className={cx('transition-opacity duration-150', isPlaceholderData && 'opacity-60')}
        >
          {/* Escritorio: tabla. */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-body">
              <thead className="bg-cream text-left text-caption font-semibold tracking-[0.04em] text-muted uppercase">
                <tr>
                  {puedeVerTodos && <th className="px-4 py-3">{t('fic.columnaPersona')}</th>}
                  <th className="px-4 py-3">{t('fic.columnaDia')}</th>
                  <th className="px-4 py-3">{t('fic.columnaHoras')}</th>
                  <th className="px-4 py-3 text-right">{t('fic.columnaPausas')}</th>
                  <th className="px-4 py-3 text-right">{t('fic.columnaTotal')}</th>
                  {puedeVerTodos && (
                    <th className="px-4 py-3">
                      <span className="sr-only">{t('fic.corregir')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.fichajes.map((f) => (
                  <tr key={f.id} className="border-t border-line align-top">
                    {puedeVerTodos && (
                      <td className="px-4 py-3">
                        <span className="font-semibold text-ink">{f.persona}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-body-2 first-letter:uppercase">
                      {diaCorto(f.entrada)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 tabular-nums">
                        <span className="text-ink">
                          {hora(f.entrada)} – {f.salida ? hora(f.salida) : '…'}
                        </span>
                        {insignias(f)}
                      </div>
                      <Correcciones f={f} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted tabular-nums">
                      {f.minutosPausa > 0 ? duracion(f.minutosPausa) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">
                      {f.minutos === null ? '—' : duracion(f.minutos)}
                    </td>
                    {puedeVerTodos && (
                      <td className="px-2 py-2 text-right">
                        <Button size="sm" variant="quiet" onClick={() => setCorrigiendo(f)}>
                          {t('fic.corregir')}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Móvil: filas. */}
          <Card className="overflow-hidden md:hidden">
            <ul>
              {data.fichajes.map((f) => (
                <li key={f.id} className="border-b border-line px-4 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {puedeVerTodos && (
                          <span className="text-ui font-semibold text-ink">{f.persona}</span>
                        )}
                        {insignias(f)}
                      </div>
                      <p
                        className={cx(
                          'text-meta text-muted first-letter:uppercase',
                          puedeVerTodos && 'mt-0.5',
                        )}
                      >
                        {dia(f.entrada)}
                      </p>
                      <p className="mt-1 text-body text-ink tabular-nums">
                        {hora(f.entrada)} – {f.salida ? hora(f.salida) : '…'}
                        {f.minutosPausa > 0 && (
                          <span className="text-muted">
                            {' · '}
                            {t('fic.enPausaTotal', { tiempo: duracion(f.minutosPausa) })}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-ui font-semibold text-ink tabular-nums">
                        {f.minutos === null ? '—' : duracion(f.minutos)}
                      </p>
                      {puedeVerTodos && (
                        <Button
                          size="sm"
                          variant="quiet"
                          className="-mr-2"
                          onClick={() => setCorrigiendo(f)}
                        >
                          {t('fic.corregir')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <Correcciones f={f} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {anadiendo && (
        <Anadir
          slug={slug}
          onHecho={() => {
            setAnadiendo(false)
            refrescar()
          }}
          onCancelar={() => setAnadiendo(false)}
        />
      )}

      {corrigiendo && (
        <Corregir
          key={corrigiendo.id}
          f={corrigiendo}
          slug={slug}
          onHecho={() => {
            setCorrigiendo(null)
            refrescar()
          }}
          onCancelar={() => setCorrigiendo(null)}
        />
      )}

      <p className="text-meta text-subtle">
        <Texto
          clave="fic.aviso"
          partes={{
            negrita: <strong className="font-semibold text-body-2">{t('fic.avisoNegrita')}</strong>,
          }}
        />
      </p>
    </div>
  )
}
