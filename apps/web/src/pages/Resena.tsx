import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatLongDate } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { Button, Card, EmptyState, ErrorNote, Spinner, Textarea, cx } from '../components/ui'

/**
 * Donde el cliente deja su reseña, con el enlace que le llegó por correo.
 *
 * Sin cuenta y en medio minuto: se puede puntuar sin escribir nada. Pedir que
 * se registre para opinar es la forma más segura de no recibir ninguna opinión.
 */

const ETIQUETA = ['', 'Mal', 'Regular', 'Bien', 'Muy bien', 'Genial']

export function Resena() {
  const { token = '' } = useParams()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [enviada, setEnviada] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['review', token],
    queryFn: () => api.getReview(token),
    retry: false,
  })

  const enviar = useMutation({
    mutationFn: () => api.sendReview(token, rating, comment.trim() || undefined),
    onSuccess: () => setEnviada(true),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
        <EmptyState
          title="Este enlace no vale"
          hint="Puede que ya hayas dejado tu opinión, o que el enlace esté incompleto."
        />
      </div>
    )
  }

  const yaEstaba = data.answered || enviada

  return (
    <div className="mx-auto flex max-w-[1440px] justify-center px-6 py-16 lg:px-16 lg:py-20">
      <Card className="w-full max-w-[480px] p-8 sm:p-10">
        {yaEstaba ? (
          <div className="text-center">
            <p className="font-display text-heading-sm font-semibold text-ink">¡Gracias!</p>
            <p className="mt-2 text-body text-muted">
              Tu opinión ya está guardada. Ayuda más de lo que parece a la gente del barrio que está
              decidiendo.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (rating > 0) enviar.mutate()
            }}
          >
            <p className="text-meta text-muted">{formatLongDate(new Date(data.startsAt))}</p>
            <h1 className="mt-1 font-display text-heading-sm font-semibold text-ink">
              ¿Qué tal fue en {data.businessName}?
            </h1>
            <p className="mt-2 text-body text-muted">
              Con puntuar basta, {data.customerName.split(' ')[0]}. Lo demás es opcional.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} de 5 · ${ETIQUETA[n]}`}
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                  className={cx(
                    'inline-flex size-12 items-center justify-center rounded-full border text-subheading',
                    'transition-[background-color,border-color,transform] duration-150 active:scale-95',
                    n <= rating
                      ? 'border-accent bg-accent text-ink'
                      : 'border-line bg-surface text-disabled hover:border-brand',
                  )}
                >
                  ★
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-1 text-body font-semibold text-body-2">{ETIQUETA[rating]}</span>
              )}
            </div>

            <div className="mt-6">
              <label
                htmlFor="comentario"
                className="mb-1.5 block text-meta font-semibold text-body-2"
              >
                ¿Quieres contar algo más?{' '}
                <span className="font-normal text-subtle">(opcional)</span>
              </label>
              <Textarea
                id="comentario"
                rows={4}
                maxLength={600}
                placeholder="Qué tal el trato, la puntualidad, el resultado…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {enviar.isError && (
              <div className="mt-4">
                <ErrorNote>
                  {enviar.error instanceof ApiError
                    ? enviar.error.message
                    : 'No se ha podido enviar'}
                </ErrorNote>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              block
              className="mt-6"
              loading={enviar.isPending}
              disabled={rating === 0}
            >
              {rating === 0 ? 'Elige una puntuación' : 'Enviar mi opinión'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
