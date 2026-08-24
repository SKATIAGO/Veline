import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { formatPrice } from '@veline/shared'
import { api, type AuditEntry } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Card, EmptyState, ErrorNote, Spinner, cx } from '../../components/ui'

/**
 * Registro de actividad: quién hizo qué y cuándo.
 *
 * Lo ve el ADMIN de su negocio y el superadmin de todos. El EMPLEADO no tiene
 * la pestaña, y la API le respondería 403 igualmente.
 */

/** Cómo se presenta cada tipo de hecho. El color agrupa por naturaleza. */
const ACCIONES: Record<string, { label: string; tono: 'neutro' | 'aviso' | 'alta' | 'baja' }> = {
  SESION_INICIADA: { label: 'Inicio de sesión', tono: 'neutro' },
  SESION_FALLIDA: { label: 'Acceso fallido', tono: 'aviso' },
  SESION_CERRADA: { label: 'Cierre de sesión', tono: 'neutro' },
  CONTRASENA_CAMBIADA: { label: 'Contraseña cambiada', tono: 'aviso' },
  CONTRASENA_RESTABLECIDA: { label: 'Contraseña restablecida', tono: 'aviso' },
  CONTRASENA_OLVIDADA: { label: 'Contraseña olvidada', tono: 'aviso' },
  USUARIO_CREADO: { label: 'Usuario creado', tono: 'alta' },
  USUARIO_ACTIVADO: { label: 'Usuario reactivado', tono: 'alta' },
  USUARIO_DESACTIVADO: { label: 'Usuario desactivado', tono: 'baja' },
  NEGOCIO_CREADO: { label: 'Negocio creado', tono: 'alta' },
  SERVICIO_CREADO: { label: 'Servicio creado', tono: 'alta' },
  SERVICIO_EDITADO: { label: 'Servicio editado', tono: 'neutro' },
  SERVICIO_ELIMINADO: { label: 'Servicio dado de baja', tono: 'baja' },
  HORARIO_EDITADO: { label: 'Horario cambiado', tono: 'neutro' },
  RESERVA_CREADA: { label: 'Reserva creada', tono: 'alta' },
  RESERVA_CANCELADA: { label: 'Reserva cancelada', tono: 'baja' },
}

const TONOS = {
  neutro: 'bg-canvas text-subtle border-line',
  aviso: 'bg-amber-50 text-amber-800 border-amber-200',
  alta: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  baja: 'bg-rose-50 text-rose-800 border-rose-200',
} as const

/** Filtros rápidos: los tres motivos reales por los que se abre esta pantalla. */
const FILTROS = [
  { key: '', label: 'Todo' },
  { key: 'RESERVA_CANCELADA', label: 'Cancelaciones' },
  { key: 'SESION_FALLIDA', label: 'Accesos fallidos' },
  { key: 'USUARIO_CREADO', label: 'Altas de usuario' },
] as const

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })

/** Nombres legibles para las claves del detalle. Sin esto se leen en crudo. */
const ETIQUETAS: Record<string, string> = {
  codigo: 'Código',
  cuando: 'Cita',
  motivo: 'Motivo',
  canceladaPor: 'Cancelada por',
  origen: 'Origen',
  precioCents: 'Precio',
  duracionMin: 'Duración',
  bufferMin: 'Margen',
  rol: 'Rol',
  negocio: 'Negocio',
  categoria: 'Categoría',
  ciudad: 'Ciudad',
  slug: 'Identificador',
  activo: 'Activo',
  active: 'Activo',
  name: 'Nombre',
  description: 'Descripción',
  durationMin: 'Duración',
  priceCents: 'Precio',
  antes: 'Antes',
  despues: 'Después',
}

const ES_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** Un valor suelto del detalle, ya legible: fechas, precios y booleanos. */
function valorLegible(clave: string, v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'string' && ES_ISO.test(v)) return fecha(v)
  if (typeof v === 'number' && /cents$/i.test(clave)) return formatPrice(v)
  if (typeof v === 'number' && /min$/i.test(clave)) return `${v} min`
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** El detalle solo se muestra si dice algo: un objeto vacío es ruido. */
function Detalle({ metadata }: { metadata: unknown }) {
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
          <div key={k} className="flex gap-1.5 text-[12px]">
            <dt className="text-muted">{ETIQUETAS[k] ?? k}:</dt>
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
  const meta = ACCIONES[e.action] ?? { label: e.action, tono: 'neutro' as const }

  return (
    <li className="border-b border-line py-3.5 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={cx(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                TONOS[meta.tono],
              )}
            >
              {meta.label}
            </span>
            <span className="text-[14px] text-ink">{e.summary}</span>
          </div>

          <p className="mt-1 text-[12px] text-muted">
            {e.actorName ? (
              <>
                {e.actorName} · {e.actorEmail}
              </>
            ) : e.actorEmail ? (
              e.actorEmail
            ) : (
              'Sin sesión (cliente)'
            )}
            {e.business && <> · {e.business.name}</>}
            {verIp && e.ip && <> · {e.ip}</>}
          </p>

          <Detalle metadata={e.metadata} />
        </div>

        <time className="shrink-0 text-[12px] text-muted tabular-nums" dateTime={e.createdAt}>
          {fecha(e.createdAt)}
        </time>
      </div>
    </li>
  )
}

export function PanelActividad() {
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
      <header>
        <h1 className="text-[22px] font-semibold text-ink">Registro de actividad</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Quién ha hecho qué y cuándo.{' '}
          {esSuperadmin
            ? 'Como superadmin ves toda la plataforma.'
            : 'Solo se muestra la actividad de tu negocio.'}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
              filtro === f.key
                ? 'border-ink bg-ink text-cream'
                : 'border-line bg-surface text-subtle hover:border-brand hover:text-ink',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorNote>No se ha podido cargar el registro de actividad.</ErrorNote>}

      {isLoading ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Todavía no hay actividad registrada"
          hint="Aquí aparecerán los accesos, los cambios de configuración y las cancelaciones."
        />
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
            variant="ghost"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Cargando…' : 'Ver más'}
          </Button>
        </div>
      )}
    </div>
  )
}
