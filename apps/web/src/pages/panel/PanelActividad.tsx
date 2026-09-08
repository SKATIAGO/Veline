import { useState } from 'react'
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
  HORARIO_EDITADO: { clave: 'act.horarioEditado', tono: 'neutral' },
  RESERVA_CREADA: { clave: 'act.reservaCreada', tono: 'ok' },
  RESERVA_CANCELADA: { clave: 'act.reservaCancelada', tono: 'off' },
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
          <div key={k} className="flex gap-1.5 text-meta">
            <dt className="text-muted">{ETIQUETAS[k] ? t(ETIQUETAS[k]) : k}:</dt>
            <dd className="font-medium text-subtle">
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

function Fila({ e, verIp }: { e: AuditEntry; verIp: boolean }) {
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
            {e.business && <> · {e.business.name}</>}
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

export function PanelActividad() {
  const { t } = useTextosRegistro()
  const { slug } = useParams()
  const { user } = useAuth()
  const [filtro, setFiltro] = useState<string>('')

  const esSuperadmin = user?.role === 'SUPERADMIN'

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
  )
}
