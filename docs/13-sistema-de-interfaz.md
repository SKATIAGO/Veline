# Sistema de interfaz

Reglas de construcción tomadas de la referencia de estilo que trajo Santiago (Airbnb), aplicadas
sobre **la identidad de Veline**: los colores, la tipografía y las secciones no cambian. Lo que
se toma prestado es la mecánica —tamaños de control, radios, escala tipográfica y jerarquía de
superficies—, no la paleta.

## El problema que resolvió

Las acciones del panel eran **texto subrayado de 12,5 px sin relleno**: «Editar», «Ocultar»,
«Desactivar», «Salir», «Añadir franja». El blanco pulsable medía unos **12 px de alto**. Las
guías de iOS piden 44 px y las de Android 48 dp.

El peor caso estaba en la web pública: el enlace de volver de las pantallas de reserva era el
carácter `‹` suelto, un botón de **4 px de ancho**, copiado en tres páginas.

Medido en el navegador, antes y después:

| Control                          | Antes   | Ahora   |
| -------------------------------- | ------- | ------- |
| «Editar» / «Ocultar» de una fila | 12 × 65 | 36 × 65 |
| «Salir»                          | 19 × 28 | 36 × 60 |
| Volver de la reserva             | 20 × 4  | 40 × 40 |
| Hueco de hora al reservar        | 36 alto | 44 alto |
| Flechas del calendario           | 36 × 36 | 40 × 40 |
| Enlaces del pie                  | 20 alto | 32 alto |

## Reglas

**Ningún control baja de 36 px de alto.** 36 para acciones dentro de una fila, 44 para los de
página entera, 48 para las llamadas a la acción de la web pública, 40 para los botones
circulares de icono.

**Los botones son píldora y los campos tienen 8 px de radio.** De un vistazo se distingue lo que
se pulsa de lo que se escribe. Las tarjetas, 12 px.

**La escala tipográfica tiene nombre.** Antes convivían `text-[12.5px]`, `text-[13.5px]` y
`text-sm` haciendo el mismo papel. Ahora son variables del `@theme` en
[`index.css`](../apps/web/src/index.css):

| Token             | Tamaño | Para qué                       |
| ----------------- | ------ | ------------------------------ |
| `text-caption`    | 11 px  | Etiquetas y nada más           |
| `text-meta`       | 13 px  | Datos secundarios, pistas      |
| `text-body`       | 14 px  | Cuerpo — el grueso del texto   |
| `text-ui`         | 16 px  | Nombres, controles             |
| `text-subheading` | 20 px  | Títulos de sección             |
| `text-heading-sm` | 22 px  | Título de pantalla             |
| `text-heading`    | 28 px  | Cifras grandes, títulos de web |

El cuerpo sube de 12,5 a 14 px: un panel que se mira todos los días no puede estar en letra
pequeña.

**La elevación es contraste de superficie, no sombra.** El lienzo es crema y las tarjetas
blancas; se separan por valor. La sombra queda para lo que de verdad flota (visor de fotos,
menús). Se conserva el leve levantamiento **solo** en las llamadas grandes de la web pública: en
controles densos hace que la interfaz parezca inestable al recorrerla con el ratón.

## Los primitivos

Todo vive en [`components/ui.tsx`](../apps/web/src/components/ui.tsx). En el panel **no queda ni
un `<button>`, `<input>` o `<select>` suelto**: si aparece uno nuevo, es que se ha saltado el
sistema.

- `Button` — variantes `primary`, `secondary`, `quiet`, `accent`, `danger`; tamaños `sm`, `md`,
  `lg`; `loading` bloquea y gira, para no enviar dos veces.
- `IconButton` — círculo de 40 px. Exige `label`: un botón sin texto no le dice nada a un lector
  de pantalla.
- `Input`, `Textarea`, `Select`, `Field` — el campo va siempre unido a su etiqueta por `htmlFor`,
  que es lo que permite pulsar el texto para enfocar. Antes los formularios eran solo
  `placeholder`, y el `placeholder` desaparece en cuanto escribes: a mitad de rellenar ya no
  sabes qué pedía cada casilla.
- `ConfirmAction` — sustituye a `confirm()`. El botón se convierte en la pregunta y la respuesta
  sin mover nada de sitio. El diálogo del navegador corta el hilo, no se puede vestir y en móvil
  tapa la pantalla entera.
- `Badge`, `FilterChip`, `PageHeader`, `Card`, `EmptyState`, `Skeleton`, `SuccessNote`,
  `ErrorNote`, `BackBar`.

## Lo que se ganó de paso

- **Pestañas arrastrables en móvil.** Con cinco no caben en 375 px, y cortarlas sin scroll
  escondía las últimas para siempre.
- **Ámbitos separados.** Dentro de un negocio la barra muestra sus pestañas; en `/panel/admin`
  las de la plataforma. Mezclarlas confundía sobre qué se estaba mirando.
- **La cuenta es alcanzable en móvil.** El enlace estaba oculto con `sm:block`.
- **Descripción de servicio.** El campo existía en la API y en el borrador, pero **no había
  ningún control para escribirlo**: no se podía rellenar desde el panel.
- **«Copiar a L–V»** en el horario. Rellenar siete días a mano cansa.
- **Aviso al salir con cambios sin guardar** en el horario.
- **Filtros de agenda** (hoy / 7 días / todo) y recuento.
- **Cuentas de acceso de toda la plataforma** — ver [14-panel-superadmin.md](14-panel-superadmin.md).

## Lo que falta

- **Contraste medido.** Se ha subido el tamaño del texto, pero no se ha comprobado la relación
  de contraste de `text-subtle` y `text-disabled` sobre crema contra WCAG AA.
- **Navegación por teclado en las listas.** Se puede tabular, pero no recorrer filas con flechas.
- **La web pública sigue con tamaños escritos a mano** en Landing, Search y Pricing. El panel y
  el flujo de reserva ya están migrados; esas tres páginas son sobre todo texto de marketing y
  no tienen controles pequeños, pero conviene terminarlas.
