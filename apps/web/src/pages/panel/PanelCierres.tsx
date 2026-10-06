import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button, Card, EmptyState, PageHeader } from '../../components/ui'
import { CerrarDias } from './CerrarDias'
import { PestanasSeccion } from '../../components/PestanasSeccion'
import { useIdioma, usePlural } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso } from '../../components/Avisos'

/**
 * Cierres y vacaciones: los días en que el negocio no abre.
 *
 * Estaban al final de El negocio, debajo de la ficha pública y de las fotos,
 * cuando lo que cambian es el horario: ahora son su pestaña, en Horario y
 * locales.
 */
export function PanelCierres() {
  const { t, locale } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()

  const formatoDia = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  const { data: cierres } = useQuery({
    queryKey: ['panel', slug, 'closures'],
    queryFn: () => api.panelClosures(slug),
  })

  const [cerrando, setCerrando] = useState(false)
  const [aAbrir, setAAbrir] = useState<{ ids: string[]; dias: string } | null>(null)

  const invalidarCierres = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug, 'closures'] })
    queryClient.invalidateQueries({ queryKey: ['availability', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const borrarCierre = useMutation({
    mutationFn: (c: { ids: string[]; dias: string }) => api.deleteClosure(slug, c.ids),
    onSuccess: (_r, c) => {
      setAAbrir(null)
      invalidarCierres()
      aviso.ok(t('neg.diasAbiertos', { dias: c.dias }))
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.horarioYLocales')}
        hint={t('neg.vacacionesPista')}
        actions={<Button onClick={() => setCerrando(true)}>{t('cierre.cerrarDias')}</Button>}
      />
      <PestanasSeccion seccion="horario" />

      <div>
        {cierres && cierres.length === 0 && (
          <EmptyState
            title={t('cierre.sinCierres')}
            hint={t('cierre.sinCierresPista')}
            action={<Button onClick={() => setCerrando(true)}>{t('cierre.cerrarDias')}</Button>}
          />
        )}

        {cierres && cierres.length > 0 && (
          <Card className="overflow-hidden">
            <ul>
              {cierres.map((c) => (
                <li
                  key={c.ids[0]}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
                >
                  <div className="min-w-[220px] flex-1">
                    <div className="text-ui font-semibold text-ink">
                      {c.from === c.to
                        ? formatoDia(c.from)
                        : t('neg.delAl', {
                            desde: formatoDia(c.from),
                            hasta: formatoDia(c.to),
                          })}
                    </div>
                    <p className="mt-0.5 text-meta text-muted">
                      {plural(c.ids.length, 'neg.unDia', 'neg.variosDias')}
                      {c.reason && ` · ${c.reason}`}
                    </p>
                  </div>
                  <div className="ml-auto sm:ml-0">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        setAAbrir({
                          ids: c.ids,
                          dias:
                            c.from === c.to
                              ? formatoDia(c.from)
                              : t('neg.delAl', {
                                  desde: formatoDia(c.from),
                                  hasta: formatoDia(c.to),
                                }),
                        })
                      }
                    >
                      {t('neg.quitar')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {cerrando && <CerrarDias slug={slug} open onClose={() => setCerrando(false)} />}

        <ConfirmDialog
          open={!!aAbrir}
          onClose={() => {
            borrarCierre.reset()
            setAAbrir(null)
          }}
          title={t('neg.abrirTitulo', { dias: aAbrir?.dias ?? '' })}
          consecuencias={[t('neg.abrirC1'), t('neg.abrirC2')]}
          confirmLabel={t('neg.abrirEsosDias')}
          onConfirm={() => aAbrir && borrarCierre.mutate(aAbrir)}
          loading={borrarCierre.isPending}
          error={borrarCierre.isError ? t('neg.noSePudoQuitar') : null}
        />
      </div>
    </div>
  )
}
