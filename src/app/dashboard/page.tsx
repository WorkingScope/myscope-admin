"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { useAuth } from "@/contexts/auth-context"
import { adminAPI } from "@/lib/apiEndpoints"
import { usePendingCounts } from "@/hooks/usePendingCounts"
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  Banknote,
  CalendarPlus,
  type LucideIcon,
} from "lucide-react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import RecentActivity from "@/components/dashboard/RecentActivity"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface OverviewData {
  stats: {
    totalUsers: number
    totalEvents: number
    totalSales: number
  }
  weeklyGrowth: Array<{
    day: string
    users: number
    newUsers: number
  }>
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  // Same source the sidebar nav badges already use — reusing it here keeps
  // "pending" counts consistent across the app instead of a second,
  // slightly-different definition living just on this page.
  const pending = usePendingCounts(!!user)

  useEffect(() => {
    fetchOverviewData()
  }, [])

  const fetchOverviewData = async () => {
    try {
      const response = await adminAPI.getOverview()
      setOverviewData(response.data.data)
    } catch (error: any) {
      console.error('Error fetching overview:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout user={user || undefined}>
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Page header — date as the small uppercase label, the greeting
              itself as the big bold heading, exactly like the organizer
              dashboard's header (not a static "Overview" title). */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="text-xl font-bold">
                  {(user?.name?.[0] ?? "A").toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {greeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ''}
                </h1>
              </div>
            </div>
          </div>

          {/* KPI cards — Total Sales is the headline metric, elevated in
              solid brand fill the same way the organizer dashboard features
              its revenue tile. Each card carries a hint line under the
              value, matching the organizer KpiCard's label/value/hint shape. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="Total Sales"
              value={`LKR ${(overviewData?.stats.totalSales ?? 0).toLocaleString()}`}
              hint="all-time revenue"
              icon={DollarSign}
              feature
              delay={0}
            />
            <StatCard
              title="Total Users"
              value={overviewData?.stats.totalUsers.toLocaleString() ?? "0"}
              hint="registered"
              icon={Users}
              accent="primary"
              delay={0.05}
            />
            <StatCard
              title="Total Events"
              value={overviewData?.stats.totalEvents.toLocaleString() ?? "0"}
              hint="all-time"
              icon={Calendar}
              accent="emerald"
              delay={0.1}
            />
          </div>

          {/* Needs attention — same "pending" counts the sidebar nav badges
              use, surfaced here as actionable links so the first thing an
              admin sees is what's actually waiting on them. */}
          {pending && (pending.eventReview + pending.organizers + pending.editReview + pending.payouts + pending.reservedLayouts + pending.shopProducts) > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" /> Needs attention
              </span>
              {pending.eventReview > 0 && (
                <AttentionChip href="/events/review" label={`${pending.eventReview} event${pending.eventReview > 1 ? "s" : ""} awaiting approval`} />
              )}
              {pending.organizers > 0 && (
                <AttentionChip href="/organizers" label={`${pending.organizers} organizer application${pending.organizers > 1 ? "s" : ""}`} />
              )}
              {pending.editReview > 0 && (
                <AttentionChip href="/events/pending-edits" label={`${pending.editReview} edit${pending.editReview > 1 ? "s" : ""} to review`} />
              )}
              {pending.payouts > 0 && (
                <AttentionChip href="/payouts" label={`${pending.payouts} payout${pending.payouts > 1 ? "s" : ""} requested`} />
              )}
              {pending.reservedLayouts > 0 && (
                <AttentionChip href="/reserved-seating-events" label={`${pending.reservedLayouts} seat map${pending.reservedLayouts > 1 ? "s" : ""} requested`} />
              )}
              {pending.shopProducts > 0 && (
                <AttentionChip href="/shop-products" label={`${pending.shopProducts} shop product${pending.shopProducts > 1 ? "s" : ""} to review`} />
              )}
            </div>
          )}

          {/* Quick actions — shortcuts to the most common admin tasks. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction href="/events/review" icon={CalendarCheck} label="Review events" />
            <QuickAction href="/organizers" icon={Building2} label="Organizers" />
            <QuickAction href="/events/create" icon={CalendarPlus} label="Create event" />
            <QuickAction href="/payouts" icon={Banknote} label="Payouts" />
          </div>

          {/* Weekly growth + Recent activity — paired side-by-side, same
              two-column pattern as the organizer dashboard's Top events /
              Recent bookings section, instead of two full-width stacked
              blocks. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Weekly User Growth</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    New registrations over the past week
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Live
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={overviewData?.weeklyGrowth ?? []}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" style={{ fontSize: 12 }} />
                  <YAxis stroke="var(--muted-foreground)" style={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--popover-foreground)",
                    }}
                    labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                    name="Total Users"
                  />
                  <Area
                    type="monotone"
                    dataKey="newUsers"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorNewUsers)"
                    name="New Users"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <RecentActivity />
            </motion.div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

interface StatCardProps {
  title: string
  value: string
  hint?: string
  icon: LucideIcon
  delay: number
  accent?: "primary" | "emerald" | "amber"
  /** Elevates this card in solid primary fill as the headline metric. */
  feature?: boolean
}

const ACCENTS = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const

function StatCard({ title, value, hint, icon: Icon, delay, accent = "primary", feature }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={
        feature
          ? "rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm transition-shadow hover:shadow-md"
          : "rounded-2xl bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:ring-1 dark:ring-white/10"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-medium uppercase tracking-wider ${feature ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {hint && (
            <p className={`mt-0.5 text-xs ${feature ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {hint}
            </p>
          )}
        </div>
        <span
          className={
            feature
              ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-primary-foreground"
              : `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACCENTS[accent]}`
          }
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  )
}

function AttentionChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-card px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-900/40"
    >
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md dark:ring-1 dark:ring-white/10"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </Link>
  )
}
