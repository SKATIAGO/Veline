# Despliegue automático desde GitHub

Cada push a `main` verifica el código y, si pasa, lo despliega solo en el VPS.
No hay que entrar por SSH para publicar nada.

## Cómo funciona

```
push a main
   │
   ├─ Verificar el código  (GitHub Actions, runner de GitHub)
   │    npm ci  →  prisma generate  →  typecheck API  →  typecheck web
   │    →  build de la web  →  npm audit (informativo)
   │
   │    Si algo falla aquí, NO se despliega.
   │
   └─ Desplegar en el VPS  (por SSH, ejecuta scripts/deploy.sh)
        git fetch  →  build  →  up -d  →  esperar a que el sitio responda
        │
        └─ ¿no responde?  →  vuelve al commit anterior, reconstruye y avisa
```

El flujo está en [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
y el script en [`scripts/deploy.sh`](../scripts/deploy.sh).

## Desplegar a mano

Desde el repositorio, sin tocar código: pestaña **Actions** → _Verificar y
desplegar_ → **Run workflow**.

O directamente en el VPS:

```bash
cd Veline && ./scripts/deploy.sh
```

## Qué protege

**Reversión automática.** Si tras desplegar el sitio no responde en 90
segundos, el script vuelve al commit anterior, reconstruye y sale con error
(así el workflow queda en rojo y te enteras). Probado: `git reset` +
reconstrucción devuelve el sitio en unos 6 segundos.

**El typecheck es la primera barrera.** La primera ejecución del pipeline
cazó un fallo real: faltaba `prisma generate`, sin el cual los tipos que
Prisma deriva del esquema no existen. En Docker no se veía porque el
Dockerfile ya lo hacía.

**La trampa del `Caddyfile`.** El script detecta si ese archivo cambió entre
commits y, en ese caso, **recrea** el contenedor de Caddy en vez de
recargarlo. Sin eso el cambio no llega (ver la trampa 3 en
[09-despliegue.md](09-despliegue.md)).

**Builds reproducibles.** Hay `package-lock.json` y los Dockerfiles usan
`npm ci`. Antes, cada build resolvía las versiones de cero: una dependencia
podía cambiar bajo los pies sin que nada del repo cambiara.

## Seguridad (el repositorio es público)

Esto importa más de lo normal porque cualquiera puede abrir un PR.

- **El workflow no se dispara con `pull_request`.** Solo con push a `main` y a
  mano. Un PR desde un fork ejecutaría código de un desconocido y, con acceso
  a los secretos, se llevaría la clave SSH del servidor.
- **Doble comprobación** en el job de despliegue: exige que la rama sea `main`
  y que el repositorio sea el original.
- **La clave SSH del CI está restringida en el servidor.** En
  `authorized_keys` lleva `command="/root/Veline/scripts/deploy.sh",restrict`:
  aunque se filtrara, solo puede lanzar un despliegue — no abre shell, no lee
  archivos, no hace túneles. Comprobado pidiendo `cat .env`: ejecutó el
  despliegue y no filtró nada.
- **Es una clave distinta a la personal.** Se puede revocar sin perder tu
  acceso: basta borrar su línea de `/root/.ssh/authorized_keys`.
- **La huella del servidor va fijada** (`VPS_KNOWN_HOSTS`) en vez de aceptar
  cualquiera.

### Secretos configurados

| Secreto           | Qué es                                        |
| ----------------- | --------------------------------------------- |
| `VPS_SSH_KEY`     | Clave privada del CI (la restringida)         |
| `VPS_HOST`        | IP del VPS                                    |
| `VPS_KNOWN_HOSTS` | Huella del servidor, para evitar suplantación |

Se gestionan en _Settings → Secrets and variables → Actions_.

## Aviso conocido de `npm audit`

Hay un aviso de severidad alta en `deepmerge-ts`, dependencia transitiva del
**CLI de prisma** — no del cliente que sirve peticiones. El vector es agotar
la pila al fusionar objetos recursivos, cosa que ocurre al leer configuración,
no al atender una reserva. Cerrarlo exige saltar a **Prisma 7**, un cambio
mayor que merece su propia tarea. Por eso `npm audit` está en el pipeline como
paso **informativo**: se ve en cada ejecución, pero no bloquea el despliegue.

## Lo que este pipeline NO hace todavía

- **No hay tests.** El typecheck detecta errores de tipos, pero nada comprueba
  que el motor de disponibilidad siga calculando bien los huecos, o que no se
  pueda reservar dos veces el mismo. Es lo siguiente que daría más tranquilidad.
- **No hay entorno de pruebas.** Se despliega directo a producción. Con un
  segundo dominio (`beta.veline.es`) se podría probar antes.
- **No avisa a ninguna parte.** Si un despliegue falla, hay que mirar la
  pestaña Actions; no llega ningún mensaje.
- **Migraciones sin vuelta atrás.** El código revierte, pero una migración de
  base de datos ya aplicada, no. Hoy no importa porque solo hay una migración
  inicial; en cuanto haya cambios de esquema en producción, hay que pensarlo.
