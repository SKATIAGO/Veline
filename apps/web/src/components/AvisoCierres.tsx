import { formatLongDate, fromDateKey, type CierreDTO } from '@veline/shared'
import { useIdioma } from '../i18n/idioma'

/** Aviso de los días en que el local no abre (vacaciones, festivos), con el motivo que puso el negocio. */
export function AvisoCierres({ cierres, className }: { cierres: CierreDTO[]; className?: string }) {
  const { t, idioma } = useIdioma()
  if (!cierres.length) return null
  const dia = (k: string) => formatLongDate(fromDateKey(k), idioma)

  return (
    <div
      role="note"
      className={`rounded-lg border border-accent/60 bg-cream px-4 py-3 text-body text-ink ${className ?? ''}`}
    >
      <p className="font-semibold">
        {t(cierres.length === 1 ? 'cierre.titulo1' : 'cierre.tituloVarios')}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5 text-body-2">
        {cierres.slice(0, 4).map((c) => (
          <li key={c.from} className="min-w-0 break-words">
            <span className="font-medium text-ink">
              {c.from === c.to
                ? t('cierre.dia', { dia: dia(c.from) })
                : t('cierre.rango', { desde: dia(c.from), hasta: dia(c.to) })}
            </span>
            {c.reason && <span className="text-muted"> · {c.reason}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
