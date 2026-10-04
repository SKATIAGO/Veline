import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CATEGORIES,
  PLAN_INFO,
  PRUEBA_DIAS_DEFECTO,
  categoryLabel,
  formatPrice,
  planLabel,
  type PlanKey,
} from '@veline/shared'
import { api } from '../../lib/api'
import { Button, ButtonLink, Field, Input, Select, cx } from '../../components/ui'
import { useIdioma } from '../../i18n/idioma'
import { aviso, textoDeError } from '../../components/Avisos'
import { Wizard } from '../../components/Wizard'
import { CredencialCreada } from '../../components/Credencial'
import { generarPassword } from '../../lib/password'

/**
 * Dar de alta un negocio, de principio a fin.
 *
 * Antes era un formulario que creaba el negocio y nada más: luego había que
 * buscar su fila para crear la cuenta del dueño, copiar la contraseña desde
 * otra tarjeta y abrir su suscripción para darle el plan. Si algo se quedaba a
 * medias, había un negocio sin dueño que nadie recordaba completar. Ahora son
 * cuatro pasos —el negocio, su dueño, su plan y un repaso— y se crea todo a la
 * vez o nada.
 */

const esEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

const vacio = {
  name: '',
  category: CATEGORIES[0].slug as string,
  email: '',
  phone: '',
  street: '',
  city: 'Madrid',
  postalCode: '',
}

const PLANES = ['GRATIS', 'NEGOCIO', 'EQUIPOS'] as const satisfies readonly PlanKey[]
const DIAS = [0, 15, 30] as const

export function AltaNegocio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, idioma } = useIdioma()
  const id = useId()
  const queryClient = useQueryClient()
  const [paso, setPaso] = useState(0)
  const [negocio, setNegocio] = useState(vacio)
  const [conDueno, setConDueno] = useState(true)
  const [dueno, setDueno] = useState({ name: '', email: '', password: generarPassword() })
  const [plan, setPlan] = useState<(typeof PLANES)[number]>('GRATIS')
  const [dias, setDias] = useState<number>(PRUEBA_DIAS_DEFECTO)
  const [creado, setCreado] = useState<{ slug: string; name: string } | null>(null)
  const [verCredencial, setVerCredencial] = useState(true)

  const empezarDeNuevo = () => {
    setPaso(0)
    setNegocio(vacio)
    setConDueno(true)
    setDueno({ name: '', email: '', password: generarPassword() })
    setPlan('GRATIS')
    setDias(PRUEBA_DIAS_DEFECTO)
    setCreado(null)
    setVerCredencial(true)
    alta.reset()
  }

  const alta = useMutation({
    mutationFn: () =>
      api.adminAlta({
        ...negocio,
        phone: negocio.phone.trim() || undefined,
        plan,
        trialDays: dias,
        dueno: conDueno
          ? { name: dueno.name.trim(), email: dueno.email.trim(), password: dueno.password }
          : null,
      }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['panel', 'businesses'] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      setCreado({ slug: r.slug, name: r.name })
      aviso.ok(t('altan.hecho', { nombre: r.name }))
    },
  })

  const cambiar = (campo: keyof typeof vacio, valor: string) =>
    setNegocio((n) => ({ ...n, [campo]: valor }))

  const opcion = (activa: boolean, titulo: string, texto: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cx(
        'flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors duration-200',
        activa ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className="text-[14px] font-semibold text-ink">{titulo}</span>
      <span className="text-meta text-muted">{texto}</span>
    </button>
  )

  const textoPlan = (p: (typeof PLANES)[number]) => {
    const info = PLAN_INFO[p]
    if (info.priceCents === 0) return t('altan.planGratis', { mensajes: info.messagesIncluded })
    // Negocio y Equipo cuestan lo mismo: lo que los distingue es para quién son.
    const para = t(p === 'EQUIPOS' ? 'pre.equipoTagline' : 'pre.negocioTagline')
    return `${para}. ${t('altan.planPago', {
      importe: formatPrice(info.priceCents, idioma),
      personas: info.seatsIncluded,
      extra: formatPrice(info.extraSeatCents, idioma),
    })}`
  }

  const textoDias = (d: number) =>
    d === 0 ? t('altan.sinPrueba') : t('altan.diasPrueba', { n: d })

  const pasos = [
    {
      id: 'negocio',
      titulo: t('altan.pasoNegocio'),
      problema:
        negocio.name.trim().length < 2
          ? t('altan.errNombre')
          : !esEmail(negocio.email)
            ? t('adm.errEmailNegocio')
            : negocio.street.trim().length < 3
              ? t('altan.errCalle')
              : negocio.city.trim().length < 2
                ? t('altan.errCiudad')
                : !/^\d{5}$/.test(negocio.postalCode.trim())
                  ? t('adm.errCp')
                  : null,
      contenido: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('adm.nombre')} htmlFor={`${id}-nombre`} required>
            <Input
              id={`${id}-nombre`}
              autoComplete="off"
              value={negocio.name}
              onChange={(e) => cambiar('name', e.target.value)}
            />
          </Field>
          <Field label={t('adm.categoria')} htmlFor={`${id}-cat`} required>
            <Select
              id={`${id}-cat`}
              value={negocio.category}
              onChange={(e) => cambiar('category', e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {idioma === 'en' ? c.labelEn : c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('adm.email')} htmlFor={`${id}-email`} hint={t('adm.emailPista')} required>
            <Input
              id={`${id}-email`}
              type="email"
              autoComplete="off"
              value={negocio.email}
              onChange={(e) => cambiar('email', e.target.value)}
            />
          </Field>
          <Field label={t('adm.telefono')} htmlFor={`${id}-tel`} hint={t('adm.opcional')}>
            <Input
              id={`${id}-tel`}
              type="tel"
              value={negocio.phone}
              onChange={(e) => cambiar('phone', e.target.value)}
            />
          </Field>
          <Field label={t('adm.calle')} htmlFor={`${id}-calle`} required>
            <Input
              id={`${id}-calle`}
              value={negocio.street}
              onChange={(e) => cambiar('street', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-[1.6fr_1fr] gap-3">
            <Field label={t('adm.ciudad')} htmlFor={`${id}-ciudad`} required>
              <Input
                id={`${id}-ciudad`}
                value={negocio.city}
                onChange={(e) => cambiar('city', e.target.value)}
              />
            </Field>
            <Field label={t('adm.cp')} htmlFor={`${id}-cp`} required>
              <Input
                id={`${id}-cp`}
                inputMode="numeric"
                maxLength={5}
                value={negocio.postalCode}
                onChange={(e) => cambiar('postalCode', e.target.value)}
              />
            </Field>
          </div>
        </div>
      ),
    },
    {
      id: 'dueno',
      titulo: t('altan.pasoDueno'),
      problema: !conDueno
        ? null
        : dueno.name.trim().length < 2
          ? t('altan.errNombreDueno')
          : !esEmail(dueno.email)
            ? t('adm.errEmail')
            : dueno.password.length < 10
              ? t('adm.errContrasena')
              : null,
      contenido: (
        <>
          <div className="flex flex-col gap-2">
            {opcion(conDueno, t('altan.duenoAhora'), t('altan.duenoAhoraPista'), () =>
              setConDueno(true),
            )}
            {opcion(!conDueno, t('altan.duenoLuego'), t('altan.duenoLuegoPista'), () =>
              setConDueno(false),
            )}
          </div>
          {conDueno && (
            <>
              <Field label={t('altan.nombreDueno')} htmlFor={`${id}-dn`} required>
                <Input
                  id={`${id}-dn`}
                  autoComplete="off"
                  value={dueno.name}
                  onChange={(e) => setDueno({ ...dueno, name: e.target.value })}
                />
              </Field>
              <Field
                label={t('adm.email')}
                htmlFor={`${id}-de`}
                hint={t('adm.emailAcceso')}
                required
              >
                <Input
                  id={`${id}-de`}
                  type="email"
                  autoComplete="off"
                  value={dueno.email}
                  onChange={(e) => setDueno({ ...dueno, email: e.target.value })}
                />
              </Field>
              <Field
                label={t('adm.contrasenaInicial')}
                htmlFor={`${id}-dp`}
                hint={t('altan.contrasenaPista')}
                required
              >
                <div className="flex gap-2">
                  <Input
                    id={`${id}-dp`}
                    autoComplete="new-password"
                    value={dueno.password}
                    onChange={(e) => setDueno({ ...dueno, password: e.target.value })}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => setDueno({ ...dueno, password: generarPassword() })}
                  >
                    {t('eq.otra')}
                  </Button>
                </div>
              </Field>
            </>
          )}
        </>
      ),
    },
    {
      id: 'plan',
      titulo: t('altan.pasoPlan'),
      problema: null,
      contenido: (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-meta font-semibold text-body-2">{t('adm.plan')}</legend>
            {PLANES.map((p) => (
              <div key={p}>
                {opcion(plan === p, planLabel(p, idioma), textoPlan(p), () => setPlan(p))}
              </div>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-meta font-semibold text-body-2">
              {t('adm.prueba')}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {DIAS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={dias === d}
                  onClick={() => setDias(d)}
                  className={cx(
                    'min-h-11 rounded-xl border px-3 text-[14px] font-semibold transition-colors duration-200',
                    dias === d
                      ? 'border-brand bg-brand/5 text-ink'
                      : 'border-line bg-surface text-body-2 hover:border-line-strong',
                  )}
                >
                  {textoDias(d)}
                </button>
              ))}
            </div>
            <p className="text-meta text-muted">
              {dias === 0 ? t('altan.sinPruebaPista') : t('altan.pruebaPista')}
            </p>
          </fieldset>
        </>
      ),
    },
    {
      id: 'revisar',
      titulo: t('altan.pasoRevisar'),
      problema: null,
      contenido: (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-xl bg-cream px-4 py-3 text-body">
            <dt className="text-muted">{t('adm.nombre')}</dt>
            <dd className="text-right font-semibold text-ink">{negocio.name.trim()}</dd>
            <dt className="text-muted">{t('adm.categoria')}</dt>
            <dd className="text-right font-semibold text-ink">
              {categoryLabel(negocio.category, idioma)}
            </dd>
            <dt className="text-muted">{t('fneg.direccionPostal')}</dt>
            <dd className="text-right font-semibold text-ink">
              {negocio.street.trim()}, {negocio.postalCode.trim()} {negocio.city.trim()}
            </dd>
            <dt className="text-muted">{t('adm.email')}</dt>
            <dd className="text-right font-semibold break-all text-ink">{negocio.email.trim()}</dd>
            <dt className="text-muted">{t('altan.pasoDueno')}</dt>
            <dd className="text-right font-semibold break-all text-ink">
              {conDueno ? `${dueno.name.trim()} · ${dueno.email.trim()}` : t('altan.sinCuentaAun')}
            </dd>
            <dt className="text-muted">{t('adm.plan')}</dt>
            <dd className="text-right font-semibold text-ink">
              {planLabel(plan, idioma)} · {textoDias(dias)}
            </dd>
          </dl>
          <p className="text-meta text-muted">
            {conDueno ? t('altan.revisarConDueno') : t('altan.revisarSinDueno')}
          </p>
        </>
      ),
    },
  ]

  const tocado = negocio.name.trim() !== '' || negocio.email.trim() !== '' || negocio.street !== ''

  return (
    <Wizard
      open={open}
      onClose={() => {
        onClose()
        // Al cerrar del todo se olvida: la próxima vez se empieza en limpio.
        window.setTimeout(empezarDeNuevo, 250)
      }}
      title={creado ? t('altan.creadoTitulo', { nombre: creado.name }) : t('adm.nuevoNegocio')}
      pasos={pasos}
      paso={paso}
      setPaso={(n) => {
        /* El correo del dueño suele ser el del negocio: se propone al llegar
           a su paso, sin pisar lo que ya se hubiera escrito. */
        if (n === 1 && !dueno.email.trim()) setDueno((d) => ({ ...d, email: negocio.email.trim() }))
        setPaso(n)
      }}
      finalLabel={t('altan.darDeAlta')}
      onFinalizar={() => alta.mutate()}
      loading={alta.isPending}
      error={alta.isError ? textoDeError(alta.error, t('adm.noSePudoCrear')) : null}
      dirty={tocado}
      resultado={
        creado &&
        (conDueno && verCredencial ? (
          <CredencialCreada
            email={dueno.email.trim()}
            password={dueno.password}
            onListo={() => setVerCredencial(false)}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-body text-body-2">
              {conDueno ? t('altan.leFaltaConDueno') : t('altan.leFaltaSinDueno')}
            </p>
            <ul className="flex flex-col gap-2">
              {(['altan.falta1', 'altan.falta2', 'altan.falta3'] as const).map((c, i) => (
                <li key={c} className="flex items-start gap-3 text-body text-ink">
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-caption font-bold text-body-2 tabular-nums"
                  >
                    {i + 1}
                  </span>
                  {t(c)}
                </li>
              ))}
            </ul>
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={empezarDeNuevo}>
                {t('altan.otro')}
              </Button>
              <ButtonLink to={`/panel/${creado.slug}`}>{t('altan.irASuPanel')}</ButtonLink>
            </div>
          </div>
        ))
      }
    />
  )
}
