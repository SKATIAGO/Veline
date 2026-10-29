import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { CATEGORIES_ALTA, CONTACT_EMAIL, categoryLabel } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { Button, ErrorNote, Field, Input, Logo, PasswordInput, Select } from '../components/ui'
import { Stepper } from '../components/Stepper'
import { DoorMotif, Glow } from '../components/Ornaments'
import { PRUEBA_DIAS } from '../content/precios'
import { SelectorIdioma } from '../components/SelectorIdioma'
import { Texto, useIdioma } from '../i18n/idioma'

/**
 * Alta de un negocio por su cuenta, paso a paso.
 *
 * Era un formulario de nueve campos en una pantalla: en el móvil, una pared.
 * Ahora son cuatro pasos con una cosa en cada uno —tu negocio, dónde está, tu
 * cuenta, revisar— con «Paso X de 4», validación al pasar de paso y un
 * borrador en el navegador: quien cierra la pestaña a medias vuelve a
 * encontrárselo (menos la contraseña, que no se guarda nunca).
 *
 * Se piden los datos mínimos para que la ficha exista y nada más. Los
 * servicios, el horario y las fotos se ponen ya dentro, con calma.
 */

const vacio = {
  negocio: '',
  categoria: CATEGORIES_ALTA[0].slug as string,
  email: '',
  telefono: '',
  calle: '',
  ciudad: '',
  codigoPostal: '',
  responsable: '',
  password: '',
}
type Form = typeof vacio

const CLAVE_BORRADOR = 'veline:alta'

function leerBorrador(): Partial<Form> | null {
  try {
    const v = localStorage.getItem(CLAVE_BORRADOR)
    return v ? (JSON.parse(v) as Partial<Form>) : null
  } catch {
    return null
  }
}

function guardarBorrador(f: Form) {
  try {
    const { password: _p, ...resto } = f
    void _p
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(resto))
  } catch {
    /* sin almacenamiento, el borrador dura lo que dure la pestaña */
  }
}

const borrarBorrador = () => {
  try {
    localStorage.removeItem(CLAVE_BORRADOR)
  } catch {
    /* nada */
  }
}

type Paso = 'negocio' | 'donde' | 'cuenta' | 'resumen'
const PASOS: Paso[] = ['negocio', 'donde', 'cuenta', 'resumen']

export function Alta() {
  const { t, idioma } = useIdioma()
  const id = useId()
  const [form, setForm] = useState<Form>(() => ({ ...vacio, ...(leerBorrador() ?? {}) }))
  const [recuperado] = useState(() => !!leerBorrador())
  const [paso, setPaso] = useState(0)
  const [intentado, setIntentado] = useState(false)
  const [hecho, setHecho] = useState<{ correoEnviado: boolean } | null>(null)

  useEffect(() => {
    guardarBorrador(form)
  }, [form])

  const alta = useMutation({
    mutationFn: () => api.signup({ ...form, telefono: form.telefono.trim() || undefined }),
    onSuccess: (r) => {
      borrarBorrador()
      setHecho({ correoEnviado: r.correoEnviado })
    },
  })

  const set = (campo: keyof Form, valor: string) => setForm((f) => ({ ...f, [campo]: valor }))

  /* Qué falla en cada paso. Se enseña al intentar pasar, no mientras se
     escribe: un error antes de terminar de teclear solo molesta. */
  const problemaDe = (p: Paso): string | null => {
    switch (p) {
      case 'negocio':
        return form.negocio.trim().length < 2 ? t('alta.errNegocio') : null
      case 'donde':
        return form.calle.trim().length < 3
          ? t('alta.errCalle')
          : form.ciudad.trim().length < 2
            ? t('alta.errCiudad')
            : !/^\d{5}$/.test(form.codigoPostal.trim())
              ? t('alta.errCp')
              : null
      case 'cuenta':
        return form.responsable.trim().length < 2
          ? t('alta.errNombre')
          : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
            ? t('alta.errEmail')
            : form.password.length < 10
              ? t('alta.errContrasena')
              : null
      case 'resumen':
        return (
          PASOS.slice(0, 3)
            .map(problemaDe)
            .find((x) => x) ?? null
        )
    }
  }

  const actual = PASOS[paso]!
  const problema = problemaDe(actual)
  const ultimo = paso === PASOS.length - 1

  const siguiente = (e?: FormEvent) => {
    e?.preventDefault()
    if (problema) {
      setIntentado(true)
      return
    }
    setIntentado(false)
    if (ultimo) alta.mutate()
    else setPaso(paso + 1)
  }

  const nombresPaso = [
    t('alta.pasoNegocio'),
    t('alta.pasoDonde'),
    t('alta.pasoCuenta'),
    t('alta.pasoResumen'),
  ]

  if (hecho) {
    return (
      <Marco
        titulo={t('alta.yaCasiEsta')}
        subtitulo={t('alta.fichaCreada', { negocio: form.negocio })}
      >
        {hecho.correoEnviado ? (
          <p className="text-body leading-relaxed text-body-2">
            <Texto
              clave="alta.correoEnviado"
              partes={{
                email: <strong className="font-semibold text-ink">{form.email}</strong>,
              }}
            />
          </p>
        ) : (
          <p className="text-body leading-relaxed text-body-2">
            <Texto
              clave="alta.correoFallido"
              partes={{
                noSalio: (
                  <strong className="font-semibold text-ink">{t('alta.correoNoSalio')}</strong>
                ),
                correo: (
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Alta de ${form.negocio}`)}`}
                    className="font-semibold text-brand-text hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                ),
              }}
            />
          </p>
        )}
        <Link
          to="/"
          className="mt-6 flex min-h-11 items-center justify-center text-body font-semibold text-brand-text hover:text-ink"
        >
          {t('alta.volverInicio')}
        </Link>
      </Marco>
    )
  }

  const resumen = (etiqueta: string, lineas: string[], irA: number) => (
    <div className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-caption font-semibold tracking-[0.04em] text-muted uppercase">
          {etiqueta}
        </p>
        {lineas.map((l, i) => (
          <p key={i} className="text-body text-ink">
            {l}
          </p>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPaso(irA)}
        className="inline-flex min-h-10 shrink-0 items-center px-2 text-meta font-semibold text-brand-text hover:underline"
      >
        {t('alta.editar')}
      </button>
    </div>
  )

  return (
    <Marco titulo={t('alta.titulo')} subtitulo={t('alta.subtitulo', { dias: PRUEBA_DIAS })} ancho>
      <Stepper pasos={nombresPaso} actual={paso} compacto className="mb-6" />

      {recuperado && paso === 0 && (
        <p className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream px-4 py-2.5 text-meta text-body-2">
          {t('alta.borradorRecuperado')}
          <button
            type="button"
            onClick={() => {
              borrarBorrador()
              setForm(vacio)
            }}
            className="inline-flex min-h-9 items-center font-semibold text-brand-text hover:underline"
          >
            {t('alta.empezarDeCero')}
          </button>
        </p>
      )}

      <form onSubmit={siguiente} noValidate className="flex flex-col gap-4">
        {actual === 'negocio' && (
          <div className="grid gap-4">
            <Field label={t('alta.nombreNegocio')} htmlFor={`${id}-n`} required>
              <Input
                id={`${id}-n`}
                autoFocus
                value={form.negocio}
                onChange={(e) => set('negocio', e.target.value)}
              />
            </Field>
            <Field label={t('alta.aQueTeDedicas')} htmlFor={`${id}-c`} required>
              <Select
                id={`${id}-c`}
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
              >
                {CATEGORIES_ALTA.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {idioma === 'en' ? c.labelEn : c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('alta.telefono')} htmlFor={`${id}-t`} hint={t('alta.telefonoPista')}>
              <Input
                id={`${id}-t`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value)}
              />
            </Field>
          </div>
        )}

        {actual === 'donde' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('alta.calle')} htmlFor={`${id}-ca`} required className="sm:col-span-2">
              <Input
                id={`${id}-ca`}
                autoFocus
                autoComplete="street-address"
                value={form.calle}
                onChange={(e) => set('calle', e.target.value)}
              />
            </Field>
            <Field label={t('alta.ciudad')} htmlFor={`${id}-ci`} required>
              <Input
                id={`${id}-ci`}
                autoComplete="address-level2"
                value={form.ciudad}
                onChange={(e) => set('ciudad', e.target.value)}
              />
            </Field>
            <Field label={t('alta.cp')} htmlFor={`${id}-cp`} required>
              <Input
                id={`${id}-cp`}
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                value={form.codigoPostal}
                onChange={(e) => set('codigoPostal', e.target.value)}
              />
            </Field>
          </div>
        )}

        {actual === 'cuenta' && (
          <div className="grid gap-4">
            <Field label={t('alta.tuNombre')} htmlFor={`${id}-r`} required>
              <Input
                id={`${id}-r`}
                autoFocus
                autoComplete="name"
                value={form.responsable}
                onChange={(e) => set('responsable', e.target.value)}
              />
            </Field>
            <Field label={t('alta.email')} htmlFor={`${id}-e`} hint={t('alta.emailPista')} required>
              <Input
                id={`${id}-e`}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field
              label={t('alta.contrasena')}
              htmlFor={`${id}-p`}
              hint={`${t('alta.contrasenaPista')} ${t('alta.contrasenaNoSeGuarda')}`}
              required
            >
              <PasswordInput
                id={`${id}-p`}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
              />
            </Field>
          </div>
        )}

        {actual === 'resumen' && (
          <div>
            <p className="mb-2 text-body text-body-2">{t('alta.revisaYEnvia')}</p>
            {resumen(
              t('alta.resumenNegocio'),
              [
                form.negocio,
                categoryLabel(form.categoria, idioma),
                form.telefono.trim() || t('alta.sinTelefono'),
              ],
              0,
            )}
            {resumen(
              t('alta.resumenDonde'),
              [form.calle, `${form.codigoPostal} ${form.ciudad}`],
              1,
            )}
            {resumen(t('alta.resumenCuenta'), [form.responsable, form.email], 2)}
          </div>
        )}

        {intentado && problema && <ErrorNote>{problema}</ErrorNote>}
        {alta.isError && (
          <ErrorNote>
            {alta.error instanceof ApiError ? alta.error.message : t('alta.noSePudo')}
          </ErrorNote>
        )}

        <div className="mt-2 flex items-center gap-2">
          {paso > 0 && (
            <Button type="button" variant="quiet" onClick={() => setPaso(paso - 1)}>
              {t('alta.atras')}
            </Button>
          )}
          <Button type="submit" size="lg" loading={alta.isPending} className="ml-auto">
            {ultimo ? t('alta.crearCuenta') : t('alta.siguiente')}
          </Button>
        </div>

        {ultimo && (
          <p className="text-center text-meta leading-relaxed text-subtle">
            <Texto
              clave="alta.avisoPrivacidad"
              partes={{
                privacidad: (
                  <Link to="/privacidad" className="font-semibold text-brand-text hover:underline">
                    {t('alta.privacidad')}
                  </Link>
                ),
              }}
            />
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-meta text-subtle">
        {t('alta.yaTienesCuenta')}{' '}
        <Link to="/login" className="font-semibold text-brand-text hover:underline">
          {t('alta.entrar')}
        </Link>
      </p>
    </Marco>
  )
}

/** El mismo marco oscuro que login y restablecer, para que se reconozca. */
function Marco({
  titulo,
  subtitulo,
  ancho,
  children,
}: {
  titulo: string
  subtitulo: string
  ancho?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grain relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-10 sm:px-6 sm:py-12">
      <div className="absolute top-4 right-4 z-elevado sm:top-6 sm:right-6">
        <SelectorIdioma />
      </div>

      <Glow className="-top-40 -left-32" color="rgba(169,106,62,.35)" size={620} />
      <Glow className="-right-40 -bottom-52" color="rgba(217,164,65,.18)" size={560} />
      <DoorMotif
        className="top-14 right-[8%] hidden lg:block"
        size={180}
        tone="#D9A441"
        opacity={0.08}
      />

      <div
        className={`rise relative w-full rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-10 ${
          ancho ? 'max-w-[620px]' : 'max-w-[460px]'
        }`}
      >
        <div className="mb-6 flex justify-center">
          <Logo size={24} />
        </div>
        <h1 className="text-center font-display text-heading font-semibold text-ink">{titulo}</h1>
        <p className="mt-2 mb-6 text-center text-body text-muted">{subtitulo}</p>
        {children}
      </div>
    </div>
  )
}
