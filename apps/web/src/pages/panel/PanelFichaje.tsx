import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  Skeleton,
  cx,
} from '../../components/ui'

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

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

/** 485 → «8 h 5 min». Se lee mejor que 8,08 horas. */
const duracion = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
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
  const id = useId()
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
    onSuccess: onHecho,
  })

  const problema =
    motivo.trim().length < 3
      ? 'Escribe por qué se corrige.'
      : salida && new Date(salida) <= new Date(entrada)
        ? 'La salida no puede ser anterior a la entrada.'
        : null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!problema) corregir.mutate()
      }}
      className="border-t border-line bg-canvas/50 px-4 py-4 sm:px-5"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Entrada" htmlFor={`${id}-e`} required>
          <Input
            id={`${id}-e`}
            type="datetime-local"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
          />
        </Field>
        <Field label="Salida" htmlFor={`${id}-s`} hint="Vacío = jornada abierta">
          <Input
            id={`${id}-s`}
            type="datetime-local"
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
          />
        </Field>
        <Field label="Motivo" htmlFor={`${id}-m`} hint="Queda guardado" required>
          <Input
            id={`${id}-m`}
            placeholder="Se olvidó de fichar la salida"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Field>
      </div>

      {corregir.isError && (
        <div className="mt-3">
          <ErrorNote>
            {corregir.error instanceof ApiError
              ? corregir.error.message
              : 'No se ha podido corregir'}
          </ErrorNote>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="submit" loading={corregir.isPending} disabled={!!problema}>
          Guardar corrección
        </Button>
        <Button type="button" variant="quiet" onClick={onCancelar}>
          Cancelar
        </Button>
        {problema && <span className="text-meta text-muted">{problema}</span>}
      </div>
    </form>
  )
}

export function PanelFichaje() {
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null)

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
    onSuccess: refrescar,
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
        title="Fichaje"
        hint={
          puedeVerTodos
            ? 'El registro de jornada de todo el equipo.'
            : 'Tu registro de jornada. Solo lo ves tú y quien administra.'
        }
      />

      {/* El botón grande: lo que se viene a hacer aquí el 95 % de las veces. */}
      <Card padded>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-subheading font-semibold text-ink">
              {dentro ? 'Estás dentro' : 'Estás fuera'}
            </p>
            <p className="mt-1 text-body text-muted">
              {dentro && abierto?.fichaje
                ? `Entraste a las ${hora(abierto.fichaje.entrada)}.`
                : 'Ficha al empezar y al terminar tu jornada.'}
            </p>
          </div>
          <Button
            size="lg"
            variant={dentro ? 'secondary' : 'primary'}
            loading={fichar.isPending}
            onClick={() => fichar.mutate(dentro ? 'salida' : 'entrada')}
          >
            {dentro ? 'Fichar salida' : 'Fichar entrada'}
          </Button>
        </div>
        {fichar.isError && (
          <div className="mt-4">
            <ErrorNote>
              {fichar.error instanceof ApiError ? fichar.error.message : 'No se ha podido fichar'}
            </ErrorNote>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-body-2">Desde</span>
          <Input
            type="date"
            value={desde}
            max={hasta || hoy()}
            onChange={(e) => setDesde(e.target.value)}
            className="w-auto"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-semibold text-body-2">Hasta</span>
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
            Quitar filtro
          </Button>
        )}
        {puedeVerTodos && (
          <Button variant="secondary" className="ml-auto" onClick={exportar}>
            Descargar archivo
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
        <EmptyState
          title="Todavía no hay fichajes"
          hint="En cuanto alguien fiche su entrada aparecerá aquí."
        />
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
                      {!f.salida && <Badge tone="ok">Dentro ahora</Badge>}
                      {f.correccion && <Badge tone="warn">Corregido</Badge>}
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
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => setCorrigiendo(corrigiendo === f.id ? null : f.id)}
                    >
                      {corrigiendo === f.id ? 'Cerrar' : 'Corregir'}
                    </Button>
                  )}
                </div>

                {/* La corrección se enseña siempre, no solo al administrador:
                    quien trabaja tiene derecho a ver que le han tocado sus
                    horas y por qué. */}
                {f.correccion && (
                  <p
                    className={cx(
                      'px-4 pb-3 text-meta text-subtle sm:px-5',
                      corrigiendo === f.id && 'pb-4',
                    )}
                  >
                    Corregido por {f.correccion.por} ·{' '}
                    {f.correccion.entradaOriginal && (
                      <>
                        antes era {hora(f.correccion.entradaOriginal)} –{' '}
                        {f.correccion.salidaOriginal ? hora(f.correccion.salidaOriginal) : '…'}{' '}
                        ·{' '}
                      </>
                    )}
                    <span className="italic">{f.correccion.motivo}</span>
                  </p>
                )}

                {corrigiendo === f.id && (
                  <Corregir
                    f={f}
                    slug={slug}
                    onHecho={() => {
                      setCorrigiendo(null)
                      refrescar()
                    }}
                    onCancelar={() => setCorrigiendo(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-meta text-subtle">
        Cada persona ficha con su cuenta: nadie puede fichar por otro, y eso es lo que hace que el
        registro valga. Corregir un fichaje{' '}
        <strong className="font-semibold text-body-2">no borra lo que se fichó</strong>: se guarda
        la hora original, quién la cambió y por qué, y queda en Actividad. En España este registro
        es obligatorio y hay que conservarlo cuatro años.
      </p>
    </div>
  )
}
