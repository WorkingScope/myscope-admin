"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { adminEventManage } from "@/lib/apiEndpoints"
import { EventCommunicationsCard } from "@/components/events/event-communications-card"
import { EventCommBillingCard } from "@/components/events/event-comm-billing-card"
import toast from "react-hot-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  AlertCircle, ArrowLeft, BarChart2, Bell, Calendar, CalendarClock, CheckCircle, CheckCircle2,
  ClipboardList, Copy, CreditCard, Edit3, ImageIcon, Loader, Mail, MapPin, Minus, Pause, Percent, Play, Plus, QrCode,
  RefreshCw, RotateCcw, Search, Send, Tag, Ticket as TicketIcon, Trash2, TrendingUp, Users,
  Wallet, WalletMinimal, X, XCircle,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000"

type Tab = "overview" | "details" | "tickets" | "attendees" | "checkin" | "scanners" | "promo" | "waitlist" | "comms" | "invite"

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "details", label: "Details" },
  { key: "tickets", label: "Tickets" },
  { key: "attendees", label: "Attendees" },
  { key: "checkin", label: "Check-in" },
  { key: "scanners", label: "Scanners" },
  { key: "promo", label: "Promos & offers" },
  { key: "waitlist", label: "Waitlist" },
  { key: "comms", label: "Comms" },
  { key: "invite", label: "Invite" },
]

const lkr = (n: any) => `LKR ${Number(n || 0).toLocaleString()}`

const formatWhen = (iso?: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

const formatRelative = (iso?: string | null) => {
  if (!iso) return ""
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ""
  const diff = Date.now() - d
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function ManageEventPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const id = params?.id as string

  const [tab, setTab] = useState<Tab>("overview")
  const [event, setEvent] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [pendingEdit, setPendingEdit] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [postponeOpen, setPostponeOpen] = useState(false)

  const loadEvent = useCallback(async () => {
    try {
      const res = await adminEventManage.get(id)
      setEvent(res.data?.data?.event ?? null)
      setTickets(res.data?.data?.ticket_types ?? [])
      setPendingEdit(res.data?.data?.pending_edit ?? null)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Couldn't load event.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadEvent() }, [loadEvent])

  const salesPaused = tickets.length > 0 && tickets.every((t) => t.is_active === false)

  const toggleSales = async (resume: boolean) => {
    setBusy(true)
    try {
      await (resume ? adminEventManage.resumeSales(id) : adminEventManage.pauseSales(id))
      toast.success(resume ? "Sales resumed." : "Sales paused.")
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setBusy(false)
    }
  }

  // Per-event convenience-fee override. The toggle only affects NEW bookings —
  // existing rows keep whatever fee was snapshotted on them at creation time.
  // Default for every event is ON; admin disables here for partner / comp events.
  const toggleConvenienceFee = async () => {
    const nextEnabled = event?.convenience_fee_enabled === false
    setBusy(true)
    try {
      await adminEventManage.setConvenienceFee(id, nextEnabled)
      toast.success(nextEnabled ? "Convenience fee enabled." : "Convenience fee disabled.")
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setBusy(false)
    }
  }

  // Per-event convenience-fee PERCENTAGE override, on top of the on/off
  // toggle above. Input holds the display value in PERCENT (e.g. "3.5"),
  // converted to a fraction (0.035) at save time. Blank input = clear the
  // override, falling back to the platform-wide default.
  const [feePctInput, setFeePctInput] = useState("")
  const [savingFeePct, setSavingFeePct] = useState(false)
  useEffect(() => {
    setFeePctInput(
      event?.convenience_fee_pct != null ? String(Number(event.convenience_fee_pct) * 100) : "",
    )
  }, [event?.convenience_fee_pct])

  const saveFeePct = async () => {
    const trimmed = feePctInput.trim()
    let pct: number | null
    if (trimmed === "") {
      pct = null
    } else {
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        toast.error("Enter a percentage between 0 and 100, or leave blank for the platform default.")
        return
      }
      pct = n / 100
    }
    setSavingFeePct(true)
    try {
      await adminEventManage.setConvenienceFeePct(id, pct)
      toast.success(pct === null ? "Back to platform default fee." : `Fee set to ${pct * 100}%.`)
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setSavingFeePct(false)
    }
  }

  // Per-event PAYOUT platform-fee PERCENTAGE override — the cut MyScope
  // keeps from this event's gross before paying the organizer out. Same
  // shape as the convenience-fee-pct override above. Replaces the old
  // per-organizer override.
  const [platformFeePctInput, setPlatformFeePctInput] = useState("")
  const [savingPlatformFeePct, setSavingPlatformFeePct] = useState(false)
  useEffect(() => {
    setPlatformFeePctInput(
      event?.platform_fee_pct != null ? String(Number(event.platform_fee_pct) * 100) : "",
    )
  }, [event?.platform_fee_pct])

  const savePlatformFeePct = async () => {
    const trimmed = platformFeePctInput.trim()
    let pct: number | null
    if (trimmed === "") {
      pct = null
    } else {
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        toast.error("Enter a percentage between 0 and 100, or leave blank for the platform default.")
        return
      }
      pct = n / 100
    }
    setSavingPlatformFeePct(true)
    try {
      await adminEventManage.setPlatformFeePct(id, pct)
      toast.success(pct === null ? "Back to platform default fee." : `Platform fee set to ${pct * 100}%.`)
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setSavingPlatformFeePct(false)
    }
  }

  // Per-event Koko (BNPL) override — on top of the global Koko feature flag.
  // The toggle only affects NEW payment attempts; a Koko payment already in
  // flight when this is disabled is unaffected.
  const toggleKoko = async () => {
    const nextEnabled = event?.koko_enabled === false
    setBusy(true)
    try {
      await adminEventManage.setKoko(id, nextEnabled)
      toast.success(nextEnabled ? "Koko payment enabled." : "Koko payment disabled.")
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setBusy(false)
    }
  }

  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  const confirmCancelEvent = async () => {
    setBusy(true)
    try {
      await adminEventManage.cancel(id, cancelReason.trim() || undefined)
      toast.success("Event cancelled.")
      setShowCancelDialog(false)
      setCancelReason("")
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setBusy(false)
    }
  }

  const [showUnpostponeDialog, setShowUnpostponeDialog] = useState(false)

  const confirmUnpostpone = async () => {
    setBusy(true)
    try {
      const r = await adminEventManage.unpostpone(id)
      toast.success(r.data?.message || "Postponement undone.")
      setShowUnpostponeDialog(false)
      loadEvent()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin"]}>
        <AdminLayout user={user ?? undefined}><PageLoader /></AdminLayout>
      </ProtectedRoute>
    )
  }

  if (!event) {
    return (
      <ProtectedRoute requiredRoles={["superadmin"]}>
        <AdminLayout user={user ?? undefined}>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Event not found.</p>
            <Link href="/events" className="text-sm text-primary hover:underline">Back to events</Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  const when = event.start_time || event.date
  const canManage = ["approved", "pending"].includes(event.approval_status)

  return (
    <ProtectedRoute requiredRoles={["superadmin"]}>
      <AdminLayout user={user ?? undefined}>
        <div className="p-6 space-y-6">
          <Link href={`/events/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to event
          </Link>

          {/* Identity — small banner thumbnail when the event has one */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
              {event.banner_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.banner_url}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              ) : (
                <Calendar className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{event.title}</h1>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">Admin override</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="capitalize">{event.approval_status}</span>
                {event.postponed && (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Postponed{event.postponed_to ? ` to ${new Date(event.postponed_to).toLocaleDateString()}` : " (date TBA)"}
                  </span>
                )}
                {when && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{new Date(when).toLocaleString()}</span>}
                {event.venue_name && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</span>}
              </div>
            </div>
          </div>

          {/* Lifecycle actions */}
          {canManage && event.approval_status !== "cancelled" && (
            <div className="flex flex-wrap items-center gap-2">
              {salesPaused ? (
                <button type="button" onClick={() => toggleSales(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  <Play className="w-4 h-4" /> Resume sales
                </button>
              ) : (
                <button type="button" onClick={() => toggleSales(false)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50">
                  <Pause className="w-4 h-4" /> Pause sales
                </button>
              )}
              {event.postponed ? (
                <button type="button" onClick={() => setShowUnpostponeDialog(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                  <RotateCcw className="w-4 h-4" /> Undo postpone
                </button>
              ) : (
                <button type="button" onClick={() => setPostponeOpen(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                  <CalendarClock className="w-4 h-4" /> Postpone
                </button>
              )}
              <button type="button" onClick={() => setShowCancelDialog(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Cancel event
              </button>
            </div>
          )}

          {/* Payment settings — grouped separately from the lifecycle actions
              above since these are per-event overrides, not one-off actions. */}
          {canManage && event.approval_status !== "cancelled" && (
            <div className="rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment settings</h3>
              <div className="flex flex-wrap items-center gap-2">
                {/* Per-event convenience fee toggle. Default state is ON — the
                    button text reflects whether the next click will turn it
                    off (currently on) or on (currently off). Forward-only:
                    changes only affect new bookings. */}
                {event.convenience_fee_enabled === false ? (
                  <button
                    type="button"
                    onClick={toggleConvenienceFee}
                    disabled={busy}
                    title="Convenience fee is OFF for this event — new bookings won't be charged. Click to enable."
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    <Wallet className="w-4 h-4" /> Enable conv. fee
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleConvenienceFee}
                    disabled={busy}
                    title="Convenience fee is ON for this event. Click to disable for new bookings."
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <WalletMinimal className="w-4 h-4" /> Disable conv. fee
                  </button>
                )}
                {/* Per-event fee PERCENTAGE override — on top of the on/off
                    toggle above. Blank = platform default. */}
                <div
                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm"
                  title="Custom convenience-fee percentage for this event. Leave blank to use the platform default."
                >
                  <Percent className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    inputMode="decimal"
                    value={feePctInput}
                    onChange={(e) => setFeePctInput(e.target.value)}
                    placeholder="default"
                    disabled={savingFeePct}
                    className="w-16 bg-transparent text-sm text-foreground focus:outline-none disabled:opacity-50"
                  />
                  <span className="text-muted-foreground">%</span>
                  <button
                    type="button"
                    onClick={saveFeePct}
                    disabled={savingFeePct}
                    className="ml-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {savingFeePct ? "Saving…" : "Set"}
                  </button>
                </div>
                {/* Per-event PAYOUT platform-fee PERCENTAGE override — the cut
                    MyScope keeps from this event's gross at payout time.
                    Replaces the old per-organizer override. */}
                <div
                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm"
                  title="Custom payout platform-fee percentage for this event. Leave blank to use the platform default."
                >
                  <Percent className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Platform fee</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    inputMode="decimal"
                    value={platformFeePctInput}
                    onChange={(e) => setPlatformFeePctInput(e.target.value)}
                    placeholder="default"
                    disabled={savingPlatformFeePct}
                    className="w-16 bg-transparent text-sm text-foreground focus:outline-none disabled:opacity-50"
                  />
                  <span className="text-muted-foreground">%</span>
                  <button
                    type="button"
                    onClick={savePlatformFeePct}
                    disabled={savingPlatformFeePct}
                    className="ml-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {savingPlatformFeePct ? "Saving…" : "Set"}
                  </button>
                </div>
                {/* Per-event Koko toggle, same shape as the conv. fee toggle
                    above — on top of the global Koko feature flag. */}
                {event.koko_enabled === false ? (
                  <button
                    type="button"
                    onClick={toggleKoko}
                    disabled={busy}
                    title="Koko payment is OFF for this event. Click to enable."
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" /> Enable Koko
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleKoko}
                    disabled={busy}
                    title="Koko payment is ON for this event (subject to the global Koko switch). Click to disable."
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" /> Disable Koko
                  </button>
                )}
              </div>
            </div>
          )}

          {postponeOpen && (
            <PostponeModal
              eventId={id}
              onClose={() => setPostponeOpen(false)}
              onDone={(msg) => {
                setPostponeOpen(false)
                toast.success(msg)
                loadEvent()
              }}
            />
          )}

          {/* A live (approved) event's edits get queued into event_pending_edits
              rather than applied directly — same rule that applies to organizer
              edits. Surfaced here so an admin editing from this page isn't
              surprised their change didn't take effect immediately. */}
          {pendingEdit && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
              <Send className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">A change is awaiting review</div>
                <p className="mt-0.5 text-xs">
                  Submitted {formatWhen(pendingEdit.submitted_at)}. This event is live, so edits queue
                  instead of applying immediately.{" "}
                  <Link href="/events/pending-edits" className="underline hover:no-underline">
                    Review in Pending edits
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="rounded-2xl bg-card p-3 shadow-sm dark:ring-1 dark:ring-white/10">
            <div className="flex flex-wrap gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {TABS.map((t) => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "overview" && <OverviewTab eventId={id} />}
          {tab === "details" && (
            <DetailsTab
              eventId={id}
              event={event}
              pendingEdit={pendingEdit}
              onSaved={loadEvent}
            />
          )}
          {tab === "tickets" && <TicketsTab eventId={id} tickets={tickets} reload={loadEvent} />}
          {tab === "attendees" && <AttendeesTab eventId={id} />}
          {tab === "checkin" && <CheckinTab eventId={id} />}
          {tab === "scanners" && <ScannersTab eventId={id} />}
          {tab === "promo" && <PromoTab eventId={id} tickets={tickets} />}
          {tab === "waitlist" && <WaitlistTab eventId={id} />}
          {tab === "comms" && <CommsTab eventId={id} />}
          {tab === "invite" && <InviteTab eventId={id} tickets={tickets} />}
        </div>

        {/* Cancel-event confirmation dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={(open) => { if (!open) { setShowCancelDialog(false); setCancelReason("") } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this event?</AlertDialogTitle>
              <AlertDialogDescription>
                Confirmed bookings will be queued for refund and attendees notified. Give an optional reason.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="mt-3 w-full resize-none rounded-lg bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowCancelDialog(false); setCancelReason("") }}>Keep event</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={(e) => { e.preventDefault(); confirmCancelEvent() }}
              >
                {busy ? <Loader className="h-4 w-4 animate-spin" /> : "Cancel event"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Undo-postpone confirmation dialog */}
        <AlertDialog open={showUnpostponeDialog} onOpenChange={(open) => { if (!open) setShowUnpostponeDialog(false) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Undo postpone?</AlertDialogTitle>
              <AlertDialogDescription>
                The event returns to its scheduled date and ticket sales reopen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowUnpostponeDialog(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                onClick={(e) => { e.preventDefault(); confirmUnpostpone() }}
              >
                {busy ? <Loader className="h-4 w-4 animate-spin" /> : "Undo postpone"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10">{children}</div>
}

function CardSkeleton() {
  return <Card><Loader className="w-5 h-5 animate-spin text-muted-foreground" /></Card>
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function EmptyHint({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function BigStat({
  icon: Icon, label, value, hint, tone = "default",
}: {
  icon: any
  label: string
  value: string
  hint?: string
  tone?: "default" | "success" | "warning"
}) {
  const iconStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[tone]
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
        </div>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${iconStyles}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ===========================================================================
// Overview — mirrors the organizer's Overview tab: 4 BigStat headline cards,
// invitations tile, communications card, ticket-type breakdown table.
// ===========================================================================

interface TicketTypeStat {
  id: string
  name: string
  price: number
  quantity: number
  sold: number
  revenue: number
  checked_in: number
}

interface OverviewData {
  summary: {
    total_revenue: number | string
    total_sold: number
    total_capacity: number
    total_checked_in: number
    occupancy_pct: number
  }
  ticket_types: TicketTypeStat[]
  attendees?: Array<{ id: string }>
}

function OverviewTab({ eventId }: { eventId: string }) {
  const [data, setData] = useState<OverviewData | null>(null)
  const [invites, setInvites] = useState<{ sent: number; failed: number } | null>(null)
  const [err, setErr] = useState("")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [analyticsRes, invitesRes] = await Promise.all([
          fetch(`${API_URL}/api/organizer/events/${eventId}/analytics`, { credentials: "include" }),
          fetch(`${API_URL}/api/organizer/events/${eventId}/invitations`, { credentials: "include" }),
        ])
        if (cancelled) return
        const analyticsBody = await analyticsRes.json()
        if (analyticsBody?.success) setData(analyticsBody.data as OverviewData)
        else setErr(analyticsBody?.message || "Couldn't load overview.")
        try {
          const invBody = await invitesRes.json()
          if (!cancelled && invBody?.success) {
            const rows = (invBody.data?.invitations ?? []) as Array<{ status: string }>
            let sent = 0
            let failed = 0
            for (const r of rows) {
              if (r.status === "sent") sent += 1
              else failed += 1
            }
            setInvites({ sent, failed })
          }
        } catch {
          /* leave invites null */
        }
      } catch {
        if (!cancelled) setErr("Network error loading overview.")
      }
    })()
    return () => { cancelled = true }
  }, [eventId])

  if (err) return <ErrorBanner message={err} />
  if (!data) return <CardSkeleton />

  const s = data.summary
  const bookingsCount = data.attendees?.length ?? 0
  const checkinPct = s.total_sold > 0 ? Math.round((s.total_checked_in / s.total_sold) * 100) : 0
  const invitesValue = invites ? String(invites.sent + invites.failed) : "—"

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <BigStat icon={TrendingUp} label="Revenue" value={lkr(s.total_revenue)} />
        <BigStat icon={TicketIcon} label="Tickets sold" value={`${s.total_sold} / ${s.total_capacity}`} hint={`${s.occupancy_pct}% full`} />
        <BigStat icon={Users} label="Bookings" value={bookingsCount.toLocaleString()} />
        <BigStat icon={CheckCircle} label="Checked in" value={`${s.total_checked_in} / ${s.total_sold}`} hint={s.total_sold > 0 ? `${checkinPct}%` : "—"} tone="success" />
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Invitations</div>
            <div className="mt-1 text-xl font-bold text-foreground">{invitesValue}</div>
            {invites && invites.failed > 0 && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {invites.sent} sent · {invites.failed} failed
              </div>
            )}
          </div>
          <Send className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <EventCommunicationsCard eventId={eventId} />

      {data.ticket_types && data.ticket_types.length > 0 && (
        <section className="overflow-hidden rounded-2xl bg-card shadow-sm dark:ring-1 dark:ring-white/10">
          <div className="border-b border-border/60 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart2 className="h-4 w-4 text-primary" /> Ticket-type breakdown
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Checked in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ticket_types.map((tt) => {
                const soldPct = tt.quantity > 0 ? Math.round((tt.sold / tt.quantity) * 100) : 0
                return (
                  <TableRow key={tt.id}>
                    <TableCell className="font-medium text-foreground">{tt.name}</TableCell>
                    <TableCell className="text-muted-foreground">{lkr(tt.price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{tt.sold} / {tt.quantity}</span>
                        <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                          <div className="h-full bg-primary" style={{ width: `${soldPct}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{lkr(tt.revenue)}</TableCell>
                    <TableCell className="text-muted-foreground">{tt.checked_in}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Details tab — the admin-side counterpart of the organizer's own edit-event
// form (myscope-web/src/app/organizer/events/[id]/edit). Same field set,
// same PATCH endpoint (superadmin passes the ownership check on
// /organizer/events/:id), so behavior matches exactly: draft/pending/rejected
// events save immediately, approved (live) events queue the change into
// event_pending_edits for review instead of applying it right away.
// ---------------------------------------------------------------------------

const isoToLocalInput = (iso: string | null | undefined) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const localInputToIso = (v: string) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function DetailsTab({
  eventId,
  event,
  pendingEdit,
  onSaved,
}: {
  eventId: string
  event: any
  pendingEdit: any
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: "", description: "", category: "", venue_name: "", venue_address: "",
    venue_location_url: "", start_time: "", end_time: "", capacity: "",
    banner_url: "", layout_image_url: "", trailer_url: "", sms_reminders: true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!event) return
    setForm({
      title: event.title ?? "",
      description: event.description ?? "",
      category: event.category ?? "",
      venue_name: event.venue_name ?? "",
      venue_address: event.venue_address ?? "",
      venue_location_url: event.venue_location_url ?? "",
      start_time: isoToLocalInput(event.start_time),
      end_time: isoToLocalInput(event.end_time),
      capacity: event.capacity != null ? String(event.capacity) : "",
      banner_url: event.banner_url ?? "",
      layout_image_url: event.layout_image_url ?? "",
      trailer_url: event.trailer_url ?? "",
      sms_reminders: event.sms_reminders ?? true,
    })
  }, [event])

  if (!event) return <CardSkeleton />

  const canEdit = ["draft", "pending", "approved", "rejected"].includes(event.approval_status)
  const inp = "w-full rounded-md bg-muted px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
  const label = "mb-1.5 block text-sm font-medium"

  const save = async () => {
    setErr("")
    if (!form.title.trim()) { setErr("Title is required."); return }
    if (!form.start_time) { setErr("Start time is required."); return }
    setSaving(true)
    try {
      const res = await adminEventManage.update(eventId, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        venue_name: form.venue_name.trim() || null,
        venue_address: form.venue_address.trim() || null,
        venue_location_url: form.venue_location_url.trim() || null,
        start_time: localInputToIso(form.start_time),
        end_time: localInputToIso(form.end_time),
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        banner_url: form.banner_url.trim() || null,
        layout_image_url: form.layout_image_url.trim() || null,
        trailer_url: form.trailer_url.trim() || null,
        sms_reminders: form.sms_reminders,
      })
      if (res.data?.queued) {
        toast.success(res.data?.message || "Submitted for review. The live event stays unchanged until approved.")
      } else {
        toast.success("Saved.")
      }
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>This event is <strong>{event.approval_status}</strong> and cannot be edited.</span>
        </div>
      )}
      {err && <ErrorBanner message={err} />}

      <Card>
        <fieldset disabled={!canEdit || saving} className="space-y-4">
          <div>
            <label className={label} htmlFor="d-title">Title <span className="text-destructive">*</span></label>
            <input id="d-title" className={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="d-category">Category</label>
              <select id="d-category" className={inp} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Pick one…</option>
                <option value="Concerts">Concerts</option>
                <option value="Theatre">Theatre</option>
                <option value="Sports">Sports</option>
                <option value="Events">Events</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="d-capacity">Capacity</label>
              <input id="d-capacity" type="number" min={1} className={inp} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="d-description">Description</label>
            <textarea id="d-description" rows={5} className={inp} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="d-start">Start time <span className="text-destructive">*</span></label>
              <input id="d-start" type="datetime-local" className={inp} value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className={label} htmlFor="d-end">End time</label>
              <input id="d-end" type="datetime-local" className={inp} value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="d-venue-name">Venue name</label>
            <input id="d-venue-name" className={inp} value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} />
          </div>

          <div>
            <label className={label} htmlFor="d-venue-address">Venue address</label>
            <input id="d-venue-address" className={inp} value={form.venue_address} onChange={(e) => setForm({ ...form, venue_address: e.target.value })} />
          </div>

          <div>
            <label className={label} htmlFor="d-venue-url">Location URL</label>
            <input id="d-venue-url" type="url" placeholder="https://maps.google.com/..." className={inp} value={form.venue_location_url} onChange={(e) => setForm({ ...form, venue_location_url: e.target.value })} />
          </div>

          <ImageUploadField label="Banner image" value={form.banner_url} onChange={(url) => setForm({ ...form, banner_url: url })} disabled={!canEdit || saving} />
          <ImageUploadField
            label="Seating / zone layout (optional)"
            hint="A venue map showing zones or the seat plan. Shown to attendees on the ticket-selection page."
            value={form.layout_image_url}
            onChange={(url) => setForm({ ...form, layout_image_url: url })}
            disabled={!canEdit || saving}
          />

          <div>
            <label className={label} htmlFor="d-trailer">YouTube trailer (optional)</label>
            <input id="d-trailer" type="url" placeholder="https://www.youtube.com/watch?v=…" className={inp} value={form.trailer_url} onChange={(e) => setForm({ ...form, trailer_url: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.sms_reminders} onChange={(e) => setForm({ ...form, sms_reminders: e.target.checked })} className="h-4 w-4 rounded border-border" />
            SMS reminders — text attendees before this event
          </label>
        </fieldset>
      </Card>

      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canEdit || saving || !!pendingEdit}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
        {pendingEdit && (
          <p className="text-xs text-muted-foreground">
            A previous edit is still awaiting review. Resolve it in Pending edits before submitting another.
          </p>
        )}
      </div>
    </div>
  )
}

function ImageUploadField({
  label, hint, value, onChange, disabled,
}: {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
  disabled: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) { setUploadErr("Please select an image file (PNG, JPG, WebP…)."); return }
    if (file.size > 5 * 1024 * 1024) { setUploadErr("Image must be under 5 MB."); return }
    setUploadErr("")
    setUploading(true)
    try {
      const res = await adminEventManage.uploadBanner(file)
      if (!res.data?.success || !res.data.data?.url) throw new Error("Upload failed.")
      onChange(res.data.data.url)
    } catch (err: any) {
      setUploadErr(err?.response?.data?.message || err?.message || "Upload failed.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <ImageIcon className="h-4 w-4 text-primary" /> {label}
      </span>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <label className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition-colors ${disabled ? "cursor-not-allowed opacity-50" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          title={`Upload ${label.toLowerCase()}`}
          aria-label={`Upload ${label.toLowerCase()}`}
          className="hidden"
          onChange={handleFile}
          disabled={disabled || uploading}
        />
        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader className="h-4 w-4 animate-spin" /> Uploading…</div>
        ) : (
          <span className="text-sm font-semibold text-primary">Click to upload image</span>
        )}
        <span className="text-xs text-muted-foreground">PNG, JPG, WebP · max 5 MB</span>
      </label>

      {uploadErr && <p className="text-xs text-destructive">{uploadErr}</p>}

      {value && (
        <div className="space-y-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={`${label} preview`} className="w-full rounded-lg bg-muted object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
          {!disabled && (
            <button type="button" onClick={() => onChange("")} className="text-xs font-medium text-destructive hover:underline">
              Remove image
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TicketsTab({ eventId, tickets, reload }: { eventId: string; tickets: any[]; reload: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<any>({ name: "", price: "", quantity_total: "", per_order_limit: "10", is_active: true, description: "" })
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const start = (t: any) => { setEditing(t.id); setDraft({ name: t.name, price: String(t.price), quantity_total: String(t.quantity_total), per_order_limit: String(t.per_order_limit), is_active: t.is_active, description: t.description ?? "" }) }
  const startNew = () => { setEditing("new"); setDraft({ name: "", price: "", quantity_total: "", per_order_limit: "10", is_active: true, description: "" }) }

  const save = async () => {
    const body = { name: draft.name.trim(), price: Number(draft.price), quantity_total: parseInt(draft.quantity_total, 10), per_order_limit: parseInt(draft.per_order_limit, 10), is_active: draft.is_active, description: draft.description || null }
    setBusy(true)
    try {
      // A live (approved) event queues ticket-tier changes into event_pending_edits
      // instead of applying them — same rule as the core-details PATCH. Without
      // checking `queued` here the tier would look "saved" while actually
      // untouched until an admin approves it via Pending edits.
      const res = editing === "new"
        ? await adminEventManage.createTicketType(eventId, body)
        : await adminEventManage.updateTicketType(eventId, editing!, body)
      toast.success(res.data?.queued ? (res.data?.message || "Submitted for review.") : "Saved.")
      setEditing(null); reload()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") } finally { setBusy(false) }
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await adminEventManage.deleteTicketType(eventId, deleteTarget.id)
      toast.success(res.data?.queued ? (res.data?.message || "Submitted for review.") : "Deleted.")
      setDeleteTarget(null)
      reload()
    }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") }
    finally { setDeleting(false) }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Ticket types</h2>
        {editing !== "new" && <button type="button" onClick={startNew} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/70"><Plus className="w-3.5 h-3.5" /> Add</button>}
      </div>
      <ul className="space-y-2">
        {tickets.map((t) => editing === t.id ? (
          <DraftRow key={t.id} draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
            <div>
              <div className="font-medium text-sm text-foreground">{t.name} {!t.is_active && <span className="text-xs text-muted-foreground">· inactive</span>}</div>
              <div className="text-xs text-muted-foreground">{lkr(t.price)} · {t.quantity_sold}/{t.quantity_total} sold · max {t.per_order_limit}/order</div>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => start(t)} className="px-2 py-1 rounded text-xs bg-muted transition-colors hover:bg-muted/70">Edit</button>
              <button type="button" onClick={() => setDeleteTarget(t)} disabled={t.quantity_sold > 0} aria-label={`Delete ticket type ${t.name}`} className="px-2 py-1 rounded text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </li>
        ))}
        {editing === "new" && <DraftRow draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />}
        {tickets.length === 0 && editing !== "new" && <li className="text-sm text-muted-foreground">No ticket types.</li>}
      </ul>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ticket type?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && <>&ldquo;{deleteTarget.name}&rdquo; will be removed. This can&rsquo;t be undone.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
            >
              {deleting ? <Loader className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function DraftRow({ draft, setDraft, busy, onSave, onCancel }: any) {
  const inp = "rounded-md bg-muted px-2.5 py-2 text-sm w-full text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
  return (
    <li className="space-y-2 rounded-lg bg-primary/5 p-3 ring-1 ring-primary/40">
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className={inp} type="number" placeholder="Price" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        <input className={inp} type="number" placeholder="Total qty" value={draft.quantity_total} onChange={(e) => setDraft({ ...draft, quantity_total: e.target.value })} />
        <input className={inp} type="number" placeholder="Per-order limit" value={draft.per_order_limit} onChange={(e) => setDraft({ ...draft, per_order_limit: e.target.value })} />
      </div>
      <input className={inp} placeholder="Description (optional)" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Active
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded text-xs bg-muted transition-colors hover:bg-muted/70">Cancel</button>
        <button type="button" onClick={onSave} disabled={busy} className="px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
    </li>
  )
}

function AttendeesTab({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refundTarget, setRefundTarget] = useState<any>(null)
  const [resendTarget, setResendTarget] = useState<any>(null)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    try { const r = await adminEventManage.bookings(eventId); setRows(r.data?.data?.bookings ?? []) }
    catch { setRows([]) }
  }, [eventId])
  useEffect(() => { load() }, [load])

  const confirmResend = async () => {
    if (!resendTarget) return
    setBusyId(resendTarget.id)
    try { await adminEventManage.resendBooking(eventId, resendTarget.id); toast.success("Confirmation resent.") }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") }
    finally { setBusyId(null); setResendTarget(null) }
  }
  const confirmRefund = async () => {
    if (!refundTarget) return
    setBusyId(refundTarget.id)
    try { await adminEventManage.refundBooking(eventId, refundTarget.id); toast.success("Refund requested."); setRefundTarget(null); load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") }
    finally { setBusyId(null) }
  }

  if (!rows) return <Card><Loader className="w-5 h-5 animate-spin text-muted-foreground" /></Card>

  const confirmedOnly = rows.filter((b) => b.status === "Confirmed")
  const q = search.trim().toLowerCase()
  const filtered = q
    ? confirmedOnly.filter((b) =>
        b.attendee_info?.name?.toLowerCase().includes(q) ||
        b.attendee_info?.email?.toLowerCase().includes(q) ||
        b.guest_name?.toLowerCase().includes(q) ||
        b.guest_email?.toLowerCase().includes(q) ||
        b.booking_reference?.toLowerCase().includes(q) ||
        b.short_code?.toLowerCase().includes(q),
      )
    : confirmedOnly

  if (confirmedOnly.length === 0) return <EmptyHint icon={Users} text="No confirmed bookings yet." />

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search by name, email, or booking ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg bg-muted py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No attendees match &ldquo;{search}&rdquo;.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((b) => {
            const name = b.attendee_info?.name || b.guest_name || "—"
            const email = b.attendee_info?.email || b.guest_email || "—"
            const checkedTickets = b.checked_in_tickets ?? 0
            const fullyIn = checkedTickets > 0 && checkedTickets >= b.number_of_tickets
            const partiallyIn = checkedTickets > 0 && checkedTickets < b.number_of_tickets
            // Refund stays blocked once ANY ticket in the booking is used.
            const anyCheckedIn = checkedTickets > 0 || !!b.checked_in_at
            return (
              <li key={b.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{name}</span>
                    {fullyIn && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Checked in
                      </span>
                    )}
                    {partiallyIn && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        <CheckCircle2 className="h-3 w-3" /> {checkedTickets}/{b.number_of_tickets} in
                      </span>
                    )}
                    {b.is_invitation && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
                        title="Comp ticket issued from the Invite tab"
                      >
                        <Send className="h-3 w-3" /> Invited
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {email} · {b.number_of_tickets} ticket{b.number_of_tickets === 1 ? "" : "s"} · {lkr(b.total_amount)}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {b.short_code || b.booking_reference}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setResendTarget(b)}
                    disabled={busyId === b.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busyId === b.id ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundTarget(b)}
                    disabled={busyId === b.id || anyCheckedIn}
                    title={anyCheckedIn ? "Can't refund — a ticket from this booking has already been checked in." : undefined}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refund
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Resend confirmation — avoids accidentally re-sending a ticket
          email/SMS from a stray tap on a list that can have dozens of rows. */}
      <AlertDialog open={resendTarget !== null} onOpenChange={(open) => { if (!open) setResendTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              {resendTarget && (
                <>
                  This will resend the ticket email/SMS to{" "}
                  <span className="font-medium text-foreground">
                    {resendTarget.attendee_info?.name || resendTarget.guest_name || "this attendee"}
                  </span>{" "}
                  ({resendTarget.attendee_info?.email || resendTarget.guest_email || "no email on file"}).
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResendTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId === resendTarget?.id}
              onClick={(e) => { e.preventDefault(); confirmResend() }}
            >
              {busyId === resendTarget?.id ? <Loader className="h-4 w-4 animate-spin" /> : "Resend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={refundTarget !== null} onOpenChange={(open) => { if (!open) setRefundTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {refundTarget && <>Booking {refundTarget.booking_reference} will be refunded and its tickets released.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRefundTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId === refundTarget?.id}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => { e.preventDefault(); confirmRefund() }}
            >
              {busyId === refundTarget?.id ? <Loader className="h-4 w-4 animate-spin" /> : "Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type GateStat = { label: string; scanned: number }

function CheckinTab({ eventId }: { eventId: string }) {
  const [data, setData] = useState<any>(null)
  const [gates, setGates] = useState<GateStat[]>([])
  const [err, setErr] = useState("")

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, statsRes] = await Promise.all([
        adminEventManage.checkInStatus(eventId),
        fetch(`${API_URL}/api/scanner/events/${eventId}/stats`, { credentials: "include" }).then((r) => r.json()).catch(() => null),
      ])
      setData(statusRes.data?.data ?? null)
      if (statsRes?.success && Array.isArray(statsRes.data?.gates)) {
        setGates(statsRes.data.gates as GateStat[])
      } else {
        setGates([])
      }
    } catch {
      setErr("Network error.")
    }
  }, [eventId])

  useEffect(() => {
    fetchStatus()
    // Light polling — the gate is fast-moving on event day. 10s avoids
    // hammering the API while still feeling live.
    const t = setInterval(fetchStatus, 10_000)
    return () => clearInterval(t)
  }, [fetchStatus])

  if (err) return <ErrorBanner message={err} />
  if (!data) return <CardSkeleton />

  const t = data.totals || {}
  const totalScanned = gates.reduce((s, g) => s + g.scanned, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <BigStat icon={TicketIcon} label="Tickets sold" value={String(t.tickets ?? 0)} />
        <BigStat icon={CheckCircle} label="Checked in" value={String(t.checked_in_tickets ?? 0)} tone="success" />
        <BigStat icon={Users} label="% through" value={`${t.checked_in_pct ?? 0}%`} />
      </div>

      {gates.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">By gate</h3>
          <ul className="space-y-2">
            {gates.map((g) => {
              const share = totalScanned > 0 ? Math.round((g.scanned / totalScanned) * 100) : 0
              return (
                <li key={g.label} className="rounded-lg bg-card p-3 shadow-sm dark:ring-1 dark:ring-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{g.label}</span>
                    <span className="text-sm font-semibold text-foreground">
                      {g.scanned} <span className="text-xs font-normal text-muted-foreground">· {share}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Recent check-ins</h3>
        {(data.recent ?? []).length === 0 ? (
          <EmptyHint icon={CheckCircle2} text="No check-ins yet." />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm dark:ring-1 dark:ring-white/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendee</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{r.name || r.booking_reference || "—"}</div>
                      {r.booking_reference && (
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {r.booking_reference}{r.number_of_tickets ? ` · ${r.number_of_tickets} ticket${r.number_of_tickets === 1 ? "" : "s"}` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

// ===========================================================================
// Scanners — issue / list / revoke scanner-app invites for door staff.
// Mirrors the organizer's ScannersTab. Polls every 10s while open.
// ===========================================================================

type ScannerInvite = {
  id: string
  gate_label: string | null
  device_label: string | null
  expires_at: string
  revoked_at: string | null
  redeemed_at: string | null
  last_used_at: string | null
  created_at: string
  scan_count: number
  computed_status: "unredeemed" | "active" | "revoked" | "expired"
  // Plaintext code for re-viewing code/QR until expiry. Null for revoked/expired
  // invites, or invites issued before the code-persistence migration.
  code: string | null
}

// The reveal card is shared between a just-issued code and re-viewing an
// existing one — both just need the code + context.
type CodeReveal = { code: string; gate_label: string | null; expires_at: string; isNew: boolean }

function ScannersTab({ eventId }: { eventId: string }) {
  const [invites, setInvites] = useState<ScannerInvite[] | null>(null)
  const [err, setErr] = useState("")
  const [form, setForm] = useState({ gate_label: "", expires_in_hours: "12" })
  const [creating, setCreating] = useState(false)
  const [formErr, setFormErr] = useState("")
  const [reveal, setReveal] = useState<CodeReveal | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ScannerInvite | null>(null)

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/organizer/scanner-invites?event_id=${eventId}`, { credentials: "include" })
      const body = await res.json()
      if (body?.success) setInvites((body.data ?? []) as ScannerInvite[])
      else setErr(body?.message || "Couldn't load scanner invites.")
    } catch {
      setErr("Network error.")
    }
  }, [eventId])

  useEffect(() => {
    fetchInvites()
    // Light polling — Scanners tab doubles as the live monitor during the
    // event so the scan counts and last-activity timestamps stay current.
    const t = setInterval(fetchInvites, 10_000)
    return () => clearInterval(t)
  }, [fetchInvites])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr("")
    setCreating(true)
    try {
      const res = await fetch(`${API_URL}/api/organizer/scanner-invites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          gate_label: form.gate_label.trim() || null,
          expires_in_hours: Number(form.expires_in_hours),
        }),
      })
      const body = await res.json()
      if (!body?.success) {
        setFormErr(body?.message || "Couldn't issue invite.")
        return
      }
      setReveal({ code: body.data.code, gate_label: body.data.gate_label, expires_at: body.data.expires_at, isNew: true })
      setCopied(false)
      setForm({ gate_label: "", expires_in_hours: form.expires_in_hours })
      await fetchInvites()
    } catch {
      setFormErr("Network error.")
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/organizer/scanner-invites/${id}/revoke`, {
        method: "POST",
        credentials: "include",
      })
      await fetchInvites()
    } catch {
      setErr("Network error revoking invite.")
    } finally {
      setRevokeTarget(null)
    }
  }

  const copyCode = async () => {
    if (!reveal) return
    try {
      await navigator.clipboard.writeText(reveal.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  if (err) return <ErrorBanner message={err} />

  const inp = "rounded-md bg-muted px-2.5 py-2 text-sm w-full text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"

  return (
    <div className="space-y-5">
      {/* Code + QR reveal — shown right after issuing AND any time you tap
          "View code" on a still-valid invite below. Re-viewable until expiry. */}
      {reveal && (
        <div className="rounded-2xl bg-primary/5 p-5 ring-2 ring-primary/40">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{reveal.isNew ? "New invite issued" : "Scanner invite code"}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Share this code with the door staff. Expires {formatWhen(reveal.expires_at)}.
              </p>
            </div>
            <button type="button" onClick={() => setReveal(null)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Dismiss">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="rounded-lg bg-white p-3 shrink-0 self-center sm:self-auto">
              <QRCodeSVG value={reveal.code} size={132} level="M" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="rounded-lg bg-card px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.4em] text-foreground shadow-sm">
                {reveal.code}
              </div>
              <button type="button" onClick={copyCode} className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-muted/70">
                <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy code"}
              </button>
              <p className="text-xs text-muted-foreground">
                Staff can scan the QR in the MyScope Organizer app, or type the code manually.
              </p>
            </div>
          </div>
          {reveal.gate_label && (
            <p className="mt-3 text-xs text-muted-foreground">Gate: <strong>{reveal.gate_label}</strong></p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
        <h3 className="text-sm font-semibold text-foreground">Issue scanner invite</h3>
        <p className="text-xs text-muted-foreground">
          Generate a one-time code your door staff can redeem in the MyScope Organizer app to scan tickets — no MyScope account required.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className={inp}
            placeholder="Gate label (optional, e.g. Main Gate)"
            value={form.gate_label}
            onChange={(e) => setForm({ ...form, gate_label: e.target.value })}
            maxLength={60}
          />
          <select
            aria-label="Expires in"
            value={form.expires_in_hours}
            onChange={(e) => setForm({ ...form, expires_in_hours: e.target.value })}
            className={inp}
          >
            <option value="4">Expires in 4 hours</option>
            <option value="8">Expires in 8 hours</option>
            <option value="12">Expires in 12 hours</option>
            <option value="24">Expires in 24 hours</option>
            <option value="48">Expires in 48 hours</option>
          </select>
        </div>
        {formErr && <p className="text-xs text-destructive">{formErr}</p>}
        <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium transition hover:bg-primary/90 disabled:opacity-50">
          {creating ? <Loader className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
          Issue invite
        </button>
      </form>

      {/* List — expired invites are hidden automatically. */}
      {(() => {
        const visible = (invites ?? []).filter((inv) => inv.computed_status !== "expired")
        if (!invites) return <CardSkeleton />
        if (visible.length === 0) return <EmptyHint icon={QrCode} text="No active scanner invites. Issue one above to delegate door-scanning to staff." />
        return (
          <ul className="space-y-2">
            {visible.map((inv) => {
              const canRevoke = inv.computed_status === "active" || inv.computed_status === "unredeemed"
              const badgeStyle =
                inv.computed_status === "active"     ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                inv.computed_status === "unredeemed" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                inv.computed_status === "revoked"    ? "bg-destructive/15 text-destructive" :
                                                       "bg-muted text-muted-foreground"
              return (
                <li key={inv.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-base font-semibold text-foreground">
                        {inv.gate_label || "(no gate label)"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${badgeStyle}`}>{inv.computed_status}</span>
                      {inv.scan_count > 0 && (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {inv.scan_count} scan{inv.scan_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {inv.device_label ? <>Phone: <strong>{inv.device_label}</strong> · </> : null}
                      Expires {formatWhen(inv.expires_at)}
                      {inv.last_used_at && <> · last activity {formatRelative(inv.last_used_at)}</>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {inv.code && (
                      <button
                        type="button"
                        onClick={() => { setReveal({ code: inv.code!, gate_label: inv.gate_label, expires_at: inv.expires_at, isNew: false }); setCopied(false) }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/70"
                      >
                        <QrCode className="w-3.5 h-3.5" /> View code
                      </button>
                    )}
                    {canRevoke && (
                      <button type="button" onClick={() => setRevokeTarget(inv)} className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20">
                        <XCircle className="w-3.5 h-3.5" /> Revoke
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )
      })()}

      <AlertDialog open={revokeTarget !== null} onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this scanner session?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget && (
                <>
                  The phone using{" "}
                  <span className="font-medium text-foreground">
                    {revokeTarget.gate_label || "this invite"}
                  </span>{" "}
                  will be signed out on its next request.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRevokeTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (revokeTarget) revoke(revokeTarget.id) }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <XCircle className="h-4 w-4" /> Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===========================================================================
// Promos & offers — promo codes (existing) + auto-applied quantity-threshold
// offers. Mirrors the organizer's PromoTab.
// ===========================================================================

function PromoTab({ eventId, tickets }: { eventId: string; tickets: any[] }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [view, setView] = useState<"codes" | "offers">("codes")
  const [form, setForm] = useState<any>({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", min_total: "" })
  const [creating, setCreating] = useState(false)
  const [formErr, setFormErr] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  const load = useCallback(async () => { try { const r = await adminEventManage.listPromos(eventId); setRows(r.data?.data?.promo_codes ?? []) } catch { setRows([]) } }, [eventId])
  useEffect(() => { load() }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr("")
    setCreating(true)
    try {
      await adminEventManage.createPromo(eventId, {
        code: form.code.trim(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        min_total: form.min_total ? Number(form.min_total) : null,
      })
      setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", min_total: "" })
      load()
    }
    catch (e: any) { setFormErr(e?.response?.data?.message || "Couldn't create code.") }
    finally { setCreating(false) }
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try { await adminEventManage.deletePromo(eventId, deleteTarget.id); toast.success("Deleted."); load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed.") }
    finally { setDeleteTarget(null) }
  }
  const inp = "rounded-md bg-muted px-2.5 py-2 text-sm w-full text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"

  return (
    <div className="space-y-5">
      {/* Toggle — promo codes (buyer enters a code) and offers (auto-applied
          at a quantity threshold) are distinct mechanisms, so showing one at
          a time keeps each tool focused instead of a long stacked scroll. */}
      <div className="inline-flex rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setView("codes")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "codes" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Tag className="h-3.5 w-3.5" /> Promo codes
        </button>
        <button
          type="button"
          onClick={() => setView("offers")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "offers" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Percent className="h-3.5 w-3.5" /> Offers
        </button>
      </div>

      {view === "codes" ? (
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Promo codes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Buyers enter a code at checkout to get a discount.</p>
          </div>

          <form onSubmit={create} className="space-y-3 rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
            <h3 className="text-sm font-semibold text-foreground">New promo code</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className={`${inp} font-mono uppercase`} placeholder="CODE (e.g. EARLY10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
              <select aria-label="Discount type" className={inp} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                <option value="percentage">Percent off (%)</option>
                <option value="fixed">Fixed amount off (LKR)</option>
              </select>
              <input className={inp} type="number" min={0} step="0.01" placeholder={form.discount_type === "percentage" ? "Percent (e.g. 10)" : "LKR off (e.g. 500)"} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required />
              <input className={inp} type="number" min={1} placeholder="Max uses (blank = unlimited)" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
              <input className={inp} type="number" min={0} placeholder="Min booking total (LKR, optional)" value={form.min_total} onChange={(e) => setForm({ ...form, min_total: e.target.value })} />
            </div>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
            <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
              {creating ? <Loader className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              Create code
            </button>
          </form>

          {!rows ? (
            <CardSkeleton />
          ) : rows.length === 0 ? (
            <EmptyHint icon={Tag} text="No promo codes yet. Create one above to give a discount." />
          ) : (
            <ul className="space-y-2">
              {rows.map((c) => {
                const valueLabel = c.discount_type === "percentage" ? `${Number(c.discount_value)}% off` : `${lkr(c.discount_value)} off`
                return (
                  <li key={c.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-base font-bold tracking-wider text-foreground">{c.code}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{valueLabel}</span>
                        {!c.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Used {c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : " (unlimited)"}
                        {c.min_total != null && ` · min ${lkr(c.min_total)}`}
                      </div>
                    </div>
                    <button type="button" onClick={() => setDeleteTarget(c)} className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this promo code?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget && <>Anyone with <span className="font-mono font-medium text-foreground">{deleteTarget.code}</span> won&rsquo;t be able to redeem it anymore.</>}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); confirmDelete() }}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      ) : (
        <OffersCard eventId={eventId} tickets={tickets} />
      )}
    </div>
  )
}

// ===========================================================================
// Offers — quantity-threshold auto-discounts. Mirrors organizer OffersCard.
// ===========================================================================

type OfferDiscountType = "free_tickets" | "percent" | "fixed"

interface EventOffer {
  id: string
  event_id: string
  ticket_type_id: string | null
  name: string
  min_quantity: number
  discount_type: OfferDiscountType
  discount_value: number | string
  is_active: boolean
  created_at: string
  updated_at: string
}

function OffersCard({ eventId, tickets }: { eventId: string; tickets: any[] }) {
  const [offers, setOffers] = useState<EventOffer[] | null>(null)
  const [err, setErr] = useState("")
  const [creating, setCreating] = useState(false)
  const [formErr, setFormErr] = useState("")
  const [form, setForm] = useState({
    name: "",
    min_quantity: "",
    discount_type: "free_tickets" as OfferDiscountType,
    discount_value: "",
    ticket_type_id: "" as string,
  })
  const [deleteTarget, setDeleteTarget] = useState<EventOffer | null>(null)

  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/offers`, { credentials: "include" })
      const body = await res.json()
      if (body?.success) setOffers((body.data?.offers ?? []) as EventOffer[])
      else setErr(body?.message || "Couldn't load offers.")
    } catch {
      setErr("Network error.")
    }
  }, [eventId])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr("")
    setCreating(true)
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/offers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          min_quantity: Number(form.min_quantity),
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          ticket_type_id: form.ticket_type_id || null,
        }),
      })
      const body = await res.json()
      if (!body?.success) {
        setFormErr(body?.message || "Couldn't create offer.")
        return
      }
      setForm({ name: "", min_quantity: "", discount_type: "free_tickets", discount_value: "", ticket_type_id: "" })
      await fetchOffers()
    } catch {
      setFormErr("Network error.")
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (offer: EventOffer) => {
    try {
      await fetch(`${API_URL}/api/organizer/events/${eventId}/offers/${offer.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !offer.is_active }),
      })
      await fetchOffers()
    } catch {
      setErr("Network error toggling offer.")
    }
  }

  const removeOffer = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/organizer/events/${eventId}/offers/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      await fetchOffers()
    } catch {
      setErr("Network error deleting offer.")
    } finally {
      setDeleteTarget(null)
    }
  }

  const valueLabel = (o: EventOffer): string => {
    const v = Number(o.discount_value) || 0
    if (o.discount_type === "free_tickets") return `${v} free ticket${v === 1 ? "" : "s"}`
    if (o.discount_type === "percent") return `${v}% off`
    return `${lkr(v)} off`
  }
  const tierLabel = (o: EventOffer): string => {
    if (!o.ticket_type_id) return "Any tier"
    const t = (tickets ?? []).find((x: any) => x.id === o.ticket_type_id)
    return t ? t.name : "Tier (deleted)"
  }

  if (err) return <ErrorBanner message={err} />

  const inp = "rounded-md bg-muted px-2.5 py-2 text-sm w-full text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Offers</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Auto-applied at checkout when the buyer&rsquo;s cart hits the threshold. No code required.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
        <div>
          <h3 className="text-sm font-semibold text-foreground">New offer</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How it works: <strong>1.</strong> Give the offer a name (buyers don&rsquo;t see this &mdash; it&rsquo;s for your records).{" "}
            <strong>2.</strong> Set the minimum tickets the buyer must add to qualify (e.g. 5).{" "}
            <strong>3.</strong> Pick the reward: free tickets, a percent off, or a fixed LKR amount off.{" "}
            <strong>4.</strong> Optionally restrict to a single tier &mdash; otherwise the threshold counts every ticket in the cart.{" "}
            The discount applies automatically at checkout once the threshold is reached. No code needed.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className={inp}
            placeholder="Name (e.g. Group of 5)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className={inp}
            type="number"
            min="1"
            placeholder="Min tickets to qualify (e.g. 5)"
            value={form.min_quantity}
            onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
            required
          />
          <select
            aria-label="Discount type"
            value={form.discount_type}
            onChange={(e) => setForm({ ...form, discount_type: e.target.value as OfferDiscountType, discount_value: "" })}
            className={inp}
          >
            <option value="free_tickets">Free tickets (buy N get M free)</option>
            <option value="percent">Percent off (%)</option>
            <option value="fixed">Fixed amount off (LKR)</option>
          </select>
          <input
            className={inp}
            type="number"
            min="0"
            step={form.discount_type === "free_tickets" ? "1" : "0.01"}
            placeholder={
              form.discount_type === "free_tickets" ? "Free count (e.g. 1)"
              : form.discount_type === "percent"    ? "Percent (e.g. 10)"
              :                                       "LKR off (e.g. 500)"
            }
            value={form.discount_value}
            onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
            required
          />
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {form.discount_type === "free_tickets" ? "Which tier gets free tickets?" : "Applies to tier"}
            </label>
            <select
              aria-label="Applies to tier"
              value={form.ticket_type_id}
              onChange={(e) => setForm({ ...form, ticket_type_id: e.target.value })}
              className={inp}
            >
              <option value="">
                {form.discount_type === "free_tickets"
                  ? "Any tier (free the cheapest in cart)"
                  : "Any tier (cart-wide)"}
              </option>
              {(tickets ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {form.discount_type === "free_tickets"
                ? "Pick a tier to make M free tickets come from that tier specifically, or keep \"Any tier\" so the buyer's cheapest tickets become free."
                : "Pick a tier to count only those tickets toward the threshold and apply the discount to that tier's subtotal."}
            </p>
          </div>
        </div>
        {formErr && <p className="text-xs text-destructive">{formErr}</p>}
        <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {creating ? <Loader className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
          Create offer
        </button>
      </form>

      {!offers ? (
        <CardSkeleton />
      ) : offers.length === 0 ? (
        <EmptyHint icon={Tag} text="No offers yet. Create one above to reward bulk purchases." />
      ) : (
        <ul className="space-y-2">
          {offers.map(o => (
            <li key={o.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-foreground">{o.name}</span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{`Buy ${o.min_quantity} get ${valueLabel(o)}`}</span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tierLabel(o)}</span>
                  {!o.is_active && <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => toggleActive(o)} className="rounded-md bg-muted px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/70">
                  {o.is_active ? "Pause" : "Resume"}
                </button>
                <button type="button" onClick={() => setDeleteTarget(o)} className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this offer?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Bookings that already used <span className="font-medium text-foreground">{deleteTarget.name}</span>{" "}
                  keep their discount.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteTarget) removeOffer(deleteTarget.id) }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function WaitlistTab({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [err, setErr] = useState("")
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await adminEventManage.waitlist(eventId)
        if (!cancelled) setRows(r.data?.data?.waitlist ?? [])
      } catch {
        if (!cancelled) setErr("Network error.")
      }
    })()
    return () => { cancelled = true }
  }, [eventId])

  if (err) return <ErrorBanner message={err} />
  if (!rows) return <CardSkeleton />
  if (rows.length === 0) return <EmptyHint icon={Bell} text="No one on the waitlist yet." />

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        These people will be notified when seats open up. (Auto-notification cron is coming — for now, you can reach out manually.)
      </p>
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm dark:ring-1 dark:ring-white/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Wants</TableHead>
              <TableHead className="text-right">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{w.name || "—"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{w.email}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {w.requested_quantity} ticket{w.requested_quantity === 1 ? "" : "s"}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {new Date(w.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CommsTab({ eventId }: { eventId: string }) {
  type Channel = "email" | "sms" | "both"
  const [message, setMessage] = useState("")
  const [channel, setChannel] = useState<Channel>("email")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ text: string; tone: "ok" | "err" } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // SMS messages charge per ~160-char segment (Unicode = 70). Show the
  // admin a rough projected segment count so they're not surprised by a
  // long body burning through SMS credit.
  const smsSegments = Math.max(1, Math.ceil((message.length + 30) / 160))
  const channelLabel = channel === "both" ? "email and SMS" : channel === "sms" ? "SMS" : "email"

  const requestSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      setResult({ text: "Message is required.", tone: "err" })
      return
    }
    setConfirmOpen(true)
  }

  const send = async () => {
    setConfirmOpen(false)
    setSending(true)
    setResult(null)
    try {
      const r = await adminEventManage.announce(eventId, { message: message.trim(), channel })
      setResult({ text: r.data?.message || "Sent.", tone: "ok" })
      setMessage("")
    } catch (e: any) {
      setResult({ text: e?.response?.data?.message || "Failed.", tone: "err" })
    } finally {
      setSending(false)
    }
  }

  const channelOptions: Array<{ value: Channel; label: string; hint: string }> = [
    { value: "email", label: "Email",       hint: "Best for long messages and attachments." },
    { value: "sms",   label: "SMS",         hint: "Time-sensitive alerts. Charged per segment." },
    { value: "both",  label: "Email + SMS", hint: "Belt-and-braces for last-minute changes." },
  ]
  const currentHint = channelOptions.find((c) => c.value === channel)?.hint

  return (
    <div className="space-y-4">
      <EventCommunicationsCard eventId={eventId} />
      <EventCommBillingCard eventId={eventId} />

      <form onSubmit={requestSend} className="space-y-4 rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Send announcement to attendees</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Goes to every confirmed attendee — parking info, schedule updates, weather notes, or any other heads-up. Deduplicated.
          </p>
        </div>

        {/* Channel selector — segmented control */}
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Channel</div>
          <div className="inline-flex rounded-lg bg-muted p-1">
            {channelOptions.map((opt) => {
              const active = channel === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {currentHint && <p className="mt-1 text-[11px] text-muted-foreground">{currentHint}</p>}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message…"
          rows={6}
          maxLength={5000}
          required
          className="w-full rounded-md bg-muted px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {message.length}/5000
            {(channel === "sms" || channel === "both") && (
              <span className="ml-2">· ~{smsSegments} SMS segment{smsSegments === 1 ? "" : "s"}</span>
            )}
          </span>
          <button type="submit" disabled={sending} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
            {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending…" : "Send to all attendees"}
          </button>
        </div>
        {result && (
          <p className={`text-xs ${result.tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {result.text}
          </p>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this announcement?</AlertDialogTitle>
              <AlertDialogDescription>
                This goes out to every confirmed attendee via <span className="font-medium text-foreground">{channelLabel}</span>. This can&rsquo;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); send() }}>
                {sending ? <Loader className="h-4 w-4 animate-spin" /> : "Send"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    </div>
  )
}

// ===========================================================================
// Invite — issue comp tickets to specific emails. Mirrors organizer InviteTab.
// ===========================================================================

interface Invitation {
  id: string
  email: string
  status: "sent" | "failed" | string
  error_message: string | null
  created_at: string
  booking_id: string | null
  booking_short_code: string | null
  booking_reference?: string | null
  ticket_type?: { id: string; name: string; price: number } | null
  quantity?: number | null
  unit_price?: number | null
  face_value?: number | null
}

function InviteTab({ eventId, tickets }: { eventId: string; tickets: any[] }) {
  const [email, setEmail] = useState("")
  const [ticketTypeId, setTicketTypeId] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(1)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ text: string; tone: "ok" | "err" } | null>(null)

  const [list, setList] = useState<Invitation[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const emailInputRef = useRef<HTMLInputElement | null>(null)

  const tierOptions = useMemo(() => {
    return (tickets || [])
      .filter((t: any) => t.is_active !== false)
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        price: Number(t.price ?? 0),
        remaining: Math.max(0, Number(t.quantity_total ?? 0) - Number(t.quantity_sold ?? 0)),
      }))
      .filter((t) => t.remaining > 0)
  }, [tickets])

  const selectedTier = useMemo(
    () => tierOptions.find((t) => t.id === ticketTypeId) ?? null,
    [tierOptions, ticketTypeId],
  )
  const maxQty = selectedTier?.remaining ?? 1

  useEffect(() => {
    setTicketTypeId((prev) => {
      if (tierOptions.length === 0) return ""
      if (prev && tierOptions.some((t) => t.id === prev)) return prev
      return tierOptions[0].id
    })
  }, [tierOptions])

  useEffect(() => {
    setQuantity((prev) => Math.max(1, Math.min(prev, maxQty)))
  }, [maxQty])

  const loadList = useCallback(async () => {
    try {
      setListError(null)
      setListLoading(true)
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/invitations`, {
        credentials: "include",
      })
      const body = await res.json()
      if (body?.success) {
        setList((body.data?.invitations ?? []) as Invitation[])
      } else {
        setListError(body?.message || "Couldn't load invitations.")
      }
    } catch {
      setListError("Network error loading invitations.")
    } finally {
      setListLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    loadList()
  }, [loadList])

  const handleResend = useCallback((rowEmail: string) => {
    setEmail(rowEmail)
    setResult(null)
    requestAnimationFrame(() => {
      const el = emailInputRef.current
      if (!el) return
      el.focus()
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [])

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSend = emailOk && !!ticketTypeId && quantity >= 1 && quantity <= maxQty

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend) {
      setResult({
        text: !emailOk
          ? "Enter a valid email address."
          : !ticketTypeId
            ? "Pick a ticket tier."
            : "Pick a valid quantity.",
        tone: "err",
      })
      return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`${API_URL}/api/organizer/events/${eventId}/invitations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          ticket_type_id: ticketTypeId,
          quantity,
        }),
      })
      const body = await res.json()
      setResult({
        text: body?.message || (body?.success ? "Sent." : "Failed."),
        tone: body?.success ? "ok" : "err",
      })
      if (body?.success) {
        setEmail("")
        setQuantity(1)
        await loadList()
      }
    } catch {
      setResult({ text: "Network error sending invitation.", tone: "err" })
    } finally {
      setSending(false)
    }
  }

  const noTiersAvailable = tierOptions.length === 0
  const inp = "rounded-md bg-muted px-2.5 py-2 text-sm w-full text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"

  return (
    <div className="space-y-6">
      <form
        onSubmit={send}
        className="space-y-4 rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10"
      >
        <header className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Send className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Invite someone — they get a free ticket</h2>
            <p className="text-xs text-muted-foreground">
              Pick the tier, choose how many tickets, and we&apos;ll email a
              QR-coded comp ticket to your invitee. Comps come out of the
              same stock as paid tickets, so they count toward capacity.
            </p>
          </div>
        </header>

        {noTiersAvailable && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>No active ticket tier with stock — add or activate a tier (with available capacity) before sending invitations.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="space-y-1.5 sm:col-span-6">
            <label htmlFor="invite-email" className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Invitee email
            </label>
            <input
              id="invite-email"
              ref={emailInputRef}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inp}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-4">
            <label htmlFor="invite-tier" className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ticket tier
            </label>
            <select
              id="invite-tier"
              value={ticketTypeId}
              onChange={(e) => setTicketTypeId(e.target.value)}
              disabled={noTiersAvailable}
              className={`${inp} disabled:opacity-60`}
            >
              {tierOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.price === 0 ? "Free" : `LKR ${t.price.toLocaleString()}`} · {t.remaining} left
                </option>
              ))}
              {noTiersAvailable && <option value="">No tiers available</option>}
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tickets
            </label>
            <div className="flex h-9 items-center rounded-md bg-muted">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || noTiersAvailable}
                aria-label="Decrease quantity"
                className="flex h-full w-9 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="flex-1 text-center text-sm font-semibold tabular-nums text-foreground">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty || noTiersAvailable}
                aria-label="Increase quantity"
                className="flex h-full w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-4">
          {result && (
            <span
              className={`inline-flex items-center gap-1.5 text-sm ${
                result.tone === "ok"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {result.tone === "ok" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {result.text}
            </span>
          )}
          <button
            type="submit"
            disabled={sending || !canSend}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium transition hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : `Send invitation${quantity === 1 ? "" : ` (${quantity} tickets)`}`}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl bg-card shadow-sm dark:ring-1 dark:ring-white/10">
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Invitations sent</h2>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {list.length}
          </span>
        </header>

        {listLoading ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">Loading…</div>
        ) : listError ? (
          <div className="px-5 py-6 text-sm text-destructive">{listError}</div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Send className="h-4 w-4" />
            </span>
            <p className="text-sm text-muted-foreground">
              No invitations sent yet. Fill in the form above to get started.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {list.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    inv.status === "sent"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-destructive/15 text-destructive"
                  }`}
                  aria-hidden
                  title={inv.status === "sent" ? "Delivered to gateway" : inv.error_message || "Failed"}
                >
                  {inv.status === "sent" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-foreground">{inv.email}</div>
                  {inv.status === "sent" && (
                    <>
                      {(inv.ticket_type || inv.quantity) && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {inv.ticket_type?.name && (
                            <span className="font-medium text-foreground">{inv.ticket_type.name}</span>
                          )}
                          {inv.quantity != null && inv.quantity > 0 && (
                            <span>· {inv.quantity} ticket{inv.quantity === 1 ? "" : "s"}</span>
                          )}
                          {inv.face_value != null && inv.face_value > 0 && (
                            <span>· {lkr(inv.face_value)} value (comp)</span>
                          )}
                        </div>
                      )}
                      {inv.booking_short_code && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          Ticket code <span className="font-mono text-foreground">{inv.booking_short_code}</span>
                        </div>
                      )}
                    </>
                  )}
                  {inv.status !== "sent" && inv.error_message && (
                    <div className="truncate text-xs text-destructive">{inv.error_message}</div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(inv.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => handleResend(inv.email)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Resend
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// Postpone modal (admin override). Two modes: keep selling (still buyable,
// shown as postponed) or stop sales (not buyable). New date optional — omit it
// to postpone with the date "to be announced". Tickets stay valid either way.
function PostponeModal({
  eventId,
  onClose,
  onDone,
}: {
  eventId: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [start, setStart] = useState("")
  const [reason, setReason] = useState("")
  const [notify, setNotify] = useState(true)
  const [closeSales, setCloseSales] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const submit = async () => {
    setBusy(true)
    setErr("")
    try {
      const r = await adminEventManage.postpone(eventId, {
        new_start_time: start || undefined,
        reason: reason.trim() || undefined,
        notify,
        close_sales: closeSales,
      })
      onDone(r.data?.message || "Event postponed.")
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to postpone.")
    } finally {
      setBusy(false)
    }
  }

  const modeBtn = (active: boolean) =>
    `rounded-lg p-3 text-left transition-colors ${
      active ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/40 hover:bg-muted"
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg dark:ring-1 dark:ring-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Postpone event</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Mark this event as postponed. Existing tickets stay valid.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {err && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">While postponed</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setCloseSales(false)} className={modeBtn(!closeSales)}>
                <span className="block text-sm font-semibold text-foreground">Keep selling tickets</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Buyers can still book for the new date.</span>
              </button>
              <button type="button" onClick={() => setCloseSales(true)} className={modeBtn(closeSales)}>
                <span className="block text-sm font-semibold text-foreground">Stop ticket sales</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Tickets can&rsquo;t be bought for now.</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="pp-start" className="mb-1.5 block text-sm font-medium text-foreground">New date <span className="text-muted-foreground">(optional)</span></label>
            <input id="pp-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-md bg-muted px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <p className="mt-1 text-xs text-muted-foreground">Leave empty to postpone with the new date announced later.</p>
          </div>

          <div>
            <label htmlFor="pp-reason" className="mb-1.5 block text-sm font-medium text-foreground">Reason <span className="text-muted-foreground">(optional)</span></label>
            <p className="mb-1.5 text-xs text-muted-foreground">
              This message is included in the email and SMS sent to confirmed attendees, so please word it formally and clearly.
            </p>
            <textarea id="pp-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Due to adverse weather, the event has been rescheduled for everyone's safety." className="w-full rounded-md bg-muted px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Notify confirmed attendees by email &amp; SMS
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium transition hover:bg-primary/90 disabled:opacity-50">
            {busy ? <Loader className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
            {busy ? "Postponing…" : "Postpone event"}
          </button>
        </div>
      </div>
    </div>
  )
}
