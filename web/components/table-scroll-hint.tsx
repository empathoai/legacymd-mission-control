/**
 * A horizontal scroll inside a bordered table is invisible until you drag it.
 * Below `sm` the table really does scroll, so say so instead of letting the
 * last columns fall off the screen unannounced.
 */
export function TableScrollHint({
  label = "Swipe the table sideways to see every column.",
}: {
  label?: string
}) {
  return <p className="text-xs text-muted-foreground sm:hidden">{label}</p>
}
