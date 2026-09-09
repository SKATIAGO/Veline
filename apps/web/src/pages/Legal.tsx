import { Link, useLocation } from 'react-router-dom'
import {
  ALMACENAMIENTO,
  COOKIES,
  CONTACTO_LEGAL,
  DATOS,
  ENCARGADOS,
  LEGAL_ACTUALIZADO,
} from '../content/legal'
import { Card } from '../components/ui'
import { Texto, useIdioma, type Clave } from '../i18n/idioma'

/**
 * Aviso de privacidad y política de cookies, en una sola pantalla con dos
 * anclas (/privacidad y /cookies llegan aquí).
 *
 * Están juntas a propósito: quien busca una casi siempre acaba queriendo la
 * otra, y separarlas obliga a repetir la mitad del texto en las dos.
 *
 * El contenido sale de content/legal.ts, que es el inventario de lo que el
 * sistema hace de verdad. Escrito para que lo entienda quien va a reservar una
 * cita, no para que lo firme un abogado: las dos leyes que aplican —el RGPD en
 * España y la LFPDPPP en México— piden justamente que se entienda.
 *
 * Los nombres de las leyes y de los organismos NO se traducen: quien tenga que
 * reclamar necesita el nombre real para encontrarlos. En la versión inglesa se
 * dejan tal cual y se explica al lado qué son.
 */

/* Cada derecho es una palabra en negrita dentro de una frase. Van en pareja
   —la palabra y la frase con su hueco— para que en inglés la negrita pueda
   caer donde le toque y no donde cae en castellano. */
const DERECHOS = [
  ['leg.ver', 'leg.verTexto'],
  ['leg.corregir', 'leg.corregirTexto'],
  ['leg.borrar', 'leg.borrarTexto'],
  ['leg.oponerte', 'leg.oponerteTexto'],
  ['leg.llevartelo', 'leg.llevarteloTexto'],
] as const satisfies readonly (readonly [Clave, Clave])[]

function Titulo({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-12 mb-4 scroll-mt-24 font-display text-heading-sm font-semibold text-ink"
    >
      {children}
    </h2>
  )
}

function Parrafo({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 max-w-[68ch] text-ui leading-relaxed text-body">{children}</p>
}

export function Legal() {
  const { t, locale } = useIdioma()
  const { pathname } = useLocation()
  const enCookies = pathname === '/cookies'

  /* La fecha se guarda en ISO y se escribe según el idioma: «8 de septiembre
     de 2026» y «8 September 2026». Con la fecha escrita a mano habría dos, y
     una se quedaría atrás en la siguiente revisión. */
  const revisado = new Date(`${LEGAL_ACTUALIZADO}T00:00:00`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-14 lg:px-16">
      <div className="max-w-[820px]">
        <h1 className="font-display text-[32px] leading-tight font-semibold text-ink sm:text-[40px]">
          {enCookies ? t('leg.cookies') : t('leg.privacidad')}
        </h1>
        <p className="mt-3 text-meta text-subtle">{t('leg.ultimaRevision', { fecha: revisado })}</p>

        <Parrafo>
          <span className="mt-6 block" />
          {t('leg.intro')}
        </Parrafo>

        <div className="mt-6 flex flex-wrap gap-2 text-body">
          <Link
            to="/privacidad"
            className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold text-body-2 hover:border-brand hover:text-brand"
          >
            {t('leg.queDatos')}
          </Link>
          <Link
            to="/cookies"
            className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold text-body-2 hover:border-brand hover:text-brand"
          >
            {t('leg.cookies')}
          </Link>
        </div>

        {/* ── COOKIES ── */}
        <Titulo id="cookies">{t('leg.queCookies')}</Titulo>
        <Parrafo>
          <Texto
            clave="leg.cookiesTexto"
            partes={{
              sinPublicidad: (
                <strong className="font-semibold text-ink">{t('leg.sinPublicidad')}</strong>
              ),
            }}
          />
        </Parrafo>

        <Card className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body">
            <thead>
              <tr className="border-b border-line text-meta text-muted">
                <th className="px-4 py-3 font-semibold">{t('leg.colCookie')}</th>
                <th className="px-4 py-3 font-semibold">{t('leg.colParaQue')}</th>
                <th className="px-4 py-3 font-semibold">{t('leg.colDura')}</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.nombre} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <code className="text-meta font-semibold text-ink">{c.nombre}</code>
                    <div className="mt-0.5 text-caption text-subtle">{t(c.quien)}</div>
                  </td>
                  <td className="max-w-[380px] px-4 py-3 align-top text-body-2">{t(c.para)}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-body-2">{t(c.dura)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Parrafo>
          <span className="mt-6 block" />
          {t('leg.ademasGuardamos')}
        </Parrafo>
        <ul className="mb-4 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-ui leading-relaxed text-body">
          {ALMACENAMIENTO.map((a) => (
            <li key={a.nombre}>
              <code className="text-meta font-semibold text-ink">{a.nombre}</code> — {t(a.para)}{' '}
              <span className="text-subtle">({t(a.dura)}.)</span>
            </li>
          ))}
        </ul>
        <Parrafo>{t('leg.puedesBorrarlas')}</Parrafo>

        {/* ── DATOS ── */}
        <Titulo id="datos">{t('leg.queDatosPorQue')}</Titulo>
        <div className="flex flex-col gap-4">
          {DATOS.map((d) => (
            <Card key={d.quien} padded>
              <p className="font-display text-ui font-semibold text-ink">{t(d.quien)}</p>
              <dl className="mt-3 flex flex-col gap-2 text-body">
                {(
                  [
                    ['leg.etQue', d.que],
                    ['leg.etParaQue', d.para],
                    ['leg.etCuanto', d.cuanto],
                  ] as [Clave, Clave][]
                ).map(([et, valor]) => (
                  <div key={et} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                    <dt className="shrink-0 text-meta font-semibold text-muted sm:w-[104px]">
                      {t(et)}
                    </dt>
                    <dd className="text-body-2">{t(valor)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>

        {/* ── TERCEROS ── */}
        <Titulo id="terceros">{t('leg.quienMasLosVe')}</Titulo>
        <Parrafo>{t('leg.tercerosIntro')}</Parrafo>
        <ul className="mb-4 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-ui leading-relaxed text-body">
          {ENCARGADOS.map((e) => (
            <li key={e.nombre}>
              <strong className="font-semibold text-ink">{e.nombre}</strong>{' '}
              <span className="text-subtle">({t(e.donde)})</span> — {t(e.para)}
            </li>
          ))}
        </ul>
        <Parrafo>{t('leg.elNegocioTambien')}</Parrafo>

        {/* ── DERECHOS ── */}
        <Titulo id="derechos">{t('leg.quePuedesPedir')}</Titulo>
        <Parrafo>
          <Texto
            clave="leg.escribiendoA"
            partes={{
              correo: (
                <a
                  href={`mailto:${CONTACTO_LEGAL}`}
                  className="font-semibold text-brand-text hover:underline"
                >
                  {CONTACTO_LEGAL}
                </a>
              ),
            }}
          />
        </Parrafo>
        <ul className="mb-4 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-ui leading-relaxed text-body">
          {DERECHOS.map(([accion, frase]) => (
            <li key={accion}>
              <Texto
                clave={frase}
                partes={{
                  accion: <strong className="font-semibold text-ink">{t(accion)}</strong>,
                }}
              />
            </li>
          ))}
        </ul>
        <Parrafo>{t('leg.autoridades')}</Parrafo>
        <Parrafo>{t('leg.contestamos')}</Parrafo>
      </div>
    </div>
  )
}
