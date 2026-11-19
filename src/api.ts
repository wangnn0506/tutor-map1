export const appBase = import.meta.env.BASE_URL
const apiBase = appBase + 'api/'

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export async function api<T>(path: string, data?: object): Promise<T> {
  const response = await fetch(apiBase + path, data ? {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data),
  } : {cache: 'no-store'})
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new ApiError(response.status, result?.error || '岗位服务暂时不可用。')
  return result as T
}
