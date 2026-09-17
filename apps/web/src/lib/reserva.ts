/**
 * Lo que se va eligiendo durante la reserva viaja en la URL, no en memoria.
 *
 * Son tres pantallas seguidas —extras, fecha, confirmar— y entre medias la
 * gente vuelve atrás, recarga o comparte el enlace. Si lo elegido viviera solo
 * en el estado de React, cualquiera de esas tres cosas lo borraría sin avisar
 * y se acabaría reservando sin los extras que se creían añadidos.
 */

/** Los ids de extra que trae la URL. Sin `?extras=`, lista vacía. */
export function extrasDeUrl(params: URLSearchParams): string[] {
  return (params.get('extras') ?? '').split(',').filter(Boolean)
}

/**
 * El trozo de URL que lleva los extras a la pantalla siguiente. Vacío cuando
 * no hay ninguno: así el flujo normal no arrastra un `&extras=` suelto.
 */
export function tramoExtras(ids: string[]): string {
  return ids.length > 0 ? `&extras=${encodeURIComponent(ids.join(','))}` : ''
}
