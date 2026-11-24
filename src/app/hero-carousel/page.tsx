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
  Calendar,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Link as LinkIcon,
  Loader,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react"

// Shape returned by GET /api/hero-slides/admin
interface HeroSlide {
  id: string
  image_url: string | null
  event_id: string | null
  event?: {
    id: string
    title: string
    banner_url: string | null
    approval_status: string
    start_time: string | null
  } | null
  title: string | null
  subtitle: string | null
  link_url: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

interface EventOption {
  id: string
  title: string
  banner_url: string | null
  start_time?: string | null
  venue_name?: string | null
}

type SourceMode = "image" | "event"

// Stripped-down form — title/subtitle/active are no longer in the UI. Event
// mode supports multi-select (one slide per picked event on save).
type FormState = {
  mode: SourceMode
  image_url: string
  // Event mode: array of picked event ids. For edits we constrain to a single
  // entry (you can only edit one row at a time); for create we allow many.
  event_ids: string[]
  link_url: string
}

const emptyForm = (): FormState => ({
  mode: "image",
  image_url: "",
  event_ids: [],
  link_url: "",
})

export default function HeroCarouselPage() {
  const { user } = useAuth()
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Editor state. `editing` = id when editing an existing slide, `"new"` when
  // creating, or null when the panel is closed.
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HeroSlide | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchSlides = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.listHeroSlides()
      setSlides(res.data?.data?.slides || [])
    } catch {
      toast.error("Failed to load slides")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSlides()
  }, [])

  // Event IDs already used by another slide — surfaced in the picker so the
  // admin doesn't accidentally double-add. The slide currently being edited
  // is excluded so swapping its own event isn't blocked.
  const alreadyUsedEventIds = slides
    .filter((s) => s.event_id && s.id !== editing)
    .map((s) => s.event_id as string)

  const openCreate = () => {
    setForm(emptyForm())
    setEditing("new")
  }

  const openEdit = (s: HeroSlide) => {
    setForm({
      mode: s.event_id ? "event" : "image",
      image_url: s.image_url ?? "",
      // Single-entry array when editing — UI enforces only one selection.
      event_ids: s.event_id ? [s.event_id] : [],
      link_url: s.link_url ?? "",
    })
    setEditing(s.id)
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
      const res = await adminAPI.uploadHeroSlideImage(file)
      const url = res.data?.data?.url
      if (!url) throw new Error("No URL returned")
      setForm((f) => ({ ...f, image_url: url }))
      toast.success("Image uploaded")
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    // Mode-dependent validation.
    if (form.mode === "image" && !form.image_url) {
      toast.error("Upload an image first.")
      return
    }
    if (form.mode === "event" && form.event_ids.length === 0) {
      toast.error("Pick at least one event first.")
      return
    }

    setSaving(true)
    try {
      if (form.mode === "image") {
        const payload = {
          image_url: form.image_url,
          event_id: null,
          link_url: form.link_url.trim() || null,
        }
        if (editing === "new") {
          await adminAPI.createHeroSlide(payload)
          toast.success("Slide added")
        } else if (editing) {
          await adminAPI.updateHeroSlide(editing, payload)
          toast.success("Slide updated")
        }
      } else {
        // Event mode. On create we can batch — one slide per picked event.
        // On edit we only support swapping the single underlying event.
        if (editing === "new") {
          await Promise.all(
            form.event_ids.map((eventId) =>
              adminAPI.createHeroSlide({
                event_id: eventId,
                image_url: null,
                link_url: null,
              }),
            ),
          )
          toast.success(
            form.event_ids.length === 1
              ? "Slide added"
              : `${form.event_ids.length} slides added`,
          )
        } else if (editing) {
          // Use the first (and only) picked event for an edit.
          const eventId = form.event_ids[0]
          await adminAPI.updateHeroSlide(editing, {
            event_id: eventId,
            image_url: null,
            link_url: null,
          })
          toast.success("Slide updated")
        }
      }
      await fetchSlides()
      closeEditor()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (s: HeroSlide) => {
    setBusyId(s.id)
    try {
      await adminAPI.updateHeroSlide(s.id, { active: !s.active })
      setSlides((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)))
    } catch {
      toast.error("Failed to toggle slide")
    } finally {
      setBusyId(null)
    }
  }

  const move = async (s: HeroSlide, direction: -1 | 1) => {
    const sorted = [...slides].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((x) => x.id === s.id)
    const target = idx + direction
    if (target < 0 || target >= sorted.length) return
    const other = sorted[target]
    setBusyId(s.id)
    try {
      // Swap sort_order between the two slides. Two PATCH calls — small N so
      // round-trip cost is fine and we avoid a bulk reorder endpoint.
      await Promise.all([
        adminAPI.updateHeroSlide(s.id, { sort_order: other.sort_order }),
        adminAPI.updateHeroSlide(other.id, { sort_order: s.sort_order }),
      ])
      await fetchSlides()
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
      await adminAPI.deleteHeroSlide(deleteTarget.id)
      setSlides((prev) => prev.filter((x) => x.id !== deleteTarget.id))
      toast.success("Slide deleted")
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
                <Star className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Hero Carousel</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Upload images that show on the homepage hero. Each slide can optionally link somewhere
                  (event, external page) — leave the link blank for a passive banner.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add slide
            </button>
          </div>

          {/* List */}
          {loading ? (
            <PageLoader />
          ) : slides.length === 0 ? (
            <EmptyState
              icon={ImagePlus}
              title="No hero slides yet"
              description="Add your first slide to power the homepage carousel. The site will fall back to its default hero if there are none."
            />
          ) : (
            <ul className="space-y-3">
              {slides
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((s, i, arr) => (
                  <SlideRow
                    key={s.id}
                    slide={s}
                    busy={busyId === s.id}
                    isFirst={i === 0}
                    isLast={i === arr.length - 1}
                    onEdit={() => openEdit(s)}
                    onToggleActive={() => toggleActive(s)}
                    onUp={() => move(s, -1)}
                    onDown={() => move(s, 1)}
                    onDelete={() => setDeleteTarget(s)}
                  />
                ))}
            </ul>
          )}

          {/* Editor modal */}
          {editing && (
            <SlideEditor
              isNew={editing === "new"}
              form={form}
              setForm={setForm}
              uploading={uploading}
              saving={saving}
              onUpload={handleUpload}
              onSave={handleSave}
              onClose={closeEditor}
              editingId={editing}
              alreadyUsedEventIds={alreadyUsedEventIds}
            />
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this slide?</AlertDialogTitle>
              <AlertDialogDescription>This can&rsquo;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => { e.preventDefault(); confirmDelete() }}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete slide"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}

// ---------------------------------------------------------------------------
// Row card — one slide in the list.
// ---------------------------------------------------------------------------
function SlideRow({
  slide,
  busy,
  isFirst,
  isLast,
  onEdit,
  onToggleActive,
  onUp,
  onDown,
  onDelete,
}: {
  slide: HeroSlide
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
      {/* Thumb — for event-backed slides we fall back to the event's banner. */}
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-md bg-muted sm:w-48">
        {(() => {
          const src = slide.image_url || slide.event?.banner_url
          if (!src) {
            return (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImagePlus className="h-6 w-6" />
              </div>
            )
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={slide.title || slide.event?.title || "Hero slide"}
              className="h-full w-full object-cover"
            />
          )
        })()}
        {!slide.active && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-800">
              Hidden
            </span>
          </div>
        )}
        {/* Source badge — distinguishes uploaded image vs event reference */}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
          {slide.event_id ? (
            <>
              <Sparkles className="h-2.5 w-2.5" /> Event
            </>
          ) : (
            <>
              <ImagePlus className="h-2.5 w-2.5" /> Image
            </>
          )}
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            #{slide.sort_order}
          </span>
          {(slide.title || slide.event?.title) ? (
            <div className="truncate text-sm font-semibold text-foreground">
              {slide.title || slide.event?.title}
            </div>
          ) : (
            <div className="text-xs italic text-muted-foreground">No title</div>
          )}
        </div>
        {slide.subtitle && (
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{slide.subtitle}</div>
        )}
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <LinkIcon className="h-3 w-3" />
          {slide.link_url ? (
            <span className="truncate font-mono">{slide.link_url}</span>
          ) : slide.event_id ? (
            <span className="italic">Links to event detail page</span>
          ) : (
            <span className="italic">No link — banner only</span>
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
        <IconBtn
          title={slide.active ? "Hide slide" : "Show slide"}
          disabled={busy}
          onClick={onToggleActive}
        >
          {slide.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
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

// ---------------------------------------------------------------------------
// Editor modal — create or edit one slide.
// ---------------------------------------------------------------------------
function SlideEditor({
  isNew,
  form,
  setForm,
  uploading,
  saving,
  onUpload,
  onSave,
  onClose,
  editingId,
  alreadyUsedEventIds,
}: {
  isNew: boolean
  form: FormState
  setForm: (updater: (f: FormState) => FormState) => void
  uploading: boolean
  saving: boolean
  onUpload: (file: File) => Promise<void>
  onSave: () => Promise<void>
  onClose: () => void
  editingId: string | "new" | null
  alreadyUsedEventIds: string[]
}) {
  void editingId // referenced by parent for the lockedIds calculation
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
            <h2 className="text-lg font-semibold text-foreground">
              {isNew ? "Add hero slide" : "Edit slide"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Landscape images (21:9) look best. Leave the link empty for a passive banner.
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
          {/* Source mode selector — two big toggle buttons. Switching modes
              clears the other source so we never accidentally save both. */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(
              [
                { value: "image" as const, label: "Upload image", icon: ImagePlus },
                { value: "event" as const, label: "Featured event", icon: Calendar },
              ]
            ).map(({ value, label, icon: Icon }) => {
              const active = form.mode === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (active) return
                    setForm((f) => ({
                      ...f,
                      mode: value,
                      // Drop the other source when switching modes so the
                      // either-or DB invariant holds on save.
                      image_url: value === "image" ? f.image_url : "",
                      event_ids: value === "event" ? f.event_ids : [],
                    }))
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              )
            })}
          </div>

          {/* IMAGE MODE — upload an image. Same as before. */}
          {form.mode === "image" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Image
              </label>
              {form.image_url ? (
                <div className="relative aspect-[21/9] overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.image_url} alt="Slide preview" className="h-full w-full object-cover" />
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
                <label className="flex aspect-[21/9] cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-primary/40 hover:bg-primary/5">
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
                      {uploading ? "Uploading…" : "Click to upload an image"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">PNG / JPG, up to 8 MB</div>
                  </div>
                </label>
              )}
            </div>
          )}

          {/* EVENT MODE — search + multi-pick approved events. Events already
              attached to other slides show an "Already added" lock; events
              the user is currently picking show "Selected". Each Save creates
              one slide per picked event. */}
          {form.mode === "event" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Featured events
              </label>
              <EventPicker
                pickedIds={form.event_ids}
                lockedIds={alreadyUsedEventIds}
                multi={isNew}
                onTogglePick={(id) => {
                  setForm((f) => {
                    const has = f.event_ids.includes(id)
                    if (has) {
                      return { ...f, event_ids: f.event_ids.filter((x) => x !== id) }
                    }
                    // In edit mode, only allow swapping (single selection).
                    return {
                      ...f,
                      event_ids: isNew ? [...f.event_ids, id] : [id],
                    }
                  })
                }}
              />
            </div>
          )}

          {/* Optional link — only in image mode. Event-backed slides link to
              their event detail page automatically and don't need an override. */}
          {form.mode === "image" && (
            <Field
              label="Link (optional)"
              hint="Leave blank for a banner-only slide. Full URLs or relative paths both work."
            >
              <input
                type="text"
                value={form.link_url}
                onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                maxLength={2048}
                className="w-full rounded-md bg-muted px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="https://example.com or /events/abc"
              />
            </Field>
          )}
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
            // Image mode needs an image_url; event mode needs an event_id.
            // The OLD condition only checked image_url, which silently dead-
            // disabled the save button whenever you were in event mode.
            disabled={
              saving ||
              uploading ||
              (form.mode === "image" ? !form.image_url : form.event_ids.length === 0)
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving
              ? "Saving…"
              : isNew
                ? form.mode === "event" && form.event_ids.length > 1
                  ? `Add ${form.event_ids.length} slides`
                  : "Add slide"
                : "Save changes"}
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

// ---------------------------------------------------------------------------
// EventPicker — searchable picker of approved events for the "Featured event"
// mode of the slide editor. Pulls from /api/admin/events filtered to approved.
// ---------------------------------------------------------------------------
function EventPicker({
  pickedIds,
  lockedIds,
  multi,
  onTogglePick,
}: {
  pickedIds: string[]
  lockedIds: string[]
  multi: boolean
  onTogglePick: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<EventOption[]>([])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await adminAPI.getEvents({
          approvalStatus: "approved",
          limit: 30,
          search: search.trim() || undefined,
        })
        const list = (res.data?.data?.events || []) as EventOption[]
        if (!cancelled) setResults(list)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search])

  const pickedSet = new Set(pickedIds)
  const lockedSet = new Set(lockedIds)

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search approved events…"
          className="h-10 w-full rounded-md bg-muted pl-9 pr-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {pickedIds.length > 0 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
            {pickedIds.length} selected
          </span>
        )}
      </div>

      {!multi && pickedIds.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          You&rsquo;re editing one slide — picking another event swaps the current selection.
        </p>
      )}

      {/* Card grid */}
      <div className="max-h-112 overflow-y-auto rounded-md bg-muted/30 p-2">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader className="h-5 w-5 animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No approved events match.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {results.map((ev) => {
              const picked = pickedSet.has(ev.id)
              const locked = !picked && lockedSet.has(ev.id)
              return (
                <li key={ev.id}>
                  <div
                    className={`flex items-center gap-3 rounded-md p-2 transition-colors ${
                      picked
                        ? "bg-primary/10 ring-1 ring-primary/40"
                        : locked
                          ? "bg-muted/60 opacity-70"
                          : "bg-card shadow-sm hover:bg-muted/60 dark:ring-1 dark:ring-white/10"
                    }`}
                  >
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-muted">
                      {ev.banner_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ev.banner_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                        </div>
                      )}
                      {picked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                          <span className="rounded-full bg-primary p-1 text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {ev.title}
                      </div>
                      {(ev.venue_name || ev.start_time) && (
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {ev.start_time && new Date(ev.start_time).toLocaleDateString()}
                          {ev.start_time && ev.venue_name && " · "}
                          {ev.venue_name}
                        </div>
                      )}
                    </div>
                    {locked ? (
                      <span
                        title="Another slide already shows this event"
                        className="shrink-0 rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                      >
                        Already added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onTogglePick(ev.id)}
                        className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          picked
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-muted text-foreground hover:bg-muted/70"
                        }`}
                      >
                        {picked ? "Selected" : multi ? "Add" : "Pick"}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
