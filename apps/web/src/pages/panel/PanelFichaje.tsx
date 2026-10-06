import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDuration } from '@veline/shared'
import { api, ApiError, type Fichaje } from '../../lib/api'
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
} from '../../components/ui'
import { Texto, useIdioma } from '../../i18n/idioma'
import { aviso, textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'

/**
 * Registro de jornada.
 *
 * Ficha cada uno con su cuenta: no hay forma de fichar por otro. Es lo que
 * hace que el registro valga como registro — quien ficha ha metido su
 * contraseña.
 *
 * Un empleado ve solo lo suyo. El administrador ve el de todos, puede
 * corregir un olvido y sacar el archivo para la Inspección.
 */

/**
 * Los formatos de esta pantalla, en el idioma de quien mira.
 *
 * Van juntos porque los usan las tres piezas del fichaje y todas necesitan lo
 * mismo: la hora, el día y la duración de una jornada.
 */
function useFormatos() {
  const { t, idioma, locale } = useIdioma()

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  const dia = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  /* La duración la escribe formatDuration, la misma de los servicios: 485 →
     «8 h 5 min». Tenerla dos veces acabó con el panel diciendo «1 hr 30 min»
     en un sitio y «8 h 5 min» en el otro dentro de la misma pantalla. */
  const duracion = (min: number) => formatDuration(min, idioma)

  return { t, hora, dia, duracion }
}

/** Fecha y hora en el formato que espera un <input type="datetime-local">. */
function paraInput(iso: string) {
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** El día de hoy en YYYY-MM-DD, para el filtro. */
const hoy = () => new Date().toISOString().slice(0, 10)

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
  const { t, hora, dia } = useFormatos()
  const id = useId()
  const [intentado, setIntentado] = useState(false)
  const [entrada, setEntrada] = useState(paraInput(f.entrada))
  const [salida, setSalida] = useState(f.salida ? paraInput(f.salida) : '')
  const [motivo, setMotivo] = useState('')

  const corregir = useMutation({
    mutationFn: () =>
      api.corregirFichaje(slug, f.id, {
        entrada: new Date(entrada).toISOString(),
        salida: salida ? new Date(salida).toISOString() : null,
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
      : salida && new Date(salida) <= new Date(entrada)
        ? t('fic.errSalida')
        : null

  /* En su diálogo, con el original a la vista: antes se desplegaba bajo la
     fila. La corrección guarda las dos horas y quién la hizo; el original no
     se pierde nunca (ver el modelo Fichaje). */
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

/**
 * Añadir el fichaje que alguien se olvidó de hacer.
 *
 * Corregir solo vale si hay algo fichado que corregir: quien no fichó en todo
 * el día no tenía nada que tocar. Se añade con su entrada, su salida y por
 * qué, y queda marcado como añadido: en la pantalla y en el archivo, para que
 * no se confunda con una jornada que fichó él mismo.
 */
function Anadir({
  slug,
  onHecho,
  onCancelar,
}: {
  slug: string
  onHecho: () => void
  onCancelar: () => void
}) {
  const { t } = useFormatos()
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
        entrada: new Date(entrada).toISOString(),
        salida: new Date(salida).toISOString(),
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
      : new Date(salida) <= new Date(entrada)
        ? t('fic.errSalida')
        : new Date(salida) > new Date()
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

export function PanelFichaje() {
  const { t, hora, dia, duracion } = useFormatos()
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [corrigiendo, setCorrigiendo] = useState<Fichaje | null>(null)
  const [anadiendo, setAnadiendo] = useState(false)

  const { data: abierto } = useQuery({
    queryKey: ['fichaje', slug, 'abierto'],
    queryFn: () => api.fichajeAbierto(slug),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['fichaje', slug, 'lista', desde, hasta],
    queryFn: () => api.fichajes(slug, { desde: desde || undefined, hasta: hasta || undefined }),
  })

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['fichaje', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const fichar = useMutation({
    mutationFn: (que: 'entrada' | 'salida') =>
      que === 'entrada' ? api.ficharEntrada(slug) : api.ficharSalida(slug),
    onSuccess: (_r, que) => {
      refrescar()
      aviso.ok(
        t(que === 'entrada' ? 'fic.entradaHecha' : 'fic.salidaHecha', {
          hora: hora(new Date().toISOString()),
        }),
      )
    },
  })

  const dentro = !!abierto?.fichaje
  const puedeVerTodos = data?.puedeVerTodos ?? false

  const exportar = () => {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const qs = params.toString()
    window.location.assign(`/api/panel/${slug}/fichajes/export${qs ? `?${qs}` : ''}`)
  }

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

      {/* El botón grande: lo que se viene a hacer aquí el 95 % de las veces. */}
      <Card padded>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-subheading font-semibold text-ink">
              {dentro ? t('fic.estasDentro') : t('fic.estasFuera')}
            </p>
            <p className="mt-1 text-body text-muted">
              {dentro && abierto?.fichaje
                ? t('fic.entrasteALas', { hora: hora(abierto.fichaje.entrada) })
                : t('fic.fichaAlEmpezar')}
            </p>
          </div>
          <Button
            size="lg"
            variant={dentro ? 'secondary' : 'primary'}
            loading={fichar.isPending}
            onClick={() => fichar.mutate(dentro ? 'salida' : 'entrada')}
          >
            {dentro ? t('fic.ficharSalida') : t('fic.ficharEntrada')}
          </Button>
        </div>
        {fichar.isError && (
          <div className="mt-4">
            <ErrorNote>
              {fichar.error instanceof ApiError ? fichar.error.message : t('fic.noSePudoFichar')}
            </ErrorNote>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-body-2">{t('fic.desde')}</span>
          <Input
            type="date"
            value={desde}
            max={hasta || hoy()}
            onChange={(e) => setDesde(e.target.value)}
            className="w-auto"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-body-2">{t('fic.hasta')}</span>
          <Input
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="w-auto"
          />
        </label>
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
        {puedeVerTodos && (
          <Button variant="secondary" className="ml-auto" onClick={exportar}>
            {t('fic.descargar')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !data?.fichajes.length ? (
        <EmptyState title={t('fic.todaviaNoHay')} hint={t('fic.todaviaNoHayPista')} />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {data.fichajes.map((f) => (
              <li key={f.id} className="border-b border-line last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-5">
                  <div className="min-w-[170px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {puedeVerTodos && (
                        <span className="text-ui font-semibold text-ink">{f.persona}</span>
                      )}
                      {!f.salida && <Badge tone="ok">{t('fic.dentroAhora')}</Badge>}
                      {f.correccion && (
                        <Badge tone="warn">
                          {f.correccion.entradaOriginal
                            ? t('fic.corregido')
                            : t('fic.anadidoBadge')}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-meta text-muted first-letter:uppercase">
                      {dia(f.entrada)}
                    </p>
                  </div>

                  <div className="text-body text-ink tabular-nums">
                    {hora(f.entrada)} – {f.salida ? hora(f.salida) : '…'}
                  </div>

                  <div className="w-[92px] text-right text-ui font-semibold text-ink tabular-nums">
                    {f.minutos === null ? '—' : duracion(f.minutos)}
                  </div>

                  {puedeVerTodos && (
                    <Button size="sm" variant="quiet" onClick={() => setCorrigiendo(f)}>
                      {t('fic.corregir')}
                    </Button>
                  )}
                </div>

                {/* La corrección se enseña siempre, no solo al administrador:
                    quien trabaja tiene derecho a ver que le han tocado sus
                    horas y por qué. */}
                {f.correccion && (
                  <p className="px-4 pb-3 text-meta text-subtle sm:px-5">
                    {t(f.correccion.entradaOriginal ? 'fic.corregidoPor' : 'fic.anadidoPor', {
                      quien: f.correccion.por,
                    })}{' '}
                    ·{' '}
                    {f.correccion.entradaOriginal && (
                      <>
                        {t('fic.antesEra', {
                          desde: hora(f.correccion.entradaOriginal),
                          hasta: f.correccion.salidaOriginal
                            ? hora(f.correccion.salidaOriginal)
                            : '…',
                        })}{' '}
                        ·{' '}
                      </>
                    )}
                    <span className="italic">{f.correccion.motivo}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
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
