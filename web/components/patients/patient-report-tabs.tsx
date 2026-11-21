"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import {
  Check,
  Download,
  MessageSquare,
  RotateCcw,
  Search,
  Sparkles,
  Users,
} from "lucide-react"

import { KpiCard } from "@/components/kpi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatClinicDay } from "@/lib/dates"
import { formatMoneyShort, formatMoneyWhole } from "@/lib/format"
import type { PatientIntelligenceData, VipTier } from "@/lib/patient-intelligence"
import { buildWhatsAppHref, firstNameOf } from "@/lib/whatsapp"

type VipFilter = "all" | "at_risk"
type OutreachQueue = "recall" | "upsell" | "watchlist"

const WEEKLY_BATCH_SIZE = 10

const cohortChartConfig = {
  revenue: { label: "Realized Cash", color: "var(--chart-1)" },
} satisfies ChartConfig

const cohortColors = ["var(--chart-2)", "var(--chart-3)", "var(--chart-1)"]

function weekStorageKey(): string {
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `legacymd_outreach_${now.getFullYear()}_w${week}`
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((cols) =>
      cols
        .map((c) => {
          const s = String(c ?? "")
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(",")
    )
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function TierBadge({ tier }: { tier: VipTier }) {
  if (tier === "platinum") {
    return (
      <Badge variant="gold" className="text-[10px] uppercase tracking-wide">
        Platinum
      </Badge>
    )
  }
  if (tier === "gold") {
    return (
      <Badge variant="positive" className="text-[10px] uppercase tracking-wide">
        Gold
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
      Silver
    </Badge>
  )
}

function WhatsAppAction({
  phone,
  name,
  message,
  contacted,
  onMarkContacted,
  onUndoContacted,
}: {
  phone: string | null
  name: string
  message: string
  contacted: boolean
  onMarkContacted: () => void
  onUndoContacted: () => void
}) {
  const href = buildWhatsAppHref(phone, message)

  if (contacted) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <Badge variant="positive" className="gap-1 text-[10px]">
          <Check className="size-3" />
          Contacted
        </Badge>
        <Button
          size="xs"
          variant="ghost"
          onClick={onUndoContacted}
          aria-label={`Undo contacted for ${name}`}
          title="Mark as not contacted"
        >
          <RotateCcw className="size-3" />
        </Button>
      </div>
    )
  }

  if (!href) {
    return <span className="text-xs text-muted-foreground">No phone</span>
  }

  return (
    <Button
      size="xs"
      variant="outline"
      nativeButton={false}
      onClick={onMarkContacted}
      render={
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp ${name}`}
        />
      }
    >
      <MessageSquare className="size-3" />
      WhatsApp
    </Button>
  )
}

export function PatientReportTabs({
  intel,
  directorySlot,
}: {
  intel: PatientIntelligenceData
  directorySlot: ReactNode
}) {
  const [vipFilter, setVipFilter] = useState<VipFilter>("all")
  const [queue, setQueue] = useState<OutreachQueue>("recall")
  const [pillarFilter, setPillarFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showAllVip, setShowAllVip] = useState(false)
  const [showAllOutreach, setShowAllOutreach] = useState(false)
  const [hideContacted, setHideContacted] = useState(false)
  const [contactedIds, setContactedIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(weekStorageKey())
      if (raw) setContactedIds(JSON.parse(raw) as Record<string, boolean>)
    } catch {
      // ignore storage errors
    }
  }, [])

  function setContacted(id: string, value: boolean) {
    setContactedIds((prev) => {
      const next = { ...prev }
      if (value) next[id] = true
      else delete next[id]
      try {
        window.localStorage.setItem(weekStorageKey(), JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const term = searchTerm.trim().toLowerCase()

  // Filtered VIP list
  const filteredVips = useMemo(() => {
    return intel.vips
      .filter((v) => (vipFilter === "at_risk" ? v.atRisk : true))
      .filter((v) =>
        pillarFilter === "all" ? true : v.categories.includes(pillarFilter)
      )
      .filter((v) => (!term ? true : v.fullName.toLowerCase().includes(term)))
      .filter((v) => (hideContacted ? !contactedIds[v.id] : true))
  }, [intel.vips, vipFilter, pillarFilter, term, hideContacted, contactedIds])

  const visibleVips = showAllVip
    ? filteredVips
    : filteredVips.slice(0, WEEKLY_BATCH_SIZE)

  // Filtered Outreach lists
  const filteredRecall = useMemo(() => {
    return intel.recall
      .filter((r) =>
        pillarFilter === "all" ? true : r.lastCategory === pillarFilter
      )
      .filter((r) => (!term ? true : r.fullName.toLowerCase().includes(term)))
      .filter((r) => (hideContacted ? !contactedIds[r.id] : true))
  }, [intel.recall, pillarFilter, term, hideContacted, contactedIds])

  const filteredUpsell = useMemo(() => {
    return intel.upsell
      .filter((u) =>
        pillarFilter === "all" ? true : u.categories.includes(pillarFilter)
      )
      .filter((u) => (!term ? true : u.fullName.toLowerCase().includes(term)))
      .filter((u) => (hideContacted ? !contactedIds[u.id] : true))
  }, [intel.upsell, pillarFilter, term, hideContacted, contactedIds])

  const filteredWatchlist = useMemo(() => {
    return intel.watchlist
      .filter((w) =>
        pillarFilter === "all" ? true : w.category === pillarFilter
      )
      .filter((w) => (!term ? true : w.fullName.toLowerCase().includes(term)))
      .filter((w) => (hideContacted ? !contactedIds[w.id] : true))
  }, [intel.watchlist, pillarFilter, term, hideContacted, contactedIds])

  const activeOutreachTotal =
    queue === "recall"
      ? filteredRecall.length
      : queue === "upsell"
        ? filteredUpsell.length
        : filteredWatchlist.length

  const visibleRecall = showAllOutreach
    ? filteredRecall
    : filteredRecall.slice(0, WEEKLY_BATCH_SIZE)
  const visibleUpsell = showAllOutreach
    ? filteredUpsell
    : filteredUpsell.slice(0, WEEKLY_BATCH_SIZE)
  const visibleWatchlist = showAllOutreach
    ? filteredWatchlist
    : filteredWatchlist.slice(0, WEEKLY_BATCH_SIZE)

  const contactedThisWeekCount = Object.keys(contactedIds).length
  const batchProgressPct = Math.min(
    100,
    Math.round((contactedThisWeekCount / WEEKLY_BATCH_SIZE) * 100)
  )

  function handleExportVips() {
    const headers = ["Patient", "Phone", "Tier", "LTV", "Visits", "Pillars", "Last Visit", "At Risk"]
    const rows = filteredVips.map((r) => [
      r.fullName,
      r.phone ?? "",
      r.tier,
      r.spentTotal.toFixed(2),
      String(r.visits),
      r.categories.join(" / "),
      r.lastVisitOn ?? "",
      r.atRisk ? "Yes" : "No",
    ])
    downloadCsv("legacymd-vip-patients.csv", [headers, ...rows])
  }

  function handleExportOutreach() {
    if (queue === "recall") {
      const headers = ["Patient", "Phone", "Tier", "LTV", "Days Idle", "Last Treatment"]
      const rows = filteredRecall.map((r) => [
        r.fullName,
        r.phone ?? "",
        r.tier ?? "",
        r.spentTotal.toFixed(2),
        String(r.daysSinceLastVisit),
        r.lastItem ?? r.lastCategory ?? "",
      ])
      downloadCsv("legacymd-recall-60-120d.csv", [headers, ...rows])
    } else if (queue === "upsell") {
      const headers = ["Patient", "Phone", "Tier", "LTV", "Signal", "Recommended Offer"]
      const rows = filteredUpsell.map((r) => [
        r.fullName,
        r.phone ?? "",
        r.tier ?? "",
        r.spentTotal.toFixed(2),
        r.signalLabel,
        r.recommendedOffer,
      ])
      downloadCsv("legacymd-upsell-candidates.csv", [headers, ...rows])
    } else {
      const headers = ["Patient", "Phone", "1st-Visit Spend", "Days Ago", "First Visit Item"]
      const rows = filteredWatchlist.map((r) => [
        r.fullName,
        r.phone ?? "",
        r.spentTotal.toFixed(2),
        String(r.daysSinceLastVisit),
        r.firstItem ?? r.category ?? "",
      ])
      downloadCsv("legacymd-first-visit-watchlist.csv", [headers, ...rows])
    }
  }

  const { summary } = intel

  return (
    <div className="flex flex-col gap-6">
      {/* 4 Real-Data Patient Intelligence KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total patients"
          value={String(summary.totalPatients)}
          action={
            <Badge variant={summary.repeatRatePct >= 40 ? "positive" : "secondary"}>
              {summary.repeatRatePct}% repeat
            </Badge>
          }
          footer={
            <span className="truncate">
              {summary.repeatPatients} patients with 2+ visits
            </span>
          }
        />

        <KpiCard
          label="VIP cohort (Gold+)"
          value={String(summary.vipCount)}
          action={<Badge variant="gold">{summary.vipCashSharePct}% of cash</Badge>}
          footer={
            <span className="truncate">
              {summary.vipAtRiskCount > 0
                ? `${summary.vipAtRiskCount} VIPs inactive 60d+`
                : "All Platinum & Gold active (<60d)"}
            </span>
          }
        />

        <KpiCard
          label="Upsell candidates"
          value={String(summary.upsellCount)}
          action={<Badge variant="secondary">Active</Badge>}
          footer={
            <span className="truncate">
              Package upgrades &amp; cross-vertical gaps
            </span>
          }
        />

        <KpiCard
          label="Recall queue (60–120d)"
          value={String(summary.recallCount)}
          action={
            <Badge variant={summary.recallCount > 0 ? "gold" : "positive"}>
              {formatMoneyWhole(summary.recallLtvAtRisk)} LTV
            </Badge>
          }
          footer={
            <span className="truncate">
              Plus {summary.watchlistCount} single-visit (14–60d)
            </span>
          }
        />
      </div>

      {/* Patient Base Health: Retention & LTV Concentration */}
      {intel.cohorts.some((c) => c.patients > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>Patient Retention &amp; Cash Concentration</CardTitle>
            <CardDescription>
              How much clinic revenue comes from one-time visitors vs. returning and loyal
              patients.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <ChartContainer config={cohortChartConfig} className="h-[160px] w-full">
                <BarChart
                  data={intel.cohorts}
                  layout="vertical"
                  margin={{ left: 4, right: 16 }}
                  accessibilityLayer
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatMoneyShort(Number(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={145}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        valueFormatter={(v) => formatMoneyWhole(v)}
                      />
                    }
                  />
                  <Bar
                    dataKey="revenue"
                    radius={[0, 3, 3, 0]}
                    isAnimationActive={false}
                  >
                    {intel.cohorts.map((c, idx) => (
                      <Cell key={c.key} fill={cohortColors[idx % cohortColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            <div className="flex flex-col justify-center gap-3 lg:col-span-5">
              {intel.cohorts.map((c, idx) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/25 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: cohortColors[idx % cohortColors.length],
                      }}
                    />
                    <div>
                      <div className="font-medium text-foreground">{c.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.patients} patients ({c.patientPct}%)
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-semibold text-foreground">
                      {formatMoneyWhole(c.revenue)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.revenuePct}% of cash
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 3 Editorial Tabs */}
      <Tabs defaultValue="directory" className="gap-5">
        <div className="border-b">
          <TabsList variant="line">
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="vip">
              VIP &amp; Rewards ({intel.vips.length})
            </TabsTrigger>
            <TabsTrigger value="outreach">
              Upsell &amp; Recall (
              {summary.recallCount + summary.upsellCount + summary.watchlistCount})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: EXISTING DIRECTORY (SERVER-RENDERED SLOT) */}
        <TabsContent value="directory">{directorySlot}</TabsContent>

        {/* TAB 2: VIP & REWARDS */}
        <TabsContent value="vip" className="flex flex-col gap-4">
          {/* Weekly Action Progress Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-l-2 border-l-sidebar-primary bg-accent/60 px-4 py-2.5">
            <div className="min-w-[220px] flex-1">
              <Progress value={batchProgressPct} className="gap-1.5">
                <ProgressLabel className="text-xs">
                  Weekly outreach goal ({contactedThisWeekCount} / {WEEKLY_BATCH_SIZE}{" "}
                  contacted)
                </ProgressLabel>
              </Progress>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-contacted-vip"
                  checked={hideContacted}
                  onCheckedChange={setHideContacted}
                />
                <Label
                  htmlFor="hide-contacted-vip"
                  className="cursor-pointer text-xs text-muted-foreground"
                >
                  Hide contacted
                </Label>
              </div>
              <Button size="xs" variant="outline" onClick={handleExportVips}>
                <Download data-icon="inline-start" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                value={[vipFilter]}
                onValueChange={(next) => {
                  const picked = next[0] as VipFilter | undefined
                  if (picked) setVipFilter(picked)
                }}
              >
                <ToggleGroupItem value="all">
                  All VIPs ({intel.vips.length})
                </ToggleGroupItem>
                <ToggleGroupItem value="at_risk">
                  At Risk 60d+ ({summary.vipAtRiskCount})
                </ToggleGroupItem>
              </ToggleGroup>

              <Select
                value={pillarFilter}
                onValueChange={(v) => v && setPillarFilter(v)}
              >
                <SelectTrigger size="sm" className="w-[155px] bg-card">
                  <SelectValue placeholder="All pillars">
                    {(val: string) => (val === "all" ? "All pillars" : val)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pillars</SelectItem>
                  {intel.allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter patient..."
                className="h-8 w-48 bg-card pl-8 text-xs"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Spent / Visits</TableHead>
                  <TableHead>Clinical Pillars</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">WhatsApp</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleVips.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="p-0">
                      <Empty className="rounded-none border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Sparkles />
                          </EmptyMedia>
                          <EmptyTitle>No VIPs match this filter</EmptyTitle>
                          <EmptyDescription>
                            Try clearing your search, pillar filter, or &quot;Hide
                            contacted&quot;.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleVips.map((row) => {
                    const name = firstNameOf(row.fullName)
                    const treatmentRef = row.lastItem ?? "tu último tratamiento"
                    const waMsg = row.atRisk
                      ? `Hola ${name}, te saludamos de LegacyMD. Queríamos revisar cómo evolucionó ${treatmentRef} y reservarte espacio prioritario con el doctor esta semana. ¿Te acomoda mejor en la mañana o en la tarde?`
                      : `Hola ${name}, gracias por confiar en LegacyMD. Nos alegra ver tu avance con ${treatmentRef}. Como paciente preferente, si alguien de tu entorno busca una evaluación seria, preséntanos por WhatsApp y le coordinamos una valoración preferente con el doctor.`
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/patients/${row.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {row.fullName}
                            </Link>
                            {row.atRisk ? (
                              <Badge variant="destructive" className="text-[10px]">
                                {row.daysSinceLastVisit}d idle
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TierBadge tier={row.tier} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          <span className="font-semibold">
                            {formatMoneyWhole(row.spentTotal)}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {row.visits}v
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {row.categories.length > 0
                            ? row.categories.join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.lastVisitOn ? formatClinicDay(row.lastVisitOn) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.sourceLabel ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <WhatsAppAction
                            phone={row.phone}
                            name={row.fullName}
                            message={waMsg}
                            contacted={Boolean(contactedIds[row.id])}
                            onMarkContacted={() => setContacted(row.id, true)}
                            onUndoContacted={() => setContacted(row.id, false)}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {filteredVips.length > WEEKLY_BATCH_SIZE ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing top {visibleVips.length} of {filteredVips.length} VIPs by LTV
              </span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setShowAllVip((prev) => !prev)}
              >
                {showAllVip
                  ? `Focus on Top ${WEEKLY_BATCH_SIZE}`
                  : `Show all (${filteredVips.length})`}
              </Button>
            </div>
          ) : null}
        </TabsContent>

        {/* TAB 3: UPSELL & RECALL */}
        <TabsContent value="outreach" className="flex flex-col gap-4">
          {/* Weekly Action Progress Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-l-2 border-l-sidebar-primary bg-accent/60 px-4 py-2.5">
            <div className="min-w-[220px] flex-1">
              <Progress value={batchProgressPct} className="gap-1.5">
                <ProgressLabel className="text-xs">
                  Weekly outreach goal ({contactedThisWeekCount} / {WEEKLY_BATCH_SIZE}{" "}
                  contacted)
                </ProgressLabel>
              </Progress>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-contacted-outreach"
                  checked={hideContacted}
                  onCheckedChange={setHideContacted}
                />
                <Label
                  htmlFor="hide-contacted-outreach"
                  className="cursor-pointer text-xs text-muted-foreground"
                >
                  Hide contacted
                </Label>
              </div>
              <Button size="xs" variant="outline" onClick={handleExportOutreach}>
                <Download data-icon="inline-start" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Queue Selector + Pillar Filter + Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                value={[queue]}
                onValueChange={(next) => {
                  const picked = next[0] as OutreachQueue | undefined
                  if (picked) setQueue(picked)
                }}
              >
                <ToggleGroupItem value="recall">
                  Recall 60–120d ({filteredRecall.length})
                </ToggleGroupItem>
                <ToggleGroupItem value="upsell">
                  Upsell &amp; Gaps ({filteredUpsell.length})
                </ToggleGroupItem>
                <ToggleGroupItem value="watchlist">
                  1st-Visit Watchlist ({filteredWatchlist.length})
                </ToggleGroupItem>
              </ToggleGroup>

              <Select
                value={pillarFilter}
                onValueChange={(v) => v && setPillarFilter(v)}
              >
                <SelectTrigger size="sm" className="w-[155px] bg-card">
                  <SelectValue placeholder="All pillars">
                    {(val: string) => (val === "all" ? "All pillars" : val)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pillars</SelectItem>
                  {intel.allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter patient..."
                className="h-8 w-48 bg-card pl-8 text-xs"
              />
            </div>
          </div>

          {queue === "recall" ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Last Treatment</TableHead>
                    <TableHead className="text-right">Idle</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">WhatsApp</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRecall.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0">
                        <Empty className="rounded-none border-0">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Users />
                            </EmptyMedia>
                            <EmptyTitle>No patients match this filter</EmptyTitle>
                            <EmptyDescription>
                              Try switching pillar, clearing search, or toggling &quot;Hide
                              contacted&quot;.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRecall.map((row) => {
                      const name = firstNameOf(row.fullName)
                      const ref = row.lastItem ?? row.lastCategory ?? "tu tratamiento"
                      const waMsg = `Hola ${name}, queríamos revisar cómo evolucionó ${ref} en LegacyMD. Para sostener el resultado y detectar ajustes a tiempo, el doctor recomienda una revisión de control en esta etapa. ¿Prefieres espacio esta semana o la próxima?`
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/patients/${row.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.fullName}
                              </Link>
                              {row.tier ? <TierBadge tier={row.tier} /> : null}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {row.lastItem ?? row.lastCategory ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="font-mono">
                              {row.daysSinceLastVisit}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                            {formatMoneyWhole(row.spentTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            <WhatsAppAction
                              phone={row.phone}
                              name={row.fullName}
                              message={waMsg}
                              contacted={Boolean(contactedIds[row.id])}
                              onMarkContacted={() => setContacted(row.id, true)}
                              onUndoContacted={() => setContacted(row.id, false)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ) : queue === "upsell" ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Detected Signal</TableHead>
                    <TableHead>Recommended Offer</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">WhatsApp</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUpsell.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0">
                        <Empty className="rounded-none border-0">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Sparkles />
                            </EmptyMedia>
                            <EmptyTitle>No upsell candidates match</EmptyTitle>
                            <EmptyDescription>
                              Try switching pillar, clearing search, or toggling &quot;Hide
                              contacted&quot;.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleUpsell.map((row) => {
                      const name = firstNameOf(row.fullName)
                      const ref = row.lastItem ?? row.categories[0] ?? "tu protocolo"
                      const waMsg =
                        row.reason === "package_upgrade"
                          ? `Hola ${name}, ya viste cómo respondió tu cuerpo con ${ref} en LegacyMD. Para no empezar de cero en cada visita, el doctor tiene un plan de continuidad con controles y prioridad de agenda. ¿Te comparto las 2 opciones para tu próxima visita?`
                          : `Hola ${name}, para potenciar los resultados que ya lograste con ${ref} en LegacyMD, muchos pacientes combinan su control estándar con un protocolo complementario. ¿Te gustaría revisarlo en tu próxima cita o prefieres mantener el control estándar?`
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/patients/${row.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.fullName}
                              </Link>
                              {row.tier ? <TierBadge tier={row.tier} /> : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.reason === "package_upgrade" ? "gold" : "secondary"
                              }
                            >
                              {row.signalLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.recommendedOffer}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                            {formatMoneyWhole(row.spentTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            <WhatsAppAction
                              phone={row.phone}
                              name={row.fullName}
                              message={waMsg}
                              contacted={Boolean(contactedIds[row.id])}
                              onMarkContacted={() => setContacted(row.id, true)}
                              onUndoContacted={() => setContacted(row.id, false)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>First Visit Item</TableHead>
                    <TableHead className="text-right">Days Ago</TableHead>
                    <TableHead className="text-right">1st-Visit Spend</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">WhatsApp</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleWatchlist.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0">
                        <Empty className="rounded-none border-0">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Users />
                            </EmptyMedia>
                            <EmptyTitle>No single-visit patients match</EmptyTitle>
                            <EmptyDescription>
                              Try switching pillar, clearing search, or toggling &quot;Hide
                              contacted&quot;.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleWatchlist.map((row) => {
                      const name = firstNameOf(row.fullName)
                      const ref = row.firstItem ?? row.category ?? "tu primera visita"
                      const waMsg = `Hola ${name}, te saludamos de LegacyMD para saber cómo te sentiste después de ${ref}. El doctor recomienda una visita de seguimiento para evaluar tu evolución. ¿Prefieres agendar entre semana o sábado?`
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link
                              href={`/patients/${row.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {row.fullName}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {row.firstItem ?? row.category ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="font-mono">
                              {row.daysSinceLastVisit}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                            {formatMoneyWhole(row.spentTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            <WhatsAppAction
                              phone={row.phone}
                              name={row.fullName}
                              message={waMsg}
                              contacted={Boolean(contactedIds[row.id])}
                              onMarkContacted={() => setContacted(row.id, true)}
                              onUndoContacted={() => setContacted(row.id, false)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Auto-suppresses overdue accounts (handled in Open items).
            </span>
            {activeOutreachTotal > WEEKLY_BATCH_SIZE ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() => setShowAllOutreach((prev) => !prev)}
              >
                {showAllOutreach
                  ? `Focus on Top ${WEEKLY_BATCH_SIZE}`
                  : `Show all (${activeOutreachTotal})`}
              </Button>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
