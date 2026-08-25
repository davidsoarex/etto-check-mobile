import type { ActivitiesInboxResponse, ActivityItem } from '@/features/activities/api/activities-api'

export type ActivityInboxScope = 'activities' | 'conferences'

export function isConferenceItem(item: ActivityItem): boolean {
  return item.type === 'inventory_conference'
}

export function filterInboxByScope(
  inbox: ActivitiesInboxResponse,
  scope: ActivityInboxScope,
): ActivitiesInboxResponse {
  const keep = (item: ActivityItem) =>
    scope === 'conferences' ? isConferenceItem(item) : !isConferenceItem(item)
  const inProgress = inbox.inProgress.filter(keep)
  const pending = inbox.pending.filter(keep)
  const available = inbox.available.filter(keep)
  const completed = inbox.completed.filter(keep)
  return {
    ...inbox,
    inProgress,
    pending,
    available,
    completed,
    summary: {
      inProgress: inProgress.length,
      pending: pending.length,
      available: available.length,
      completed: completed.length,
    },
  }
}

function itemLocationKey(item: ActivityItem): string | null {
  const name = item.stockLocationName?.trim()
  return name ? name : null
}

/** Locais distintos presentes no inbox (ordem alfabética). */
export function collectInboxLocations(inbox: ActivitiesInboxResponse): string[] {
  const set = new Set<string>()
  for (const list of [inbox.inProgress, inbox.pending, inbox.available, inbox.completed]) {
    for (const item of list) {
      const key = itemLocationKey(item)
      if (key) set.add(key)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Filtra buckets por nome de local; `location` vazio = todos. */
export function filterInboxByLocation(
  inbox: ActivitiesInboxResponse,
  location: string | null | undefined,
): ActivitiesInboxResponse {
  const wanted = location?.trim() || ''
  if (!wanted) return inbox
  const keep = (item: ActivityItem) => itemLocationKey(item) === wanted
  const inProgress = inbox.inProgress.filter(keep)
  const pending = inbox.pending.filter(keep)
  const available = inbox.available.filter(keep)
  const completed = inbox.completed.filter(keep)
  return {
    ...inbox,
    inProgress,
    pending,
    available,
    completed,
    summary: {
      inProgress: inProgress.length,
      pending: pending.length,
      available: available.length,
      completed: completed.length,
    },
  }
}

export function activityPath(item: ActivityItem): string | null {
  if (item.type === 'inventory_conference') return `/atividades/${item.id}/conferencia`
  if (item.type === 'checklist') return `/atividades/${item.id}/checklist`
  if (item.type === 'simple_task') return `/atividades/${item.id}/tarefa`
  return null
}
