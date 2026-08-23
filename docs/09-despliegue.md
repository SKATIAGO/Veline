# Desplegar Veline en un VPS (dominio en Hostinger, hosting en IONOS)

Guía para pasar de "corre en mi Mac por ngrok" a un dominio real con HTTPS.
Todo lo de aquí está **probado localmente** antes de escribirlo: las imágenes
de producción se construyeron, el stack completo se levantó con Caddy, y se
verificó HTTPS, el proxy de `/api`, las rutas de React Router y el reinicio
de la API sin romper nada — ver el resumen al final de este documento.

## 0. Lo que cambia frente al `docker-compose.yml` de desarrollo

| | Desarrollo (`docker-compose.yml`) | Producción (`docker-compose.prod.yml`) |
|---|---|---|
| Web | `vite` en modo dev, hot-reload | Build estático (`vite build`) servido por nginx |
| API | `tsx watch`, con bind mount del código | `tsx` sin watch, código copiado dentro de la imagen |
| Esquema de BD | `prisma db push` en cada arranque | `prisma migrate deploy` (migraciones versionadas) |
| Puertos expuestos | `db:5432`, `api:3001`, `web:5173` — todos al host | **Solo Caddy** (80/443). `db` y `api` no son alcanzables desde fuera |
| HTTPS | No | Automático, vía Caddy + Let's Encrypt |
| Cómo se accede | `http://localhost:5173` o el túnel de ngrok | `https://tu-dominio` |

Nunca mezcles los dos: son `-f docker-compose.yml` y `-f docker-compose.prod.yml`
por separado, con `.env` distintos.

## 1. Apuntar el dominio de Hostinger al VPS de IONOS

En IONOS, dentro del panel del VPS, copia la **IP pública** del servidor.

En Hostinger: `Dominios` → tu dominio → `Zona DNS`, y añade:

- Registro **A**, host `@`, valor = la IP del VPS.
- Registro **A**, host `www`, mismo valor.

Mantienes el DNS gestionado en Hostinger (no tocas los nameservers), así que
si ya tienes correo configurado ahí con registros MX, no se rompe. Tarda de
varios minutos a un par de horas en propagarse — puedes comprobarlo con:

```bash
dig +short tu-dominio.es
```

Cuando el resultado sea la IP del VPS, ya puedes arrancar el stack: Caddy
necesita que el dominio resuelva **antes** de pedir el certificado a Let's
Encrypt, si no falla la verificación.

## 2. Preparar el VPS

Conéctate por SSH y, si no lo tienes ya, instala Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# cierra sesión y vuelve a entrar para que el grupo surta efecto
```

Abre el firewall solo a lo necesario (SSH, HTTP, HTTPS):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**No hace falta abrir el 5432 ni el 3001** — `docker-compose.prod.yml` ni
siquiera los publica al host, así que ni con el firewall abierto serían
alcanzables desde fuera. Es la diferencia más importante con el compose de
desarrollo.

## 3. Clonar y configurar

```bash
git clone https://github.com/SKATIAGO/Veline.git
cd Veline
cp .env.production.example .env
```

Edita `.env` y rellena, como mínimo:

```bash
DOMAIN=tu-dominio.es
PUBLIC_WEB_URL=https://tu-dominio.es
ACME_EMAIL=tu-email@tu-dominio.es
POSTGRES_PASSWORD=$(openssl rand -base64 24)   # genera una y pégala
```

El correo (Brevo) puede quedarse en `MAIL_MODE=dry` hasta que verifiques el
dominio de envío — ver [docs/08-correo.md](08-correo.md). Poner `live` antes
de eso hace que los correos salgan sin remitente verificado y acaben en spam
con más facilidad.

## 4. Arrancar

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

La primera vez construye las tres imágenes (web, api) y descarga Postgres y
Caddy — tarda uno o dos minutos. Al terminar, la API aplica la migración
inicial y siembra los negocios de ejemplo automáticamente (es una operación
segura de repetir: en arranques siguientes detecta que ya hay datos y no
duplica nada).

Comprueba que los cuatro servicios están sanos:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs caddy --tail 30
```

En los logs de Caddy busca `certificate obtained successfully` — es la señal
de que Let's Encrypt emitió el certificado. Si en vez de eso ves errores de
`authorization`, casi siempre es que el DNS todavía no resolvía al VPS
cuando Caddy lo intentó: espera a que propague y reinicia solo Caddy:

```bash
docker compose -f docker-compose.prod.yml restart caddy
```

Con eso ya deberías tener `https://tu-dominio.es` sirviendo la web real.

## 5. Actualizar tras un cambio

```bash
cd Veline
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Reconstruye solo lo que cambió y reinicia esos contenedores; Caddy y la base
de datos siguen corriendo sin cortar el servicio de los demás. Si cambiaste
el esquema de Prisma, la migración nueva se aplica sola al arrancar la API
(siempre que hayas generado y subido el archivo de migración — ver más abajo).

## 6. Cuando cambies el esquema de la base de datos

En local, con el stack de desarrollo levantado:

```bash
docker compose exec api npx prisma migrate dev --name lo-que-sea --schema apps/api/prisma/schema.prisma
```

Esto genera una carpeta nueva en `apps/api/prisma/migrations/` con el SQL del
cambio. Se sube al repo como cualquier otro archivo — es lo que
`prisma migrate deploy` aplicará en el VPS en el siguiente despliegue.

## 7. Copias de seguridad

```bash
./scripts/backup-db.sh
```

Vuelca la base de datos comprimida en `./backups/` y borra las de más de 14
días. Prográmalo a diario con cron:

```bash
crontab -e
# añade:
0 4 * * * cd /ruta/a/Veline && ./scripts/backup-db.sh >> /var/log/veline-backup.log 2>&1
```

Para restaurar una copia:

```bash
gunzip -c backups/veline-20260101-040000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U veline veline
```

## Lo que queda pendiente

Esto despliega lo que hay hoy — no cambia nada de lo ya documentado en
[04-pendientes.md](04-pendientes.md). En concreto, para producción de verdad
(no una demo con dominio propio) faltaría:

- **El panel sigue sin autenticación.** Con un dominio público y sin túnel de
  por medio, cualquiera que encuentre la URL de `/panel` puede ver y cancelar
  citas de cualquier negocio. Es lo primero que hay que cerrar antes de
  compartir el enlace más allá de una demo controlada.
- **Backups automáticos, pero sin comprobar la restauración.** El script
  existe; ensayar una restauración real es otra cosa.
- **Sin monitorización.** Si un contenedor se cae, `restart: unless-stopped`
  lo revive, pero nadie se entera de que pasó.
- **La imagen de la API instala `tsx` y `prisma` como dependencias de
  desarrollo en producción** (ver el comentario en `apps/api/Dockerfile.prod`).
  Funciona bien, pero compilar a JS y correr con `node` a secas sería una
  imagen más pequeña y un arranque más rápido.

## Verificación hecha antes de escribir esta guía

Todo el stack de `docker-compose.prod.yml` se construyó y se levantó en
local (con `DOMAIN=localhost`, que hace que Caddy use su CA interna en vez de
pedir un certificado real) y se comprobó, con peticiones reales:

- Redirección automática de HTTP a HTTPS.
- La web responde 200 con el HTML compilado real (no una plantilla vacía).
- `/api/health` y `/api/businesses` accesibles a través del proxy de Caddy,
  con los 6 negocios del seed.
- Una ruta de React Router (`/taller-mecanico-rivas`) resuelve 200 en vez de
  404, confirmando el `try_files` de nginx para la SPA.
- Los archivos con hash de Vite llevan `Cache-Control: public, immutable`.
- Reiniciar el contenedor de la API no rompe nada: la migración y el seed son
  idempotentes.
- La migración inicial de Prisma se generó y se aplicó contra un Postgres
  limpio de verdad antes de darla por buena, no solo se escribió a mano.

Los contenedores y volúmenes de esa prueba se borraron al terminar; no queda
nada de eso en el VPS ni en tu Mac.
