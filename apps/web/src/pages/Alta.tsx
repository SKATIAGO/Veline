import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { CATEGORIES, CONTACT_EMAIL } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { Button, ErrorNote, Field, Input, Logo, Select } from '../components/ui'
import { DoorMotif, Glow } from '../components/Ornaments'
import { PRUEBA_DIAS } from '../content/precios'
import { SelectorIdioma } from '../components/SelectorIdioma'
import { Texto, useIdioma } from '../i18n/idioma'

/**
 * Alta de un negocio por su cuenta.
 *
 * Antes esto no existía: el botón «Contratar» llevaba a la pantalla de entrada
 * y quien quería darse de alta se topaba con un «inicia sesión» que no podía
 * pasar.
 *
 * Se piden los datos mínimos para que la ficha exista y nada más. Los
 * servicios, el horario y las fotos se ponen ya dentro, con calma: pedirlo
 * todo aquí convierte el alta en un trámite y la gente se cae por el camino.
 */

const vacio = {
  negocio: '',
  categoria: CATEGORIES[0].slug as string,
  email: '',
  telefono: '',
  calle: '',
  ciudad: '',
  codigoPostal: '',
  responsable: '',
  password: '',
}

export function Alta() {
  const { t, idioma } = useIdioma()
  const id = useId()
  const [form, setForm] = useState(vacio)
  const [hecho, setHecho] = useState<{ correoEnviado: boolean } | null>(null)

  const alta = useMutation({
    mutationFn: () => api.signup({ ...form, telefono: form.telefono.trim() || undefined }),
    onSuccess: (r) => setHecho({ correoEnviado: r.correoEnviado }),
  })

  const set = (campo: keyof typeof vacio, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }))

  const problema =
    form.negocio.trim().length < 2
      ? t('alta.errNegocio')
      : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
        ? t('alta.errEmail')
        : form.calle.trim().length < 3
          ? t('alta.errCalle')
          : form.ciudad.trim().length < 2
            ? t('alta.errCiudad')
            : !/^\d{5}$/.test(form.codigoPostal.trim())
              ? t('alta.errCp')
              : form.responsable.trim().length < 2
                ? t('alta.errNombre')
                : form.password.length < 10
                  ? t('alta.errContrasena')
                  : null

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!problema) alta.mutate()
  }

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
          /* La verdad por delante: si el correo no ha salido, mandar a alguien
             a mirar su buzón es hacerle perder el tiempo y quedar mal. */
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

  return (
    <Marco titulo={t('alta.titulo')} subtitulo={t('alta.subtitulo', { dias: PRUEBA_DIAS })} ancho>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('alta.nombreNegocio')}
            htmlFor={`${id}-n`}
            required
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-n`}
              placeholder={t('alta.nombreEjemplo')}
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
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {idioma === 'en' ? c.labelEn : c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('alta.telefono')} htmlFor={`${id}-t`} hint={t('alta.telefonoPista')}>
            <Input
              id={`${id}-t`}
              placeholder="600 000 000"
              value={form.telefono}
              onChange={(e) => set('telefono', e.target.value)}
            />
          </Field>

          <Field label={t('alta.calle')} htmlFor={`${id}-ca`} required className="sm:col-span-2">
            <Input
              id={`${id}-ca`}
              placeholder={t('alta.calleEjemplo')}
              value={form.calle}
              onChange={(e) => set('calle', e.target.value)}
            />
          </Field>

          <Field label={t('alta.ciudad')} htmlFor={`${id}-ci`} required>
            <Input
              id={`${id}-ci`}
              placeholder={t('alta.ciudadEjemplo')}
              value={form.ciudad}
              onChange={(e) => set('ciudad', e.target.value)}
            />
          </Field>

          <Field label={t('alta.cp')} htmlFor={`${id}-cp`} required>
            <Input
              id={`${id}-cp`}
              inputMode="numeric"
              maxLength={5}
              placeholder="28013"
              value={form.codigoPostal}
              onChange={(e) => set('codigoPostal', e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-2 border-t border-line pt-5">
          <p className="mb-4 text-meta font-semibold tracking-[0.04em] text-muted uppercase">
            {t('alta.tuCuenta')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('alta.tuNombre')} htmlFor={`${id}-r`} required>
              <Input
                id={`${id}-r`}
                placeholder={t('alta.tuNombreEjemplo')}
                value={form.responsable}
                onChange={(e) => set('responsable', e.target.value)}
              />
            </Field>

            <Field label={t('alta.email')} htmlFor={`${id}-e`} hint={t('alta.emailPista')} required>
              <Input
                id={`${id}-e`}
                type="email"
                autoComplete="email"
                placeholder={t('alta.emailEjemplo')}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>

            <Field
              label={t('alta.contrasena')}
              htmlFor={`${id}-p`}
              hint={t('alta.contrasenaPista')}
              required
              className="sm:col-span-2"
            >
              <Input
                id={`${id}-p`}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
              />
            </Field>
          </div>
        </div>

        {alta.isError && (
          <ErrorNote>
            {alta.error instanceof ApiError ? alta.error.message : t('alta.noSePudo')}
          </ErrorNote>
        )}

        <Button type="submit" size="lg" block loading={alta.isPending} disabled={!!problema}>
          {t('alta.crearCuenta')}
        </Button>
        {problema && <p className="text-center text-meta text-muted">{problema}</p>}

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
    <div className="grain relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-6 py-12">
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
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
        className={`rise relative w-full rounded-2xl border border-line bg-surface p-8 shadow-pop sm:p-10 ${
          ancho ? 'max-w-[620px]' : 'max-w-[460px]'
        }`}
      >
        <div className="mb-7 flex justify-center">
          <Logo size={24} />
        </div>
        <h1 className="text-center font-display text-[26px] font-semibold text-ink">{titulo}</h1>
        <p className="mt-2 mb-7 text-center text-body text-muted">{subtitulo}</p>
        {children}
      </div>
    </div>
  )
}
