import { readPortalErrorMessage } from '@/lib/portal-auth'
import { API_BASE_URL } from '@/lib/api'

export type EcheckLoginInput = {
  cpf: string
  transactionalPin: string
}

export type EcheckLoginResponse = {
  token: string
  collaborator: EcheckPortalProfile
}

export type EcheckPortalProfile = {
  id: number
  name: string
  isSupervisor: boolean
  hasRoutineAccess: boolean
  canValidateSubmissions: boolean
}

export type EcheckMeResponse = EcheckPortalProfile

export type EcheckTaskPhoto = {
  id: number | null
  takenAt: string | null
  hasPhoto: boolean
}

export type EcheckTask = {
  id: number
  title: string
  instructions: string | null
  sortOrder: number
  photo: EcheckTaskPhoto
}

export type EcheckRoutineSession = {
  routine: { id: number; name: string; description: string | null }
  submission: {
    id: number
    referenceDate: string
    status: string
    submittedAt: string | null
    validatedAt: string | null
    validationNotes: string | null
    completedCount: number
    requiredCount: number
    canSubmit: boolean
  }
  tasks: EcheckTask[]
}

async function requestEcheck<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
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

export async function loginEcheckPortal(input: EcheckLoginInput): Promise<EcheckLoginResponse> {
  return requestEcheck<EcheckLoginResponse>('echeck_portal/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function fetchEcheckMe(token: string): Promise<EcheckMeResponse> {
  return requestEcheck<EcheckMeResponse>('echeck_portal/me', {}, token)
}

export async function fetchEcheckRoutines(token: string): Promise<{ data: EcheckRoutineSession[] }> {
  return requestEcheck<{ data: EcheckRoutineSession[] }>('echeck_portal/routines', {}, token)
}

export async function fetchEcheckRoutineSession(
  token: string,
  routineId: number,
): Promise<EcheckRoutineSession> {
  return requestEcheck<EcheckRoutineSession>(`echeck_portal/routines/${routineId}`, {}, token)
}

export async function uploadEcheckTaskPhoto(
  token: string,
  submissionId: number,
  taskId: number,
  file: File,
): Promise<EcheckRoutineSession> {
  const form = new FormData()
  form.append('photo', file)
  return requestEcheck<EcheckRoutineSession>(
    `echeck_portal/submissions/${submissionId}/tasks/${taskId}/photo`,
    { method: 'POST', body: form },
    token,
  )
}

export async function submitEcheckForValidation(
  token: string,
  submissionId: number,
): Promise<EcheckRoutineSession> {
  return requestEcheck<EcheckRoutineSession>(
    `echeck_portal/submissions/${submissionId}/submit`,
    { method: 'POST' },
    token,
  )
}

export function echeckPhotoUrl(token: string, photoId: number): string {
  return `${API_BASE_URL}/echeck_portal/photos/${photoId}?t=${encodeURIComponent(token)}`
}

/** Busca foto autenticada e retorna blob URL para exibição. */
export async function fetchEcheckPhotoBlob(
  token: string,
  photoId: number,
  takenAt?: string | null,
): Promise<string> {
  const cacheKey = takenAt ? encodeURIComponent(takenAt) : '0'
  const response = await fetch(`${API_BASE_URL}/echeck_portal/photos/${photoId}?v=${cacheKey}`, {
    headers: { 'X-Collaborator-Portal-Token': token },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Não foi possível carregar a foto.')
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export type EcheckSupervisorValidationRow = {
  id: number
  routineId: number
  collaboratorId: number
  referenceDate: string
  status: string
  submittedAt: string | null
  routineName: string | null
  collaboratorName: string | null
}

export type EcheckSupervisorValidationDetail = {
  id: number
  routineId: number
  collaboratorId: number
  referenceDate: string
  status: string
  submittedAt: string | null
  routineName: string | null
  collaboratorName: string | null
  tasks: Array<{
    id: number
    title: string
    instructions: string | null
    photo: { id: number; takenAt: string | null } | null
  }>
}

export async function fetchSupervisorPendingValidations(
  token: string,
): Promise<{ data: EcheckSupervisorValidationRow[] }> {
  return requestEcheck<{ data: EcheckSupervisorValidationRow[] }>(
    'echeck_portal/supervisor/validations',
    {},
    token,
  )
}

export async function fetchSupervisorValidationDetail(
  token: string,
  submissionId: number,
): Promise<EcheckSupervisorValidationDetail> {
  return requestEcheck<EcheckSupervisorValidationDetail>(
    `echeck_portal/supervisor/submissions/${submissionId}`,
    {},
    token,
  )
}

export async function validateSupervisorSubmission(
  token: string,
  submissionId: number,
  body: { status: 'approved' | 'rejected'; validationNotes?: string | null },
): Promise<{ ok: boolean }> {
  return requestEcheck<{ ok: boolean }>(
    `echeck_portal/supervisor/submissions/${submissionId}/validate`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    token,
  )
}
