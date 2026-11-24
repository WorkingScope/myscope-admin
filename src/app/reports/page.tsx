"use client"

import { useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart3,
  Banknote,
  CalendarDays,
  Download,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

interface Summary {
  gross_revenue: number
  refunds: number
  platform_fee: number
  payouts_disbursed: number
  net_to_organizers: number
  booking_count: number
  refund_count: number
  payout_count: number
  live_events: number
  platform_fee_pct: number
}

interface EventRow {
  event_id: string
  title: string
  gross: number
  refunded: number
  bookings: number
  payouts: number
}

interface ReportData {
  period: { from: string; to: string }
  summary: Summary
  by_event: EventRow[]
}

// NEXT_PUBLIC_API_URL is configured with a trailing /api (matching lib/api.ts's
// axios baseURL) — strip it here since this file builds its own /api/... path
// below. Without this, production doubles up to /api/api/... and 404s.
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000"

// Pre-fill the inputs with the last 30-day window
const today = new Date()
const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
const toIso = (d: Date) => d.toISOString().slice(0, 10)

export default function ReportsPage() {
  const { user } = useAuth()
  const [from, setFrom] = useState(toIso(thirtyDaysAgo))
  const [to, setTo] = useState(toIso(today))
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await adminAPI.getFinanceReport({ from, to })
      setData(res.data?.data as ReportData)
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load report.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const downloadCsv = () => {
    // Cookie auth — open in same tab so the browser sends our session
    const qs = new URLSearchParams({ from, to }).toString()
    window.location.href = `${API_URL}/api/admin/reports/finance.csv?${qs}`
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user ?? undefined}>
        <div className="p-6 space-y-6">
          {/* Header + filters */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Finance Reports</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Revenue, refunds, platform fees, and payouts.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-card p-3 shadow-sm dark:ring-1 dark:ring-white/10">
              <div>
                <label htmlFor="report-from" className="mb-1 block text-xs text-muted-foreground">From</label>
                <input
                  id="report-from"
                  type="date"
                  title="Report start date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label htmlFor="report-to" className="mb-1 block text-xs text-muted-foreground">To</label>
                <input
                  id="report-to"
                  type="date"
                  title="Report end date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                type="button"
                onClick={load}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Run report
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                className="inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <div className="space-y-2">
              <ErrorMessage message={error} />
              <button
                type="button"
                onClick={load}
                className="text-xs text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <SummaryCard
                  icon={<CalendarDays className="w-5 h-5" />}
                  label="Approved events"
                  value={(data.summary.live_events ?? 0).toLocaleString()}
                  sub="platform-wide"
                  tone="primary"
                />
                <SummaryCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Gross revenue"
                  value={`LKR ${data.summary.gross_revenue.toLocaleString()}`}
                  sub={`${data.summary.booking_count} confirmed bookings`}
                  tone="success"
                />
                <SummaryCard
                  icon={<Receipt className="w-5 h-5" />}
                  label={`Platform fee (${(data.summary.platform_fee_pct * 100).toFixed(1)}%)`}
                  value={`LKR ${data.summary.platform_fee.toLocaleString()}`}
                  tone="primary"
                />
                <SummaryCard
                  icon={<TrendingDown className="w-5 h-5" />}
                  label="Refunds"
                  value={`LKR ${data.summary.refunds.toLocaleString()}`}
                  sub={`${data.summary.refund_count} refund${data.summary.refund_count === 1 ? "" : "s"}`}
                  tone="destructive"
                />
                <SummaryCard
                  icon={<Banknote className="w-5 h-5" />}
                  label="Payouts disbursed"
                  value={`LKR ${data.summary.payouts_disbursed.toLocaleString()}`}
                  sub={`${data.summary.payout_count} payout${data.summary.payout_count === 1 ? "" : "s"}`}
                  tone="warning"
                />
              </div>

              {/* Net to organizers callout */}
              <div className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Net owed to organizers (after platform fee &amp; refunds)
                </div>
                <div className="text-2xl font-bold mt-1">
                  LKR {data.summary.net_to_organizers.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Reporting period: {new Date(data.period.from).toLocaleDateString()} → {new Date(data.period.to).toLocaleDateString()}
                </div>
              </div>

              {/* Per-event table */}
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Per-event breakdown
                </h2>
                {data.by_event.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                    No event activity in this window.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl bg-card shadow-sm dark:ring-1 dark:ring-white/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {["Event", "Bookings", "Gross", "Refunded", "Payouts"].map(h => (
                            <TableHead key={h}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.by_event.map(e => (
                          <TableRow key={e.event_id}>
                            <TableCell className="font-medium text-foreground">{e.title}</TableCell>
                            <TableCell className="text-muted-foreground">{e.bookings}</TableCell>
                            <TableCell className="text-foreground">LKR {e.gross.toLocaleString()}</TableCell>
                            <TableCell className="text-destructive">LKR {e.refunded.toLocaleString()}</TableCell>
                            <TableCell className="text-foreground">LKR {e.payouts.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

type ReportTone = "success" | "primary" | "destructive" | "warning"

const REPORT_TONE: Record<ReportTone, { bg: string; text: string }> = {
  success:     { bg: "bg-emerald-500/10",  text: "text-emerald-600 dark:text-emerald-400" },
  primary:     { bg: "bg-primary/10",      text: "text-primary" },
  destructive: { bg: "bg-destructive/10",  text: "text-destructive" },
  warning:     { bg: "bg-amber-500/10",    text: "text-amber-600 dark:text-amber-400" },
}

function SummaryCard({
  icon, label, value, sub, tone = "primary",
}: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: ReportTone }) {
  const t = REPORT_TONE[tone]
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10">
      <div className={`h-9 w-9 rounded-md flex items-center justify-center mb-3 ${t.bg} ${t.text}`}>
        {icon}
      </div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className={`text-xs mt-1 ${t.text}`}>{sub}</div>}
    </div>
  )
}
