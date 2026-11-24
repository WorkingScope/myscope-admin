"use client"

import { useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { PageLoader } from "@/components/ui/loading"
import { EmptyState } from "@/components/ui/error-message"
import { adminAPI } from "@/lib/apiEndpoints"
import { useAuth } from "@/contexts/auth-context"
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
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Handshake,
  ImagePlus,
  Link as LinkIcon,
  Loader,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"

interface Partner {
  id: string
  image_url: string
  name: string | null
  website_url: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

type FormState = {
  image_url: string
  name: string
  website_url: string
}

const emptyForm = (): FormState => ({ image_url: "", name: "", website_url: "" })

export default function PartnersPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.listPartners()
      setItems(res.data?.data?.items || [])
    } catch {
      toast.error("Failed to load partners")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const openCreate = () => {
    setForm(emptyForm())
    setEditing("new")
  }

  const openEdit = (it: Partner) => {
    setForm({
      image_url: it.image_url ?? "",
      name: it.name ?? "",
      website_url: it.website_url ?? "",
    })
    setEditing(it.id)
  }

  const closeEditor = () => {
    setEditing(null)
    setForm(emptyForm())
  }

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file.")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB.")
      return
    }
    setUploading(true)
    try {
      const res = await adminAPI.uploadPartnerImage(file)
      const url = res.data?.data?.url
      if (!url) throw new Error("No URL returned")
      setForm((f) => ({ ...f, image_url: url }))
      toast.success("Logo uploaded")
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.image_url) {
      toast.error("Upload a logo first.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        image_url: form.image_url,
        name: form.name.trim() || null,
        website_url: form.website_url.trim() || null,
      }
      if (editing === "new") {
        await adminAPI.createPartner(payload)
        toast.success("Partner added")
      } else if (editing) {
        await adminAPI.updatePartner(editing, payload)
        toast.success("Partner updated")
      }
      await fetchItems()
      closeEditor()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (it: Partner) => {
    setBusyId(it.id)
    try {
      await adminAPI.updatePartner(it.id, { active: !it.active })
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, active: !it.active } : x)))
    } catch {
      toast.error("Failed to toggle")
    } finally {
      setBusyId(null)
    }
  }

  const move = async (it: Partner, direction: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((x) => x.id === it.id)
    const target = idx + direction
    if (target < 0 || target >= sorted.length) return
    const other = sorted[target]
    setBusyId(it.id)
    try {
      await Promise.all([
        adminAPI.updatePartner(it.id, { sort_order: other.sort_order }),
        adminAPI.updatePartner(other.id, { sort_order: it.sort_order }),
      ])
      await fetchItems()
    } catch {
      toast.error("Reorder failed")
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminAPI.deletePartner(deleteTarget.id)
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id))
      toast.success("Deleted")
      setDeleteTarget(null)
    } catch {
      toast.error("Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout user={user || undefined}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Handshake className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Our Partners</h1>
                <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                  Upload partner logos. They appear on the home page above the footer
                  as an auto-scrolling strip. Add an optional partner name or website link per logo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add partner
            </button>
          </div>

          {/* List */}
          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="No partners yet"
              description="Add your first partner logo. The home-page strip stays hidden until at least one is published."
            />
          ) : (
            <ul className="space-y-3">
              {items
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((it, i, arr) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    busy={busyId === it.id}
                    isFirst={i === 0}
                    isLast={i === arr.length - 1}
                    onEdit={() => openEdit(it)}
                    onToggleActive={() => toggleActive(it)}
                    onUp={() => move(it, -1)}
                    onDown={() => move(it, 1)}
                    onDelete={() => setDeleteTarget(it)}
                  />
                ))}
            </ul>
          )}

          {/* Editor modal */}
          {editing && (
            <ItemEditor
              isNew={editing === "new"}
              form={form}
              setForm={setForm}
              uploading={uploading}
              saving={saving}
              onUpload={handleUpload}
              onSave={handleSave}
              onClose={closeEditor}
            />
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this partner?</AlertDialogTitle>
              <AlertDialogDescription>This can&rsquo;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => { e.preventDefault(); confirmDelete() }}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function ItemRow({
  item,
  busy,
  isFirst,
  isLast,
  onEdit,
  onToggleActive,
  onUp,
  onDown,
  onDelete,
}: {
  item: Partner
  busy: boolean
  isFirst: boolean
  isLast: boolean
  onEdit: () => void
  onToggleActive: () => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
}) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl bg-card p-3 shadow-sm dark:ring-1 dark:ring-white/10 sm:flex-row sm:items-center">
      {/* Thumb — contain (not cover) so the full logo is visible without
          cropping. Logos are typically letterboxed / non-square. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted sm:w-40">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.name || "Partner"} className="h-full w-full object-contain p-2" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImagePlus className="h-6 w-6" />
          </div>
        )}
        {!item.active && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-800">
              Hidden
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            #{item.sort_order}
          </span>
          {item.name ? (
            <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
          ) : (
            <div className="text-xs italic text-muted-foreground">No name</div>
          )}
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <LinkIcon className="h-3 w-3" />
          {item.website_url ? (
            <span className="truncate font-mono">{item.website_url}</span>
          ) : (
            <span className="italic">No website — logo only</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <IconBtn title="Move up" disabled={isFirst || busy} onClick={onUp}>
          <ArrowUp className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Move down" disabled={isLast || busy} onClick={onDown}>
          <ArrowDown className="h-4 w-4" />
        </IconBtn>
        <IconBtn title={item.active ? "Hide" : "Show"} disabled={busy} onClick={onToggleActive}>
          {item.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </IconBtn>
        <IconBtn title="Edit" disabled={busy} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          title="Delete"
          disabled={busy}
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </IconBtn>
      </div>
    </li>
  )
}

function IconBtn({
  children,
  title,
  disabled,
  onClick,
  className = "",
}: {
  children: React.ReactNode
  title: string
  disabled?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

function ItemEditor({
  isNew,
  form,
  setForm,
  uploading,
  saving,
  onUpload,
  onSave,
  onClose,
}: {
  isNew: boolean
  form: FormState
  setForm: (updater: (f: FormState) => FormState) => void
  uploading: boolean
  saving: boolean
  onUpload: (file: File) => Promise<void>
  onSave: () => Promise<void>
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !saving && !uploading && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-lg dark:ring-1 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{isNew ? "Add partner" : "Edit partner"}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Transparent PNG logos look best in the scrolling strip.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Logo
            </label>
            {form.image_url ? (
              <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Preview" className="h-full w-full object-contain p-3" />
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onUpload(f)
                      e.target.value = ""
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-800 shadow hover:bg-white">
                    {uploading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading…" : "Replace"}
                  </span>
                </label>
              </div>
            ) : (
              <label className="mx-auto flex aspect-square w-full max-w-xs cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onUpload(f)
                    e.target.value = ""
                  }}
                />
                <div className="text-center">
                  {uploading ? (
                    <Loader className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <ImagePlus className="mx-auto h-6 w-6 text-muted-foreground" />
                  )}
                  <div className="mt-2 text-xs font-medium text-muted-foreground">
                    {uploading ? "Uploading…" : "Click to upload a logo"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">PNG / JPG / WebP, up to 8 MB</div>
                </div>
              </label>
            )}
          </div>

          {/* Name */}
          <Field label="Partner name (optional)">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={200}
              className="w-full rounded-md bg-muted px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Acme Corp"
            />
          </Field>

          {/* Website */}
          <Field label="Website (optional)" hint="Full URLs or relative paths both work. Leave blank for a non-clickable logo.">
            <input
              type="text"
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
              maxLength={2048}
              className="w-full rounded-md bg-muted px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="https://example.com"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || uploading || !form.image_url}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : isNew ? "Add" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
