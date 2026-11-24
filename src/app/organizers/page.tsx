"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/contexts/auth-context"
import { PageLoader } from "@/components/ui/loading"
import { ErrorMessage, EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
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
  AlertTriangle,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Mail,
  Phone,
  Landmark,
  IdCard,
  Loader,
  Search,
  ShieldOff,
  Trash2,
  User,
  X,
} from "lucide-react"

type Status = "pending" | "approved" | "rejected"

interface OrganizerProfile {
  id: string
  user_id: string
  business_name: string
  business_type: string | null
  profile_image_url: string | null
  nic_or_br: string | null
  // `phone` is the witness's mobile/WhatsApp number (registration step 2).
  phone: string | null
  witness_name: string | null
  witness_nic: string | null
  witness_email: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  branch_name: string | null
  bank_code: string | null
  branch_code: string | null
  verification_status: Status
  rejection_reason: string | null
  verified_at: string | null
  created_at: string
  users?: {
    id: string
    name: string
    email: string
    profile_image: string | null
    created_at: string
  } | null
}

const TABS: { key: Status; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
]

interface Blocker {
  type: string
  message: string
  detail?: string
  count?: number
  amount?: number
}

export default function OrganizersPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Status>("pending")
  const [profiles, setProfiles] = useState<OrganizerProfile[]>([])
  // Client-side search across the brand fields admins actually use to spot
  // an application: business name, NIC/BR, business type, and the underlying
  // user's name + email (handy when an organizer reaches out by personal mail).
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [viewingFor, setViewingFor] = useState<OrganizerProfile | null>(null)
  const [rejectingFor, setRejectingFor] = useState<OrganizerProfile | null>(null)
  const [revokingFor, setRevokingFor] = useState<OrganizerProfile | null>(null)
  const [deletingFor, setDeletingFor] = useState<OrganizerProfile | null>(null)
  const [clearingBankFor, setClearingBankFor] = useState<OrganizerProfile | null>(null)
  const [approvingFor, setApprovingFor] = useState<OrganizerProfile | null>(null)
  // Revoke-only state — the blockers list comes from a preflight call when the
  // modal opens so the admin can see what's in flight before deciding to force.
  const [revokeBlockers, setRevokeBlockers] = useState<Blocker[] | null>(null)
  const [revokeChecking, setRevokeChecking] = useState(false)

  const fetchProfiles = async (status: Status) => {
    try {
      setLoading(true)
      const res = await adminAPI.getOrganizers(status)
      setProfiles(res.data?.data?.profiles ?? [])
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load organizer applications")
      toast.error("Failed to load organizers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles(tab)
  }, [tab])

  const confirmApprove = async () => {
    if (!approvingFor) return
    setPendingActionId(approvingFor.id)
    try {
      await adminAPI.approveOrganizer(approvingFor.id)
      toast.success("Organizer approved")
      // Remove from current tab (would no longer match the filter)
      setProfiles((prev) => prev.filter((p) => p.id !== approvingFor.id))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to approve")
    } finally {
      setPendingActionId(null)
      setApprovingFor(null)
    }
  }

  const submitRejection = async (reason: string) => {
    if (!rejectingFor) return
    setPendingActionId(rejectingFor.id)
    try {
      await adminAPI.rejectOrganizer(rejectingFor.id, reason)
      toast.success("Organizer rejected")
      setProfiles((prev) => prev.filter((p) => p.id !== rejectingFor.id))
      setRejectingFor(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to reject")
    } finally {
      setPendingActionId(null)
    }
  }

  const submitClearBank = async (reason: string) => {
    if (!clearingBankFor) return
    setPendingActionId(clearingBankFor.id)
    try {
      await adminAPI.clearOrganizerBank(clearingBankFor.id, reason)
      toast.success("Bank details cleared")
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === clearingBankFor.id
            ? {
                ...p,
                bank_name: null, bank_account_number: null, bank_account_name: null,
                branch_name: null, bank_code: null, branch_code: null,
              }
            : p,
        ),
      )
      setClearingBankFor(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to clear bank details")
    } finally {
      setPendingActionId(null)
    }
  }

  const handleOpenRevoke = async (profile: OrganizerProfile) => {
    setRevokingFor(profile)
    setRevokeBlockers(null)
    setRevokeChecking(true)
    try {
      const res = await adminAPI.canRevokeOrganizer(profile.id)
      setRevokeBlockers((res.data?.data?.blockers || []) as Blocker[])
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Couldn't check eligibility")
      setRevokeBlockers([])
    } finally {
      setRevokeChecking(false)
    }
  }

  const submitRevocation = async (reason: string, force: boolean) => {
    if (!revokingFor) return
    setPendingActionId(revokingFor.id)
    try {
      await adminAPI.revokeOrganizer(revokingFor.id, reason, force)
      toast.success(
        force ? "Organizer revoked (blockers bypassed)" : "Organizer revoked",
      )
      setProfiles((prev) => prev.filter((p) => p.id !== revokingFor.id))
      setRevokingFor(null)
      setRevokeBlockers(null)
    } catch (err: any) {
      // If server returns a fresh blockers list (state shifted since preflight), refresh the modal.
      const fresh = err?.response?.data?.data?.blockers as Blocker[] | undefined
      if (fresh) setRevokeBlockers(fresh)
      toast.error(err?.response?.data?.message || "Failed to revoke")
    } finally {
      setPendingActionId(null)
    }
  }

  // Hard-delete the organizer profile. Pending/rejected applications skip
  // the reason+force ceremony; approved organizers need reason ≥10 and
  // optionally force=true to bypass live-event blockers. The submit
  // function receives both — DeleteModal omits them for non-approved.
  const submitDeletion = async (reason: string, force: boolean) => {
    if (!deletingFor) return
    setPendingActionId(deletingFor.id)
    try {
      await adminAPI.deleteOrganizer(deletingFor.id, {
        ...(reason ? { reason } : {}),
        ...(force ? { force: true } : {}),
      })
      toast.success("Organizer deleted")
      setProfiles((prev) => prev.filter((p) => p.id !== deletingFor.id))
      setDeletingFor(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete")
    } finally {
      setPendingActionId(null)
    }
  }

  // Filter once, drive both the rendered grid and the "X shown" counter
  // from the same memoized list so they never disagree.
  const filteredProfiles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => {
      const haystack = [
        p.business_name,
        p.nic_or_br,
        p.business_type,
        p.users?.name,
        p.users?.email,
      ]
      return haystack.some((s) => (s || "").toLowerCase().includes(q))
    })
  }, [profiles, searchTerm])
  const counts = useMemo(() => ({ shown: filteredProfiles.length }), [filteredProfiles])

  return (
    <ProtectedRoute requiredRoles={["superadmin", "content-manager", "event-manager"]}>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Organizer Applications
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Review business details, then approve or reject applications.
              </p>
            </div>
          </div>

          {/* Tabs + search — one toolbar panel, same pattern as the
              organizer dashboard's events toolbar. */}
          <div className="rounded-2xl bg-card p-3 shadow-sm dark:ring-1 dark:ring-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex shrink-0 rounded-lg bg-muted p-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      tab === t.key
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Search — narrows the current tab. Matches business name,
                  NIC/BR, business type, and the underlying user's name + email. */}
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by business name, NIC, email…"
                  className="h-9 w-full rounded-lg bg-muted pl-9 pr-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={loading || !!error}
                />
              </div>
            </div>
            <div className="mt-2 text-right text-xs text-muted-foreground">
              {!loading && `${counts.shown} shown`}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorMessage type="error" title="Error loading organizers" message={error} />
          ) : filteredProfiles.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={
                searchTerm.trim()
                  ? "No matches"
                  : `No ${tab} applications`
              }
              description={
                searchTerm.trim()
                  ? `No ${tab} applications match "${searchTerm.trim()}".`
                  : tab === "pending"
                    ? "Nothing waiting for review right now."
                    : `No applications have been ${tab} yet.`
              }
            />
          ) : (
            <div className="rounded-2xl bg-card shadow-sm dark:ring-1 dark:ring-white/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organizer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((p) => {
                    const u = p.users
                    const busy = pendingActionId === p.id
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {p.profile_image_url || u?.profile_image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={(p.profile_image_url || u?.profile_image) as string}
                                alt={p.business_name}
                                className="h-9 w-9 shrink-0 rounded-full bg-muted object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-secondary text-sm font-semibold text-primary-foreground">
                                {(u?.name || p.business_name).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {p.business_name}
                              </div>
                              <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{u?.email || "—"}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm capitalize text-muted-foreground">
                          {p.business_type || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.verification_status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setViewingFor(p)}
                              className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {tab === "pending" && (
                              <>
                                <button
                                  onClick={() => setApprovingFor(p)}
                                  disabled={busy}
                                  className="rounded-md p-2 text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400"
                                  title="Approve"
                                >
                                  {busy ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => setRejectingFor(p)}
                                  disabled={busy}
                                  className="rounded-md p-2 text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {tab === "approved" && (
                              <button
                                onClick={() => handleOpenRevoke(p)}
                                disabled={busy}
                                className="rounded-md p-2 text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                                title="Revoke organizer status"
                              >
                                {busy ? <Loader className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingFor(p)}
                              disabled={busy}
                              className="rounded-md p-2 text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                              title="Delete organizer"
                            >
                              {busy ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <AlertDialog open={approvingFor !== null} onOpenChange={(open) => { if (!open) setApprovingFor(null) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve this organizer?</AlertDialogTitle>
                <AlertDialogDescription>
                  {approvingFor && (
                    <>
                      This promotes <span className="font-medium text-foreground">{approvingFor.business_name}</span>&rsquo;s account to the organizer role.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setApprovingFor(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={pendingActionId !== null} onClick={(e) => { e.preventDefault(); confirmApprove() }}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {viewingFor && (
            <OrganizerDetailsModal
              profile={viewingFor}
              busy={pendingActionId === viewingFor.id}
              onClose={() => setViewingFor(null)}
              onClearBank={() => setClearingBankFor(viewingFor)}
            />
          )}
        </div>

        {rejectingFor && (
          <RejectModal
            profile={rejectingFor}
            busy={pendingActionId === rejectingFor.id}
            onClose={() => setRejectingFor(null)}
            onSubmit={submitRejection}
          />
        )}

        {revokingFor && (
          <RevokeModal
            profile={revokingFor}
            busy={pendingActionId === revokingFor.id}
            checking={revokeChecking}
            blockers={revokeBlockers}
            onClose={() => {
              setRevokingFor(null)
              setRevokeBlockers(null)
            }}
            onSubmit={submitRevocation}
          />
        )}

        {deletingFor && (
          <DeleteModal
            profile={deletingFor}
            busy={pendingActionId === deletingFor.id}
            onClose={() => setDeletingFor(null)}
            onSubmit={submitDeletion}
          />
        )}

        {clearingBankFor && (
          <ClearBankModal
            profile={clearingBankFor}
            busy={pendingActionId === clearingBankFor.id}
            onClose={() => setClearingBankFor(null)}
            onSubmit={submitClearBank}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  )
}

// Full-detail modal opened via the row's "View details" action — bank,
// witness, and rejection-reason fields that don't fit in the table row.
function OrganizerDetailsModal({
  profile,
  busy,
  onClose,
  onClearBank,
}: {
  profile: OrganizerProfile
  busy: boolean
  onClose: () => void
  onClearBank: () => void
}) {
  const u = profile.users
  const hasBankDetails = !!(
    profile.bank_name || profile.bank_account_number || profile.bank_account_name ||
    profile.branch_name || profile.bank_code || profile.branch_code
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-lg dark:ring-1 dark:ring-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            {profile.profile_image_url || u?.profile_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(profile.profile_image_url || u?.profile_image) as string}
                alt={profile.business_name}
                className="h-12 w-12 rounded-full object-cover shrink-0 border border-border bg-muted"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold shrink-0">
                {(u?.name || profile.business_name).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">{profile.business_name}</h2>
              <p className="text-xs text-muted-foreground capitalize truncate">
                {profile.business_type || "type not specified"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <StatusBadge status={profile.verification_status} />
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={u?.email} />
          <DetailRow icon={<IdCard className="h-3.5 w-3.5" />} label="NIC / BR" value={profile.nic_or_br} />
          <DetailRow
            icon={<Landmark className="h-3.5 w-3.5" />}
            label="Bank"
            value={
              profile.bank_name && profile.bank_account_number
                ? `${profile.bank_name} · ${profile.bank_account_number}`
                : profile.bank_name || null
            }
          />
          <DetailRow
            icon={<Landmark className="h-3.5 w-3.5" />}
            label="Branch"
            value={
              [profile.branch_name, profile.branch_code && `(${profile.branch_code})`]
                .filter(Boolean)
                .join(" ") || null
            }
          />
        </div>

        {(profile.bank_account_name || profile.bank_code) && (
          <div className="text-xs text-muted-foreground mt-2">
            {profile.bank_account_name && <>Account holder: {profile.bank_account_name}</>}
            {profile.bank_account_name && profile.bank_code && " · "}
            {profile.bank_code && <>Bank code: {profile.bank_code}</>}
          </div>
        )}

        {/* Witness — collected in registration step 2. `phone` is the witness's
            single mobile/WhatsApp number. */}
        {(profile.witness_name ||
          profile.witness_nic ||
          profile.witness_email ||
          profile.phone) && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Witness
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Name" value={profile.witness_name} />
              <DetailRow icon={<IdCard className="h-3.5 w-3.5" />} label="NIC" value={profile.witness_nic} />
              <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={profile.witness_email} />
              <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Mobile (WhatsApp)" value={profile.phone} />
            </div>
          </div>
        )}

        {profile.rejection_reason && (
          <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            <span className="font-semibold">Rejection reason: </span>
            {profile.rejection_reason}
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-3">
          Applied {new Date(profile.created_at).toLocaleString()}
        </div>

        {/* Clear bank details — a lighter, admin-only housekeeping action
            (organizers can't self-serve clearing their own bank info, only
            editing it). Approve/Reject/Revoke/Delete live on the row itself. */}
        {hasBankDetails && (
          <div className="flex justify-end pt-5 mt-5 border-t border-border">
            <button
              type="button"
              onClick={onClearBank}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
            >
              {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Landmark className="h-3.5 w-3.5" />}
              Clear bank details
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide">{label}</div>
        <div className="text-foreground truncate">{value || "—"}</div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { classes: string; icon: React.ReactNode; label: string }> = {
    pending: {
      classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
    },
    approved: {
      classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Approved",
    },
    rejected: {
      classes: "bg-destructive/10 text-destructive",
      icon: <XCircle className="h-3 w-3" />,
      label: "Rejected",
    },
  }
  const c = map[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${c.classes}`}>
      {c.icon}
      {c.label}
    </span>
  )
}

function RejectModal({
  profile,
  busy,
  onClose,
  onSubmit,
}: {
  profile: OrganizerProfile
  busy: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const trimmed = reason.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg dark:ring-1 dark:ring-white/10">
        <h2 className="text-xl font-bold text-foreground mb-1">Reject application</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {profile.business_name} — the applicant will see this reason and can re-apply with edits.
        </p>

        <label className="block text-sm font-medium text-foreground mb-2">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          placeholder="e.g. NIC/BR number does not match the registered business name."
          maxLength={1000}
          autoFocus
        />
        <div className="text-xs text-muted-foreground mt-1">{trimmed.length} / 1000</div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg bg-muted px-4 py-2 text-foreground transition hover:bg-muted/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !trimmed}
            onClick={() => onSubmit(trimmed)}
            className="flex-1 rounded-md bg-destructive px-4 py-2 text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Confirms + collects a reason before wiping an organizer's bank details.
// Reason mirrors the API's own validation (min 10 chars) so the button isn't
// enabled until a submission would actually succeed.
function ClearBankModal({
  profile,
  busy,
  onClose,
  onSubmit,
}: {
  profile: OrganizerProfile
  busy: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const trimmed = reason.trim()
  const valid = trimmed.length >= 10

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg dark:ring-1 dark:ring-white/10">
        <h2 className="text-xl font-bold text-foreground mb-1">Clear bank details?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Removes {profile.business_name}&rsquo;s stored bank name, account number/name, and branch
          info for good. They can re-enter it themselves from their profile at any time.
        </p>

        <label className="block text-sm font-medium text-foreground mb-2">Reason (min. 10 characters)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          placeholder="e.g. Organizer resigned and requested their bank details be removed."
          maxLength={500}
          autoFocus
        />
        <div className="text-xs text-muted-foreground mt-1">{trimmed.length} / 500</div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg bg-muted px-4 py-2 text-foreground transition hover:bg-muted/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => onSubmit(trimmed)}
            className="flex-1 rounded-md bg-destructive px-4 py-2 text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
          >
            {busy ? "Clearing…" : "Clear bank details"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Two-step revoke modal: shows preflight blockers, requires a reason ≥10 chars,
// and a typed business-name confirmation. If blockers exist the admin can tick
// "force-override" — that maps to `force: true` on the API.
function RevokeModal({
  profile,
  busy,
  checking,
  blockers,
  onClose,
  onSubmit,
}: {
  profile: OrganizerProfile
  busy: boolean
  checking: boolean
  blockers: Blocker[] | null
  onClose: () => void
  onSubmit: (reason: string, force: boolean) => void
}) {
  const [reason, setReason] = useState("")
  const [typedName, setTypedName] = useState("")
  const [forceAck, setForceAck] = useState(false)

  const trimmedReason = reason.trim()
  const reasonOk = trimmedReason.length >= 10
  const nameOk = typedName.trim().toLowerCase() === profile.business_name.trim().toLowerCase()
  const hasBlockers = (blockers?.length ?? 0) > 0
  const forceOk = !hasBlockers || forceAck

  const canSubmit = !busy && reasonOk && nameOk && forceOk

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-lg dark:ring-1 dark:ring-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3 mb-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldOff className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-foreground">Revoke organizer status</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{profile.business_name}</span> will be
              demoted to a regular user. Past events stay public; they lose access to the
              organizer dashboard. This is logged to the admin audit trail.
            </p>
          </div>
        </div>

        {/* Blockers preflight */}
        {checking ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader className="h-4 w-4 animate-spin" />
            Checking active commitments…
          </div>
        ) : hasBlockers ? (
          <div className="mb-4 space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-700 dark:text-amber-400">
                {blockers!.length} blocker{blockers!.length === 1 ? "" : "s"} found. Force-override
                is required to proceed.
              </span>
            </div>
            <ul className="space-y-2">
              {blockers!.map((b) => (
                <li
                  key={b.type}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="font-medium text-foreground">{b.message}</div>
                  {b.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{b.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : blockers ? (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            No active commitments — safe to revoke.
          </div>
        ) : null}

        {/* Reason */}
        <label className="block text-sm font-medium text-foreground mb-2">
          Reason <span className="text-destructive">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          placeholder="e.g. Policy violation — repeated no-show events leaving attendees stranded."
          maxLength={1000}
        />
        <div className="text-xs text-muted-foreground mt-1">
          {trimmedReason.length} / 1000 — minimum 10 characters for the audit log.
        </div>

        {/* Typed confirmation */}
        <label className="block text-sm font-medium text-foreground mt-4 mb-2">
          Type <span className="font-mono text-destructive">{profile.business_name}</span> to confirm
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder={profile.business_name}
          autoComplete="off"
        />

        {/* Force-override (only when blockers exist) */}
        {hasBlockers && (
          <label className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={forceAck}
              onChange={(e) => setForceAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-destructive"
            />
            <span className="text-xs text-foreground">
              <span className="font-semibold text-destructive">Force-revoke.</span> I understand
              this bypasses {blockers!.length} blocker{blockers!.length === 1 ? "" : "s"} and may
              orphan in-flight payments / payouts. Logged as <code>ORGANIZER_REVOKED_FORCED</code>.
            </span>
          </label>
        )}

        <div className="flex gap-3 pt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg bg-muted px-4 py-2 text-foreground transition hover:bg-muted/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(trimmedReason, hasBlockers && forceAck)}
            className="flex-1 rounded-md bg-destructive px-4 py-2 text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy
              ? "Revoking…"
              : hasBlockers
                ? "Force revoke"
                : "Revoke organizer"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Confirmation modal for hard-deleting an organizer profile. Two modes:
//   1. Approved + not-deactivated → reason (>=10 chars) required, optional
//      force-bypass for any live-event/payout blockers the backend reports.
//   2. Anything else (pending, rejected, already-revoked) → simple confirm.
function DeleteModal({
  profile,
  busy,
  onClose,
  onSubmit,
}: {
  profile: OrganizerProfile
  busy: boolean
  onClose: () => void
  onSubmit: (reason: string, force: boolean) => void
}) {
  const isApproved = profile.verification_status === "approved"
  const [reason, setReason] = useState("")
  const [force, setForce] = useState(false)
  const trimmed = reason.trim()
  const reasonValid = !isApproved || trimmed.length >= 10

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg dark:ring-1 dark:ring-white/10">
        <div className="flex items-start gap-3 mb-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Delete organizer?</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {profile.business_name}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 mb-4">
          This removes the organizer profile permanently. The user account stays
          (role resets to <span className="font-mono">&apos;user&apos;</span>).
          {" "}For an approved organizer, prefer <strong>Revoke</strong> if you want to
          keep the profile row for history.
        </div>

        {isApproved && (
          <>
            <label className="block text-sm font-medium text-foreground mb-2">Reason (≥10 chars)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              placeholder="e.g. duplicate account; merged with main organizer profile"
              maxLength={1000}
              autoFocus
            />
            <div className="text-xs text-muted-foreground mt-1">{trimmed.length} / 1000</div>

            <label className="mt-3 flex items-start gap-2 cursor-pointer text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-destructive"
              />
              <span>
                Force-override blockers (active events, pending payouts, etc.). Only use when
                you&apos;ve already reconciled those manually.
              </span>
            </label>
          </>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg bg-muted px-4 py-2 text-foreground transition hover:bg-muted/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !reasonValid}
            onClick={() => onSubmit(trimmed, force)}
            className="flex-1 rounded-md bg-destructive px-4 py-2 text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}
