"use client"

// Per-event communications billing config card. Lives on the admin manage
// event page (Comms tab). Admins toggle SMS / email billing independently
// and pick which message types get billed; the global rate (defaults to
// 0.5 LKR each) is shown for context but isn't edited here — that lives on
// the Settings page.
//
// Changes take effect FORWARD ONLY: existing event_communications rows keep
// the billable / rate snapshot they were stamped with at send time. So
// disabling billing here doesn't refund past charges, and enabling it
// doesn't retroactively bill past sends.

import { useEffect, useState } from "react"
import { adminEventManage } from "@/lib/apiEndpoints"
import toast from "react-hot-toast"
import { AlertCircle, Loader, Mail, MessageSquare, Save, Wallet } from "lucide-react"

interface BillingConfig {
  sms_enabled: boolean
  email_enabled: boolean
  sms_billable_types: string[]
  email_billable_types: string[]
}

interface Rates { smsRateLkr: number; emailRateLkr: number }
interface Totals {
  total_lkr: number
  sms: { count: number; total_lkr: number }
  email: { count: number; total_lkr: number }
}
interface Catalogue { email: string[]; sms: string[] }

const TYPE_LABELS: Record<string, string> = {
  booking_confirmation:    "Booking confirmations",
  booking_cancellation:    "Booking cancellations",
  event_reminder:          "Event reminders",
  event_postponed:         "Postponement notices",
  organizer_announcement:  "Organizer announcements",
  event_approved:          "Event approved",
  event_rejected:          "Event rejected",
  event_created_by_admin:  "Admin handoff",
  event_invitation:        "Invitations",
  waitlist_opening:        "Waitlist openings",
  check_in:                "Gate check-ins",
}

function labelFor(type: string) {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type]
  return type
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")
}

const formatLkr = (n: number) =>
  `LKR ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function EventCommBillingCard({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<BillingConfig | null>(null)
  const [rates, setRates] = useState<Rates>({ smsRateLkr: 0.5, emailRateLkr: 0.5 })
  const [totals, setTotals] = useState<Totals | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue>({ email: [], sms: [] })
  const [defaults, setDefaults] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await adminEventManage.getCommBilling(eventId)
      const d = res.data.data
      setConfig(d.config)
      setRates(d.rates)
      setTotals(d.totals)
      setCatalogue(d.catalogue)
      setDefaults(d.defaults.billable_types)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load billing config.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  // Flip a channel on/off. When turning a channel ON for the first time we
  // preselect the default billable types (announcements/reminders/postponements)
  // so admins don't have to remember the full set — they can untick anything
  // they don't want.
  const toggleChannel = (channel: "sms" | "email") => {
    if (!config) return
    const enabledKey = channel === "sms" ? "sms_enabled" : "email_enabled"
    const typesKey   = channel === "sms" ? "sms_billable_types" : "email_billable_types"
    const nowEnabled = !config[enabledKey]
    const channelCatalogue = channel === "sms" ? catalogue.sms : catalogue.email
    const filteredDefaults = defaults.filter((t) => channelCatalogue.includes(t))
    setConfig({
      ...config,
      [enabledKey]: nowEnabled,
      // Only preselect when turning on AND the current list is empty.
      [typesKey]: nowEnabled && config[typesKey].length === 0 ? filteredDefaults : config[typesKey],
    })
  }

  const toggleType = (channel: "sms" | "email", type: string) => {
    if (!config) return
    const key = channel === "sms" ? "sms_billable_types" : "email_billable_types"
    const set = new Set(config[key])
    if (set.has(type)) set.delete(type)
    else set.add(type)
    setConfig({ ...config, [key]: Array.from(set) })
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      await adminEventManage.updateCommBilling(eventId, config)
      toast.success("Billing config saved.")
      // Re-pull totals — saving doesn't change them retroactively, but a
      // fresh fetch is cheap and keeps numbers honest.
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader className="h-4 w-4 animate-spin" /> Loading billing config…
        </div>
      </div>
    )
  }
  if (error || !config) {
    return (
      <div className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10">
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || "Billing config unavailable."}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm dark:ring-1 dark:ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Communications billing</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              Charge the organizer per SMS / email this event sends. Changes apply forward only —
              past sends keep their original billable status and rate.
            </p>
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-muted px-3 py-1.5 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current rates</div>
          <div className="mt-0.5 font-mono text-foreground">
            SMS {formatLkr(rates.smsRateLkr)} · Email {formatLkr(rates.emailRateLkr)} per send
          </div>
        </div>
      </div>

      {/* Running totals for THIS event (only billable rows count) */}
      {totals ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <SmallTile
            label="Billable SMS"
            top={`${totals.sms.count.toLocaleString()} sends`}
            sub={formatLkr(totals.sms.total_lkr)}
          />
          <SmallTile
            label="Billable email"
            top={`${totals.email.count.toLocaleString()} sends`}
            sub={formatLkr(totals.email.total_lkr)}
          />
          <SmallTile
            label="Total charged"
            top={formatLkr(totals.total_lkr)}
            sub="Deducted at payout"
            highlight
          />
        </div>
      ) : null}

      {/* Two columns: SMS on the left, Email on the right */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChannelColumn
          icon={MessageSquare}
          title="SMS"
          enabled={config.sms_enabled}
          onToggle={() => toggleChannel("sms")}
          types={catalogue.sms}
          billable={config.sms_billable_types}
          onToggleType={(t) => toggleType("sms", t)}
        />
        <ChannelColumn
          icon={Mail}
          title="Email"
          enabled={config.email_enabled}
          onToggle={() => toggleChannel("email")}
          types={catalogue.email}
          billable={config.email_billable_types}
          onToggleType={(t) => toggleType("email", t)}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save billing config"}
        </button>
      </div>
    </div>
  )
}

function SmallTile({
  label, top, sub, highlight = false,
}: { label: string; top: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{top}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function ChannelColumn({
  icon: Icon,
  title,
  enabled,
  onToggle,
  types,
  billable,
  onToggleType,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  enabled: boolean
  onToggle: () => void
  types: string[]
  billable: string[]
  onToggleType: (type: string) => void
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 text-primary" /> {title} billing
        </span>
        <Toggle checked={enabled} onChange={onToggle} label={`${title} billing`} />
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Pick which {title.toLowerCase()} types to charge for. Disabled when billing is off.
      </p>

      <ul className={`mt-3 space-y-1 ${enabled ? "" : "pointer-events-none opacity-50"}`}>
        {types.map((t) => {
          const checked = billable.includes(t)
          return (
            <li key={t}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-card">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                    checked ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                      <path d="M3.5 8.5L6.5 11.5L12.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleType(t)}
                  className="sr-only"
                />
                <span className="text-foreground">{labelFor(t)}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Native checkbox styled as a switch — matches the toggle used on the
// Settings page, so "on/off" channel billing reads the same way everywhere.
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label
      title={label}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-border"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="sr-only" />
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </label>
  )
}
