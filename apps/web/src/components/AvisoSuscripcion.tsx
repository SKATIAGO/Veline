import { formatPrice, PLAN_INFO, type PlanKey } from '@veline/shared'
import type { PanelSubscription } from '../lib/api'
import { Card, cx } from './ui'

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
  if (!sub) return null

  const dias = sub.trialEndsAt ? diasHasta(sub.trialEndsAt) : null
  const cuota = formatPrice(sub.monthlyCents)
  const plan = PLAN_INFO[sub.plan as PlanKey]?.label ?? sub.plan

  // Cortado: no acepta reservas. Es lo más grave que le puede pasar.
  if (!sub.accepting) {
    const motivo =
      sub.status === 'PRUEBA'
        ? 'Se han acabado los días de prueba.'
        : sub.status === 'CANCELADA'
          ? 'La cuenta está dada de baja.'
          : 'La cuenta está suspendida.'
    return (
      <Aviso tono="grave" titulo="Tu negocio no está aceptando reservas">
        {motivo} Tu ficha sigue publicada, pero nadie puede reservar hasta que se reactive.
        Escríbenos y lo arreglamos.
      </Aviso>
    )
  }

  if (sub.status === 'IMPAGADA') {
    return (
      <Aviso tono="grave" titulo="Hay una cuota pendiente">
        La cuota de {cuota} al mes no consta pagada. Las reservas siguen funcionando, pero conviene
        resolverlo antes de que se corte.
      </Aviso>
    )
  }

  // La prueba solo se avisa cuando de verdad está cerca de acabarse.
  if (sub.status === 'PRUEBA' && dias !== null && dias <= 5) {
    return (
      <Aviso
        tono="aviso"
        titulo={
          dias <= 0
            ? 'Tu prueba termina hoy'
            : `Te ${dias === 1 ? 'queda' : 'quedan'} ${dias} ${dias === 1 ? 'día' : 'días'} de prueba`
        }
      >
        Después seguirás con el plan {plan} por {cuota} al mes. Si no quieres continuar, no tienes
        que hacer nada.
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
