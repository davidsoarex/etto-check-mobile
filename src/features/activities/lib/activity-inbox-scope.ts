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

export function activityPath(item: ActivityItem): string | null {
  if (item.type === 'inventory_conference') return `/atividades/${item.id}/conferencia`
  if (item.type === 'checklist') return `/atividades/${item.id}/checklist`
  if (item.type === 'simple_task') return `/atividades/${item.id}/tarefa`
  return null
}
