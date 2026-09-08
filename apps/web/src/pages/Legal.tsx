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
 */

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
  const { pathname } = useLocation()
  const enCookies = pathname === '/cookies'

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-14 lg:px-16">
      <div className="max-w-[820px]">
        <h1 className="font-display text-[32px] leading-tight font-semibold text-ink sm:text-[40px]">
          {enCookies ? 'Cookies' : 'Privacidad'}
        </h1>
        <p className="mt-3 text-meta text-subtle">Última revisión: {LEGAL_ACTUALIZADO}</p>

        <Parrafo>
          <span className="mt-6 block" />
          Veline es una herramienta de reservas para negocios de barrio. Guardamos lo justo para que
          una cita funcione: quién viene, cuándo y a qué. Ni vendemos datos a nadie ni te seguimos
          por otras webs.
        </Parrafo>

        <div className="mt-6 flex flex-wrap gap-2 text-body">
          <Link
            to="/privacidad"
            className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold text-body-2 hover:border-brand hover:text-brand"
          >
            Qué datos guardamos
          </Link>
          <Link
            to="/cookies"
            className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold text-body-2 hover:border-brand hover:text-brand"
          >
            Cookies
          </Link>
        </div>

        {/* ── COOKIES ── */}
        <Titulo id="cookies">Qué cookies usamos</Titulo>
        <Parrafo>
          Una sola, y hace falta para que el panel funcione:{' '}
          <strong className="font-semibold text-ink">
            no usamos cookies de publicidad, ni de analítica, ni de redes sociales
          </strong>
          . Por eso no verás un cartel pidiéndote permiso para aceptarlas o rechazarlas: no hay nada
          opcional que aceptar. Si algún día lo hubiera, te lo preguntaríamos antes de ponerla.
        </Parrafo>

        <Card className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body">
            <thead>
              <tr className="border-b border-line text-meta text-muted">
                <th className="px-4 py-3 font-semibold">Cookie</th>
                <th className="px-4 py-3 font-semibold">Para qué</th>
                <th className="px-4 py-3 font-semibold">Dura</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.nombre} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <code className="text-meta font-semibold text-ink">{c.nombre}</code>
                    <div className="mt-0.5 text-caption text-subtle">{c.quien}</div>
                  </td>
                  <td className="max-w-[380px] px-4 py-3 align-top text-body-2">{c.para}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-body-2">{c.dura}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Parrafo>
          <span className="mt-6 block" />
          Además guardamos una cosa en el navegador que no es una cookie, pero se cuenta igual:
        </Parrafo>
        <ul className="mb-4 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-ui leading-relaxed text-body">
          {ALMACENAMIENTO.map((a) => (
            <li key={a.nombre}>
              <code className="text-meta font-semibold text-ink">{a.nombre}</code> — {a.para}{' '}
              <span className="text-subtle">({a.dura}.)</span>
            </li>
          ))}
        </ul>
        <Parrafo>
          Puedes borrar unas y otra desde los ajustes de tu navegador. Si borras la de sesión,
          simplemente tendrás que volver a entrar en el panel.
        </Parrafo>

        {/* ── DATOS ── */}
        <Titulo id="datos">Qué datos guardamos y por qué</Titulo>
        <div className="flex flex-col gap-4">
          {DATOS.map((d) => (
            <Card key={d.quien} padded>
              <p className="font-display text-ui font-semibold text-ink">{d.quien}</p>
              <dl className="mt-3 flex flex-col gap-2 text-body">
                {[
                  ['Qué', d.que],
                  ['Para qué', d.para],
                  ['Cuánto tiempo', d.cuanto],
                ].map(([et, valor]) => (
                  <div key={et} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                    <dt className="shrink-0 text-meta font-semibold text-muted sm:w-[104px]">
                      {et}
                    </dt>
                    <dd className="text-body-2">{valor}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>

        {/* ── TERCEROS ── */}
        <Titulo id="terceros">Quién más los ve</Titulo>
        <Parrafo>
          Nadie con fines propios. Solo las empresas que hacen falta para que el servicio funcione,
          y únicamente con lo imprescindible:
        </Parrafo>
        <ul className="mb-4 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-ui leading-relaxed text-body">
          {ENCARGADOS.map((e) => (
            <li key={e.nombre}>
              <strong className="font-semibold text-ink">{e.nombre}</strong>{' '}
              <span className="text-subtle">({e.donde})</span> — {e.para}
            </li>
          ))}
        </ul>
        <Parrafo>
          El negocio en el que reservas también ve tus datos de esa cita: es quien te va a atender.
          Cada negocio ve solo los suyos, nunca los de otro.
        </Parrafo>

        {/* ── DERECHOS ── */}
        <Titulo id="derechos">Qué puedes pedirnos</Titulo>
        <Parrafo>
          Escribiendo a{' '}
          <a
            href={`mailto:${CONTACTO_LEGAL}`}
            className="font-semibold text-brand-text hover:underline"
          >
            {CONTACTO_LEGAL}
          </a>{' '}
          puedes pedir, sin dar explicaciones:
        </Parrafo>
        <ul className="mb-4 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-ui leading-relaxed text-body">
          <li>
            <strong className="font-semibold text-ink">Ver</strong> qué tenemos tuyo.
          </li>
          <li>
            <strong className="font-semibold text-ink">Corregir</strong> lo que esté mal.
          </li>
          <li>
            <strong className="font-semibold text-ink">Borrar</strong> lo que ya no quieras que
            tengamos.
          </li>
          <li>
            <strong className="font-semibold text-ink">Oponerte</strong> a que lo usemos, o pedir
            que lo dejemos solo guardado sin tocarlo.
          </li>
          <li>
            <strong className="font-semibold text-ink">Llevártelo</strong> a otro sitio en un
            archivo.
          </li>
        </ul>
        <Parrafo>
          En España esos son los derechos del Reglamento General de Protección de Datos, y si crees
          que no los atendemos bien puedes acudir a la Agencia Española de Protección de Datos. En
          México son los derechos ARCO de la Ley Federal de Protección de Datos Personales en
          Posesión de los Particulares, y la autoridad es el INAI. Se piden igual: por correo, a la
          dirección de arriba.
        </Parrafo>
        <Parrafo>Contestamos lo antes posible y, como muy tarde, en un mes.</Parrafo>
      </div>
    </div>
  )
}
