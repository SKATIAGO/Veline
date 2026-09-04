import { useEffect, useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CATEGORIES } from '@veline/shared'
import { api, ApiError, type PanelProfile } from '../../lib/api'
import {
  Button,
  Card,
  ConfirmAction,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  SuccessNote,
  Textarea,
} from '../../components/ui'

/**
 * La ficha pública del negocio y sus cierres.
 *
 * Hasta ahora un negocio se creaba una vez y se quedaba congelado: no había
 * forma de corregir ni un teléfono. Los cierres tampoco tenían pantalla, así
 * que un local no podía cerrar por vacaciones aunque el motor de huecos ya
 * sabía respetarlos.
 */

const hoy = () => new Date().toISOString().slice(0, 10)

const formatoDia = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export function PanelNegocio() {
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const id = useId()

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['panel', slug, 'profile'],
    queryFn: () => api.panelProfile(slug),
  })

  const { data: cierres } = useQuery({
    queryKey: ['panel', slug, 'closures'],
    queryFn: () => api.panelClosures(slug),
  })

  const [form, setForm] = useState<PanelProfile | null>(null)
  const [tocado, setTocado] = useState(false)

  // El formulario arranca con lo que hay guardado y solo se rehace cuando
  // llegan datos nuevos del servidor, no en cada render.
  useEffect(() => {
    if (perfil) {
      setForm(perfil)
      setTocado(false)
    }
  }, [perfil])

  const guardar = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('Sin datos')
      const { slug: _s, photos: _p, ...resto } = form
      return api.saveProfile(slug, resto)
    },
    onSuccess: () => {
      setTocado(false)
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['business', slug] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const [desde, setDesde] = useState(hoy())
  const [hasta, setHasta] = useState(hoy())
  const [motivo, setMotivo] = useState('')

  const invalidarCierres = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug, 'closures'] })
    queryClient.invalidateQueries({ queryKey: ['availability', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const crearCierre = useMutation({
    mutationFn: () =>
      api.createClosure(slug, { from: desde, to: hasta, reason: motivo.trim() || undefined }),
    onSuccess: () => {
      setMotivo('')
      invalidarCierres()
    },
  })

  const borrarCierre = useMutation({
    mutationFn: (ids: string[]) => api.deleteClosure(slug, ids),
    onSuccess: invalidarCierres,
  })

  const set = <K extends keyof PanelProfile>(campo: K, valor: PanelProfile[K]) => {
    setForm((f) => (f ? { ...f, [campo]: valor } : f))
    setTocado(true)
  }

  if (isLoading || !form) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="El negocio" />
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Card>
      </div>
    )
  }

  const problema =
    form.name.trim().length < 2
      ? 'El nombre es demasiado corto.'
      : form.street.trim().length < 3
        ? 'Falta la calle.'
        : form.city.trim().length < 2
          ? 'Falta la ciudad.'
          : !/^\d{5}$/.test(form.postalCode.trim())
            ? 'El código postal son 5 cifras.'
            : form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)
              ? 'El email no es válido.'
              : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="El negocio"
        hint="Lo que ve un cliente en tu ficha del marketplace."
        actions={
          <>
            {tocado && <span className="text-meta text-muted">Cambios sin guardar</span>}
            <Button
              onClick={() => guardar.mutate()}
              loading={guardar.isPending}
              disabled={!tocado || !!problema}
            >
              Guardar
            </Button>
          </>
        }
      />

      {guardar.isError && (
        <ErrorNote>
          {guardar.error instanceof ApiError ? guardar.error.message : 'No se ha podido guardar'}
        </ErrorNote>
      )}
      {guardar.isSuccess && !tocado && <SuccessNote>Ficha guardada.</SuccessNote>}

      <Card padded>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor={`${id}-name`} required>
            <Input
              id={`${id}-name`}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>

          <Field
            label="Categoría"
            htmlFor={`${id}-cat`}
            hint="Determina en qué filtro del marketplace apareces"
            required
          >
            <Select
              id={`${id}-cat`}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Descripción"
            htmlFor={`${id}-desc`}
            hint="Un par de frases sobre el negocio"
            className="sm:col-span-2"
          >
            <Textarea
              id={`${id}-desc`}
              rows={3}
              maxLength={600}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>

          <Field label="Teléfono" htmlFor={`${id}-tel`} hint="Se muestra en la ficha">
            <Input
              id={`${id}-tel`}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>

          <Field
            label="Email"
            htmlFor={`${id}-mail`}
            hint="Aquí llegan los avisos de cita nueva y de cancelación"
          >
            <Input
              id={`${id}-mail`}
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>

          <Field label="Calle y número" htmlFor={`${id}-calle`} required className="sm:col-span-2">
            <Input
              id={`${id}-calle`}
              value={form.street}
              onChange={(e) => set('street', e.target.value)}
            />
          </Field>

          <Field label="Ciudad" htmlFor={`${id}-ciudad`} required>
            <Input
              id={`${id}-ciudad`}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
          </Field>

          <Field label="Código postal" htmlFor={`${id}-cp`} required>
            <Input
              id={`${id}-cp`}
              inputMode="numeric"
              maxLength={5}
              value={form.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
            />
          </Field>
        </div>

        {problema && <p className="mt-4 text-meta text-brand-text">{problema}</p>}

        <p className="mt-5 border-t border-line pt-4 text-meta text-subtle">
          La dirección web de tu ficha (
          <strong className="font-semibold text-body-2">/{form.slug}</strong>) no cambia aunque
          cambies el nombre: si cambiara, se romperían todos los enlaces que ya hayas compartido.
        </p>
      </Card>

      <div>
        <h2 className="mb-1 font-display text-subheading font-semibold text-ink">
          Vacaciones y festivos
        </h2>
        <p className="mb-4 text-body text-muted">
          Los días cerrados desaparecen del buscador: nadie podrá reservar en ellos.
        </p>

        <Card padded>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (hasta >= desde) crearCierre.mutate()
            }}
            className="grid gap-4 sm:grid-cols-[repeat(3,1fr)_auto] sm:items-end"
          >
            <Field label="Desde" htmlFor={`${id}-desde`} required>
              <Input
                id={`${id}-desde`}
                type="date"
                value={desde}
                min={hoy()}
                onChange={(e) => {
                  setDesde(e.target.value)
                  if (hasta < e.target.value) setHasta(e.target.value)
                }}
              />
            </Field>
            <Field label="Hasta" htmlFor={`${id}-hasta`} required>
              <Input
                id={`${id}-hasta`}
                type="date"
                value={hasta}
                min={desde}
                invalid={hasta < desde}
                onChange={(e) => setHasta(e.target.value)}
              />
            </Field>
            <Field label="Motivo" htmlFor={`${id}-motivo`} hint="Opcional, solo lo ves tú">
              <Input
                id={`${id}-motivo`}
                placeholder="Vacaciones"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={crearCierre.isPending} disabled={hasta < desde}>
              Cerrar esos días
            </Button>
          </form>

          {crearCierre.isError && (
            <div className="mt-4">
              <ErrorNote>
                {crearCierre.error instanceof ApiError
                  ? crearCierre.error.message
                  : 'No se ha podido cerrar'}
              </ErrorNote>
            </div>
          )}

          {crearCierre.isSuccess && crearCierre.data.affectedBookings > 0 && (
            <div className="mt-4">
              <ErrorNote>
                Ojo: hay {crearCierre.data.affectedBookings}{' '}
                {crearCierre.data.affectedBookings === 1
                  ? 'cita ya reservada'
                  : 'citas ya reservadas'}{' '}
                dentro de esos días. No se han tocado — muévelas o cancélalas desde la agenda.
              </ErrorNote>
            </div>
          )}
        </Card>

        {cierres && cierres.length > 0 && (
          <Card className="mt-4 overflow-hidden">
            <ul>
              {cierres.map((c) => (
                <li
                  key={c.ids[0]}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
                >
                  <div className="min-w-[220px] flex-1">
                    <div className="text-ui font-semibold text-ink">
                      {c.from === c.to
                        ? formatoDia(c.from)
                        : `Del ${formatoDia(c.from)} al ${formatoDia(c.to)}`}
                    </div>
                    <p className="mt-0.5 text-meta text-muted">
                      {c.ids.length} {c.ids.length === 1 ? 'día' : 'días'}
                      {c.reason && ` · ${c.reason}`}
                    </p>
                  </div>
                  <div className="ml-auto sm:ml-0">
                    <ConfirmAction
                      label="Quitar"
                      confirmLabel="Sí, abrir"
                      loading={borrarCierre.isPending}
                      onConfirm={() => borrarCierre.mutate(c.ids)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {borrarCierre.isError && (
          <div className="mt-4">
            <ErrorNote>No se ha podido quitar el cierre.</ErrorNote>
          </div>
        )}
      </div>
    </div>
  )
}
