"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
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
  AlertTriangle,
  Calendar,
  Eye,
  EyeOff,
  Search,
  MapPin,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ListChecks,
  Loader2,
  Trash2,
  Pin,
  PinOff,
} from "lucide-react"

interface Event {
  id: string
  title: string
  description: string
  date: string
  location: string
  price: number
  tickets_available: number
  tickets_sold?: number
  status: "upcoming" | "ongoing" | "completed" | "cancelled"
  approval_status: "pending" | "approved" | "rejected"
  organizer?: {
    id: string
    name: string
    email: string
  }
  banner_url?: string | null
  category?: string
  pinned?: boolean
  delisted?: boolean
  created_at: string
}

export default function EventsPage() {
  const { user: currentUser } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [canForce, setCanForce] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getEvents()
      setEvents(response.data?.data?.events || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load events")
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await adminAPI.approveEvent(id)
      toast.success("Event approved")
      fetchEvents()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve event")
    }
  }

  const handleTogglePin = async (event: Event) => {
    const next = !event.pinned
    // Optimistic update so the button flips instantly.
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, pinned: next } : e)))
    try {
      await adminAPI.setEventPinned(event.id, next)
      toast.success(next ? "Event pinned to top" : "Event unpinned")
    } catch (err: any) {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, pinned: !next } : e)))
      toast.error(err.response?.data?.message || "Failed to update pin")
    }
  }

  const handleToggleDelist = async (event: Event) => {
    const next = !event.delisted
    // Optimistic update so the button flips instantly.
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, delisted: next } : e)))
    try {
      await adminAPI.setEventDelisted(event.id, next)
      toast.success(next ? "Event hidden from public listings" : "Event visible in listings again")
    } catch (err: any) {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, delisted: !next } : e)))
      toast.error(err.response?.data?.message || "Failed to update visibility")
    }
  }

  const [rejectTarget, setRejectTarget] = useState<Event | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejecting, setRejecting] = useState(false)

  const openReject = (event: Event) => {
    setRejectReason("")
    setRejectTarget(event)
  }

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    setRejecting(true)
    try {
      await adminAPI.rejectEvent(rejectTarget.id, rejectReason.trim())
      toast.success("Event rejected")
      setRejectTarget(null)
      fetchEvents()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject event")
    } finally {
      setRejecting(false)
    }
  }

  const openDelete = (event: Event) => {
    setDeleteError(null)
    setCanForce(false)
    setDeleteTarget(event)
  }

  const closeDelete = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
    setCanForce(false)
  }

  const confirmDelete = async (force: boolean) => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await adminAPI.deleteEvent(deleteTarget.id, { force })
      toast.success(force ? "Event force-deleted" : "Event deleted")
      setDeleteTarget(null)
      setCanForce(false)
      fetchEvents()
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to delete event"
      const allowForce = !!err.response?.data?.data?.can_force
      setDeleteError(msg)
      setCanForce(allowForce)
    } finally {
      setDeleting(false)
    }
  }

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (event.organizer?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || event.approval_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: events.length,
    approved: events.filter(e => e.approval_status === "approved").length,
    pending: events.filter(e => e.approval_status === "pending").length,
    upcoming: events.filter(e => new Date(e.date) > new Date() && e.status === "upcoming").length,
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}>
          <PageLoader />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "event-manager", "content-manager"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Events
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Review submitted events. Organizers create events from their own dashboard.
                </p>
              </div>
            </div>
            <Link
              href="/events/review"
              className="inline-flex shrink-0 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <ListChecks className="mr-2 h-4 w-4" />
              Approval queue
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Events" value={stats.total} />
            <StatCard title="Approved" value={stats.approved} />
            <StatCard title="Pending" value={stats.pending} />
            <StatCard title="Upcoming" value={stats.upcoming} />
          </div>

          {/* Filters */}
          <div className="rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg bg-muted py-2 pl-10 pr-4 text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                title="Filter by approval status"
                aria-label="Filter by approval status"
                className="rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {error && <ErrorMessage type="error" title="Error" message={error} />}

          {!error && filteredEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No events found"
              description={searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters."
                : "When organizers submit events for review they'll appear here."}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => {
                const sold = event.tickets_sold ?? 0
                const cap = event.tickets_available ?? 0
                return (
                  <div key={event.id} className={`overflow-hidden rounded-2xl bg-card shadow-sm transition-shadow hover:shadow-md dark:ring-1 ${event.pinned ? 'ring-2 ring-amber-500/60 dark:ring-amber-500/60' : 'dark:ring-white/10'}`}>
                    <div className="relative h-48 bg-primary/10 flex items-center justify-center overflow-hidden">
                      {event.pinned && (
                        <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          <Pin className="h-3 w-3" /> Pinned
                        </span>
                      )}
                      {event.delisted && (
                        <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          <EyeOff className="h-3 w-3" /> Hidden
                        </span>
                      )}
                      {event.banner_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.banner_url}
                          alt={event.title}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <Calendar className="h-16 w-16 text-primary/40" />
                      )}
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                            {event.title}
                          </h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap capitalize ${
                            event.approval_status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            event.approval_status === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            {event.approval_status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          by {event.organizer?.name || 'Unknown organizer'}
                        </p>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {new Date(event.date).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          LKR {Number(event.price ?? 0).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {sold} / {cap} tickets sold
                        </div>
                      </div>

                      {event.approval_status === 'pending' && (
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(event.id)}
                            className="flex-1 px-3 py-2 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-500/20 transition flex items-center justify-center gap-1"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => openReject(event)}
                            className="flex-1 px-3 py-2 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition flex items-center justify-center gap-1"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      )}

                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(event)}
                          className={`w-full px-3 py-2 text-sm rounded-md transition flex items-center justify-center gap-1.5 font-medium ${
                            event.pinned
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                          title={event.pinned ? 'Unpin from top of events' : 'Pin to top of events'}
                        >
                          {event.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                          {event.pinned ? 'Pinned — click to unpin' : 'Pin to top'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDelist(event)}
                          className={`w-full px-3 py-2 text-sm rounded-md transition flex items-center justify-center gap-1.5 font-medium ${
                            event.delisted
                              ? 'bg-slate-500/15 text-slate-600 dark:text-slate-300 hover:bg-slate-500/25'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                          title={event.delisted ? 'Hidden from public listings — click to show' : 'Hide from public listings (direct link still works)'}
                        >
                          {event.delisted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          {event.delisted ? 'Hidden — click to show' : 'Hide from web'}
                        </button>
                        <Link
                          href={`/events/${event.id}`}
                          className="w-full px-3 py-2 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition flex items-center justify-center gap-1.5 font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          Review details
                        </Link>
                        <button
                          type="button"
                          onClick={() => openDelete(event)}
                          className="w-full px-3 py-2 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete event
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Reject confirmation dialog */}
        <AlertDialog open={rejectTarget !== null} onOpenChange={(open) => { if (!open) setRejectTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject this event?</AlertDialogTitle>
              <AlertDialogDescription>
                {rejectTarget && (
                  <>
                    Give a reason for rejecting{" "}
                    <span className="font-medium text-foreground">&ldquo;{rejectTarget.title}&rdquo;</span>.
                    This will be visible to the organizer.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="mt-3 w-full resize-none rounded-lg bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRejectTarget(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={rejecting || !rejectReason.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => { e.preventDefault(); confirmReject() }}
              >
                {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject event"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) closeDelete() }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && (
                  <>
                    You&rsquo;re about to delete{" "}
                    <span className="font-semibold text-foreground">&ldquo;{deleteTarget.title}&rdquo;</span>
                    {deleteTarget.organizer?.name && (
                      <> by <span className="font-medium text-foreground">{deleteTarget.organizer.name}</span></>
                    )}
                    . Ticket types and pending bookings will be removed too. This can&rsquo;t be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {deleteError && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting} onClick={closeDelete}>Cancel</AlertDialogCancel>
              {canForce ? (
                <AlertDialogAction
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => { e.preventDefault(); confirmDelete(true) }}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Force delete</span>}
                </AlertDialogAction>
              ) : (
                <AlertDialogAction
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => { e.preventDefault(); confirmDelete(false) }}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="inline-flex items-center gap-1.5"><Trash2 className="h-4 w-4" /> Delete event</span>}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  )
}
