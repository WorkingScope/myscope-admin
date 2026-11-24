"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
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
  Users,
  Search,
  Eye,
  Plus,
  Trash2,
  Ban,
  CheckCircle2,
  XCircle,
  Mail,
} from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  role: string
  status?: string
  created_at: string
  profile_image?: string
  phone?: string | null
  phone_verified?: boolean
  city?: string | null
  nic?: string | null
  provider?: string
}

export default function UsersPage() {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [banTarget, setBanTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [forceDeleteTarget, setForceDeleteTarget] = useState<{ user: User; message: string } | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<User | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getUsers()
      // Backend returns response.data.data.users
      setUsers(response.data?.data?.users || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load users")
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return
    const userId = deleteTarget.id
    setActionBusy(true)
    try {
      await adminAPI.deleteUser(userId)
      toast.success("User deleted successfully")
      setDeleteTarget(null)
      fetchUsers()
    } catch (err: any) {
      // FK violation → user has linked records (payouts / shop_orders /
      // scanner_sessions / events). Offer a force-delete escape hatch that
      // wipes those records too. Backend logs the destruction to AdminLogs.
      const status = err?.response?.status
      const code = err?.response?.data?.data?.code
      const message = err?.response?.data?.message || "Failed to delete user"
      if (status === 409 && code === "FK_VIOLATION") {
        setDeleteTarget(null)
        setForceDeleteTarget({ user: deleteTarget, message })
      } else {
        toast.error(message)
        setDeleteTarget(null)
      }
    } finally {
      setActionBusy(false)
    }
  }

  const confirmForceDelete = async () => {
    if (!forceDeleteTarget) return
    setActionBusy(true)
    try {
      await adminAPI.deleteUser(forceDeleteTarget.user.id, { force: true })
      toast.success("User force-deleted (linked records wiped)")
      fetchUsers()
    } catch (forceErr: any) {
      toast.error(forceErr?.response?.data?.message || "Force delete failed")
    } finally {
      setActionBusy(false)
      setForceDeleteTarget(null)
    }
  }

  const confirmBanUser = async () => {
    if (!banTarget) return
    setActionBusy(true)
    try {
      await adminAPI.banUser(banTarget.id)
      toast.success("User banned successfully")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to ban user")
    } finally {
      setActionBusy(false)
      setBanTarget(null)
    }
  }

  const handleUnbanUser = async (userId: string) => {
    try {
      await adminAPI.unbanUser(userId)
      toast.success("User unbanned successfully")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to unban user")
    }
  }

  const confirmPromoteToModerator = async () => {
    if (!promoteTarget) return
    setActionBusy(true)
    try {
      await adminAPI.updateUser(promoteTarget.id, { role: "content-manager" })
      toast.success("User promoted to Content Manager")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to promote user")
    } finally {
      setActionBusy(false)
      setPromoteTarget(null)
    }
  }

  const handleViewUser = (user: User) => {
    router.push(`/users/${user.id}`)
  }

  const filteredUsers = users.filter(user => {
    // Null-safe across name + email — some users have null names (Google-only
    // OAuth without a name claim, partial profiles). The previous code called
    // `.toLowerCase()` directly on those, which throws and breaks the filter
    // for the whole list, making search by email appear to "do nothing".
    const q = searchTerm.trim().toLowerCase()
    const matchesSearch =
      q === "" ||
      (user.name || "").toLowerCase().includes(q) ||
      (user.email || "").toLowerCase().includes(q)
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const stats = {
    total: users.length,
    organizers: users.filter(u => u.role === "organizer").length,
    moderators: users.filter(u => u.role === "moderator").length,
    admins: users.filter(u => ["superadmin", "event-manager", "content-manager", "support"].includes(u.role)).length,
    active: users.filter(u => u.status !== "banned").length,
    banned: users.filter(u => u.status === "banned").length
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
        <AdminLayout user={currentUser || undefined}>
          <PageLoader />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRoles={["superadmin", "content-manager"]}>
      <AdminLayout user={currentUser || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Users
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Manage user accounts, roles, and permissions
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex shrink-0 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <StatCard title="Total Users" value={stats.total} tone="primary" />
            <StatCard title="Organizers" value={stats.organizers} tone="accent" />
            <StatCard title="Moderators" value={stats.moderators} tone="warning" />
            <StatCard title="Admins" value={stats.admins} tone="primary" />
            <StatCard title="Active" value={stats.active} tone="success" />
            <StatCard title="Banned" value={stats.banned} tone="destructive" />
          </div>

          {/* Filters and Search */}
          <div className="rounded-2xl bg-card p-4 shadow-sm dark:ring-1 dark:ring-white/10">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg bg-muted py-2 pl-10 pr-4 text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="organizer">Organizers</option>
                <option value="scanner">Scanners</option>
                <option value="moderator">Moderators</option>
                <option value="support">Support</option>
                <option value="content-manager">Content Manager</option>
                <option value="event-manager">Event Manager</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <ErrorMessage
              type="error"
              title="Error loading users"
              message={error}
            />
          )}

          {/* Users Table */}
          {!error && filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description={searchTerm || roleFilter !== "all" 
                ? "Try adjusting your filters"
                : "Get started by adding your first user"
              }
              action={
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-primary-foreground transition hover:bg-primary/90"
                >
                  Add User
                </button>
              }
            />
          ) : (
            <div className="rounded-2xl bg-card shadow-sm dark:ring-1 dark:ring-white/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary/10">
                            {user.profile_image ? (
                              <Image
                                src={user.profile_image}
                                alt={user.name}
                                width={36}
                                height={36}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground">
                              {user.name}
                            </div>
                            <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${roleBadgeClass(user.role)}`}>
                          {user.role.replace('-', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.status === 'banned' ? (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                            Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Active
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewUser(user)}
                            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {user.role === 'user' && (
                            <button
                              onClick={() => setPromoteTarget(user)}
                              className="rounded-md p-2 text-primary transition hover:bg-primary/10"
                              title="Promote to Content Manager"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {user.status === 'banned' ? (
                            <button
                              onClick={() => handleUnbanUser(user.id)}
                              className="rounded-md p-2 text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"
                              title="Unban user"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setBanTarget(user)}
                              className="rounded-md p-2 text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-400"
                              title="Ban user"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(user)}
                            className="rounded-md p-2 text-destructive transition hover:bg-destructive/10"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <AlertDialog open={banTarget !== null} onOpenChange={(open) => { if (!open) setBanTarget(null) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ban this user?</AlertDialogTitle>
                <AlertDialogDescription>
                  {banTarget && (
                    <>
                      <span className="font-medium text-foreground">{banTarget.name}</span> won&rsquo;t be able to sign in until unbanned.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setBanTarget(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={actionBusy}
                  onClick={(e) => { e.preventDefault(); confirmBanUser() }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Ban className="h-4 w-4" /> Ban user
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={promoteTarget !== null} onOpenChange={(open) => { if (!open) setPromoteTarget(null) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Promote to Content Manager?</AlertDialogTitle>
                <AlertDialogDescription>
                  {promoteTarget && (
                    <>
                      <span className="font-medium text-foreground">{promoteTarget.name}</span> will gain Content Manager permissions.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPromoteTarget(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={actionBusy} onClick={(e) => { e.preventDefault(); confirmPromoteToModerator() }}>
                  <CheckCircle2 className="h-4 w-4" /> Promote
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget && (
                    <>
                      This permanently deletes <span className="font-medium text-foreground">{deleteTarget.name}</span>. This can&rsquo;t be undone.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={actionBusy}
                  onClick={(e) => { e.preventDefault(); confirmDeleteUser() }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Force-delete escape hatch — shown only when the normal delete
              hit a foreign-key violation (user has linked payouts/orders/
              events/scanner sessions). */}
          <AlertDialog open={forceDeleteTarget !== null} onOpenChange={(open) => { if (!open) setForceDeleteTarget(null) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Can&rsquo;t delete — force instead?</AlertDialogTitle>
                <AlertDialogDescription>
                  {forceDeleteTarget?.message} Force-delete will <span className="font-medium text-foreground">wipe the linked records</span> (payouts, shop orders, scanner sessions, events) before deleting the user. This is destructive and irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setForceDeleteTarget(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={actionBusy}
                  onClick={(e) => { e.preventDefault(); confirmForceDelete() }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Trash2 className="h-4 w-4" /> Force delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredUsers.length} of {users.length} users
              </p>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateUserModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              fetchUsers()
              setShowCreateModal(false)
            }}
          />
        )}

      </AdminLayout>
    </ProtectedRoute>
  )
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case 'superadmin':       return 'bg-primary/15 text-primary'
    case 'event-manager':    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
    case 'content-manager':  return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'moderator':        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    case 'support':          return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
    case 'organizer':        return 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
    case 'scanner':          return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
    default:                 return 'bg-muted text-muted-foreground'
  }
}

type Tone = "primary" | "accent" | "success" | "warning" | "destructive"

const TONE_CLASSES: Record<Tone, { bg: string; text: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  accent: { bg: "bg-accent text-accent-foreground/80", text: "text-foreground" },
  success: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive" },
}

function StatCard({ title, value, tone = "primary" }: { title: string; value: number; tone?: Tone }) {
  const t = TONE_CLASSES[tone]
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:ring-1 dark:ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.bg}`}>
          <Users className={`h-4 w-4 ${t.text}`} />
        </span>
      </div>
    </div>
  )
}

function CreateUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "user",
    password: ""
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await adminAPI.createUser(formData)
      toast.success("User created successfully")
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Operation failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg dark:ring-1 dark:ring-white/10">
        <h2 className="mb-4 text-2xl font-bold text-foreground">Create New User</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="user">User</option>
              <option value="organizer">Organizer</option>
              <option value="scanner">Scanner</option>
              <option value="moderator">Moderator</option>
              <option value="support">Support</option>
              <option value="content-manager">Content Manager</option>
              <option value="event-manager">Event Manager</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-lg bg-muted px-4 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
              minLength={6}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-muted px-4 py-2 text-foreground transition hover:bg-muted/70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

