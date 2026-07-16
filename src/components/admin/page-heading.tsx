export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="relative mb-7 flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-white/8 bg-card/45 px-5 py-5 sm:flex-row sm:items-end sm:px-6">
    <div aria-hidden className="absolute -left-16 -top-28 size-64 rounded-full bg-primary/8 blur-3xl" />
    <div className="relative">{eyebrow && <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary"><span className="size-1 rounded-full bg-primary" />{eyebrow}</p>}<h1 className="font-heading text-3xl tracking-tight sm:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{actions && <div className="relative flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </div>;
}
