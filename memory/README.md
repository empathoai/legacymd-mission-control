# /memory

Working memory for the project. Each file answers a different question: read the matching one before writing.

## Memory Map

| File | Holds | Cadence |
|---|---|---|
| `project-brief.md` | The original kickoff. **Frozen**, never edited | never |
| `current-strategy.md` | The *now* state | edited weekly |
| `decisions.md` | One line per decision, plus the long-form reasoning behind each | per decision |
| `next-actions.md` | The punch list | per session |
| `session-summaries.md` | Dated session wrap-ups | per session |
| `bugs-and-risks.md` | Open issues and watch-outs | as they appear |

## Rules

0. **A session is not closed until `memory/` is updated**: a dated entry in `session-summaries.md`, the *now* in `current-strategy.md`, the punch list in `next-actions.md`, any new risk, and every decision taken. Also delete or mark stale files (generated SQL, extracts of a superseded base).

1. If something is already in `decisions.md`, do not restate it in `current-strategy.md`: link to it.
2. `current-strategy.md` describes now, not history. What expires moves to `session-summaries.md`.
3. Every decision goes into `decisions.md` the day it is made, not at the end of the project.
4. A risk that starts to hurt graduates from `bugs-and-risks.md` into `next-actions.md`.
