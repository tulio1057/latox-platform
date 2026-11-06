import type { Metadata } from "next";
import Link from "next/link";
import { IconCalendar } from "@/components/icons";
import { EmptyState, EventRow, PageHero } from "@/components/ui";
import { api } from "@/lib/api";
import type { EventItem } from "@/lib/types";

export const metadata: Metadata = { title: "Eventos", description: "Agenda de eventos, palestras e cursos da LATox." };

const TZ = "America/Sao_Paulo";
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function Calendar({ events, month }: { events: EventItem[]; month: string }) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = first.getUTCDay();
  const byDay = new Map<string, EventItem>();
  for (const e of events) {
    const key = ymd(new Date(e.startAt));
    if (!byDay.has(key)) byDay.set(key, e);
  }
  const today = ymd(new Date());
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const next = new Date(Date.UTC(y, m, 1));
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  return (
    <div className="calendar">
      <div className="calendar-head">
        <Link className="btn btn-ghost btn-sm" href={`/eventos?mes=${fmt(prev)}#calendario`} aria-label="Mês anterior" scroll={false}>
          ←
        </Link>
        <h3 id="calendario">{label}</h3>
        <Link className="btn btn-ghost btn-sm" href={`/eventos?mes=${fmt(next)}#calendario`} aria-label="Próximo mês" scroll={false}>
          →
        </Link>
      </div>
      <div className="calendar-grid" role="grid" aria-label={`Calendário de ${label}`}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={i} className="dow" role="columnheader">
            {d}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const key = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const ev = byDay.get(key);
          const cls = `calendar-day${key === today ? " is-today" : ""}`;
          return ev ? (
            <Link key={key} href={`/eventos/${ev.slug}`} className={`${cls} has-event`} title={ev.title} aria-label={`${day}: ${ev.title}`}>
              {day}
            </Link>
          ) : (
            <div key={key} className={cls} role="gridcell">
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ categoria?: string; mes?: string }> }) {
  const sp = await searchParams;
  const category = typeof sp.categoria === "string" ? sp.categoria.slice(0, 60) : undefined;
  const month = typeof sp.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : ymd(new Date()).slice(0, 7);
  const { items, categories } = await api.events({ when: "all", category });
  const upcoming = items.filter((e) => !e.isPast);
  const past = items.filter((e) => e.isPast).reverse();
  const href = (c?: string) => (c ? `/eventos?categoria=${encodeURIComponent(c)}` : "/eventos");

  return (
    <>
      <PageHero eyebrow="Agenda" title="Eventos" lead="Palestras, cursos, simpósios e atividades acadêmicas da LATox." />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {categories.length > 0 && (
            <nav className="filters chip-row" aria-label="Filtrar por categoria">
              <Link className="chip" href={href()} aria-current={!category ? "true" : undefined}>
                Todos
              </Link>
              {categories.map((c) => (
                <Link key={c} className="chip" href={href(c)} aria-current={c === category ? "true" : undefined}>
                  {c}
                </Link>
              ))}
            </nav>
          )}
          <div className="detail-layout">
            <div style={{ display: "grid", gap: 48 }}>
              <section aria-labelledby="upcoming">
                <h2 id="upcoming">Próximos eventos</h2>
                {upcoming.length ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    {upcoming.map((e) => (
                      <EventRow key={e.id} item={e} />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Nenhum evento agendado">Novos eventos serão divulgados aqui.</EmptyState>
                )}
              </section>
              <section aria-labelledby="past">
                <h2 id="past">Eventos anteriores</h2>
                {past.length ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    {past.map((e) => (
                      <EventRow key={e.id} item={e} />
                    ))}
                  </div>
                ) : (
                  <p className="muted">Ainda não há histórico de eventos.</p>
                )}
              </section>
            </div>
            <aside className="events-calendar" aria-label="Calendário">
              <p className="eyebrow">
                <IconCalendar size={16} /> Calendário
              </p>
              <Calendar events={items} month={month} />
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
