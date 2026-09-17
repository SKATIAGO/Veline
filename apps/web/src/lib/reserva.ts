import { extrasParam, parseExtrasParam, type ExtraPedido } from '@veline/shared'

/**
 * Lo que se va eligiendo durante la reserva viaja en la URL, no en memoria.
 *
 * Son tres pantallas seguidas —extras, fecha, confirmar— y entre medias la
 * gente vuelve atrás, recarga o comparte el enlace. Si lo elegido viviera solo
 * en el estado de React, cualquiera de esas tres cosas lo borraría sin avisar
 * y se acabaría reservando sin los extras que se creían añadidos.
 *
 * El formato («corte:2,tinte») lo ponen y lo leen las funciones de @veline/shared,
 * porque el servidor lee exactamente lo mismo al calcular los huecos.
 */

/** Los extras que trae la URL, con su cantidad. Sin `?extras=`, lista vacía. */
export function extrasDeUrl(params: URLSearchParams): ExtraPedido[] {
  return parseExtrasParam(params.get('extras'))
}

/**
 * El trozo de URL que lleva los extras a la pantalla siguiente. Vacío cuando
 * no hay ninguno: así el flujo normal no arrastra un `&extras=` suelto.
 */
export function tramoExtras(pedidos: ExtraPedido[]): string {
  const valor = extrasParam(pedidos)
  return valor ? `&extras=${encodeURIComponent(valor)}` : ''
}
