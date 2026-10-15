# Fase 4 — Web pública: landing, precios, marketplace y alta

## Landing

### Tres arquitecturas

|              | A. Hero + vídeo + 3 beneficios + cómo funciona + precio + cierre (elegida)                                                | B. Solo hero + vídeo + cierre                                         | C. La actual, recortada a la mitad                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| Qué se queda | Titular, entradilla, vídeo del panel, un botón, tres beneficios, tres pasos, el precio en una línea, cierre.              | Titular, vídeo, botón.                                                | Lo mismo que hoy sin la lista de ocho «Plus».     |
| Qué se va    | La lista de cinco ventajas (+ «¿Echas algo en falta?»), los ocho servicios «Plus», el bloque oscuro «Impulsa tu negocio». | Todo lo demás.                                                        | La lista de ocho.                                 |
| Pros         | En 10 segundos se entiende qué es, cómo funciona y cuánto cuesta; un solo botón principal; lo demás se enlaza.            | Mínima.                                                               | Poco trabajo.                                     |
| Contras      | Hay que renunciar a decirlo todo.                                                                                         | Quien no ve el vídeo no entiende nada; sin «cómo funciona» ni precio. | Sigue habiendo dos CTA y dos listas de funciones. |

**Decisión: A.** Un único botón principal («Empezar 15 días gratis» → alta),
«Ver cómo funciona» como enlace, el precio de Negocio en una línea con enlace
a Precios y a los servicios aparte. De siete secciones a cinco; de ~40 frases
a ~15. El menú «Servicios» y el pie apuntan a `/precios#extras`, que es donde
viven ahora los servicios aparte.

## Precios

### Tres formas

|         | A. Dos planes + calculadora + «qué va aparte» (elegida)                                                                                                                                                                                                                        | B. Tabla comparativa de tres columnas                        | C. Tarjetas por plan con qué incluye / qué no |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------- |
| Idea    | Prueba gratis y Negocio como únicos planes; Equipo deja de ser una tarjeta (costaba lo mismo) y pasa a una franja «¿Varios locales o un equipo grande? Hablamos». Un deslizador «¿cuántas personas atienden?» da el precio al mes. Los servicios aparte, bajo «Qué va aparte». | Prueba · Negocio · Equipo con filas de funciones y ✓.        | Cada plan con dos listas.                     |
| Pros    | Inequívoco: un precio, una cuenta, una lista. Funciona igual en móvil (apilado) y escritorio (lado a lado).                                                                                                                                                                    | Familiar.                                                    | Compara a la vista.                           |
| Contras | Hay que aceptar que Equipo no es un plan.                                                                                                                                                                                                                                      | Con dos planes iguales la tabla miente; en móvil se desliza. | Repite lo mismo tres veces.                   |

**Decisión: A** (pregunta 2, aprobada: fundir Negocio y Equipo). No hay
mensual/anual porque no existe tarifa anual; no se inventa.

## Marketplace

La tarjeta entera es un enlace (enlace estirado que la cubre; «Reservar»
sigue visible como acción secundaria); hover y foco visibles en toda la
tarjeta.

## Alta de negocio

Cuatro pasos con `Stepper` («Paso X de 4»): tu negocio (nombre, sector,
teléfono) → dónde está (calle, ciudad, CP) → tu cuenta (nombre, email,
contraseña) → revisar y crear. Validación al pasar de paso, autocompletado en
cada campo, borrador en el navegador (pregunta 10: localStorage; la
contraseña nunca se guarda) con «Empezar de cero». El selector de idioma
vive en la capa `elevado`, por debajo de cualquier ficha.
