"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ExpenseMonth } from "@/lib/expenses"
import { formatMoneyShort, formatMoneyWhole } from "@/lib/format"

const chartConfig = {
  fixed: { label: "Fixed Overhead", color: "var(--chart-2)" },
  varAcq: { label: "Variable & Acquisition", color: "var(--chart-3)" },
  ownerDraw: { label: "Owner Draw", color: "var(--chart-1)" },
  capex: { label: "CapEx", color: "var(--chart-4)" },
} satisfies ChartConfig

function shortMonth(period: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(new Date(`${period}T12:00:00`))
}

export function ExpensesCompositionChart({
  months,
  year,
}: {
  months: ExpenseMonth[]
  year?: string
}) {
  const series = [...months]
    .reverse()
    .map((m) => ({
      label: shortMonth(m.period),
      fixed: m.fixed,
      varAcq: Math.round((m.variable + m.acquisition) * 100) / 100,
      ownerDraw: m.ownerDraw,
      capex: m.capex,
    }))

  if (series.length === 0) return null
  const hasCapex = series.some((s) => s.capex > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {year
            ? `Where the Cash Goes (${year})`
            : `Where the Cash Goes (${series.length} Months)`}
        </CardTitle>
        <CardDescription>
          Separates true clinic operating costs from physician owner draw and one-time
          CapEx.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[240px] w-full">
          <BarChart data={series} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatMoneyShort(Number(v))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(value) => formatMoneyWhole(value)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="fixed"
              fill="var(--color-fixed)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="varAcq"
              fill="var(--color-varAcq)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="ownerDraw"
              fill="var(--color-ownerDraw)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            {hasCapex ? (
              <Bar
                dataKey="capex"
                fill="var(--color-capex)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            ) : null}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
