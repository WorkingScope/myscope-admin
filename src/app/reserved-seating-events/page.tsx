"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { PageLoader } from "@/components/ui/loading"
import { EmptyState } from "@/components/ui/error-message"
import { useAuth } from "@/contexts/auth-context"
import {
  reservedEventsAPI,
  venueTemplatesAPI,
  type ReservedEvent,
  type ReservedEventTicketType,
  type VenueTemplateSummary,
  type VenueTemplateDetail,
  type VenueLayoutData,
} from "@/lib/apiEndpoints"
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
  Armchair,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Loader,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react"

const BUILDER_COLORS = ["#7F77DD", "#1D9E75", "#BA7517", "#D85A30", "#185FA5", "#993556"]

// Spreadsheet-style row labels: 0 -> A, 25 -> Z, 26 -> AA … (real auditoriums
// routinely need AA/AB rows for balconies).
function rowLabelFromIndex(n: number): string {
  let s = ""
  let i = n + 1
  while (i > 0) {
    const r = (i - 1) % 26
    s = String.fromCharCode(65 + r) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}
function rowIndexFromLabel(label: string): number {
  let n = 0
  for (const ch of label.toUpperCase()) {
    if (ch < "A" || ch > "Z") return -1
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

type Tab = "awaiting" | "pending" | "live" | "all"
const TABS: { value: Tab; label: string }[] = [
  { value: "awaiting", label: "Awaiting layout" },
  { value: "pending", label: "Pending approval" },
  { value: "live", label: "Live" },
  { value: "all", label: "All" },
]

const matchesTab = (e: ReservedEvent, tab: Tab): boolean => {
  switch (tab) {
    case "awaiting":
      return e.seats_count === 0
    case "pending":
      return e.seats_count > 0 && e.approval_status === "pending"
    case "live":
      return e.approval_status === "approved"
    default:
      return true
  }
}

export default function ReservedSeatingEventsPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<ReservedEvent[]>([])
  const [templates, setTemplates] = useState<VenueTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("awaiting")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [building, setBuilding] = useState<ReservedEvent | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ReservedEvent | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const load = async () => {
    try {
      setLoading(true)
      const [evRes, tplRes] = await Promise.all([
        reservedEventsAPI.list(),
        venueTemplatesAPI.list().catch(() => null),
      ])
      setEvents(evRes.data?.data?.events || [])
      setTemplates(tplRes?.data?.data?.templates || [])
    } catch {
      toast.error("Failed to load reserved events")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { awaiting: 0, pending: 0, live: 0, all: events.length }
    for (const e of events) {
      if (matchesTab(e, "awaiting")) c.awaiting++
      if (matchesTab(e, "pending")) c.pending++
      if (matchesTab(e, "live")) c.live++
    }
    return c
  }, [events])

  const visible = useMemo(() => events.filter((e) => matchesTab(e, tab)), [events, tab])

  const approve = async (e: ReservedEvent) => {
    setBusyId(e.id)
    try {
      await reservedEventsAPI.approve(e.id)
      toast.success("Event approved — now live")
      await load()
    } catch (err) {
      const ex = err as { response?: { data?: { message?: string } } }
      toast.error(ex.response?.data?.message || "Approve failed")
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (e: ReservedEvent) => {
    setRejectReason("")
    setRejectTarget(e)
  }

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    setBusyId(rejectTarget.id)
    try {
      await reservedEventsAPI.reject(rejectTarget.id, rejectReason.trim())
      toast.success("Event rejected")
      setRejectTarget(null)
      await load()
    } catch (err) {
      const ex = err as { response?: { data?: { message?: string } } }
      toast.error(ex.response?.data?.message || "Reject failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Armchair className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Reserved Seating Events</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                Reserved events arrive here for their seat map. Organizers either build a square/grid
                themselves or upload their venue layout for you to build. Build the seat map from the
                uploaded documents, then approve the event for live.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="rounded-2xl bg-card p-3 shadow-sm dark:ring-1 dark:ring-white/10">
            <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {TABS.map((t) => (
                <TabButton
                  key={t.value}
                  active={tab === t.value}
                  onClick={() => setTab(t.value)}
                  label={t.label}
                  count={counts[t.value]}
                />
              ))}
            </div>
          </div>

          {loading ? (
            <PageLoader />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Armchair}
              title="Nothing here"
              description={
                tab === "awaiting"
                  ? "No reserved events are waiting for a seat map. Custom-layout uploads and any incomplete grids show up here."
                  : "No reserved events match this filter yet."
              }
            />
          ) : (
            <ul className="space-y-3">
              {visible.map((e) => (
                <ReservedEventCard
                  key={e.id}
                  event={e}
                  busy={busyId === e.id}
                  onBuild={() => setBuilding(e)}
                  onApprove={() => approve(e)}
                  onReject={() => openReject(e)}
                />
              ))}
            </ul>
          )}

          {building && (
            <BuildModal
              event={building}
              templates={templates}
              onClose={() => setBuilding(null)}
              onDone={() => {
                setBuilding(null)
                load()
              }}
            />
          )}
        </div>

        {/* Reject confirmation dialog */}
        <AlertDialog open={rejectTarget !== null} onOpenChange={(open) => { if (!open) setRejectTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject this event?</AlertDialogTitle>
              <AlertDialogDescription>
                {rejectTarget && (
                  <>Give a reason for rejecting <span className="font-medium text-foreground">&ldquo;{rejectTarget.title}&rdquo;</span>. This will be visible to the organizer.</>
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
                disabled={busyId === rejectTarget?.id || !rejectReason.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => { e.preventDefault(); confirmReject() }}
              >
                {busyId === rejectTarget?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject event"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}

// ---------------------------------------------------------------------------
// Event card
// ---------------------------------------------------------------------------
function ReservedEventCard({
  event,
  busy,
  onBuild,
  onApprove,
  onReject,
}: {
  event: ReservedEvent
  busy: boolean
  onBuild: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const when = event.start_time || event.date
  const hasSeats = event.seats_count > 0
  const isCustom = event.layout_source === "custom"
  const docs = event.layout_documents || []

  return (
    <li className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10 lg:flex-row">
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{event.title}</span>
          <SourceBadge source={event.layout_source} />
          <StatusBadge event={event} />
        </div>
        <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
          {event.venue_name && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {event.venue_name}
            </div>
          )}
          {when && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {new Date(when).toLocaleString()}
            </div>
          )}
          {event.organizer && (
            <div className="truncate">
              By {event.organizer.name} · {event.organizer.email}
            </div>
          )}
          <div className="font-medium text-muted-foreground">
            {hasSeats ? `${event.seats_count.toLocaleString()} seats generated` : "No seat map yet"}
          </div>
        </div>

        {event.layout_request_note && (
          <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs italic text-muted-foreground">
            “{event.layout_request_note}”
          </p>
        )}

        {/* Uploaded documents (custom requests) */}
        {docs.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Organizer documents
            </div>
            <ul className="flex flex-wrap gap-2">
              {docs.map((doc) => (
                <li key={doc.url}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted/70"
                  >
                    {doc.type === "application/pdf" ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    <span className="max-w-[160px] truncate">{doc.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {isCustom && docs.length === 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            No documents uploaded — check the organizer&rsquo;s note or contact them.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-stretch gap-2 lg:w-48">
        <a
          href={`/reserved-seating-events/${event.id}/builder`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          title="Open the canvas editor — drag seats to fit any venue shape"
        >
          <LayoutGrid className="h-4 w-4" />
          Visual builder
        </a>
        <button
          type="button"
          onClick={onBuild}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
          title="Quick grid builder — fastest path for rectangular sections"
        >
          <Armchair className="h-4 w-4" />
          {hasSeats ? "Rebuild grid" : "Quick grid"}
        </button>

        {event.approval_status === "pending" && (
          <>
            <button
              type="button"
              onClick={onApprove}
              disabled={busy || !hasSeats}
              title={!hasSeats ? "Build a seat map first" : undefined}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve for live
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function SourceBadge({ source }: { source: ReservedEvent["layout_source"] }) {
  if (source === "custom") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
        <FileText className="h-3 w-3" /> Custom upload
      </span>
    )
  }
  if (source === "grid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        <LayoutGrid className="h-3 w-3" /> Grid
      </span>
    )
  }
  return null
}

function StatusBadge({ event }: { event: ReservedEvent }) {
  if (event.approval_status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Live
      </span>
    )
  }
  if (event.seats_count === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        <Clock className="h-3 w-3" /> Needs layout
      </span>
    )
  }
  if (event.approval_status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        Ready · pending approval
      </span>
    )
  }
  if (event.approval_status === "rejected") {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
        Rejected
      </span>
    )
  }
  return null
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-card text-primary shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Build modal — build a grid OR pick a template, map each section to one of the
// event's ticket types, then apply. Applying generates event_seats and clears
// the pending-layout flag so the event can be approved.
// ---------------------------------------------------------------------------
interface BuilderSection {
  name: string
  color: string
  rows: string
  seatsPerRow: string
  rowStart: string
}
const emptyBuilderSection = (idx: number): BuilderSection => ({
  name: idx === 0 ? "Main Hall" : `Section ${idx + 1}`,
  color: BUILDER_COLORS[idx % BUILDER_COLORS.length],
  rows: "8",
  seatsPerRow: "20",
  rowStart: "A",
})

type BuildMode = "grid" | "template"

function BuildModal({
  event,
  templates,
  onClose,
  onDone,
}: {
  event: ReservedEvent
  templates: VenueTemplateSummary[]
  onClose: () => void
  onDone: () => void
}) {
  const [mode, setMode] = useState<BuildMode>("grid")
  const [ticketTypes, setTicketTypes] = useState<ReservedEventTicketType[]>([])
  const [loadingTT, setLoadingTT] = useState(true)
  const [applying, setApplying] = useState(false)

  // Grid builder state
  const [sections, setSections] = useState<BuilderSection[]>([emptyBuilderSection(0)])
  // Template state
  const [templateId, setTemplateId] = useState("")
  const [templateDetail, setTemplateDetail] = useState<VenueTemplateDetail | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  // section name -> ticket_type id (shared by both modes)
  const [sectionMap, setSectionMap] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await reservedEventsAPI.ticketTypes(event.id)
        if (!cancelled) setTicketTypes(res.data?.data?.ticket_types || [])
      } catch {
        if (!cancelled) toast.error("Couldn't load the event's ticket types")
      } finally {
        if (!cancelled) setLoadingTT(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [event.id])

  const updSection = (i: number, patch: Partial<BuilderSection>) =>
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const totalSeats = sections.reduce(
    (acc, s) => acc + (parseInt(s.rows, 10) || 0) * (parseInt(s.seatsPerRow, 10) || 0),
    0,
  )

  // Sections currently in play (grid section names, or the chosen template's).
  const activeSections: { name: string; color?: string }[] =
    mode === "grid"
      ? sections.map((s) => ({ name: s.name.trim() || "Section", color: s.color }))
      : (templateDetail?.layout_data?.sections || []).map((s) => ({ name: s.name, color: s.color }))

  const allMapped = activeSections.length > 0 && activeSections.every((s) => sectionMap[s.name])

  const pickTemplate = async (id: string) => {
    setTemplateId(id)
    setTemplateDetail(null)
    setSectionMap({})
    if (!id) return
    setLoadingTemplate(true)
    try {
      const res = await venueTemplatesAPI.get(id)
      setTemplateDetail(res.data?.data?.layout as VenueTemplateDetail)
    } catch {
      toast.error("Couldn't load that template")
    } finally {
      setLoadingTemplate(false)
    }
  }

  const buildGridLayout = (): VenueLayoutData | { error: string } => {
    const out: VenueLayoutData = { sections: [] }
    const used = new Set<string>()
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i]
      const nm = s.name.trim()
      if (!nm) return { error: `Section #${i + 1}: name is required.` }
      if (used.has(nm)) return { error: `Duplicate section name "${nm}".` }
      used.add(nm)
      const rowCount = parseInt(s.rows, 10)
      const seatsPerRow = parseInt(s.seatsPerRow, 10)
      if (!Number.isInteger(rowCount) || rowCount <= 0) return { error: `Section "${nm}": rows must be a positive integer.` }
      if (!Number.isInteger(seatsPerRow) || seatsPerRow <= 0) return { error: `Section "${nm}": seats per row must be a positive integer.` }
      const startIdx = rowIndexFromLabel((s.rowStart || "A").trim())
      if (startIdx < 0) return { error: `Section "${nm}": start row must be letters A–Z (e.g. A or AA).` }
      out.sections.push({
        id: `s${i + 1}`,
        name: nm,
        color: s.color,
        rows: Array.from({ length: rowCount }, (_, r) => ({
          label: rowLabelFromIndex(startIdx + r),
          seats: Array.from({ length: seatsPerRow }, (_, j) => ({ number: String(j + 1), type: "standard" })),
        })),
      })
    }
    return out
  }

  const apply = async () => {
    if (ticketTypes.length === 0) {
      toast.error("This event has no ticket types — it can't be priced.")
      return
    }
    if (!allMapped) {
      toast.error("Assign a ticket type to every section.")
      return
    }
    setApplying(true)
    try {
      if (mode === "grid") {
        const built = buildGridLayout()
        if ("error" in built) {
          toast.error(built.error)
          setApplying(false)
          return
        }
        await reservedEventsAPI.buildGrid(event.id, { layout_data: built, section_ticket_map: sectionMap })
      } else {
        if (!templateId || !templateDetail) {
          toast.error("Pick a template first.")
          setApplying(false)
          return
        }
        await reservedEventsAPI.applyTemplate(templateId, { event_id: event.id, section_ticket_map: sectionMap })
      }
      toast.success("Seat map applied — event is ready for approval")
      onDone()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Apply failed")
    } finally {
      setApplying(false)
    }
  }

  const docs = event.layout_documents || []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !applying && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-card shadow-lg dark:ring-1 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/60 p-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">Build the seat map</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {event.title}
              {event.venue_name ? ` · ${event.venue_name}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Organizer-supplied documents + note */}
          {(docs.length > 0 || event.layout_request_note) && (
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Organizer&rsquo;s layout
              </div>
              {docs.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {docs.map((doc) => (
                    <li key={doc.url}>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-muted"
                      >
                        {doc.type === "application/pdf" ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                        <span className="max-w-[180px] truncate">{doc.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {event.layout_request_note && (
                <p className="text-xs italic text-muted-foreground">“{event.layout_request_note}”</p>
              )}
            </div>
          )}

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {([["grid", "Build a grid", LayoutGrid], ["template", "Use a template", Armchair]] as const).map(
              ([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setSectionMap({}) }}
                  className={`flex items-center justify-center gap-2 rounded-lg p-3 text-sm font-semibold transition-colors ${
                    mode === m
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ),
            )}
          </div>

          {/* GRID builder */}
          {mode === "grid" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sections</h3>
                <span className="text-xs font-medium text-muted-foreground">{totalSeats.toLocaleString()} seats total</span>
              </div>
              {sections.map((s, i) => (
                <div key={i} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={s.color}
                      onChange={(e) => updSection(i, { color: e.target.value })}
                      aria-label="Section colour"
                      className="h-8 w-8 shrink-0 cursor-pointer rounded bg-transparent"
                    />
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => updSection(i, { name: e.target.value })}
                      placeholder="Section name"
                      className="flex-1 rounded-md bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSections((prev) => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove section"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <FieldSmall label="Rows">
                      <input
                        type="number"
                        min={1}
                        value={s.rows}
                        onChange={(e) => updSection(i, { rows: e.target.value })}
                        className="w-full rounded-md bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </FieldSmall>
                    <FieldSmall label="Seats / row">
                      <input
                        type="number"
                        min={1}
                        value={s.seatsPerRow}
                        onChange={(e) => updSection(i, { seatsPerRow: e.target.value })}
                        className="w-full rounded-md bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </FieldSmall>
                    <FieldSmall label="Start row">
                      <input
                        type="text"
                        value={s.rowStart}
                        onChange={(e) => updSection(i, { rowStart: e.target.value.toUpperCase() })}
                        maxLength={3}
                        placeholder="A"
                        className="w-full rounded-md bg-card px-3 py-2 text-sm uppercase text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </FieldSmall>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSections((prev) => [...prev, emptyBuilderSection(prev.length)])}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Add section
              </button>
            </div>
          )}

          {/* TEMPLATE picker */}
          {mode === "template" && (
            <FieldSmall label="Venue template">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No templates yet — create one in Venue Templates, or switch to Build a grid.
                </p>
              ) : (
                <select
                  aria-label="Venue template"
                  value={templateId}
                  onChange={(e) => pickTemplate(e.target.value)}
                  className="w-full rounded-md bg-muted px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Pick a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.total_seats} seats)
                    </option>
                  ))}
                </select>
              )}
            </FieldSmall>
          )}

          {/* Section -> ticket type mapping */}
          {loadingTemplate ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader className="h-5 w-5 animate-spin" />
            </div>
          ) : activeSections.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Assign pricing to each section
              </div>
              {loadingTT ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader className="h-4 w-4 animate-spin" /> Loading ticket types…
                </div>
              ) : ticketTypes.length === 0 ? (
                <p className="text-sm text-destructive">This event has no ticket types — it can&rsquo;t be priced.</p>
              ) : (
                <div className="space-y-2.5">
                  {activeSections.map((section) => (
                    <div key={section.name} className="flex flex-wrap items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded"
                        style={{ background: section.color || "#9ca3af" }}
                        aria-hidden
                      />
                      <span className="w-32 shrink-0 truncate text-sm font-medium text-foreground">
                        {section.name}
                      </span>
                      <select
                        aria-label={`Ticket type for section ${section.name}`}
                        value={sectionMap[section.name] || ""}
                        onChange={(e) => setSectionMap((prev) => ({ ...prev, [section.name]: e.target.value }))}
                        className="h-9 min-w-[200px] flex-1 rounded-md bg-muted px-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="">Pick a ticket type…</option>
                        {ticketTypes.map((tt) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name} — LKR {Number(tt.price).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border/60 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={applying || !allMapped || ticketTypes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applying ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {applying ? "Applying…" : "Apply seat map"}
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldSmall({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
