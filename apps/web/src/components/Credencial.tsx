import { useState } from 'react'
import { Button } from './ui'
import { Texto, useIdioma } from '../i18n/idioma'

/**
 * La contraseña de una cuenta recién creada, la única vez que se puede ver.
 *
 * Va dentro del mismo diálogo en el que se creó la cuenta. Antes salía en una
 * tarjeta arriba de la página, lejos de donde se había pulsado, y «Copiar»
 * copiaba solo la contraseña: luego había que escribir a mano el correo y la
 * dirección para entrar. Ahora se copia todo junto, listo para pegarlo en un
 * mensaje.
 */
export function CredencialCreada({
  email,
  password,
  onListo,
  avisoCorreo = true,
}: {
  email: string
  password: string
  onListo: () => void
  /** Si el servidor ya le ha mandado los datos por correo. */
  avisoCorreo?: boolean
}) {
  const { t } = useIdioma()
  const [copiado, setCopiado] = useState(false)
  const entrar = `${window.location.origin}/login`
  const todo = t('cred.textoCopiar', { email, password, url: entrar })

  const copiar = () =>
    navigator.clipboard
      .writeText(todo)
      .then(() => setCopiado(true))
      .catch(() => setCopiado(false))

  return (
    <div className="flex flex-col gap-4">
      {avisoCorreo && (
        <p className="text-body text-body-2">
          <Texto clave="eq.pasaleDatos" partes={{ email: <strong>{email}</strong> }} />
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-cream px-4 py-3 text-body">
        <dt className="text-muted">{t('cred.correo')}</dt>
        <dd className="font-semibold break-all text-ink">{email}</dd>
        <dt className="text-muted">{t('cred.contrasena')}</dt>
        <dd className="font-mono font-semibold break-all text-ink">{password}</dd>
        <dt className="text-muted">{t('cred.entrarEn')}</dt>
        <dd className="font-semibold break-all text-ink">{entrar}</dd>
      </dl>
      <p className="text-meta text-muted">
        {/* Sin correo no hay «por si no le llega»: se la pasa quien la crea. */}
        {t(avisoCorreo ? 'eq.guardalaAhora' : 'eq.guardalaSinCorreo')}
      </p>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={copiar}>
          {copiado ? t('cred.copiado') : t('cred.copiarTodo')}
        </Button>
        <Button onClick={onListo}>{t('comun.listo')}</Button>
      </div>
    </div>
  )
}
