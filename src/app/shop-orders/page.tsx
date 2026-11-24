"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertTriangle,
  Calendar,
  Eye,
  Package,
  Receipt,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react"

type OrderStatus = "Pending" | "Confirmed" | "Cancelled" | "Refunded"
type FulfillmentStatus = "pending" | "preparing" | "shipped" | "delivered" | "picked_up" | "returned"

interface Order {
  id: string
  order_reference: string
  buyer_user_id: string
  organizer_id: string
  status: OrderStatus
  payment_status: "Pending" | "Completed" | "Failed"
  fulfillment_status: FulfillmentStatus
  fulfillment_type: "shipping" | "pickup"
  total_amount: number | string
  currency: string
  buyer_email: string | null
  shipping_address: { name?: string } | null
  created_at: string
}

interface SummaryStats {
  total_orders: number
  confirmed_orders: number
  pending_orders: number
  confirmed_revenue: number
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  Pending:   "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  Confirmed: "bg-green-500/15 text-green-700 dark:text-green-300",
  Cancelled: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  Refunded:  "bg-red-500/15 text-red-700 dark:text-red-300",
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  Pending:   "Awaiting payment",
  Confirmed: "Paid",
  Cancelled: "Cancelled",
  Refunded:  "Refunded",
}

const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  pending:    "New",
  preparing:  "Preparing",
  shipped:    "Shipped",
  delivered:  "Delivered",
  picked_up:  "Picked up",
  returned:   "Returned",
}

function formatMoney(amount: number | string, currency = "LKR") {
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return `${currency} —`
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function ShopOrdersInner() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all")

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [ordersRes, summaryRes] = await Promise.all([
        adminAPI.getShopOrders({ limit: 200 }),
        adminAPI.getShopOrdersSummary(),
      ])
      setOrders(ordersRes.data?.data?.orders || [])
      setSummary(summaryRes.data?.data || null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load shop orders"
      setError(msg)
      toast.error("Failed to load shop orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    let result = orders
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((o) =>
        o.order_reference.toLowerCase().includes(q) ||
        o.buyer_email?.toLowerCase().includes(q) ||
        o.shipping_address?.name?.toLowerCase().includes(q),
      )
    }
    return result
  }, [orders, statusFilter, search])

  if (loading) return <PageLoader />

  return (
    <AdminLayout user={user || undefined}>
      <div className="space-y-6">
        <header className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Shop Orders</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Oversight across every organizer storefront. Read-mostly — force-cancel only for support escalations.
            </p>
          </div>
        </header>

        {/* Summary tiles */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="Total orders" value={summary.total_orders} icon={Receipt} />
            <SummaryTile label="Paid" value={summary.confirmed_orders} icon={Truck} tone="success" />
            <SummaryTile label="Awaiting payment" value={summary.pending_orders} icon={Calendar} tone="warning" />
            <SummaryTile label="Paid revenue" value={formatMoney(summary.confirmed_revenue)} icon={Package} />
          </div>
        )}

        {error && <ErrorMessage message={error} onRetry={load} />}

        <div className="rounded-2xl bg-card p-3 shadow-sm dark:ring-1 dark:ring-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search by order ref, buyer name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg bg-muted pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | OrderStatus)}
              aria-label="Filter by status"
              className="h-9 rounded-lg bg-muted px-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All statuses</option>
              <option value="Pending">Awaiting payment</option>
              <option value="Confirmed">Paid</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={orders.length === 0 ? "No shop orders yet" : "Nothing matches your filter"}
            description={
              orders.length === 0
                ? "Shop orders will appear here once buyers start checking out."
                : "Try a different status or clear the search."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm dark:ring-1 dark:ring-white/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs text-foreground">{o.order_reference}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.shipping_address?.name || o.buyer_email || "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="capitalize">{o.fulfillment_type}</span>
                      {o.status === "Confirmed" && (
                        <span className="ml-1 text-xs">· {FULFILLMENT_LABEL[o.fulfillment_status]}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground">{formatMoney(o.total_amount, o.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Link
                          href={`/shop-orders/${o.id}`}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function SummaryTile({
  label, value, icon: Icon, tone,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  tone?: "success" | "warning"
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${
        tone === "success" ? "text-green-600 dark:text-green-400" :
        tone === "warning" ? "text-yellow-600 dark:text-yellow-400" :
        "text-foreground"
      }`}>
        {value}
      </div>
    </div>
  )
}

export default function ShopOrdersPage() {
  return (
    <ProtectedRoute>
      <ShopOrdersInner />
    </ProtectedRoute>
  )
}
