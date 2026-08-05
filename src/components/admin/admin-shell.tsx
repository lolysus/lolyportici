"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, BarChart3, BookOpenText, Bot, CalendarPlus, CalendarRange, CircleHelp, CircleUserRound, ContactRound, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PhoneCall, Search, Settings2, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { RealtimeStatus } from "@/components/admin/realtime-status";
import { OperationalNotifications } from "@/components/admin/operational-notifications";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { RestaurantLocation } from "@/config/brand";
import type { Permission } from "@/config/permissions";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { cn } from "@/lib/utils";
import type { StaffSession } from "@/types/domain";

type NavItem = { href: string; label: string; short: string; icon: LucideIcon; permission: Permission };
type NavGroup = { title: string; items: NavItem[] };

/**
 * Le sezioni sono raggruppate per momento della giornata invece che elencate
 * di fila: in servizio si cerca "Sala", non la nona voce di un elenco.
 */
const navGroups: NavGroup[] = [
  {
    title: "Servizio",
    items: [
      { href: "/admin/dashboard", label: "Oggi", short: "Oggi", icon: LayoutDashboard, permission: "reservations:read" },
      { href: "/admin/reservations", label: "Prenotazioni", short: "Agenda", icon: CalendarRange, permission: "reservations:read" },
      { href: "/admin/waitlist", label: "Lista d’attesa", short: "Attesa", icon: UsersRound, permission: "reservations:read" },
      { href: "/admin/floor-plan", label: "Sala e tavoli", short: "Sala", icon: Armchair, permission: "floor:read" },
    ],
  },
  {
    title: "Ospiti",
    items: [
      { href: "/admin/customers", label: "Ospiti", short: "Ospiti", icon: ContactRound, permission: "customers:read" },
      { href: "/admin/calls", label: "Chiamate AI", short: "Chiamate", icon: PhoneCall, permission: "calls:read" },
      { href: "/admin/analytics", label: "Andamento", short: "Dati", icon: BarChart3, permission: "analytics:read" },
    ],
  },
  {
    title: "Configurazione",
    items: [
      { href: "/admin/settings", label: "Impostazioni", short: "Regole", icon: Settings2, permission: "settings:write" },
      { href: "/admin/knowledge-base", label: "Knowledge base", short: "Risposte", icon: BookOpenText, permission: "knowledge:write" },
      { href: "/admin/staff", label: "Personale", short: "Team", icon: CircleUserRound, permission: "staff:write" },
      { href: "/admin/integrations", label: "Integrazioni", short: "Canali", icon: Bot, permission: "settings:write" },
      { href: "/admin/help", label: "Guida operativa", short: "Guida", icon: CircleHelp, permission: "reservations:read" },
    ],
  },
];

/**
 * Il pannello di un ristorante. Uno solo: non esiste più un profilo che sta
 * sopra i due locali, quindi non c'è nulla da scegliere e la sede è un fatto,
 * non un menu a tendina.
 *
 * `scopedRestaurantSlug` arriva dal proxy quando l'indirizzo nomina la sede
 * (`/admin/yuko/...`): tutti i link restano dentro quel ramo, così da un
 * pannello non si scivola nell'altro cliccando.
 */
export function AdminShell({ session, activeLocation, scopedRestaurantSlug, children }: { session: StaffSession; locations: readonly RestaurantLocation[]; activeLocation: RestaurantLocation; scopedRestaurantSlug?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const scopeSlug = scopedRestaurantSlug ?? activeLocation.slug;
  const scopedHref = (href: string) => href.replace(/^\/admin/, `/admin/${scopeSlug}`);

  const groups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => session.permissions.includes(item.permission)).map((item) => ({ ...item, href: scopedHref(item.href) })) }))
    .filter((group) => group.items.length > 0);
  const allItems = groups.flatMap((group) => group.items);
  // In servizio il pollice arriva solo qui sotto: le cinque cose che si
  // toccano davvero, nell'ordine in cui servono.
  const mobileNav = ["/admin/dashboard", "/admin/reservations", "/admin/floor-plan", "/admin/waitlist", "/admin/customers"]
    .map((href) => allItems.find((item) => item.href === scopedHref(href)))
    .filter((item): item is NavItem => Boolean(item))
    .slice(0, 5);
  const currentSection = allItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
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

  function renderSidebar(onNavigate?: () => void, forceExpanded = false) {
    const isCollapsed = collapsed && !forceExpanded;
    return <div className="admin-rail relative flex h-full flex-col overflow-hidden">
      <div className={cn("relative flex min-h-20 items-center border-b border-white/8", isCollapsed ? "justify-center px-3" : "gap-3 px-4")}>
        {isCollapsed
          ? <span className="admin-sede-mark" aria-hidden>{activeLocation.shortName.slice(0, 1)}</span>
          : <>
            <span className="admin-sede-spine" aria-hidden />
            <div className="min-w-0 py-4">
              <BrandLogo priority restaurant={activeLocation} subtitle="Pannello del ristorante" />
              <p className="mt-1.5 truncate font-mono text-[8px] uppercase tracking-[0.24em] text-white/32">{activeLocation.city} · sede unica</p>
            </div>
          </>}
      </div>
      <div className="relative flex-1 overflow-y-auto px-2.5 py-4">
        {groups.map((group, index) => <div key={group.title} className={cn(index > 0 && "mt-5")}>
          {!isCollapsed && <p className="px-3 pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/28">{group.title}</p>}
          {isCollapsed && index > 0 && <div className="mx-3 mb-3 h-px bg-white/8" />}
          <NavItems items={group.items} pathname={pathname} collapsed={isCollapsed} onNavigate={onNavigate} />
        </div>)}
      </div>
      <div className="relative border-t border-white/8 p-2.5">
        <div className={cn("flex items-center gap-2 rounded-xl p-2", isCollapsed ? "flex-col justify-center" : "bg-white/[0.03]")}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{initials}</div>
          {!isCollapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{session.name}</p><p className="truncate text-xs capitalize text-muted-foreground">{session.role.replace("_", " ")}</p></div>}
          <form action={logoutAction}><button type="submit" title="Esci" aria-label="Esci dall’area riservata" className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"><LogOut className="size-4" /></button></form>
        </div>
      </div>
    </div>;
  }

  return <div style={restaurantThemeStyle(activeLocation)} className="dark min-h-screen bg-background text-foreground">
    <a href="#admin-content" className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only">Vai al contenuto</a>
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-white/8 bg-sidebar transition-[width] md:block", collapsed ? "w-[76px]" : "w-60")}>
      {renderSidebar()}
      <button type="button" onClick={() => setCollapsed((value) => !value)} className="absolute -right-3 top-24 flex size-9 touch-manipulation items-center justify-center rounded-full border border-white/10 bg-card text-muted-foreground shadow-lg hover:text-foreground" aria-label={collapsed ? "Espandi menu" : "Riduci menu"}>{collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}</button>
    </aside>
    <div className={cn("min-h-screen transition-[padding]", collapsed ? "md:pl-[76px]" : "md:pl-60")}>
      <header className="admin-topbar sticky top-0 z-30 flex h-16 items-center gap-1.5 border-b border-white/8 px-2.5 sm:gap-3 sm:px-4 md:px-7">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11 touch-manipulation md:hidden"><Menu /><span className="sr-only">Apri menu</span></Button></SheetTrigger>
          <SheetContent side="left" className="dark w-72 border-white/8 bg-sidebar p-0 text-foreground" style={restaurantThemeStyle(activeLocation)}><SheetTitle className="sr-only">Navigazione</SheetTitle>{renderSidebar(() => setMobileOpen(false), true)}</SheetContent>
        </Sheet>
        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-primary">{activeLocation.shortName}</p>
          <p className="truncate text-sm font-medium leading-tight">{currentSection?.label ?? "Pannello"}</p>
        </div>
        <div className="hidden min-w-32 md:block">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">{activeLocation.shortName} · {activeLocation.city}</p>
          <p className="mt-0.5 truncate text-sm font-medium">{currentSection?.label ?? "Pannello"}</p>
        </div>
        <button onClick={() => setCommandOpen(true)} className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-muted-foreground transition-colors hover:border-white/15 md:h-10 md:min-w-0 md:max-w-xs md:flex-1 md:justify-start md:gap-2 md:px-3 md:text-sm" aria-label="Vai a una sezione"><Search className="size-4" /><span className="hidden truncate md:inline">Vai a una sezione…</span><kbd className="ml-auto hidden rounded border border-white/10 px-1.5 font-mono text-[10px] lg:block">Ctrl K</kbd></button>
        <RealtimeStatus locationId={activeLocation.id} compact />
        <Button asChild size="sm" className="hidden xl:inline-flex"><Link href={`/prenota/${activeLocation.slug}`}><CalendarPlus />Pagina prenotazioni</Link></Button>
        <OperationalNotifications key={activeLocation.id} location={activeLocation} />
      </header>
      {session.demo && <Link href={scopedHref("/admin/integrations")} className="flex items-center justify-center gap-2 border-b border-primary/15 bg-primary/8 px-4 py-2 text-center text-xs text-primary hover:bg-primary/12"><Sparkles className="size-3.5" /><span>Ambiente sandbox · dati temporanei</span><span className="font-semibold underline underline-offset-4">Completa la configurazione</span></Link>}
      <main id="admin-content" tabIndex={-1} className="mx-auto max-w-[1540px] scroll-mt-20 px-3.5 py-5 pb-28 outline-none sm:px-4 md:px-7 md:py-8 md:pb-10">{children}</main>
    </div>
    <MobileAdminNav items={mobileNav} pathname={pathname} />
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Cerca una sezione…" />
      <CommandList>
        <CommandEmpty>Nessun risultato.</CommandEmpty>
        {groups.map((group) => <CommandGroup key={group.title} heading={group.title}>{group.items.map((item) => <CommandItem key={item.href} asChild><Link href={item.href} onClick={() => setCommandOpen(false)}><item.icon />{item.label}</Link></CommandItem>)}</CommandGroup>)}
      </CommandList>
    </CommandDialog>
  </div>;
}

function NavItems({ items, pathname, collapsed, onNavigate }: { items: NavItem[]; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  return <nav className="space-y-0.5">{items.map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn("admin-nav-link flex h-11 touch-manipulation items-center gap-3 rounded-lg px-3 text-sm transition-colors", active ? "is-active font-medium text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground", collapsed && "justify-center px-0")}>
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>;
  })}</nav>;
}

function MobileAdminNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  if (items.length === 0) return null;
  return <nav aria-label="Navigazione rapida" className="admin-mobile-nav fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 md:hidden">
    {items.map((item) => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] transition-colors", active ? "text-primary" : "text-muted-foreground")}>
        {active && <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />}
        <item.icon className="size-[18px]" />
        <span className="max-w-full truncate px-0.5">{item.short}</span>
      </Link>;
    })}
  </nav>;
}
