"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Armchair, BarChart3, BookOpenText, Bot, Building2, CalendarPlus, CalendarRange, CircleHelp, CircleUserRound, ContactRound, LayoutDashboard, LoaderCircle, LogOut, MapPin, Menu, PanelLeftClose, PanelLeftOpen, PhoneCall, Search, Settings2, Sparkles, UsersRound, Utensils, type LucideIcon } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { RealtimeStatus } from "@/components/admin/realtime-status";
import { OperationalNotifications } from "@/components/admin/operational-notifications";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { RestaurantLocation } from "@/config/brand";
import type { Permission } from "@/config/permissions";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { cn } from "@/lib/utils";
import type { StaffSession } from "@/types/domain";

type NavItem = { href: string; label: string; icon: LucideIcon; permission: Permission; masterOnly?: boolean };

const nav: NavItem[] = [
  { href: "/admin/master", label: "Regole master", icon: Settings2, permission: "settings:write", masterOnly: true },
  { href: "/admin/locations", label: "Ristoranti", icon: Building2, permission: "reservations:read" },
  { href: "/admin/dashboard", label: "Oggi", icon: LayoutDashboard, permission: "reservations:read" },
  { href: "/admin/reservations", label: "Prenotazioni", icon: CalendarRange, permission: "reservations:read" },
  { href: "/admin/waitlist", label: "Lista d'attesa", icon: UsersRound, permission: "reservations:read" },
  { href: "/admin/floor-plan", label: "Sala e tavoli", icon: Armchair, permission: "floor:read" },
  { href: "/admin/customers", label: "Ospiti", icon: ContactRound, permission: "customers:read" },
  { href: "/admin/calls", label: "Chiamate AI", icon: PhoneCall, permission: "calls:read" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:read" },
  { href: "/admin/knowledge-base", label: "Knowledge base", icon: BookOpenText, permission: "knowledge:write" },
];
const utilityNav: NavItem[] = [
  { href: "/admin/help", label: "Guida operativa", icon: CircleHelp, permission: "reservations:read" },
  { href: "/admin/staff", label: "Personale", icon: CircleUserRound, permission: "staff:write" },
  { href: "/admin/integrations", label: "Integrazioni", icon: Bot, permission: "settings:write" },
  { href: "/admin/settings", label: "Impostazioni", icon: Settings2, permission: "settings:write" },
];

export function AdminShell({ session, locations, activeLocation, children }: { session: StaffSession; locations: readonly RestaurantLocation[]; activeLocation: RestaurantLocation; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [locationPending, startLocationTransition] = useTransition();
  const isScopedOperatorView = /^\/admin\/(yuko|kousushi)(?:\/|$)/.test(pathname);
  const isMasterAccount = session.centralAccess && locations.length > 1 && !isScopedOperatorView;
  const visibleNav = nav
    .filter((item) => session.permissions.includes(item.permission))
    .filter((item) => !item.masterOnly || isMasterAccount)
    .filter((item) => isMasterAccount || item.href !== "/admin/locations");
  const visibleUtilityNav = utilityNav.filter((item) => session.permissions.includes(item.permission));
  const mobileNav = [
    visibleNav.find((item) => item.href === "/admin/dashboard"),
    visibleNav.find((item) => item.href === "/admin/locations"),
    visibleNav.find((item) => item.href === "/admin/reservations"),
    visibleNav.find((item) => item.href === "/admin/customers"),
    visibleUtilityNav.find((item) => item.href === "/admin/help"),
  ].filter((item): item is NavItem => Boolean(item));
  const currentSection = [...visibleNav, ...visibleUtilityNav].find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const initials = session.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function switchLocation(slug: string) {
    if (slug === activeLocation.slug) return;
    startLocationTransition(async () => {
      const response = await fetch("/api/admin/v1/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (response.ok) router.refresh();
    });
  }

  function renderSidebar(onNavigate?: () => void, forceExpanded = false) {
    const isCollapsed = collapsed && !forceExpanded;
    return <div className="relative flex h-full flex-col overflow-hidden">
      <div className={cn("relative flex h-20 items-center border-b border-white/8", isCollapsed ? "justify-center px-3" : "px-5")}>
        {isCollapsed ? <Utensils className="size-5 text-primary" /> : <div className="min-w-0"><BrandLogo priority restaurant={isMasterAccount ? undefined : activeLocation} subtitle={isMasterAccount ? "Account master" : "Pannello operatori"} /><p className="mt-1 truncate font-mono text-[8px] uppercase tracking-[0.24em] text-white/30">{isMasterAccount ? "Regole centrali e controllo in tempo reale" : `${activeLocation.city} · dati limitati alla sede`}</p></div>}
      </div>
      <div className="relative flex-1 overflow-y-auto px-3 py-5">
        <NavItems items={visibleNav} pathname={pathname} collapsed={isCollapsed} onNavigate={onNavigate} />
        {visibleUtilityNav.length > 0 && <><div className="my-5 h-px bg-white/8" /><NavItems items={visibleUtilityNav} pathname={pathname} collapsed={isCollapsed} onNavigate={onNavigate} /></>}
      </div>
      <div className="relative border-t border-white/8 p-3"><div className={cn("flex items-center gap-2 rounded-xl p-2", isCollapsed ? "flex-col justify-center" : "bg-white/[0.025]")}><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{initials}</div>{!isCollapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{session.name}</p><p className="truncate text-xs capitalize text-muted-foreground">{session.role.replace("_", " ")}</p></div>}<form action={logoutAction}><button type="submit" title="Esci" aria-label="Esci dall’area riservata" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"><LogOut className="size-4" /></button></form></div></div>
    </div>;
  }

  return <div style={isMasterAccount ? undefined : restaurantThemeStyle(activeLocation)} className="dark min-h-screen bg-background text-foreground">
    <a href="#admin-content" className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only">Vai al contenuto</a>
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-white/8 bg-sidebar transition-[width] md:block", collapsed ? "w-[76px]" : "w-60")}>{renderSidebar()}<button type="button" onClick={() => setCollapsed((value) => !value)} className="absolute -right-3 top-24 flex size-7 items-center justify-center rounded-full border border-white/10 bg-card text-muted-foreground shadow-lg hover:text-foreground" aria-label={collapsed ? "Espandi sidebar" : "Riduci sidebar"}>{collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}</button></aside>
    <div className={cn("min-h-screen transition-[padding]", collapsed ? "md:pl-[76px]" : "md:pl-60")}>
      <header className="sticky top-0 z-30 flex h-[4.25rem] items-center gap-1.5 border-b border-white/8 bg-background/88 px-2.5 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-4 md:px-7">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="size-11 touch-manipulation md:hidden"><Menu /><span className="sr-only">Apri menu</span></Button></SheetTrigger><SheetContent side="left" className="dark w-72 border-white/8 bg-sidebar p-0 text-foreground"><SheetTitle className="sr-only">Navigazione</SheetTitle>{renderSidebar(() => setMobileOpen(false), true)}</SheetContent></Sheet>
        <div className="hidden min-w-28 lg:block"><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{isMasterAccount ? "Account master" : "Pannello operatore"}</p><p className="mt-0.5 truncate text-sm font-medium">{isMasterAccount ? (currentSection?.label ?? "Regia") : activeLocation.shortName}</p></div>
        <button onClick={() => setCommandOpen(true)} className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/8 bg-card/60 text-muted-foreground hover:border-white/15 sm:h-9 sm:min-w-0 sm:max-w-sm sm:flex-1 sm:justify-start sm:gap-2 sm:px-3 sm:text-sm" aria-label="Vai a una sezione"><Search className="size-4" /><span className="hidden truncate sm:inline">Vai a una sezione…</span><kbd className="ml-auto hidden rounded border border-white/10 px-1.5 font-mono text-[10px] md:block">Ctrl K</kbd></button>
        {isMasterAccount ? <Select value={activeLocation.slug} onValueChange={switchLocation} disabled={locationPending}>
          <SelectTrigger aria-label="Cambia ristorante" className="h-11 w-11 justify-center border-white/8 bg-card/60 p-0 [&>span]:hidden sm:h-9 sm:w-[176px] sm:justify-start sm:px-3 sm:[&>span]:inline">
            {locationPending ? <LoaderCircle className="size-3.5 animate-spin text-primary" /> : <MapPin className="size-3.5 text-primary" />}
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {locations.map((location) => <SelectItem key={location.id} value={location.slug}>{location.shortName}</SelectItem>)}
          </SelectContent>
        </Select> : <div className="hidden items-center gap-2 rounded-lg border border-white/8 bg-card/60 px-2.5 py-1.5 text-xs sm:flex"><span className="size-2 rounded-full bg-primary" /><span className="max-w-28 truncate">{activeLocation.shortName}</span></div>}
        <RealtimeStatus locationId={activeLocation.id} compact />
        <Button asChild size="sm" className="hidden xl:inline-flex"><Link href={`/prenota/${activeLocation.slug}`}><CalendarPlus />Apri booking</Link></Button>
        <OperationalNotifications key={isMasterAccount ? "ceo" : activeLocation.id} location={activeLocation} locations={isMasterAccount ? locations : undefined} />
      </header>
      {session.demo && <Link href="/admin/integrations" className="flex items-center justify-center gap-2 border-b border-primary/15 bg-primary/8 px-4 py-2 text-center text-xs text-primary hover:bg-primary/12"><Sparkles className="size-3.5" /><span>Ambiente sandbox · dati temporanei</span><span className="font-semibold underline underline-offset-4">Completa la configurazione</span></Link>}
      <main id="admin-content" tabIndex={-1} className="mx-auto max-w-[1540px] scroll-mt-20 px-4 py-6 pb-28 outline-none md:px-7 md:py-8">{children}</main>
    </div>
    <MobileAdminNav items={mobileNav} pathname={pathname} />
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}><CommandInput placeholder="Cerca una sezione…" /><CommandList><CommandEmpty>Nessun risultato.</CommandEmpty><CommandGroup heading="Navigazione">{[...visibleNav, ...visibleUtilityNav].map((item) => <CommandItem key={item.href} asChild><Link href={item.href} onClick={() => setCommandOpen(false)}><item.icon />{item.label}</Link></CommandItem>)}</CommandGroup></CommandList></CommandDialog>
  </div>;
}

function NavItems({ items, pathname, collapsed, onNavigate }: { items: NavItem[]; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  return <nav className="space-y-1">{items.map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors", active ? "bg-primary/12 font-medium text-primary shadow-[inset_0_0_0_1px_rgba(228,98,77,.1)]" : "text-muted-foreground hover:bg-white/5 hover:text-foreground", collapsed && "justify-center px-0")}><item.icon className="size-4 shrink-0" />{!collapsed && <span className="truncate">{item.label}</span>}{active && !collapsed && <span className="ml-auto h-4 w-0.5 rounded-full bg-primary" />}</Link>;
  })}</nav>;
}

function MobileAdminNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return <nav aria-label="Navigazione rapida" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#090a09]/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 backdrop-blur-xl md:hidden">
    {items.map((item) => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors", active ? "text-primary" : "text-muted-foreground")}><item.icon className="size-4" /><span className="max-w-full truncate px-1">{item.label === "Ristoranti" ? "Ristoranti" : item.label}</span></Link>;
    })}
  </nav>;
}
