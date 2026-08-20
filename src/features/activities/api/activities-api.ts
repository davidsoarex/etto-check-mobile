import { readPortalErrorMessage } from '@/lib/portal-auth'
import { API_BASE_URL } from '@/lib/api'

export type ActivityPriority = 'normal' | 'high' | 'urgent'
export type ActivityStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type CompletionResult = 'complete' | 'partial'

export type ActivityItem = {
  id: number
  type: string
  typeLabel?: string
  titleSnapshot: string
  periodicitySnapshot: string | null
  scheduledDate: string
  /** HH:mm from API when the occurrence has a frozen scheduled time. */
  scheduledTimeSnapshot?: string | null
  assignmentMode: 'fixed' | 'pool'
  assignedToCollaboratorId: number | null
  priority: ActivityPriority
  status: ActivityStatus
  executionType: string | null
  executionId: number | null
  canClaim: boolean
  canStart: boolean
  canContinue: boolean
  /** API: in_progress + assignee + tipo com conclusão direta (simple_task). */
  canComplete?: boolean
  canReceiveAttachments?: boolean
  progress: { counted: number; total: number } | null
  /** Pending past scheduledTimeSnapshot (server-computed). */
  isOverdue?: boolean
  /** Local de estoque da lista (conferência). */
  stockLocationName?: string | null
  completionResult?: CompletionResult | null
  completionJustification?: string | null
  completedAt?: string | null
}

export type ActivitiesInboxResponse = {
  date: string
  summary: { inProgress: number; pending: number; available: number; completed: number }
  inProgress: ActivityItem[]
  pending: ActivityItem[]
  available: ActivityItem[]
  completed: ActivityItem[]
}

export type ConferenceLineDto = {
  id: number
  sessionId: number
  itemName: string
  unit: string | null
  contado: number | null
  registeredAt: string | null
  countMode?: 'free' | 'package_count'
  packages?: Array<{ quantity: number; isDefault?: boolean }> | null
}

export type ConferenceActivityPayload = {
  occurrence: ActivityItem
  session: {
    id: number
    conferenceListId: number | null
    conferenceListName: string | null
    stockLocationName: string | null
    referenceDate: string
    status: string
  }
  lines: ConferenceLineDto[]
  progress: { counted: number; total: number }
}

export type ActivityAttachment = {
  id: number
  subjectType: string
  subjectId: number
  fileName: string | null
  mimeType: string | null
  createdAt: string | null
}

export type ChecklistActivityPayload = {
  occurrence: ActivityItem
  execution: {
    id: number
    status: string
    title: string
    description: string | null
    exigeConfirmacao: boolean
    evidenceMode: 'none' | 'optional' | 'required'
  }
  attachments: ActivityAttachment[]
}

async function requestActivities<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('X-Collaborator-Portal-Token', token)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/${path}`, { ...options, headers })
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const err = new Error(readPortalErrorMessage(body, response.status)) as Error & {
      status?: number
      code?: string
    }
    err.status = response.status
    err.code = body?.code ?? null
    throw err
  }
  return body as T
}

export async function fetchActivitiesInbox(
  token: string,
  date?: string,
): Promise<ActivitiesInboxResponse> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  const data = await requestActivities<ActivitiesInboxResponse>(`echeck_portal/activities${qs}`, {}, token)
  return {
    ...data,
    summary: {
      inProgress: data.summary?.inProgress ?? 0,
      pending: data.summary?.pending ?? 0,
      available: data.summary?.available ?? 0,
      completed: data.summary?.completed ?? 0,
    },
    completed: data.completed ?? [],
  }
}

export async function claimActivity(token: string, id: number): Promise<ActivityItem> {
  return requestActivities<ActivityItem>(`echeck_portal/activities/${id}/claim`, { method: 'POST', body: '{}' }, token)
}

export async function startActivity(
  token: string,
  id: number,
): Promise<ActivityItem & { execution: { type: string; id: number } }> {
  return requestActivities(`echeck_portal/activities/${id}/start`, { method: 'POST', body: '{}' }, token)
}

export async function fetchActivityConference(
  token: string,
  activityId: number,
): Promise<ConferenceActivityPayload> {
  return requestActivities(`echeck_portal/activities/${activityId}/conference`, {}, token)
}

export async function patchActivityConferenceLine(
  token: string,
  lineId: number,
  contado: number,
  packageBreakdown?: {
    packages: Array<{ quantity: number; count: number }>
    loose: number
  } | null,
): Promise<{ id: number; contado: number | null; registeredAt: string | null }> {
  return requestActivities(
    `echeck_portal/activities/conference/lines/${lineId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        contado,
        ...(packageBreakdown ? { packageBreakdown } : {}),
      }),
    },
    token,
  )
}

export async function finalizeActivityConference(
  token: string,
  sessionId: number,
): Promise<{ id: number; status: string; completedAt: string | null }> {
  return requestActivities(
    `echeck_portal/activities/conference/sessions/${sessionId}/finalize`,
    { method: 'POST', body: '{}' },
    token,
  )
}

export async function fetchActivityChecklist(
  token: string,
  activityId: number,
): Promise<ChecklistActivityPayload> {
  return requestActivities(`echeck_portal/activities/${activityId}/checklist`, {}, token)
}

export async function completeActivityChecklist(
  token: string,
  activityId: number,
  input: {
    completionResult: CompletionResult
    completionJustification?: string | null
  },
): Promise<{
  occurrence: ActivityItem
  execution: { id: number; status: string; completedAt: string | null }
}> {
  return requestActivities(
    `echeck_portal/activities/${activityId}/checklist/complete`,
    {
      method: 'POST',
      body: JSON.stringify({
        completionResult: input.completionResult,
        completionJustification: input.completionJustification ?? null,
      }),
    },
    token,
  )
}

export async function uploadActivityAttachment(
  token: string,
  activityId: number,
  file: File,
): Promise<ActivityAttachment> {
  const form = new FormData()
  form.append('photo', file)
  return requestActivities(
    `echeck_portal/activities/${activityId}/attachments`,
    { method: 'POST', body: form },
    token,
  )
}

export function activityAttachmentUrl(token: string, attachmentId: number): string {
  return `${API_BASE_URL}/echeck_portal/activities/attachments/${attachmentId}?t=${encodeURIComponent(token)}`
}

export async function fetchActivityAttachmentBlob(
  token: string,
  attachmentId: number,
): Promise<Blob> {
  const response = await fetch(activityAttachmentUrl(token, attachmentId), {
    headers: { 'X-Collaborator-Portal-Token': token },
  })
  if (!response.ok) throw new Error('Não foi possível carregar a imagem.')
  return response.blob()
}

/** Conclusão direta — só quando a inbox entrega canComplete (ex.: simple_task). */
export async function completeActivity(token: string, activityId: number): Promise<ActivityItem> {
  return requestActivities(
    `echeck_portal/activities/${activityId}/complete`,
    { method: 'POST', body: '{}' },
    token,
  )
}

export type OperationalIssueImpact = 'blocked' | 'degraded' | 'normal'
export type OperationalIssueStatus = 'open' | 'acknowledged' | 'resolved' | 'cancelled'

export type MyOperationalIssue = {
  id: number
  title: string
  description: string | null
  status: OperationalIssueStatus
  operationalImpact: OperationalIssueImpact
  locationLabel: string | null
  reportedAt: string | null
  acknowledgedAt: string | null
  resolvedAt: string | null
  resolutionNote: string | null
  attachments: Array<{ id: number; fileName: string | null; mimeType: string | null }>
}

export async function reportOperationalIssue(
  token: string,
  input: {
    title: string
    description?: string | null
    operationalImpact: OperationalIssueImpact
    locationLabel?: string | null
    sourceOccurrenceId?: number | null
  },
): Promise<{ id: number }> {
  return requestActivities(`echeck_portal/issues`, { method: 'POST', body: JSON.stringify(input) }, token)
}

export async function fetchMyOperationalIssues(token: string): Promise<MyOperationalIssue[]> {
  const data = await requestActivities<{ data: MyOperationalIssue[] }>(
    `echeck_portal/issues`,
    {},
    token,
  )
  return data.data ?? []
}

export async function uploadIssueAttachment(
  token: string,
  issueId: number,
  file: File,
): Promise<ActivityAttachment> {
  const form = new FormData()
  form.append('photo', file)
  return requestActivities(
    `echeck_portal/issues/${issueId}/attachments`,
    { method: 'POST', body: form },
    token,
  )
}

export async function fetchIssueAttachmentBlob(
  token: string,
  attachmentId: number,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/echeck_portal/issues/attachments/${attachmentId}`,
    { headers: { 'X-Collaborator-Portal-Token': token } },
  )
  if (!response.ok) throw new Error('Não foi possível carregar a imagem.')
  return response.blob()
}

export function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
