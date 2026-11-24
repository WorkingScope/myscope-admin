"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRoute } from "@/lib/rbac"
import { usePendingCounts } from "@/hooks/usePendingCounts"
import { useTheme } from "@/components/theme-provider"
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Coins,
  Settings,
  Menu,
  X,
  ChevronLeft,
  Building2,
  Banknote,
  BarChart3,
  Star,
  Armchair,
  LayoutGrid,
  History,
  Handshake,
  Package,
  ShoppingBag,
  RotateCcw,
} from "lucide-react"
import { ThemeToggle } from "../ui/theme-toggle"

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
}

const allNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/users", icon: Users },
  { name: "Organizers", href: "/organizers", icon: Building2 },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Event Review", href: "/events/review", icon: CalendarCheck },
  { name: "Edit Review", href: "/events/pending-edits", icon: CalendarCheck },
  { name: "Create for organizer", href: "/events/create", icon: CalendarPlus },
  { name: "Hero Carousel", href: "/hero-carousel", icon: Star },
  { name: "Past Events", href: "/past-events", icon: History },
  { name: "Partners", href: "/partners", icon: Handshake },
  { name: "Shop Products", href: "/shop-products", icon: Package },
  { name: "Shop Orders", href: "/shop-orders", icon: ShoppingBag },
  { name: "Payouts", href: "/payouts", icon: Banknote },
  { name: "Refunds", href: "/refunds", icon: RotateCcw },
  { name: "Earnings", href: "/earnings", icon: Coins },
  { name: "Finance Reports", href: "/reports", icon: BarChart3 },
  { name: "Reserved Seating Events", href: "/reserved-seating-events", icon: LayoutGrid },
  { name: "Venue Templates", href: "/venues", icon: Armchair },
  { name: "Settings", href: "/settings", icon: Settings },
]

interface AdminLayoutProps {
  children: React.ReactNode
  user?: {
    name: string
    email: string
    role: string
    profileImage?: string
  }
}

export function AdminLayout({ children, user }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const pathname = usePathname()
  const { logout } = useAuth()
  const pending = usePendingCounts(!!user)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  // Pre-cropped variants trim the baked-in padding around the wordmark so
  // it reads large within the bar's fixed height (the source files have a
  // lot of empty canvas around the actual glyphs).
  const wordmarkSrc =
    mounted && resolvedTheme === "dark"
      ? "/images/navbar_logo_dark_cropped.png"
      : "/images/navbar_logo_light_cropped.png"

  // Filter navigation items based on user's role
  const navItems = React.useMemo(() => {
    if (!user?.role) return []
    
    return allNavItems.filter(item => {
      // Dashboard is accessible to all admin roles
      if (item.href === '/dashboard') return true
      
      // Check if user can access this route
      return canAccessRoute(user.role, item.href)
    })
  }, [user?.role])

  const handleLogout = () => {
    logout()
  }

  // The active nav item is the longest-prefix match against the current pathname.
  // Without this, sibling items like /events and /events/review both light up on /events/review.
  const activeHref = React.useMemo(() => {
    if (!pathname) return null
    let best: string | null = null
    for (const item of navItems) {
      const match = pathname === item.href || pathname.startsWith(`${item.href}/`)
      if (match && (best === null || item.href.length > best.length)) {
        best = item.href
      }
    }
    return best
  }, [navItems, pathname])

  return (
    <div className="min-h-screen bg-background">
      {/* Unified top bar — a brand panel sized to match the sidebar's own
          width (so the logo block lines up with the sidebar column below
          it), plus the rest of the bar for page title and account controls. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-border bg-card">
        <div
          className={`flex h-full shrink-0 items-center justify-center transition-all duration-300 w-20 ${
            sidebarCollapsed ? "lg:w-16" : "lg:w-64"
          }`}
        >
          <Link href="/dashboard" className="flex items-center">
            <Image
              src={wordmarkSrc}
              alt="MyScope"
              width={200}
              height={48}
              className="h-9 w-auto object-contain"
              style={{ width: "auto" }}
              priority
            />
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 border-l border-border px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronLeft className={`h-5 w-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
            </button>

            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Admin Panel
              </p>
              <h1 className="-mt-0.5 truncate text-sm font-semibold text-foreground">
                {navItems.find((n) => n.href === activeHref)?.name ?? "Dashboard"}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />

            {user && (
              <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-border bg-background pl-3 pr-1 py-1">
                <div className="text-right leading-tight">
                  <p className="text-xs font-semibold text-foreground">{user.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{user.role}</p>
                </div>
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/20">
                  {user.profileImage ? (
                    <Image
                      src={user.profileImage}
                      alt={user.name}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary font-semibold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-16 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — starts below the unified top bar */}
      <aside
        className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] bg-card border-r border-border transition-all duration-300 ${
          sidebarCollapsed ? "w-16" : "w-64"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute right-3 top-3 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Navigation Links — compact spacing so every item fits without a
            scrollbar on typical viewport heights; overflow-y-auto stays as a
            safety net for very short windows. */}
        <nav className="h-full space-y-0.5 overflow-y-auto p-3">
          {!sidebarCollapsed && (
            <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Manage
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href === activeHref

            // Map each nav route to its pending count
            const badge =
              item.href === '/organizers' ? pending.organizers :
              item.href === '/events/review' ? pending.eventReview :
              item.href === '/payouts' ? pending.payouts :
              item.href === '/events/pending-edits' ? pending.editReview :
              item.href === '/reserved-seating-events' ? pending.reservedLayouts :
              item.href === '/shop-products' ? pending.shopProducts : 0

            const badgeLabel = badge > 99 ? '99+' : String(badge)
            // Tooltip surfaces the remaining-work count too — not just the
            // page name — so it's useful collapsed AND expanded (native
            // title tooltips work regardless of hover target size).
            const tooltip = badge > 0 ? `${item.name} · ${badgeLabel} pending` : item.name

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
                title={tooltip}
              >
                {/* Icon with badge dot when collapsed */}
                <span className="relative flex-shrink-0">
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                  {badge > 0 && sidebarCollapsed && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>

                {!sidebarCollapsed && <span className="flex-1">{item.name}</span>}

                {/* Inline count badge (expanded) */}
                {!sidebarCollapsed && badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {badgeLabel}
                  </span>
                )}

                {/* Active dot — only when no badge */}
                {!sidebarCollapsed && isActive && badge === 0 && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div
        className={`pt-16 transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        }`}
      >
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
