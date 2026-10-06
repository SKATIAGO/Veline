import { useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  extrasParam,
  formatDuration,
  formatLongDate,
  formatPrice,
  normalizarTelefono,
  phoneES,
  TIMEZONE,
} from '@veline/shared'
import { api, type PanelCustomer } from '../../lib/api'
import {
  Contador,
  ErrorNote,
  Field,
  Input,
  MAX_POR_EXTRA,
  Select,
  Skeleton,
  cx,
} from '../../components/ui'
import { Texto, useIdioma, usePlural } from '../../i18n/idioma'
import { aviso, textoDeError } from '../../components/Avisos'
import { Wizard } from '../../components/Wizard'
import { SlotPicker } from '../../components/SlotPicker'

/** Para comparar con los teléfonos guardados, que van siempre normalizados. */
const cifras = normalizarTelefono

/**
 * Apuntar la cita que entra por teléfono o por la puerta, paso a paso.
 *
 * Antes era un formulario encima de la agenda: la hora se escribía a mano sin
 * saber si había sitio, no se veía quién estaba libre y el cliente se tecleaba
 * entero aunque ya hubiera venido diez veces. Ahora: el servicio y sus
 * extras, con quién y uno de los huecos que de verdad caben, el cliente (que
 * se encuentra por su teléfono o su nombre) y un repaso antes de que le llegue
 * la confirmación.
 */
export function ApuntarCita({
  slug,
  open,
  onClose,
  diaInicial,
  clienteInicial,
  alApuntar,
}: {
  slug: string
  open: boolean
  onClose: () => void
  /** El día del calendario desde el que se abrió. */
  diaInicial?: string
  /** El cliente de la ficha desde la que se pidió «Nueva cita para…». */
  clienteInicial?: Pick<PanelCustomer, 'name' | 'phone' | 'email'> | null
  /** Para el «Ver» del aviso: lleva a donde ha caído la cita. */
  alApuntar?: (cuando: Date) => (() => void) | undefined
}) {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const id = useId()
  const queryClient = useQueryClient()

  const [paso, setPaso] = useState(0)
  const [serviceId, setServiceId] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [localId, setLocalId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [cuando, setCuando] = useState<string | null>(null)
  const [telefono, setTelefono] = useState(clienteInicial?.phone ?? '')
  const [nombre, setNombre] = useState(clienteInicial?.name ?? '')
  const [email, setEmail] = useState(clienteInicial?.email ?? '')
  const [notas, setNotas] = useState('')

  const { data: carta, isLoading } = useQuery({
    queryKey: ['panel', slug, 'agenda', 'carta'],
    queryFn: () => api.agendaCarta(slug),
    enabled: open,
  })
  const { data: clientes } = useQuery({
    queryKey: ['panel', slug, 'customers'],
    queryFn: () => api.panelCustomers(slug),
    enabled: open,
  })

  const servicios = carta?.servicios ?? []
  const servicio = servicios.find((s) => s.id === serviceId) ?? null
  const extras = (carta?.extras ?? [])
    .map((extra) => ({ extra, cantidad: cantidades[extra.id] ?? 0 }))
    .filter((l) => l.cantidad > 0)
  const total =
    (servicio?.priceCents ?? 0) + extras.reduce((n, l) => n + l.extra.priceCents * l.cantidad, 0)
  const duracion =
    (servicio?.durationMin ?? 0) + extras.reduce((n, l) => n + l.extra.durationMin * l.cantidad, 0)

  const locales = carta?.locales ?? []
  const local = locales.length > 1 ? localId || locales[0]!.id : undefined
  // Las de este local y las que atienden en cualquiera, como en la web.
  const personas = (carta?.personas ?? []).filter(
    (p) => !local || !p.locationId || p.locationId === local,
  )
  const persona = personas.find((p) => p.id === staffId) ?? null

  /* El cliente se encuentra por cualquiera de las dos cosas que se tienen a
     mano al teléfono: el número que llama o el nombre que dice. */
  const conocido = useMemo(() => {
    const tel = cifras(telefono)
    return tel.length >= 9 ? (clientes ?? []).find((c) => cifras(c.phone) === tel) : undefined
  }, [clientes, telefono])
  const sugerencias = useMemo(() => {
    if (conocido) return []
    const tel = cifras(telefono)
    const q = nombre.trim().toLowerCase()
    if (tel.length < 3 && q.length < 2) return []
    return (clientes ?? [])
      .filter(
        (c) =>
          (tel.length >= 3 && cifras(c.phone).includes(tel)) ||
          (q.length >= 2 && c.name.toLowerCase().includes(q)),
      )
      .slice(0, 4)
  }, [clientes, telefono, nombre, conocido])

  const elegirCliente = (c: Pick<PanelCustomer, 'name' | 'phone' | 'email'>) => {
    setTelefono(c.phone)
    setNombre(c.name)
    setEmail(c.email ?? '')
  }

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TIMEZONE,
    })

  const apuntar = useMutation({
    mutationFn: () =>
      api.createManualBooking(slug, {
        serviceId,
        startsAt: cuando!,
        staffId: staffId || undefined,
        locationId: local,
        customerName: nombre.trim(),
        customerPhone: telefono.trim(),
        customerEmail: email.trim() || undefined,
        notes: notas.trim() || undefined,
        extras: extras.map((l) => ({ extraId: l.extra.id, quantity: l.cantidad })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['availability', slug] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      /* Una cita para otro día no sale en la vista de hoy: sin el aviso, y sin
         su «Ver», parecía que no se había guardado. */
      const fecha = new Date(cuando!)
      const ver = alApuntar?.(fecha)
      aviso.ok(
        t('agenda.apuntadaHecho', { fecha: formatLongDate(fecha, idioma), hora: hora(cuando!) }),
        ver ? { texto: t('avisos.ver'), onClick: ver } : undefined,
      )
      onClose()
    },
  })

  const opcion = (
    activa: boolean,
    titulo: string,
    texto: string | null,
    onClick: () => void,
    derecha?: string,
  ) => (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200',
        activa ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ink">{titulo}</span>
        {texto && <span className="text-meta text-muted">{texto}</span>}
      </span>
      {derecha && (
        <span className="shrink-0 text-[14px] font-semibold text-ink tabular-nums">{derecha}</span>
      )}
    </button>
  )

  const pasos = [
    {
      id: 'servicio',
      titulo: t('cita.pasoServicio'),
      problema: !serviceId ? t('cita.eligeServicio') : null,
      contenido: isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : !servicios.length ? (
        <p className="rounded-xl bg-cream px-4 py-3 text-body text-body-2">
          {t('cita.sinServicios')}
        </p>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-meta font-semibold text-body-2">
              {t('agenda.servicio')}
            </legend>
            {servicios.map((s) => (
              <div key={s.id}>
                {opcion(
                  s.id === serviceId,
                  s.name,
                  formatDuration(s.durationMin, idioma),
                  () => {
                    setServiceId(s.id)
                    setCuando(null)
                  },
                  formatPrice(s.priceCents, idioma),
                )}
              </div>
            ))}
          </fieldset>

          {(carta?.extras.length ?? 0) > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-meta font-semibold text-body-2">
                {t('comun.extras')}{' '}
                <span className="font-normal text-subtle">{t('comun.opcional')}</span>
              </legend>
              {carta!.extras.map((e) => {
                const cantidad = cantidades[e.id] ?? 0
                return (
                  <div
                    key={e.id}
                    className={cx(
                      'flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors duration-200',
                      cantidad > 0 ? 'border-brand bg-brand/5' : 'border-line bg-surface',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-ink">{e.name}</span>
                      <span className="block text-meta text-muted tabular-nums">
                        +{formatPrice(e.priceCents, idioma)}
                        {e.durationMin > 0 && ` · +${formatDuration(e.durationMin, idioma)}`}
                      </span>
                    </span>
                    <Contador
                      compacto
                      cantidad={cantidad}
                      nombre={e.name}
                      onCambiar={(n) => {
                        setCantidades((p) => ({
                          ...p,
                          [e.id]: Math.max(0, Math.min(n, MAX_POR_EXTRA)),
                        }))
                        // Más minutos pueden dejar de caber en la hora elegida.
                        if (e.durationMin > 0) setCuando(null)
                      }}
                    />
                  </div>
                )
              })}
            </fieldset>
          )}

          {servicio && (
            <p className="text-meta text-muted">
              {t('comun.total')}:{' '}
              <strong className="font-semibold text-ink">{formatPrice(total, idioma)}</strong>
              {' · '}
              <strong className="font-semibold text-ink">{formatDuration(duracion, idioma)}</strong>
            </p>
          )}
        </>
      ),
    },
    {
      id: 'cuando',
      titulo: t('cita.pasoCuando'),
      problema: !cuando ? t('cita.faltaHora') : null,
      contenido: (
        <>
          {locales.length > 1 && (
            <Field label={t('pers.dondeAtiende')} htmlFor={`${id}-local`}>
              <Select
                id={`${id}-local`}
                value={local}
                onChange={(e) => {
                  setLocalId(e.target.value)
                  setStaffId('')
                  setCuando(null)
                }}
              >
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {/* Con una sola persona no hay nada que elegir. */}
          {personas.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-meta font-semibold text-body-2">
                {t('agenda.conQuien')}
              </legend>
              <div className="flex flex-wrap gap-2">
                {[{ id: '', name: t('agenda.sinPreferencia') }, ...personas].map((p) => (
                  <button
                    key={p.id || 'cualquiera'}
                    type="button"
                    aria-pressed={staffId === p.id}
                    onClick={() => setStaffId(p.id)}
                    className={cx(
                      'inline-flex min-h-10 items-center rounded-xl border px-3.5 text-[14px] font-semibold transition-colors duration-200',
                      staffId === p.id
                        ? 'border-brand bg-brand/5 text-ink'
                        : 'border-line bg-surface text-body-2 hover:border-line-strong',
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {serviceId && (
            <SlotPicker
              slug={slug}
              consulta={{
                serviceId,
                extras:
                  extrasParam(extras.map((l) => ({ extraId: l.extra.id, quantity: l.cantidad }))) ||
                  undefined,
                staffId: staffId || undefined,
                locationId: local,
              }}
              valor={cuando}
              onElegir={setCuando}
              diaInicial={diaInicial}
            />
          )}
        </>
      ),
    },
    {
      id: 'cliente',
      titulo: t('cita.pasoCliente'),
      problema: !phoneES.safeParse(telefono).success
        ? t('cita.errTelefono')
        : nombre.trim().length < 2
          ? t('agenda.faltaNombre')
          : email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
            ? t('cita.errEmail')
            : null,
      contenido: (
        <>
          <Field
            label={t('agenda.telefono')}
            htmlFor={`${id}-tel`}
            hint={
              conocido
                ? t('cita.yaVino', {
                    nombre: conocido.name,
                    citas: plural(conocido.total, 'clientes.unaCita', 'clientes.variasCitas'),
                  })
                : t('cita.telefonoPista')
            }
            required
          >
            <Input
              id={`${id}-tel`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value)
                const tel = cifras(e.target.value)
                const c =
                  tel.length >= 9 ? clientes?.find((x) => cifras(x.phone) === tel) : undefined
                // Si es alguien conocido, sus datos se rellenan solos.
                if (c && !nombre.trim()) {
                  setNombre(c.name)
                  if (!email.trim()) setEmail(c.email ?? '')
                }
              }}
            />
          </Field>

          <Field label={t('cita.nombre')} htmlFor={`${id}-nombre`} required>
            <Input
              id={`${id}-nombre`}
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>

          {sugerencias.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-meta font-semibold text-body-2">{t('cita.esAlguno')}</p>
              {sugerencias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => elegirCliente(c)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-left transition-colors duration-200 hover:border-brand"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-ink">{c.name}</span>
                    <span className="block text-meta text-muted tabular-nums">{c.phone}</span>
                  </span>
                  <span className="shrink-0 text-meta text-muted">
                    {plural(c.total, 'clientes.unaCita', 'clientes.variasCitas')}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Field label={t('agenda.email')} htmlFor={`${id}-mail`} hint={t('agenda.emailPista')}>
            <Input
              id={`${id}-mail`}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label={t('agenda.notas')} htmlFor={`${id}-notas`} hint={t('cita.notasPista')}>
            <Input
              id={`${id}-notas`}
              value={notas}
              maxLength={400}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Field>
        </>
      ),
    },
    {
      id: 'revisar',
      titulo: t('cita.pasoRevisar'),
      problema: null,
      contenido: (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-xl bg-cream px-4 py-3 text-body">
            <dt className="text-muted">{t('agenda.servicio')}</dt>
            <dd className="text-right font-semibold text-ink">{servicio?.name}</dd>
            {extras.length > 0 && (
              <>
                <dt className="text-muted">{t('comun.extras')}</dt>
                <dd className="text-right font-semibold text-ink">
                  {extras
                    .map((l) => (l.cantidad > 1 ? `${l.extra.name} ×${l.cantidad}` : l.extra.name))
                    .join(', ')}
                </dd>
              </>
            )}
            {locales.length > 1 && (
              <>
                <dt className="text-muted">{t('cita.donde')}</dt>
                <dd className="text-right font-semibold text-ink">
                  {locales.find((l) => l.id === local)?.name}
                </dd>
              </>
            )}
            {personas.length > 1 && (
              <>
                <dt className="text-muted">{t('agenda.conQuien')}</dt>
                <dd className="text-right font-semibold text-ink">
                  {persona?.name ?? t('cita.quienEsteLibre')}
                </dd>
              </>
            )}
            <dt className="text-muted">{t('agenda.cuando')}</dt>
            <dd className="text-right font-semibold text-ink first-letter:uppercase">
              {cuando &&
                t('cita.fechaHora', {
                  fecha: formatLongDate(new Date(cuando), idioma),
                  hora: hora(cuando),
                })}
            </dd>
            <dt className="text-muted">{t('agenda.cliente')}</dt>
            <dd className="text-right font-semibold break-words text-ink">
              {nombre.trim()} · {telefono.trim()}
            </dd>
            <dt className="text-muted">{t('comun.total')}</dt>
            <dd className="text-right font-semibold text-ink tabular-nums">
              {formatPrice(total, idioma)} · {formatDuration(duracion, idioma)}
            </dd>
          </dl>
          <p className="text-meta text-muted">
            {t(email.trim() ? 'cita.recibiraConCorreo' : 'cita.recibira', {
              nombre: nombre.trim().split(' ')[0] ?? '',
            })}
          </p>
          <p className="text-meta text-subtle">
            <Texto
              clave="agenda.avisoDirecta"
              partes={{
                directa: (
                  <strong className="font-semibold text-body-2">{t('agenda.esDirecta')}</strong>
                ),
              }}
            />
          </p>
          {apuntar.isError && (
            <ErrorNote>{textoDeError(apuntar.error, t('avisos.error'))}</ErrorNote>
          )}
        </>
      ),
    },
  ]

  const tocado =
    !!serviceId ||
    !!cuando ||
    (telefono.trim() !== '' && telefono !== (clienteInicial?.phone ?? ''))

  return (
    <Wizard
      open={open}
      onClose={onClose}
      title={
        clienteInicial
          ? t('cita.tituloPara', { nombre: clienteInicial.name.split(' ')[0] ?? '' })
          : t('agenda.apuntarTitulo')
      }
      pasos={pasos}
      paso={paso}
      setPaso={(n) => {
        apuntar.reset()
        setPaso(n)
      }}
      finalLabel={t('agenda.apuntarBoton')}
      onFinalizar={() => apuntar.mutate()}
      loading={apuntar.isPending}
      dirty={tocado}
    />
  )
}
