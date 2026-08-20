import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Camera, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import {
  reportOperationalIssue,
  uploadIssueAttachment,
  type OperationalIssueImpact,
} from '@/features/activities/api/activities-api'

const PROBLEM_TYPES = [
  { value: 'equipamento', label: 'Equipamento com defeito' },
  { value: 'lampada', label: 'Lâmpada / iluminação' },
  { value: 'falta_item', label: 'Falta de item / material' },
  { value: 'infraestrutura', label: 'Infraestrutura / instalação' },
  { value: 'higiene', label: 'Higiene / limpeza' },
  { value: 'seguranca', label: 'Segurança / risco' },
  { value: 'outro', label: 'Outro' },
] as const

const IMPACTS: { value: OperationalIssueImpact; label: string }[] = [
  { value: 'blocked', label: 'Não consigo seguir o trabalho' },
  { value: 'degraded', label: 'Consigo trabalhar com dificuldade' },
  { value: 'normal', label: 'Trabalho segue, mas precisa atenção' },
]

export function ReportIssuePage() {
  const { activityId: activityIdParam } = useParams()
  const sourceOccurrenceId = Number(activityIdParam)
  const hasLinkedActivity = Number.isFinite(sourceOccurrenceId) && sourceOccurrenceId > 0
  const navigate = useNavigate()
  const location = useLocation()
  const titleHint =
    (location.state as { titleHint?: string; area?: string } | null)?.titleHint?.trim() || ''
  const areaHint =
    (location.state as { area?: string } | null)?.area?.trim() ||
    (hasLinkedActivity ? 'Área da atividade' : '')
  const { portalToken } = useAuth()

  const [problemType, setProblemType] = useState<(typeof PROBLEM_TYPES)[number]['value']>('outro')
  const [title, setTitle] = useState(titleHint ? `Problema em: ${titleHint}` : '')
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState<OperationalIssueImpact>('degraded')
  const [locationLabel, setLocationLabel] = useState(areaHint)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const captureInputRef = useRef<HTMLInputElement>(null)

  const typeLabel = PROBLEM_TYPES.find((t) => t.value === problemType)?.label ?? 'Outro'
  const effectiveTitle = (title.trim() || typeLabel).trim()
  const canSubmit = effectiveTitle.length > 0 && !busy

  const onSubmit = async () => {
    if (!portalToken || !canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const issue = await reportOperationalIssue(portalToken, {
        title: effectiveTitle,
        description: [`Tipo: ${typeLabel}`, description.trim() || null].filter(Boolean).join('\n\n'),
        operationalImpact: impact,
        locationLabel: locationLabel.trim() || null,
        sourceOccurrenceId: hasLinkedActivity ? sourceOccurrenceId : null,
      })
      if (file) {
        await uploadIssueAttachment(portalToken, issue.id, file)
      }
      if (hasLinkedActivity) navigate(-1)
      else navigate('/meus-problemas', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao reportar problema.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="px-0.5">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
          onClick={() => (hasLinkedActivity ? navigate(-1) : navigate('/inicio'))}
        >
          <ChevronLeft className="size-4" />
          Voltar
        </button>
      </div>

      <PortalSectionCard
        title="Relatar problema"
        description="Registre falhas do dia a dia no local de trabalho: equipamento, iluminação, falta de material e semelhantes. A operação recebe o aviso."
      >
        <div className="space-y-4 px-4 py-4">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-600">Tipo do problema</legend>
            <div className="flex flex-wrap gap-2">
              {PROBLEM_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                    problemType === opt.value
                      ? 'bg-brand-deep text-white ring-brand-deep'
                      : 'bg-white text-slate-800 ring-slate-300'
                  }`}
                  onClick={() => {
                    setProblemType(opt.value)
                    if (!title.trim() || PROBLEM_TYPES.some((t) => t.label === title.trim())) {
                      setTitle(opt.label)
                    }
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Título</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Lâmpada queimada na câmara fria"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Descrição</span>
            <textarea
              className="min-h-[5.5rem] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que está acontecendo? Onde fica? Há risco ou urgência?"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Local / setor (opcional)</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="Ex.: Loja, Fábrica, cozinha, estoque…"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-600">Impacto no trabalho</legend>
            <div className="flex flex-wrap gap-2">
              {IMPACTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                    impact === opt.value
                      ? 'bg-brand-deep text-white ring-brand-deep'
                      : 'bg-white text-slate-800 ring-slate-300'
                  }`}
                  onClick={() => setImpact(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">Foto do problema (opcional)</p>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white"
              onClick={() => captureInputRef.current?.click()}
            >
              <Camera className="size-3.5" />
              Tirar foto agora
            </button>
            {file ? <p className="text-xs text-emerald-700">Arquivo: {file.name}</p> : null}
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            className="min-h-11 w-full rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void onSubmit()}
          >
            {busy ? 'Enviando…' : 'Enviar para a operação'}
          </button>

          {!hasLinkedActivity ? (
            <p className="text-center text-[11px] text-slate-500">
              Acompanhe em{' '}
              <Link to="/meus-problemas" className="font-semibold text-brand-deep">
                Meus problemas
              </Link>
            </p>
          ) : null}
        </div>
      </PortalSectionCard>

      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
    </section>
  )
}
