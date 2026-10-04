import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type PanelLocal } from '../../lib/api'
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Skeleton,
  useALaVista,
} from '../../components/ui'
import { Texto, useIdioma, usePlural } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'

/**
 * Los locales del negocio.
 *
 * Cada uno tiene SU horario y SUS personas, así que abrir uno nuevo no es solo
 * añadir una dirección: hasta que no tenga horario y alguien que atienda, no
 * ofrece ni un hueco. Por eso cada fila dice qué le falta en vez de dejar que
 * lo descubra el dueño cuando un cliente le diga que no puede reservar.
 */

const vacio = { name: '', street: '', city: '', postalCode: '' }

function Formulario({
  inicial,
  titulo,
  enviando,
  error,
  onGuardar,
  onCancelar,
}: {
  inicial: typeof vacio
  titulo: string
  enviando: boolean
  error?: string | null
  onGuardar: (d: typeof vacio) => void
  onCancelar: () => void
}) {
  const { t } = useIdioma()
  const id = useId()
  const [form, setForm] = useState(inicial)
  const set = (k: keyof typeof vacio, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const problema =
    form.name.trim().length < 2
      ? t('loc.errNombre')
      : form.street.trim().length < 3
        ? t('loc.errCalle')
        : form.city.trim().length < 2
          ? t('loc.errCiudad')
          : !/^\d{5}$/.test(form.postalCode.trim())
            ? t('loc.errCp')
            : null

  return (
    <Card padded>
      <h2 className="mb-4 text-ui font-semibold text-ink">{titulo}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!problema) onGuardar(form)
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('loc.nombre')} htmlFor={`${id}-n`} hint={t('loc.nombrePista')} required>
            <Input id={`${id}-n`} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label={t('loc.calle')} htmlFor={`${id}-c`} required>
            <Input
              id={`${id}-c`}
              value={form.street}
              onChange={(e) => set('street', e.target.value)}
            />
          </Field>
          <Field label={t('loc.ciudad')} htmlFor={`${id}-ci`} required>
            <Input
              id={`${id}-ci`}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
          </Field>
          <Field label={t('loc.cp')} htmlFor={`${id}-cp`} required>
            <Input
              id={`${id}-cp`}
              inputMode="numeric"
              maxLength={5}
              value={form.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
            />
          </Field>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={enviando} disabled={!!problema}>
            {t('loc.guardar')}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancelar}>
            {t('loc.cancelar')}
          </Button>
          {problema && <span className="text-meta text-muted">{problema}</span>}
        </div>
      </form>
    </Card>
  )
}

export function PanelLocales() {
  const { t } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<PanelLocal | null>(null)
  const [aCerrar, setACerrar] = useState<PanelLocal | null>(null)
  const vistaNuevo = useALaVista<HTMLDivElement>(creando)
  const vistaEditar = useALaVista<HTMLDivElement>(editando?.id)

  const { data: locales, isLoading } = useQuery({
    queryKey: ['panel', slug, 'locales'],
    queryFn: () => api.panelLocales(slug),
  })

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    queryClient.invalidateQueries({ queryKey: ['business', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const crear = useMutation({
    mutationFn: (d: typeof vacio) => api.crearLocal(slug, d),
    onSuccess: (_r, d) => {
      setCreando(false)
      refrescar()
      aviso.ok(t('loc.creado', { nombre: d.name }))
    },
  })

  const editar = useMutation({
    mutationFn: (d: typeof vacio) => api.editarLocal(slug, editando!.id, d),
    onSuccess: () => {
      setEditando(null)
      refrescar()
      aviso.ok(t('avisos.guardado'))
    },
  })

  const cerrar = useMutation({
    mutationFn: (l: PanelLocal) => api.cerrarLocal(slug, l.id),
    onSuccess: (_r, l) => {
      setACerrar(null)
      refrescar()
      aviso.ok(t('loc.cerrado', { nombre: l.name }))
    },
  })

  const mensaje = (e: unknown) => (e instanceof ApiError ? e.message : t('loc.noSePudoGuardar'))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.locales')}
        hint={locales ? plural(locales.length, 'loc.unLocal', 'loc.variosLocales') : undefined}
        actions={
          !creando &&
          !editando && <Button onClick={() => setCreando(true)}>{t('loc.abrir')}</Button>
        }
      />

      {creando && (
        <div ref={vistaNuevo} className="scroll-mt-4">
          <Formulario
            inicial={vacio}
            titulo={t('loc.nuevo')}
            enviando={crear.isPending}
            error={crear.isError ? mensaje(crear.error) : null}
            onGuardar={(d) => crear.mutate(d)}
            onCancelar={() => setCreando(false)}
          />
        </div>
      )}

      {editando && (
        <div ref={vistaEditar} className="scroll-mt-4">
          <Formulario
            inicial={{
              name: editando.name,
              street: editando.street,
              city: editando.city,
              postalCode: editando.postalCode,
            }}
            titulo={t('loc.editarComillas', { nombre: editando.name })}
            enviando={editar.isPending}
            error={editar.isError ? mensaje(editar.error) : null}
            onGuardar={(d) => editar.mutate(d)}
            onCancelar={() => setEditando(null)}
          />
        </div>
      )}

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {(locales ?? []).map((l) => {
              // Un local sin horario o sin nadie que atienda no ofrece huecos:
              // existe, pero no se puede reservar en él.
              const falta = [
                !l.tieneHorario && t('loc.faltaHorario'),
                l.personas === 0 && t('loc.faltaPersonas'),
              ].filter(Boolean)

              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
                >
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-ink">{l.name}</span>
                      {!l.approved && <Badge tone="warn">{t('loc.pendienteAprobar')}</Badge>}
                      {falta.length > 0 && <Badge tone="warn">{t('loc.noAceptaReservas')}</Badge>}
                    </div>
                    <p className="mt-0.5 text-meta text-muted">
                      {l.street}, {l.postalCode} {l.city}
                    </p>
                    {!l.approved && (
                      <p className="mt-1 text-meta text-brand-text">
                        {t('loc.pendienteAprobarPista')}
                      </p>
                    )}
                    {falta.length > 0 && (
                      <p className="mt-1 text-meta text-brand-text">
                        {t('loc.leFalta', { que: falta.join(t('loc.y')) })}
                      </p>
                    )}
                  </div>

                  <dl className="flex gap-5 text-meta text-muted">
                    {[
                      [t('loc.personas'), l.personas],
                      [t('loc.citas'), l.citas],
                    ].map(([et, n]) => (
                      <div key={et as string}>
                        <dt className="text-caption">{et}</dt>
                        <dd className="font-semibold text-body-2 tabular-nums">{n}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="ml-auto flex flex-wrap justify-end gap-1 sm:ml-0">
                    <Button size="sm" variant="quiet" onClick={() => setEditando(l)}>
                      {t('loc.editar')}
                    </Button>
                    {(locales ?? []).length > 1 && (
                      <Button size="sm" variant="danger" onClick={() => setACerrar(l)}>
                        {t('loc.cerrar')}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Con citas no se puede: el servidor lo rechaza porque se perdería su
          historial. Se dice antes, en vez de dejar pulsar «Sí» y fallar. */}
      <ConfirmDialog
        open={!!aCerrar}
        onClose={() => {
          cerrar.reset()
          setACerrar(null)
        }}
        title={t('loc.cerrarTitulo', { nombre: aCerrar?.name ?? '' })}
        imposible={!!aCerrar && aCerrar.citas > 0}
        consecuencias={
          aCerrar && aCerrar.citas > 0
            ? [
                plural(aCerrar.citas, 'loc.cerrarConUnaCita', 'loc.cerrarConCitas'),
                t('loc.cerrarAlternativa'),
              ]
            : [
                t('loc.cerrarC1'),
                t('loc.cerrarC2'),
                ...(aCerrar && aCerrar.personasPropias > 0
                  ? [plural(aCerrar.personasPropias, 'loc.cerrarC3Una', 'loc.cerrarC3Varias')]
                  : []),
                t('loc.cerrarC4'),
              ]
        }
        confirmLabel={t('loc.cerrarLocal')}
        tono="destruir"
        onConfirm={() => aCerrar && cerrar.mutate(aCerrar)}
        loading={cerrar.isPending}
        error={cerrar.isError ? textoDeError(cerrar.error, t('loc.noSePudoGuardar')) : null}
      />

      <p className="text-meta text-subtle">
        <Texto
          clave="loc.aviso"
          partes={{
            horario: (
              <Link
                to={`/panel/${slug}/horario`}
                className="font-semibold text-brand-text hover:underline"
              >
                {t('loc.avisoHorario')}
              </Link>
            ),
            personas: (
              <Link
                to={`/panel/${slug}/personas`}
                className="font-semibold text-brand-text hover:underline"
              >
                {t('loc.avisoPersonas')}
              </Link>
            ),
          }}
        />
      </p>
    </div>
  )
}
