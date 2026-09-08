import { formatPrice, PLAN_INFO, type PlanKey } from '@veline/shared'
import type { PanelSubscription } from '../lib/api'
import { Card, cx } from './ui'
import { useIdioma, usePlural } from '../i18n/idioma'

/**
 * El estado de la cuenta, arriba del todo y solo cuando hay algo que decir.
 *
 * Una suscripción al día no merece un cartel permanente: si todo va bien no
 * aparece nada. Lo que sí tiene que verse sin buscarlo es que la prueba se
 * acaba en tres días o que el negocio ha dejado de aceptar reservas — eso
 * último es dinero que se pierde cada hora que pasa sin que nadie lo sepa.
 */

const diasHasta = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)

export function AvisoSuscripcion({ sub }: { sub: PanelSubscription | null }) {
  const { t, idioma } = useIdioma()
  const plural = usePlural()

  if (!sub) return null

  const dias = sub.trialEndsAt ? diasHasta(sub.trialEndsAt) : null
  const cuota = formatPrice(sub.monthlyCents, idioma)
  const plan = PLAN_INFO[sub.plan as PlanKey]?.label ?? sub.plan

  // Cortado: no acepta reservas. Es lo más grave que le puede pasar.
  if (!sub.accepting) {
    const motivo =
      sub.status === 'PRUEBA'
        ? t('sub.pruebaAcabada')
        : sub.status === 'CANCELADA'
          ? t('sub.baja')
          : t('sub.suspendida')
    return (
      <Aviso tono="grave" titulo={t('sub.noAcepta')}>
        {t('sub.noAceptaTexto', { motivo })}
      </Aviso>
    )
  }

  if (sub.status === 'IMPAGADA') {
    return (
      <Aviso tono="grave" titulo={t('sub.cuotaPendiente')}>
        {t('sub.cuotaPendienteTexto', { cuota })}
      </Aviso>
    )
  }

  // La prueba solo se avisa cuando de verdad está cerca de acabarse.
  if (sub.status === 'PRUEBA' && dias !== null && dias <= 5) {
    return (
      <Aviso
        tono="aviso"
        titulo={
          dias <= 0 ? t('sub.pruebaHoy') : plural(dias, 'sub.pruebaUnDia', 'sub.pruebaVariosDias')
        }
      >
        {t('sub.pruebaTexto', { plan, cuota })}
      </Aviso>
    )
  }

  return null
}

function Aviso({
  tono,
  titulo,
  children,
}: {
  tono: 'grave' | 'aviso'
  titulo: string
  children: React.ReactNode
}) {
  return (
    <Card
      className={cx(
        'p-5',
        tono === 'grave' ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50',
      )}
    >
      <p
        className={cx(
          'text-ui font-semibold',
          tono === 'grave' ? 'text-rose-900' : 'text-amber-900',
        )}
      >
        {titulo}
      </p>
      <p
        className={cx(
          'mt-1 text-body',
          tono === 'grave' ? 'text-rose-900/90' : 'text-amber-900/90',
        )}
      >
        {children}
      </p>
    </Card>
  )
}
