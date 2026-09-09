import { readPortalErrorMessage } from '@/lib/portal-auth'
import { API_BASE_URL } from '@/lib/api'

export type CheckTargetKind = 'area' | 'room' | 'equipment'

export type ReferenceAttachment = {
  id: number
  filePath: string
  originalFileName: string | null
  mimeType: string | null
  sortOrder: number
}

export type PortalCheckableItem = {
  id: number
  name: string
  instruction: string | null
  responseType: 'confirmation' | 'status' | 'action' | string
  requirePhoto: boolean
  sortOrder: number
  referenceAttachments: ReferenceAttachment[]
}

export type PortalCheckTarget = {
  id: number
  organizationId: number
  kind: CheckTargetKind | string
  name: string
  code: string
  parentId?: number | null
  qrToken: string
  deepLink: string
  isActive: boolean
  activeItemCount: number
  items: PortalCheckableItem[]
}

export type ManagedCheckTargetSummary = {
  id: number
  organizationId: number
  kind: CheckTargetKind | string
  name: string
  code: string
  parentId: number | null
  isActive: boolean
  activeItemCount: number
}

export type PortalResolveResponse = {
  target: PortalCheckTarget
  inProgressExecutionId: number | null
  lastCompleted: {
    id: number
    finishedAt: string | null
    collaboratorId: number
    collaboratorName: string | null
  } | null
}

export type PortalExecutionEvidence = {
  id: number
  filePath: string
  originalFileName: string | null
  mimeType: string | null
  createdAt: string | null
}

export type PortalExecutionItem = {
  id: number
  organizationId: number
  checkExecutionId: number
  checkableItemId: number | null
  itemNameSnapshot: string
  instructionSnapshot: string | null
  responseTypeSnapshot: string
  requirePhotoSnapshot: boolean
  sortOrderSnapshot: number
  result: string | null
  actionTaken: string | null
  note: string | null
  completedAt: string | null
  referenceAttachments?: ReferenceAttachment[]
  evidences?: PortalExecutionEvidence[]
}

export type PortalExecution = {
  id: number
  organizationId: number
  checkTargetId: number
  collaboratorId: number
  mode: string
  status: 'in_progress' | 'completed' | 'cancelled' | string
  startedAt: string | null
  finishedAt: string | null
  items: PortalExecutionItem[]
}

async function requestJson<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('X-Collaborator-Portal-Token', token)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/${path}`, { ...options, headers })
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readPortalErrorMessage(body, response.status))
  }
  return body as T
}

async function requestBlob(path: string, token: string, signal?: AbortSignal): Promise<string> {
  const headers = new Headers()
  headers.set('X-Collaborator-Portal-Token', token)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/${path}`, { headers, signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new Error('Não foi possível carregar a imagem.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(readPortalErrorMessage(body, response.status))
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export async function resolveCheckTargetByToken(
  token: string,
  qrToken: string,
): Promise<PortalResolveResponse> {
  return requestJson<PortalResolveResponse>(
    `echeck_portal/check_targets/by_token/${encodeURIComponent(qrToken)}`,
    {},
    token,
  )
}

export async function startOrResumeCheckExecution(
  token: string,
  checkTargetId: number,
): Promise<PortalExecution> {
  return requestJson<PortalExecution>(
    'echeck_portal/check_executions',
    { method: 'POST', body: JSON.stringify({ checkTargetId }) },
    token,
  )
}

export async function fetchCheckExecution(token: string, executionId: number): Promise<PortalExecution> {
  return requestJson<PortalExecution>(`echeck_portal/check_executions/${executionId}`, {}, token)
}

export async function updateCheckExecutionItem(
  token: string,
  executionId: number,
  itemId: number,
  payload: { result?: string | null; actionTaken?: string | null; note?: string | null },
): Promise<PortalExecution> {
  return requestJson<PortalExecution>(
    `echeck_portal/check_executions/${executionId}/items/${itemId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    token,
  )
}

export async function uploadCheckExecutionEvidence(
  token: string,
  executionId: number,
  itemId: number,
  file: File,
): Promise<{ id: number }> {
  const form = new FormData()
  form.append('photo', file)
  return requestJson<{ id: number }>(
    `echeck_portal/check_executions/${executionId}/items/${itemId}/evidences`,
    { method: 'POST', body: form },
    token,
  )
}

export async function completeCheckExecution(
  token: string,
  executionId: number,
): Promise<PortalExecution> {
  return requestJson<PortalExecution>(
    `echeck_portal/check_executions/${executionId}/complete`,
    { method: 'POST' },
    token,
  )
}

export async function cancelCheckExecution(
  token: string,
  executionId: number,
): Promise<PortalExecution> {
  return requestJson<PortalExecution>(
    `echeck_portal/check_executions/${executionId}/cancel`,
    { method: 'POST' },
    token,
  )
}

export type PortalContextualIssue = {
  id: number
  title: string
  description: string | null
  checkTargetId: number | null
  checkableItemId: number | null
  locationLabel: string | null
}

export async function reportExecutionIssue(
  token: string,
  executionId: number,
  input: { description: string; title?: string; operationalImpact?: string },
): Promise<PortalContextualIssue> {
  return requestJson<PortalContextualIssue>(
    `echeck_portal/check_executions/${executionId}/issues`,
    { method: 'POST', body: JSON.stringify(input) },
    token,
  )
}

export async function reportExecutionItemIssue(
  token: string,
  executionId: number,
  itemId: number,
  input: { description: string; title?: string; operationalImpact?: string },
): Promise<PortalContextualIssue> {
  return requestJson<PortalContextualIssue>(
    `echeck_portal/check_executions/${executionId}/items/${itemId}/issues`,
    { method: 'POST', body: JSON.stringify(input) },
    token,
  )
}

export async function uploadOperationalIssuePhoto(
  token: string,
  issueId: number,
  file: File,
): Promise<{ id: number }> {
  const form = new FormData()
  form.append('photo', file)
  return requestJson<{ id: number }>(
    `echeck_portal/issues/${issueId}/attachments`,
    { method: 'POST', body: form },
    token,
  )
}

export async function fetchExecutionEvidenceBlob(
  token: string,
  evidenceId: number,
  signal?: AbortSignal,
): Promise<string> {
  return requestBlob(`echeck_portal/check_execution_evidences/${evidenceId}`, token, signal)
}

export async function fetchReferenceAttachmentBlob(
  token: string,
  attachmentId: number,
  signal?: AbortSignal,
): Promise<string> {
  return requestBlob(`echeck_portal/checkable_item_references/${attachmentId}`, token, signal)
}

export async function fetchManagedCheckTargets(
  token: string,
): Promise<{ data: ManagedCheckTargetSummary[] }> {
  return requestJson<{ data: ManagedCheckTargetSummary[] }>('echeck_portal/check_targets', {}, token)
}

export async function fetchManagedCheckTarget(
  token: string,
  targetId: number,
): Promise<PortalCheckTarget> {
  return requestJson<PortalCheckTarget>(`echeck_portal/check_targets/${targetId}`, {}, token)
}

export async function uploadManagedItemReference(
  token: string,
  itemId: number,
  file: File,
): Promise<ReferenceAttachment> {
  const form = new FormData()
  form.append('photo', file)
  return requestJson<ReferenceAttachment>(
    `echeck_portal/checkable_items/${itemId}/references`,
    { method: 'POST', body: form },
    token,
  )
}

export async function deleteManagedItemReference(
  token: string,
  attachmentId: number,
): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(
    `echeck_portal/checkable_item_references/${attachmentId}`,
    { method: 'DELETE' },
    token,
  )
}

export function kindLabel(kind: string): string {
  if (kind === 'area') return 'Área'
  if (kind === 'room') return 'Cômodo'
  if (kind === 'equipment') return 'Equipamento'
  return kind
}

export function formatLastCompleted(last: PortalResolveResponse['lastCompleted']): string {
  if (!last?.finishedAt) return 'Ainda não verificado'
  const when = new Date(last.finishedAt)
  const today = new Date()
  const sameDay =
    when.getFullYear() === today.getFullYear() &&
    when.getMonth() === today.getMonth() &&
    when.getDate() === today.getDate()
  const time = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const day = sameDay ? 'Hoje' : when.toLocaleDateString('pt-BR')
  const who = last.collaboratorName?.trim() || 'Colaborador'
  return `${day}, ${time} · ${who}`
}
