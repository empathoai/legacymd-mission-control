/**
 * A page request the URL cannot trust. PostgREST answers `416` when the offset is
 * past the last row, so a stale `?page=9` in an old link would break the screen:
 * the window counts first and clamps the page to the last one that exists.
 */
export type PageWindow = {
  page: number
  total: number
  pageCount: number
  start: number
  end: number
}

export async function pageWindow(
  count: () => PromiseLike<{
    count: number | null
    error: { message: string } | null
  }>,
  requested: number,
  pageSize: number,
  label: string
): Promise<PageWindow> {
  const { count: total, error } = await count()
  if (error) throw new Error(`${label}: ${error.message}`)

  const pageCount = Math.max(1, Math.ceil((total ?? 0) / pageSize))
  const page = Math.min(Math.max(1, Math.trunc(requested) || 1), pageCount)
  const start = (page - 1) * pageSize

  return { page, total: total ?? 0, pageCount, start, end: start + pageSize - 1 }
}
