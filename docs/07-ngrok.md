# Exponer Veline fuera de localhost con ngrok

Sirve para enseñar el boceto a alguien sin desplegar nada: la app sigue corriendo en tu
Mac y ngrok le pone una URL pública por delante.

## ⚠️ Antes de compartir el enlace

**`/panel` no tiene autenticación.** Cualquiera que abra el enlace puede entrar en el panel,
ver los datos de los clientes (nombre y teléfono) y **cancelar citas de cualquier negocio**.

Mientras era `localhost` no importaba. Con un túnel público sí. Opciones:

- Compartir el enlace solo con quien tenga que verlo y **apagar el túnel al terminar**
  (`Ctrl-C`); la URL muere con él.
- Poner una contraseña al túnel entero: `ngrok http 5173 --basic-auth "eli:loquesea"`.
  Es lo más rápido y protege también el panel.
- Construir un acceso real al panel. Es lo que toca antes de que esto sea público de verdad.

Ten en cuenta también que expone tu **servidor de desarrollo** de Vite, que sirve el código
fuente. Para una demo puntual va bien; no lo dejes levantado días.

## Un solo túnel basta

Vite hace de proxy de `/api` hacia el contenedor de la API, así que **exponiendo solo el
puerto 5173 funciona todo**: web, API y reservas. No hace falta un segundo túnel.

## Pasos

**1. Authtoken de ngrok** (solo la primera vez). Se saca en
[dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken):

```bash
ngrok config add-authtoken TU_TOKEN
```

**2. Activa el modo túnel** en `.env`:

```bash
TUNNEL=true
```

Esto hace que el HMR de Vite hable por `wss://<dominio>:443` en vez del puerto 5173, que
por el túnel no existe. Sin esto la web carga, pero la consola se llena de errores de
websocket y el recargado en caliente deja de funcionar.

**3. Levanta la app:**

```bash
docker compose up -d
```

**4. Abre el túnel:**

```bash
ngrok http 5173
```

ngrok imprime la URL pública (`https://algo-aleatorio.ngrok-free.app`). Esa es la que
compartes.

## Detalles que te vas a encontrar

**La pantalla intermedia de ngrok.** En el plan gratuito, la primera visita ve un aviso de
"You are about to visit...". Hay que pulsar **Visit Site** y no vuelve a salir en esa sesión.
Se quita con un dominio propio de pago.

**El dominio cambia en cada arranque.** Por eso `vite.config.ts` acepta los subdominios de
ngrok enteros en vez de un dominio concreto. Si tienes un dominio reservado y prefieres
cerrarlo solo a él:

```bash
ALLOWED_HOSTS=mi-dominio.ngrok-free.app
```

**Si ves "Blocked request. This host is not allowed"**, es la protección de Vite: añade el
dominio a `ALLOWED_HOSTS` y reinicia el contenedor web.

**La base de datos sigue siendo la tuya, local.** Quien entre por el enlace crea reservas de
verdad en tu Postgres. Para empezar de cero:

```bash
docker compose down -v && docker compose up --build
```

## Volver a solo local

Quita o comenta `TUNNEL=true` en `.env` y reinicia el contenedor web:

```bash
docker compose restart web
```
