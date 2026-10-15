# Revisión de UX/UI — octubre 2026

Auditoría hecha con el navegador de pruebas sobre el entorno local (datos de
demostración), sin instalar herramientas. Cada pantalla se cargó en un marco de
375 px (móvil) y de 1280 px (escritorio). Se midió lo objetivo y se recorrieron
a mano los flujos de reserva.

## Qué se cubrió

- Reserva pública: inicio, buscador, precios, ficha del negocio, extras, fecha,
  confirmación, reserva hecha, gestionar y cancelar, 404.
- Panel del negocio (administrador y empleado): agenda, calendario, clientes,
  fichaje, contabilidad, servicios, extras, equipo, horario, cierres, locales,
  negocio, fotos, enlaces, suscripción, actividad, cuenta.
- Plataforma (superadmin): negocios, cuentas, cobros, actividad, cuenta.
- Inglés a 360 px, contrastes de los colores de marca, peticiones por pantalla.

## Qué NO se pudo comprobar

- Gestos táctiles reales (deslizar, pellizcar, arrastrar para cerrar): el
  navegador de pruebas no los simula.
- Safari/iPhone real (solo Chromium).
- Lector de pantalla real (solo reglas automáticas).
- Producción con datos reales: todo fue en local.

---

## Alta gravedad

### 1. Un empleado puede abrir por URL pantallas de configuración y ve datos falsos

El menú las oculta, pero la dirección funciona. El servidor responde 403 y la
interfaz lo trata como «no hay nada»:

- `/servicios` → «Todavía no hay servicios… Un negocio sin servicios no puede
  recibir reservas» + botón «Añadir servicio».
- `/equipo` → «Todavía no hay nadie que atienda» + «Incorporar a alguien».
- `/horario` → «Abierto 0 días a la semana» + «Guardar horario».
- `/facturacion` → «Todavía no hay nada que cobrar».
- `/contabilidad` → **sí enseña los totales** del mes (usa el permiso de agenda).

Un empleado puede creer que el negocio está vacío. Arreglo: guarda por rol en
las rutas del panel (redirigir a la agenda) y que un 403 se muestre como «no
tienes acceso», nunca como vacío.

### 2. Un 429 (demasiadas peticiones) te manda al login sin avisar

`/api/auth/me` falla con 429 → la interfaz deduce «sin sesión» y redirige a
`/login`. Visto en la auditoría. El límite es 120 peticiones/minuto **por IP**,
así que varias personas tras la misma wifi (un salón con 5 empleados) o un
móvil con CGNAT comparten cupo. Además el mensaje del 429 llega en `message` y
la interfaz solo lee `error`: sale «Algo ha ido mal».
Arreglo: tratar solo el 401 como «sin sesión»; reintentar o avisar con un 429;
subir el cupo de lecturas o limitar por sesión en usuarios con sesión.

### 3. El formulario de reserva no te lleva al error

En móvil, al pulsar «Confirmar reserva» con campos vacíos los errores aparecen
**arriba**, fuera de pantalla (la página queda en el botón, scrollY 1108, el
primer error no es visible), el foco se queda en el body y los campos no llevan
`aria-invalid`. Parece que el botón no hace nada.
Arreglo: scroll y foco al primer campo con error, `aria-invalid` y
`aria-describedby`.

## Gravedad media

### 4. El botón de marca no llega a contraste AA

Texto blanco sobre `#a96a3e`: **4,36:1** (AA pide 4,5:1). Es el botón primario
de toda la app. El estado hover (`#935a33`, 5,6:1) sí cumple. Basta oscurecer
el marrón un punto (p. ej. `#a2633a`).

### 5. El título de la pestaña es el mismo en todas las pantallas

Todas dicen «Veline — Gestiona tu negocio de forma inteligente»: la ficha de un
negocio, el panel, el login. Afecta a la accesibilidad (el lector no anuncia
dónde estás), al historial/pestañas y a compartir un enlace. Para un
marketplace, el nombre del negocio debería estar en el título.

### 6. Zonas pulsables por debajo de 44 px (AA mínimo: 24 px)

| Elemento                                                                                                                              | Tamaño            | Dónde                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------ |
| «¿Olvidaste la contraseña?»                                                                                                           | **19 px** de alto | login                    |
| «Elegir mes»                                                                                                                          | **21 px**         | calendario, contabilidad |
| «Quitar foto»                                                                                                                         | 28×28             | panel → fotos            |
| Mes anterior / siguiente                                                                                                              | 32×32             | calendario, contabilidad |
| Teléfono de la lista de clientes                                                                                                      | 32 px             | clientes                 |
| «Escríbenos»                                                                                                                          | 27 px             | precios                  |
| ES / EN                                                                                                                               | 36×32             | todas                    |
| Pestañas de sección, filtros, «+ Franja», «Copiar a L–V», «Corregir», «Marcar cobrado», «Copiar», «Reservar», cabecera y pie públicos | 33–36 px          | varias                   |

Los botones «estirados» de las listas (cliente, persona, local, negocio)
miden 21 px pero cubren la fila entera: son correctos.

### 7. «Sí, cancelar» recibe el foco al pedir cancelar una reserva

En la gestión de reserva, la confirmación en línea pone el foco en el botón
destructivo: un Intro de más cancela. El resto del panel pone el foco en
«Cancelar»/«Mantener».

### 8. El formulario de reserva no usa autocompletado

Nombre, teléfono y email sin `autocomplete` (`name`, `tel`, `email`) ni
`inputMode`: el móvil no ofrece los datos guardados, y es el paso en el que se
pierde más gente.

## Gravedad baja

- **11 px de texto** en muchos sitios (días del calendario, insignias,
  «Más elegido», «Agenda» en la barra inferior). Por debajo de 12 px cuesta
  leer, sobre todo al sol. Subir el token de 11 a 12.
- **Dos `<h1>`** en las pantallas de reserva en móvil («Elige fecha y hora» y
  el mes).
- **Campos a 14 px en escritorio** (buscador, login): no afecta a iPhone (la
  interfaz móvil usa 16 px) pero conviene unificar.
- **/reserva/… y /resena/… no encontrados** son un callejón sin salida: sin
  enlace para volver.
- **La reserva gestionada dice «¡Reserva confirmada!»** cada vez que se abre el
  enlace del SMS.
- **Bundle único de 880 KB (247 KB gzip)**, sin carga por rutas: en 3G el
  primer arranque pasa de los 3 s. Dividir por rutas (panel y plataforma aparte
  del público).

## Lo que está bien

- Cero desbordes horizontales en ninguna pantalla, en 375 y en 1280 px, en
  español e inglés (a 360 px).
- Todos los campos de entrada a 16 px en móvil (no hace zoom en iPhone).
- Todos los botones, enlaces y campos tienen nombre o etiqueta; imágenes con
  `alt`.
- Huecos de hora de 86×44, botón principal de reserva de 48 px.
- Foco visible global (`:focus-visible`), Esc y «atrás» cierran las capas,
  foco atrapado en diálogos.
- Contrastes de texto secundario por encima de 4,5:1.
- El flujo de reserva (ficha → fecha → confirmar → hecha) no se traba, no
  duplica envíos y «atrás» desde «hecha» no reenvía el formulario.
- Mis cambios del selector de local duplicaban peticiones (resumen, citas,
  clientes): corregido, 8→6 peticiones en la agenda.

## Orden sugerido

1. Guardas por rol + manejo del 403 y del 429 (1, 2).
2. Errores del formulario de reserva visibles + autocompletado (3, 8).
3. Contraste del botón de marca, foco de «Sí, cancelar», título por pantalla
   (4, 7, 5).
4. Zonas pulsables y texto de 11 px (6).
5. Carga por rutas.
6. Playwright + axe para que nada de esto vuelva a pasar sin avisar.
