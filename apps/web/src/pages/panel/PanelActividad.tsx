import { useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { formatPrice } from '@veline/shared'
import { api, type AuditEntry } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  FilterChip,
  PageHeader,
  Skeleton,
} from '../../components/ui'
import { useIdioma, type Clave } from '../../i18n/idioma'
import { Tabs, panelProps } from '../../components/Tabs'

/**
 * Registro de actividad: quién hizo qué y cuándo.
 *
 * Lo ve el ADMIN de su negocio y el superadmin de todos. El EMPLEADO no tiene
 * la pestaña, y la API le respondería 403 igualmente.
 */

/** Cómo se presenta cada tipo de hecho. El color agrupa por naturaleza. */
type Tono = 'neutral' | 'warn' | 'ok' | 'off'

const ACCIONES: Record<string, { clave: Clave; tono: Tono }> = {
  SESION_INICIADA: { clave: 'act.sesionIniciada', tono: 'neutral' },
  SESION_FALLIDA: { clave: 'act.sesionFallida', tono: 'warn' },
  SESION_CERRADA: { clave: 'act.sesionCerrada', tono: 'neutral' },
  CONTRASENA_CAMBIADA: { clave: 'act.contrasenaCambiada', tono: 'warn' },
  CONTRASENA_RESTABLECIDA: { clave: 'act.contrasenaRestablecida', tono: 'warn' },
  CONTRASENA_OLVIDADA: { clave: 'act.contrasenaOlvidada', tono: 'warn' },
  USUARIO_CREADO: { clave: 'act.usuarioCreado', tono: 'ok' },
  USUARIO_ACTIVADO: { clave: 'act.usuarioActivado', tono: 'ok' },
  USUARIO_DESACTIVADO: { clave: 'act.usuarioDesactivado', tono: 'off' },
  NEGOCIO_CREADO: { clave: 'act.negocioCreado', tono: 'ok' },
  SERVICIO_CREADO: { clave: 'act.servicioCreado', tono: 'ok' },
  SERVICIO_EDITADO: { clave: 'act.servicioEditado', tono: 'neutral' },
  SERVICIO_ELIMINADO: { clave: 'act.servicioEliminado', tono: 'off' },
  EXTRA_CREADO: { clave: 'act.extraCreado', tono: 'ok' },
  EXTRA_EDITADO: { clave: 'act.extraEditado', tono: 'neutral' },
  EXTRA_ELIMINADO: { clave: 'act.extraEliminado', tono: 'off' },
  HORARIO_EDITADO: { clave: 'act.horarioEditado', tono: 'neutral' },
  RESERVA_CREADA: { clave: 'act.reservaCreada', tono: 'ok' },
  RESERVA_CANCELADA: { clave: 'act.reservaCancelada', tono: 'off' },
  USUARIO_ROL_CAMBIADO: { clave: 'act.usuarioRolCambiado', tono: 'neutral' },
  NEGOCIO_PLAN_CAMBIADO: { clave: 'act.negocioPlanCambiado', tono: 'neutral' },
  NEGOCIO_SUSPENDIDO: { clave: 'act.negocioSuspendido', tono: 'off' },
  NEGOCIO_REACTIVADO: { clave: 'act.negocioReactivado', tono: 'ok' },
  PRUEBA_AMPLIADA: { clave: 'act.pruebaAmpliada', tono: 'neutral' },
  COBRO_GENERADO: { clave: 'act.cobroGenerado', tono: 'neutral' },
  COBRO_MARCADO: { clave: 'act.cobroMarcado', tono: 'ok' },
  RESENA_PUBLICADA: { clave: 'act.resenaPublicada', tono: 'ok' },
  RESERVA_MOVIDA: { clave: 'act.reservaMovida', tono: 'neutral' },
  RESERVA_COMPLETADA: { clave: 'act.reservaCompletada', tono: 'ok' },
  RESERVA_NO_ASISTIO: { clave: 'act.reservaNoAsistio', tono: 'warn' },
  PERSONA_CREADA: { clave: 'act.personaCreada', tono: 'ok' },
  PERSONA_EDITADA: { clave: 'act.personaEditada', tono: 'neutral' },
  PERSONA_DESACTIVADA: { clave: 'act.personaDesactivada', tono: 'off' },
  PERSONA_ACTIVADA: { clave: 'act.personaActivada', tono: 'ok' },
  PERSONA_HORARIO_EDITADO: { clave: 'act.personaHorarioEditado', tono: 'neutral' },
  PERSONA_ELIMINADA: { clave: 'act.personaEliminada', tono: 'off' },
  NOTA_CREADA: { clave: 'act.notaCreada', tono: 'neutral' },
  NOTA_ELIMINADA: { clave: 'act.notaEliminada', tono: 'off' },
  CIERRE_CREADO: { clave: 'act.cierreCreado', tono: 'neutral' },
  CIERRE_ELIMINADO: { clave: 'act.cierreEliminado', tono: 'neutral' },
  NEGOCIO_EDITADO: { clave: 'act.negocioEditado', tono: 'neutral' },
  FICHAJE_CORREGIDO: { clave: 'act.fichajeCorregido', tono: 'warn' },
}

/** Filtros rápidos: los tres motivos reales por los que se abre esta pantalla. */
const FILTROS = [
  { key: '', clave: 'act.filtroTodo' },
  { key: 'RESERVA_CANCELADA', clave: 'act.filtroCancelaciones' },
  { key: 'SESION_FALLIDA', clave: 'act.filtroAccesosFallidos' },
  { key: 'USUARIO_CREADO', clave: 'act.filtroAltas' },
] as const satisfies readonly { key: string; clave: Clave }[]

/** Nombres legibles para las claves del detalle. Sin esto se leen en crudo. */
const ETIQUETAS: Record<string, Clave> = {
  codigo: 'act.campoCodigo',
  cuando: 'act.campoCuando',
  motivo: 'act.campoMotivo',
  canceladaPor: 'act.campoCanceladaPor',
  origen: 'act.campoOrigen',
  precioCents: 'act.campoPrecio',
  extras: 'comun.extras',
  duracionMin: 'act.campoDuracion',
  bufferMin: 'act.campoMargen',
  rol: 'act.campoRol',
  negocio: 'act.campoNegocio',
  categoria: 'act.campoCategoria',
  ciudad: 'act.campoCiudad',
  slug: 'act.campoIdentificador',
  activo: 'act.campoActivo',
  active: 'act.campoActivo',
  name: 'act.campoNombre',
  description: 'act.campoDescripcion',
  durationMin: 'act.campoDuracion',
  priceCents: 'act.campoPrecio',
  antes: 'act.campoAntes',
  despues: 'act.campoDespues',
  anadido: 'act.campoAnadido',
  plan: 'adm.plan',
  diasPrueba: 'act.campoDiasPrueba',
}

const ES_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/**
 * Los textos del registro, en el idioma de quien mira.
 *
 * Se agrupan aquí porque los usan tres piezas de esta pantalla y todas
 * necesitan lo mismo: la fecha con su formato y los valores sueltos legibles.
 *
 * La zona horaria NO sigue al idioma: la hora que se registró es la de
 * Madrid, que es donde ocurrió. Enseñarla en otra convertiría el registro en
 * algo que no cuadra con lo que vio quien estaba delante.
 */
function useTextosRegistro() {
  const { t, idioma, locale } = useIdioma()

  const fecha = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    })

  /** Un valor suelto del detalle, ya legible: fechas, precios y booleanos. */
  const valorLegible = (clave: string, v: unknown): string => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'boolean') return v ? t('act.si') : t('act.no')
    if (typeof v === 'string' && ES_ISO.test(v)) return fecha(v)
    if (typeof v === 'number' && /cents$/i.test(clave)) return formatPrice(v, idioma)
    if (typeof v === 'number' && /min$/i.test(clave)) return `${v} min`
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  return { t, fecha, valorLegible }
}

/** El detalle solo se muestra si dice algo: un objeto vacío es ruido. */
function Detalle({ metadata }: { metadata: unknown }) {
  const { t, valorLegible } = useTextosRegistro()

  if (!metadata || typeof metadata !== 'object') return null
  const filas = Object.entries(metadata as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && !(typeof v === 'object' && !Object.keys(v).length),
  )
  if (!filas.length) return null

  return (
    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
      {filas.map(([k, v]) => {
        const esCambio = typeof v === 'object' && v !== null && 'antes' in v && 'despues' in v
        const par = v as Record<string, unknown>
        return (
          <div key={k} className="flex min-w-0 gap-1.5 text-meta">
            <dt className="text-muted">{ETIQUETAS[k] ? t(ETIQUETAS[k]) : k}:</dt>
            <dd className="min-w-0 font-medium text-subtle [overflow-wrap:anywhere]">
              {esCambio
                ? `${valorLegible(k, par.antes)} → ${valorLegible(k, par.despues)}`
                : valorLegible(k, v)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

export function Fila({
  e,
  verIp,
  sinNegocio,
}: {
  e: AuditEntry
  verIp: boolean
  /** Dentro de la ficha de un negocio, su nombre en cada línea sobra. */
  sinNegocio?: boolean
}) {
  const { t, fecha } = useTextosRegistro()
  const meta = ACCIONES[e.action]

  return (
    <li className="border-b border-line py-3.5 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* e.summary lo escribió el servidor el día que pasó y está
                guardado tal cual: es un registro, no interfaz. Traducirlo
                ahora sería reescribir lo que quedó anotado. */}
            <Badge tone={meta?.tono ?? 'neutral'}>{meta ? t(meta.clave) : e.action}</Badge>
            <span className="text-body text-ink">{e.summary}</span>
          </div>

          <p className="mt-1 text-meta text-muted">
            {e.actorName ? (
              <>
                {e.actorName} · {e.actorEmail}
              </>
            ) : e.actorEmail ? (
              e.actorEmail
            ) : (
              t('act.sinSesion')
            )}
            {e.business && !sinNegocio && <> · {e.business.name}</>}
            {verIp && e.ip && <> · {e.ip}</>}
          </p>

          <Detalle metadata={e.metadata} />
        </div>

        <time className="shrink-0 text-meta text-muted tabular-nums" dateTime={e.createdAt}>
          {fecha(e.createdAt)}
        </time>
      </div>
    </li>
  )
}

const TIPO_CLAVE: Record<string, Clave> = {
  RESERVA_CONFIRMADA: 'env.tipoConfirmacion',
  RESERVA_CANCELADA: 'env.tipoCancelacion',
  RECORDATORIO: 'env.tipoRecordatorio',
  RESENA_PEDIDA: 'env.tipoResena',
  RESTABLECER_CONTRASENA: 'env.tipoContrasena',
}

/**
 * Qué sale de verdad del servidor: es lo único de la plataforma que puede
 * estar roto sin que nada lo parezca, porque con los SMS en modo de prueba
 * las citas se confirman igual y nadie recibe nada. Estaba encima de la lista
 * de negocios; vive aquí, junto a lo que ha pasado, que es donde se mira
 * cuando alguien dice que no le llegó un aviso.
 *
 * La línea de cada canal la escribe el servidor tal cual la pone en su log de
 * arranque, en castellano: es un diagnóstico, y reescribirlo aquí sería
 * perder precisión justo donde importa. Lo de alrededor sí va traducido.
 */
function Envios() {
  const { t, locale } = useIdioma()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'envios'],
    queryFn: api.adminEnvios,
  })
  if (isLoading) return <Skeleton className="h-48" />
  if (isError || !data) return <ErrorNote>{t('act.noSePudoCargar')}</ErrorNote>

  const sms = data.ultimos7dias.filter((f) => f.canal === 'SMS')
  const canales = [
    ['env.correo', data.correo],
    ['env.sms', data.sms],
  ] as const

  return (
    <Card padded>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-subheading font-semibold text-ink">{t('env.titulo')}</h2>
        <p className="text-meta text-subtle">{t('env.pista')}</p>
      </div>

      <dl className="flex flex-col gap-3">
        {canales.map(([clave, canal]) => (
          <div key={clave} className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <dt className="w-[60px] shrink-0 pt-0.5 text-meta font-semibold text-body-2">
              {t(clave)}
            </dt>
            <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Badge tone={canal.activo ? 'ok' : 'warn'}>
                {canal.activo ? t('env.activo') : t('env.noSale')}
              </Badge>
              <span className="min-w-0 text-meta break-words text-muted">{canal.texto}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-meta font-semibold text-body-2">
          {t('env.smsUltimos7')}
          {data.ultimoSmsEnviado && (
            <span className="ml-2 font-normal text-subtle">
              {t('env.ultimoSms', {
                fecha: new Date(data.ultimoSmsEnviado).toLocaleString(locale, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </span>
          )}
        </p>
        {sms.length === 0 ? (
          <p className="text-meta text-subtle">{t('env.sinSms')}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-meta">
            {sms.map((f) => (
              <li
                key={`${f.tipo}-${f.estado}-${f.motivo ?? ''}`}
                className="flex flex-wrap gap-x-2 text-body-2"
              >
                <span className="font-semibold text-ink">
                  {TIPO_CLAVE[f.tipo] ? t(TIPO_CLAVE[f.tipo]!) : f.tipo}
                </span>
                <span>
                  {f.estado === 'ENVIADO'
                    ? t('env.enviados', { n: f.total })
                    : t('env.noEnviados', { n: f.total })}
                </span>
                {f.motivo && <span className="text-subtle">· {f.motivo}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export function PanelActividad() {
  const { t } = useTextosRegistro()
  const { slug } = useParams()
  const { user } = useAuth()
  const [filtro, setFiltro] = useState<string>('')
  const idBase = useId()
  const [vista, setVista] = useState<'registro' | 'envios'>('registro')

  const esSuperadmin = user?.role === 'SUPERADMIN'
  // Los envíos son de toda la plataforma: solo en la Actividad de la trastienda.
  const conEnvios = esSuperadmin && !slug

  // El superadmin ve el registro del negocio que tenga abierto; en /panel/admin
  // (sin slug) lo ve entero. Al admin la API le fuerza el suyo de todas formas,
  // así que este filtro solo tiene efecto para el superadmin.
  const { data: businesses } = useQuery({
    queryKey: ['panel', 'businesses'],
    queryFn: api.panelBusinesses,
    enabled: esSuperadmin && !!slug,
  })
  const businessId = esSuperadmin ? businesses?.find((b) => b.slug === slug)?.id : undefined

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['audit', slug ?? 'plataforma', businessId ?? '', filtro],
      queryFn: ({ pageParam }) =>
        api.auditLog({
          ...(filtro ? { action: filtro } : {}),
          ...(businessId ? { businessId } : {}),
          ...(pageParam ? { cursor: pageParam } : {}),
          limit: 50,
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    })

  const entries = data?.pages.flatMap((p) => p.entries) ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('act.titulo')}
        hint={esSuperadmin ? t('act.pistaPlataforma') : t('act.pistaNegocio')}
      />

      {conEnvios && (
        <Tabs
          idBase={idBase}
          tabs={[
            { id: 'registro', label: t('act.registro') },
            { id: 'envios', label: t('env.titulo') },
          ]}
          activa={vista}
          onCambiar={setVista}
          label={t('act.titulo')}
        />
      )}

      {conEnvios && vista === 'envios' ? (
        <div {...panelProps(idBase, vista)} className="outline-none">
          <Envios />
        </div>
      ) : (
        <div
          {...(conEnvios ? panelProps(idBase, vista) : {})}
          className="flex flex-col gap-5 outline-none"
        >
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <FilterChip key={f.key} active={filtro === f.key} onClick={() => setFiltro(f.key)}>
                {t(f.clave)}
              </FilterChip>
            ))}
          </div>

          {error && <ErrorNote>{t('act.noSePudoCargar')}</ErrorNote>}

          {isLoading ? (
            <Card className="flex flex-col gap-3 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </Card>
          ) : entries.length === 0 ? (
            <EmptyState title={t('act.todaviaNoHay')} hint={t('act.todaviaNoHayPista')} />
          ) : (
            <Card className="px-5 py-1">
              <ul>
                {entries.map((e) => (
                  <Fila key={e.id} e={e} verIp={esSuperadmin} />
                ))}
              </ul>
            </Card>
          )}

          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? t('comun.cargando') : t('act.verMas')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
