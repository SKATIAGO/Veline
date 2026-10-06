import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button, ErrorNote, Field, Input, Select } from '../../components/ui'
import { useIdioma } from '../../i18n/idioma'
import { textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'
import { CredencialCreada } from '../../components/Credencial'
import { generarPassword } from '../../lib/password'

const esEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

/**
 * Crear una cuenta de acceso a un negocio desde la plataforma.
 *
 * La usan Negocios (desde la fila o la ficha de un negocio, que ya sabe para
 * cuál) y Cuentas (que pregunta para cuál). Desde aquí no se manda correo: los
 * datos se pasan a mano, y la contraseña solo se puede ver una vez, dentro del
 * mismo diálogo donde se crea.
 */
export function CrearCuentaAdmin({
  negocios,
  inicial,
  onClose,
}: {
  negocios: { id: string; name: string; email: string | null }[]
  /** Con negocio ya elegido (businessId) o vacío para que se elija. */
  inicial: { businessId: string; email: string }
  onClose: () => void
}) {
  const { t } = useIdioma()
  const id = useId()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({
    businessId: inicial.businessId,
    name: '',
    email: inicial.email,
    password: generarPassword(),
    role: 'ADMIN' as 'ADMIN' | 'EMPLEADO',
  })
  const [intento, setIntento] = useState(false)
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null)
  const [elige] = useState(!inicial.businessId)

  const crear = useMutation({
    mutationFn: () => api.createAdminUser({ ...draft, name: draft.name.trim() }),
    onSuccess: () => {
      setCredencial({ email: draft.email.trim(), password: draft.password })
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const problema = !draft.businessId
    ? t('cuentas.errNegocio')
    : draft.name.trim().length < 2
      ? t('altan.errNombreDueno')
      : !esEmail(draft.email)
        ? t('adm.errEmail')
        : draft.password.length < 10
          ? t('adm.errContrasena')
          : null

  const nombreNegocio = negocios.find((b) => b.id === draft.businessId)?.name ?? ''

  return (
    <FormDialog
      open
      onClose={onClose}
      title={
        credencial
          ? t('eq.cuentaCreada')
          : nombreNegocio
            ? t('adm.nuevaCuentaPara', { negocio: nombreNegocio })
            : t('cuentas.nueva')
      }
      submitLabel={t('adm.crearCuenta')}
      onSubmit={() => {
        setIntento(true)
        if (!problema) crear.mutate()
      }}
      loading={crear.isPending}
      error={crear.isError ? textoDeError(crear.error, t('adm.noSePudoCrear')) : null}
      dirty={!credencial && draft.name.trim() !== ''}
      sinPie={!!credencial}
    >
      {credencial ? (
        <CredencialCreada
          email={credencial.email}
          password={credencial.password}
          avisoCorreo={false}
          onListo={onClose}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {elige && (
              <Field
                label={t('cuentas.negocio')}
                htmlFor={`${id}-b`}
                required
                className="sm:col-span-2"
              >
                <Select
                  id={`${id}-b`}
                  value={draft.businessId}
                  onChange={(e) => {
                    const b = negocios.find((x) => x.id === e.target.value)
                    // Su correo de contacto suele ser también el de quien lo lleva.
                    setDraft((d) => ({
                      ...d,
                      businessId: e.target.value,
                      email: d.email.trim() ? d.email : (b?.email ?? ''),
                    }))
                  }}
                >
                  <option value="">{t('cuentas.eligeNegocio')}</option>
                  {negocios.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={t('adm.nombre')} htmlFor={`${id}-un`} required>
              <Input
                id={`${id}-un`}
                autoComplete="off"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label={t('adm.email')} htmlFor={`${id}-ue`} hint={t('adm.emailAcceso')} required>
              <Input
                id={`${id}-ue`}
                type="email"
                autoComplete="off"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Field>
            <Field
              label={t('adm.contrasenaInicial')}
              htmlFor={`${id}-up`}
              hint={t('adm.contrasenaPista')}
              required
            >
              <div className="flex gap-2">
                <Input
                  id={`${id}-up`}
                  autoComplete="new-password"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
                <Button
                  variant="secondary"
                  onClick={() => setDraft({ ...draft, password: generarPassword() })}
                >
                  {t('eq.otra')}
                </Button>
              </div>
            </Field>
            <Field label={t('adm.permisos')} htmlFor={`${id}-ur`} required>
              <Select
                id={`${id}-ur`}
                value={draft.role}
                onChange={(e) =>
                  setDraft({ ...draft, role: e.target.value as 'ADMIN' | 'EMPLEADO' })
                }
              >
                <option value="ADMIN">{t('panel.rolAdmin')}</option>
                <option value="EMPLEADO">{t('panel.rolEmpleado')}</option>
              </Select>
            </Field>
          </div>

          {intento && problema && <ErrorNote>{problema}</ErrorNote>}
        </>
      )}
    </FormDialog>
  )
}
