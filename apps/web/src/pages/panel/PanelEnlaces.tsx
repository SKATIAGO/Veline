import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { enlacesDeOrigen } from '../../lib/origen'
import { Button, Card, PageHeader } from '../../components/ui'
import { Texto, useIdioma } from '../../i18n/idioma'

/**
 * Los enlaces que evitan la comisión del marketplace, en su propia pantalla.
 *
 * Antes vivían dentro de «Facturación», como una tarjeta más al lado de lo
 * que se paga ese mes. Ahí eran fáciles de perder: quien entraba a mirar el
 * cobro del mes no tenía motivo para fijarse en la otra tarjeta, y quien
 * quería el enlace para pegarlo en Instagram tenía que abrir la pantalla de
 * facturación para encontrarlo. Con su propio hueco en el menú se ve de
 * un vistazo, sin pasar por delante del dinero para llegar a él.
 */
export function PanelEnlaces() {
  const { t } = useIdioma()
  const { slug = '' } = useParams()
  const [copiado, setCopiado] = useState<string | null>(null)

  const base = window.location.origin
  const enlaces = enlacesDeOrigen(base, slug)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('panel.enlaces')} hint={t('enl.pista')} />

      <Card padded className="max-w-[640px]">
        <p className="text-body text-muted">
          <Texto
            clave="enl.texto"
            partes={{
              sinComision: (
                <strong className="font-semibold text-body-2">{t('enl.sinComision')}</strong>
              ),
            }}
          />
        </p>

        <ul className="mt-4 flex flex-col gap-2.5">
          {enlaces.map((e) => (
            <li
              key={e.param}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas/40 px-3 py-2.5"
            >
              <span className="w-[76px] shrink-0 text-meta font-semibold text-body-2">
                {e.clave ? t(e.clave) : e.label}
              </span>
              {/* En el móvil se parte en varias líneas en vez de recortarse: lo
                  que se recortaba era el final —«?origen=instagram»—, que es
                  justo lo que distingue un enlace de otro. */}
              <code className="min-w-0 flex-1 basis-full text-meta break-all text-subtle sm:basis-0 sm:truncate">
                {e.url}
              </code>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  void navigator.clipboard.writeText(e.url).then(() => setCopiado(e.param))
                }}
              >
                {copiado === e.param ? t('enl.copiado') : t('enl.copiar')}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
