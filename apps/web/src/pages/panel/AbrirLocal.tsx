import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button, Field, Input, Skeleton, cx } from '../../components/ui'
import { FranjasSemanales, ORDEN_SEMANA, type Franja } from '../../components/FranjasSemanales'
import { useIdioma, usePlural } from '../../i18n/idioma'
import { aviso, textoDeError } from '../../components/Avisos'
import { Wizard } from '../../components/Wizard'

const vacio = { name: '', street: '', city: '', postalCode: '' }

/**
 * Abrir un local nuevo, de principio a fin.
 *
 * Un local no ofrece ni un hueco hasta que tiene horario y alguien que
 * atienda. Antes eso eran tres viajes —Locales, luego Horario eligiendo el
 * local, luego Equipo cambiando el local de cada persona—, y el dueño se
 * enteraba de lo que faltaba cuando un cliente decía que no podía reservar.
 * Ahora son tres pasos seguidos, y el local se crea al final con todo.
 *
 * Se crea al final y no al principio a propósito: crear el local avisa a
 * Veline para que lo apruebe, y ese aviso tiene que llegar una sola vez y con
 * el local ya completo. Si algo falla a medias, el local ya creado se
 * recuerda y al reintentar solo se repite lo que falta.
 */
export function AbrirLocal({
  slug,
  open,
  onClose,
}: {
  slug: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useIdioma()
  const plural = usePlural()
  const id = useId()
  const queryClient = useQueryClient()

  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState(vacio)
  const [conHorario, setConHorario] = useState(true)
  // null = sin tocar: se enseña el horario del local principal como punto de partida.
  const [semana, setSemana] = useState<Record<number, Franja[]> | null>(null)
  const [elegidas, setElegidas] = useState<string[]>([])
  const [creadoId, setCreadoId] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ nombre: string; horario: boolean; personas: number } | null>(
    null,
  )

  const { data: locales } = useQuery({
    queryKey: ['panel', slug, 'locales'],
    queryFn: () => api.panelLocales(slug),
    enabled: open,
  })
  const principal = locales?.[0]
  const { data: horasPrincipal, isLoading: cargandoHoras } = useQuery({
    queryKey: ['panel', slug, 'hours', principal?.id ?? ''],
    queryFn: () => api.panelHours(slug, principal?.id),
    enabled: open && !!principal,
  })
  const { data: personas } = useQuery({
    queryKey: ['panel', slug, 'staff'],
    queryFn: () => api.panelStaff(slug),
    enabled: open,
  })
  const activas = (personas ?? []).filter((p) => p.active)

  const deLaPrincipal = (): Record<number, Franja[]> => {
    const w: Record<number, Franja[]> = {}
    for (const wd of ORDEN_SEMANA) w[wd] = []
    for (const h of horasPrincipal ?? [])
      w[h.weekday]!.push({ startMin: h.startMin, endMin: h.endMin })
    return w
  }
  const semanaActual = semana ?? deLaPrincipal()
  const franjas = ORDEN_SEMANA.flatMap((wd) =>
    (semanaActual[wd] ?? []).map((f) => ({ weekday: wd, ...f })),
  )

  const nombreLocal = (localId: string | null) =>
    localId ? (locales?.find((l) => l.id === localId)?.name ?? '') : ''

  const abrir = useMutation({
    mutationFn: async () => {
      // 1. El local. Si ya se creó en un intento anterior, no se repite.
      let localId = creadoId
      if (!localId) {
        const r = await api.crearLocal(slug, {
          name: form.name.trim(),
          street: form.street.trim(),
          city: form.city.trim(),
          postalCode: form.postalCode.trim(),
        })
        localId = r.id
        setCreadoId(r.id)
      }
      // 2. Su horario, y 3. quién atiende: ambas son idempotentes.
      if (conHorario && franjas.length > 0) await api.saveHours(slug, franjas, localId)
      for (const staffId of elegidas) await api.updateStaff(slug, staffId, { locationId: localId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['business', slug] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      aviso.ok(t('loc.creado', { nombre: form.name.trim() }))
      setHecho({
        nombre: form.name.trim(),
        horario: conHorario && franjas.length > 0,
        personas: elegidas.length,
      })
    },
  })

  const alternar = (staffId: string) =>
    setElegidas((e) => (e.includes(staffId) ? e.filter((x) => x !== staffId) : [...e, staffId]))

  const opcion = (activa: boolean, titulo: string, texto: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cx(
        'flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors duration-200',
        activa ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className="text-[14px] font-semibold text-ink">{titulo}</span>
      <span className="text-meta text-muted">{texto}</span>
    </button>
  )

  const set = (k: keyof typeof vacio, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const pasos = [
    {
      id: 'local',
      titulo: t('alocal.pasoLocal'),
      problema:
        form.name.trim().length < 2
          ? t('loc.errNombre')
          : form.street.trim().length < 3
            ? t('loc.errCalle')
            : form.city.trim().length < 2
              ? t('loc.errCiudad')
              : !/^\d{5}$/.test(form.postalCode.trim())
                ? t('loc.errCp')
                : null,
      contenido: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('loc.nombre')} htmlFor={`${id}-n`} hint={t('loc.nombrePista')} required>
            <Input
              id={`${id}-n`}
              autoComplete="off"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label={t('loc.calle')} htmlFor={`${id}-c`} required>
            <Input
              id={`${id}-c`}
              autoComplete="off"
              value={form.street}
              onChange={(e) => set('street', e.target.value)}
            />
          </Field>
          <Field label={t('loc.ciudad')} htmlFor={`${id}-ci`} required>
            <Input
              id={`${id}-ci`}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
          </Field>
          <Field label={t('loc.cp')} htmlFor={`${id}-cp`} required>
            <Input
              id={`${id}-cp`}
              inputMode="numeric"
              maxLength={5}
              value={form.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
            />
          </Field>
        </div>
      ),
    },
    {
      id: 'horario',
      titulo: t('alocal.pasoHorario'),
      problema: !conHorario
        ? null
        : franjas.some((f) => f.endMin <= f.startMin)
          ? t('hor.franjaInvalida')
          : franjas.length === 0
            ? t('alocal.errSinFranjas')
            : null,
      contenido: cargandoHoras ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {opcion(conHorario, t('alocal.horarioAhora'), t('alocal.horarioAhoraPista'), () =>
              setConHorario(true),
            )}
            {opcion(!conHorario, t('alocal.horarioLuego'), t('alocal.horarioLuegoPista'), () =>
              setConHorario(false),
            )}
          </div>
          {conHorario && (
            <>
              {principal && semana === null && franjas.length > 0 && (
                <p className="text-meta text-muted">
                  {t('alocal.partimosDe', { local: principal.name })}
                </p>
              )}
              <FranjasSemanales
                week={semanaActual}
                onChange={(wd, r) => setSemana({ ...semanaActual, [wd]: r })}
                onCopiarALaborables={(wd) => {
                  const n = { ...semanaActual }
                  for (const otro of [1, 2, 3, 4, 5])
                    n[otro] = (semanaActual[wd] ?? []).map((f) => ({ ...f }))
                  setSemana(n)
                }}
              />
            </>
          )}
        </>
      ),
    },
    {
      id: 'personas',
      titulo: t('alocal.pasoPersonas'),
      problema: null,
      contenido: !personas ? (
        <Skeleton className="h-32" />
      ) : activas.length === 0 ? (
        <p className="rounded-xl bg-cream px-4 py-3 text-body text-body-2">
          {t('alocal.sinPersonas')}
        </p>
      ) : (
        <>
          <p className="text-body text-body-2">{t('alocal.personasTexto')}</p>
          <ul className="flex flex-col gap-2">
            {activas.map((p) => {
              // Sin local propio atienden en todos: ya cuentan para el nuevo.
              const enTodos = p.locationId === null
              const marcada = elegidas.includes(p.id)
              return (
                <li key={p.id}>
                  <label
                    className={cx(
                      'flex min-h-14 items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors duration-200',
                      enTodos ? 'border-line bg-cream' : 'cursor-pointer',
                      marcada ? 'border-brand bg-brand/5' : 'border-line bg-surface',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={enTodos || marcada}
                      disabled={enTodos}
                      onChange={() => alternar(p.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-ink">{p.name}</span>
                      <span className="block text-meta text-muted">
                        {enTodos
                          ? t('alocal.yaEnTodos')
                          : marcada
                            ? t('alocal.dejaraDe', { local: nombreLocal(p.locationId) })
                            : t('alocal.ahoraEn', { local: nombreLocal(p.locationId) })}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      ),
    },
    {
      id: 'revisar',
      titulo: t('alocal.pasoRevisar'),
      problema: null,
      contenido: (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-xl bg-cream px-4 py-3 text-body">
            <dt className="text-muted">{t('loc.nombre')}</dt>
            <dd className="text-right font-semibold text-ink">{form.name.trim()}</dd>
            <dt className="text-muted">{t('alocal.direccion')}</dt>
            <dd className="text-right font-semibold text-ink">
              {form.street.trim()}, {form.postalCode.trim()} {form.city.trim()}
            </dd>
            <dt className="text-muted">{t('equipo.horario')}</dt>
            <dd className="text-right font-semibold text-ink">
              {conHorario && franjas.length > 0 ? t('alocal.conHorario') : t('alocal.sinHorario')}
            </dd>
            <dt className="text-muted">{t('alocal.quienAtiende')}</dt>
            <dd className="text-right font-semibold text-ink">
              {elegidas.length > 0
                ? elegidas.map((s) => activas.find((p) => p.id === s)?.name).join(', ')
                : activas.some((p) => p.locationId === null)
                  ? t('alocal.lasQueAtiendenEnTodos')
                  : t('alocal.nadie')}
            </dd>
          </dl>
          {(!conHorario || franjas.length === 0) && (
            <p className="text-meta text-brand-text">{t('alocal.avisoSinHorario')}</p>
          )}
          <p className="text-meta text-muted">{t('alocal.avisoAprobar')}</p>
        </>
      ),
    },
  ]

  const tocado = form.name.trim() !== '' || form.street.trim() !== '' || elegidas.length > 0

  return (
    <Wizard
      open={open}
      onClose={onClose}
      title={hecho ? t('alocal.hechoTitulo', { nombre: hecho.nombre }) : t('loc.abrir')}
      pasos={pasos}
      paso={paso}
      setPaso={(n) => {
        abrir.reset()
        setPaso(n)
      }}
      finalLabel={t('alocal.abrirBoton')}
      onFinalizar={() => abrir.mutate()}
      loading={abrir.isPending}
      error={
        abrir.isError
          ? `${textoDeError(abrir.error, t('avisos.error'))}${creadoId ? ` ${t('alocal.yaCreado')}` : ''}`
          : null
      }
      dirty={tocado}
      resultado={
        hecho && (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2 text-body text-ink">
              <li>✓ {t('alocal.okLocal')}</li>
              <li>
                {hecho.horario ? '✓' : '·'}{' '}
                {hecho.horario ? t('alocal.okHorario') : t('alocal.pendHorario')}
              </li>
              <li>
                {hecho.personas > 0 ? '✓' : '·'}{' '}
                {hecho.personas > 0
                  ? plural(hecho.personas, 'alocal.okUnaPersona', 'alocal.okVariasPersonas')
                  : t('alocal.pendPersonas')}
              </li>
              <li>· {t('alocal.pendAprobar')}</li>
            </ul>
            <div className="flex justify-end border-t border-line pt-4">
              <Button onClick={onClose}>{t('comun.listo')}</Button>
            </div>
          </div>
        )
      }
    />
  )
}
