# Estado de seguridad

Repaso de qué está protegido, qué no, y por qué. Actualizado tras la revisión
técnica previa a producción.

## Resuelto

### Infraestructura

| Medida                    | Detalle                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **SSH solo por clave**    | `PasswordAuthentication no`. Verificado desde fuera: con contraseña responde `Permission denied (publickey)` |
| **Firewall**              | Solo 22, 80 y 443. Comprobado con sonda externa: 5432 y 3001 no responden                                    |
| **HTTPS obligatorio**     | Certificado de Let's Encrypt, renovación automática, HTTP redirige a HTTPS                                   |
| **Cabeceras**             | HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`. Versiones de servidor ocultas                   |
| **`.env` en modo 600**    | Contiene la contraseña de Postgres                                                                           |
| **Base de datos aislada** | Postgres no publica puerto: solo es alcanzable desde la red interna de Docker                                |

### Aplicación

| Medida                          | Por qué                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Secretos fuera de la imagen** | El `.env` se copiaba dentro de la imagen Docker. Una imagen se copia y se comparte; los secretos no pueden viajar en ella. Resuelto con `.dockerignore` |
| **Límite de peticiones**        | 120/min por IP. Sin él, los endpoints públicos quedaban abiertos a crear reservas en masa o recorrer códigos hasta dar con uno válido                   |
| **Códigos de reserva robustos** | `crypto.randomInt` en vez de `Math.random`, y 8 caracteres en vez de 5. Ese código es lo único que protege los datos del cliente en `/reserva/{código}` |
| **CORS restringido**            | Solo el dominio propio en producción                                                                                                                    |
| **Validación de entrada**       | Todo el cuerpo de las peticiones pasa por esquemas Zod compartidos entre cliente y servidor                                                             |
| **Errores sin filtraciones**    | Un 500 nunca devuelve el mensaje interno, que puede revelar rutas o detalles de la base de datos                                                        |
| **Concurrencia de reservas**    | Transacción SERIALIZABLE: dos personas no pueden llevarse el mismo hueco                                                                                |
| **Panel bajo contraseña**       | Autenticación HTTP en Caddy, sobre la interfaz **y** sobre `/api/panel/*`                                                                               |

## Pendiente — lo que hay que resolver antes de crecer

### 1. El panel no tiene autenticación propia (candado provisional)

Los ocho endpoints de `/api/panel/*` **no comprueban ninguna credencial** por
sí mismos. Ahora mismo los protege una contraseña puesta en Caddy, delante.

Eso es suficiente para que nadie ajeno entre, pero tiene un límite importante:
**es una sola contraseña para todos los negocios**. Quien la tenga ve y
modifica los datos de cualquiera. En cuanto haya más de un negocio real usando
la plataforma, hace falta autenticación de verdad: cada dueño con su acceso, y
cada petición comprobando que ese negocio es suyo.

Las credenciales actuales están en el servidor, en `/root/panel-credenciales.txt`
(solo lectura para root). Para cambiarlas, ver [09-despliegue.md](09-despliegue.md).

### 2. Datos personales

La aplicación guarda nombre, teléfono y email de los clientes. Con el panel ya
cerrado no están expuestos, pero para operar en España con datos reales falta:

- Aviso de privacidad y base legal del tratamiento.
- Política de conservación: hoy nada se borra nunca.
- Vía para ejercer derechos de acceso y supresión.

### 3. Otras cosas conocidas

- **Aviso alto de `npm audit`** en `deepmerge-ts`, dependencia transitiva del
  _CLI_ de Prisma — no del cliente que atiende peticiones. Se cierra saltando a
  Prisma 7, que merece su propio cambio. El pipeline lo muestra en cada
  ejecución sin bloquear.
- **Sin registro de auditoría**: no queda constancia de quién canceló una cita
  o cambió un precio.
- **Sin monitorización ni alertas**: si algo se cae, `restart: unless-stopped`
  lo levanta, pero nadie se entera.
- **Sin protección anti-bots** en el formulario de reserva más allá del límite
  de peticiones.

## Cómo comprobar que sigue bien

```bash
# El panel debe pedir credenciales
curl -s -o /dev/null -w '%{http_code}\n' https://veline.es/api/panel/businesses   # 401

# Los secretos no deben estar en la imagen
docker run --rm --entrypoint sh veline-api -c 'ls /app/.env'                      # no existe

# SSH no debe aceptar contraseña
sshd -T | grep passwordauthentication                                             # no

# Solo 22, 80 y 443 abiertos
ufw status
```
