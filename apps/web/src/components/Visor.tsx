import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/plugins/counter.css'
import { photoFull, photoSrc } from './Photo'
import { useIdioma } from '../i18n/idioma'
import type { FotoGaleria } from './Galeria'

/** El ancho que de verdad hace falta: el de la pantalla por su densidad, en
    pasos de 480 para que el CDN reutilice lo que ya tiene. Ni menos de 960 ni
    más de 2400: más no se nota y pesa. */
function anchoIdeal() {
  const px = window.innerWidth * (window.devicePixelRatio || 1)
  return Math.min(2400, Math.max(960, Math.ceil(px / 480) * 480))
}

/**
 * El visor de fotos. Es la librería «yet-another-react-lightbox», cargada solo
 * al abrir una foto (ver Galeria): trae lo que una galería casera no tenía.
 *
 *  - Móvil: deslizar entre fotos, pellizcar y doble toque para ampliar,
 *    arrastrar hacia abajo para cerrar.
 *  - Escritorio: flechas, rueda del ratón o botones para ampliar, miniaturas,
 *    Esc para cerrar.
 *  - Foto entera, sin recortar, y a la resolución que pide la pantalla.
 *  - Foco atrapado, anuncio al lector de pantalla y bloqueo del fondo.
 */
export default function Visor({
  fotos,
  index,
  onIndex,
  onClose,
  titulo,
}: {
  fotos: FotoGaleria[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  titulo: string
}) {
  const { t } = useIdioma()
  const ancho = anchoIdeal()
  const varias = fotos.length > 1

  return (
    <Lightbox
      open
      className="veline-visor"
      index={index}
      close={onClose}
      on={{ view: ({ index: i }) => onIndex(i) }}
      slides={fotos.map((f) => ({
        src: photoFull(f.src, ancho),
        alt: f.detalle ? `${f.titulo}. ${f.detalle}` : f.titulo,
        // El nombre y el detalle juntos, abajo: arriba solo van el contador y los
        // botones, y un título largo no se pisa con ellos.
        description: (
          <>
            <span className="block text-base font-semibold">{f.titulo}</span>
            {f.detalle && <span className="block opacity-85">{f.detalle}</span>}
          </>
        ),
        thumbnail: photoSrc(f.src, 160, 160),
      }))}
      plugins={[Zoom, Captions, Counter, ...(varias ? [Thumbnails] : [])]}
      controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
      carousel={{ finite: !varias, preload: 2 }}
      zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
      thumbnails={{
        position: 'bottom',
        width: 64,
        height: 64,
        border: 0,
        borderRadius: 10,
        gap: 8,
        padding: 0,
        showToggle: false,
        vignette: false,
      }}
      captions={{ showToggle: false, descriptionTextAlign: 'center', descriptionMaxLines: 4 }}
      counter={{ container: { style: { top: 0, left: 0 } } }}
      render={{
        ...(varias ? {} : { buttonPrev: () => null, buttonNext: () => null }),
      }}
      labels={{
        Previous: t('galeria.anterior'),
        Next: t('galeria.siguiente'),
        Close: t('ficha.cerrarGaleria'),
        Lightbox: t('ficha.fotosDe', { nombre: titulo }),
        'Photo gallery': t('ficha.fotosDe', { nombre: titulo }),
        'Zoom in': t('galeria.ampliar'),
        'Zoom out': t('galeria.reducir'),
        Thumbnails: t('galeria.miniaturas'),
        '{index} of {total}': t('galeria.xDeN'),
      }}
    />
  )
}
