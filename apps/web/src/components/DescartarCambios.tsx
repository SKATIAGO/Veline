import { useSyncExternalStore } from 'react'
import { ConfirmDialog } from './Confirmar'
import { descarte } from '../lib/cambios'
import { useIdioma } from '../i18n/idioma'

/** La pregunta de `siDescarta`. Va una vez, en el marco del panel. */
export function DescartarCambios() {
  const { t } = useIdioma()
  const pendiente = useSyncExternalStore(descarte.suscribir, descarte.pendiente, descarte.pendiente)
  return (
    <ConfirmDialog
      open={!!pendiente}
      onClose={descarte.cancelar}
      title={t('conf.descartarTitulo')}
      consecuencias={[t('conf.descartarTexto')]}
      confirmLabel={t('conf.descartar')}
      onConfirm={descarte.confirmar}
      sinHistorial
    />
  )
}
