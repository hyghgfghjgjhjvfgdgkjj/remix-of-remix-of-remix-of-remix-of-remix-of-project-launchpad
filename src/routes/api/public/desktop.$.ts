import { createFileRoute } from "@tanstack/react-router";
import { fetchHome, fetchMostTrending, searchCatalog, fetchDetails, fetchSources, fetchRelated } from "@/lib/moviebox";
import { CATEGORIES, isAdultItem } from "@/lib/categories";
import { restGetTitle, restListEpisodes, restListTitles } from "@/lib/luo-rest";
import { fsWhere } from "@/lib/developer-api";

let uploadsCache: { at: number; rows: Awaited<ReturnType<typeof restListTitles>> } | null = null;
let plansCache: { at: number; v: unknown } | null = null;

/** Edge Cache API (available on Cloudflare Workers) survives isolate restarts on Firestore quota days. */
function edgeCache(): Cache | null {
  const c = (globalThis as unknown as { caches?: { default?: Cache } }).caches;
  return c?.default ?? null;
}

/** Data for the standalone desktop app: catalog, categories, details and in-app play links. */
const cors = { "access-control-allow-origin": "*" };
const json = (d: unknown, s = 120) => Response.json(d, { headers: { ...cors, "cache-control": `public, max-age=${s}` } });
const cats = () => CATEGORIES.filter((c) => !c.adult && c.slug !== "home").map((c) => ({ slug: c.slug, label: c.short, icon: c.icon, type: c.type ?? null }));
const nb = async (p: string) => {
  const r = await fetch(`https://portal.naraboxtv.com/api/v1/${p}`, { signal: AbortSignal.timeout(12000), headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("Luganda unavailable");
  return r.json() as Promise<any>;
};

export const Route = createFileRoute("/api/public/desktop/$")({
  server: { handlers: { GET: async ({ request, params }) => {
    const url = new URL(request.url); const q = url.searchParams;
    const [action, id] = (params._splat ?? "").split("/");
    try {
      switch (action) {
        case "home": {
          const [home, trending] = await Promise.allSettled([fetchHome(), fetchMostTrending()]);
          const h = home.status === "fulfilled" ? home.value : { rows: [] as any[] };
          return json({ trending: trending.status === "fulfilled" ? trending.value : [], rows: h.rows, categories: cats() }, 300);
        }
        case "uploads": {
          const lang = id === "teso" ? "teso" : id === "luo" ? "luo" : "luganda";
          if (!uploadsCache || Date.now() - uploadsCache.at > 600_000) {
            const rows = await restListTitles();
            if (rows.length) uploadsCache = { at: Date.now(), rows };
          }
          const items = (uploadsCache?.rows ?? []).filter((t) => t.language === lang)
            .sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0)).slice(0, 80)
            .map((t) => ({ id: `up-${t.id}`, title: t.title, poster: t.poster, year: t.year, genre: t.genre ?? "", vj: t.vj, type: t.kind, direct: t.kind === "series" ? null : t.videoUrl, description: t.description }));
          const cache = edgeCache();
          const cacheKey = new Request(`https://luofilm.site/__desktop_cache/uploads/${lang}`);
          if (items.length) {
            const res = json({ items }, 300);
            if (cache) await cache.put(cacheKey, Response.json({ items }, { headers: { ...cors, "cache-control": "public, max-age=86400" } })).catch(() => {});
            return res;
          }
          if (cache) {
            const hit = await cache.match(cacheKey).catch(() => null);
            if (hit) {
              const body = await hit.json().catch(() => null) as { items?: unknown[] } | null;
              if (body?.items?.length) return json({ items: body.items }, 60);
            }
          }
          return Response.json({ items: [] }, { headers: { ...cors, "cache-control": "no-store" } });
        }
        case "plans": {
          if (!plansCache || Date.now() - plansCache.at > 600_000) {
            const row = await fsWhere("app_settings", "key", "plans").then((r) => r[0]).catch(() => null);
            if (!row?.["value"]) return Response.json({ error: "Prices temporarily unavailable" }, { status: 503, headers: cors });
            plansCache = { at: Date.now(), v: row["value"] };
          }
          return json({ plans: plansCache.v }, 300);
        }
        case "category": {
          if (id === "trending") { const items = (await fetchMostTrending()).filter((i) => i.poster && !isAdultItem(i)); if (items.length && (Number(q.get("page")) || 1) === 1) return json({ items }, 300); }
          const c = CATEGORIES.find((x) => x.slug === id && !x.adult);
          if (!c) return json({ items: [] });
          const page = Math.max(1, Math.min(200, Number(q.get("page")) || 1));
          const lists = await Promise.allSettled((c.keywords ?? [c.keyword]).slice(0, 4).map((k) => searchCatalog(k, page)));
          const seen = new Set<string>();
          const items = lists.flatMap((l) => (l.status === "fulfilled" ? l.value : []))
            .filter((i) => i.poster && !isAdultItem(i) && (!c.type || i.type === c.type) && !seen.has(i.id) && seen.add(i.id));
          return json({ items }, 300);
        }
        case "search": {
          const term = (q.get("q") ?? "").trim().slice(0, 120);
          return json({ items: term ? (await searchCatalog(term, 1)).filter((i) => !isAdultItem(i)) : [] }, 120);
        }
        case "luganda": {
          const kind = id === "tv-shows" ? "tv-shows" : "movies";
          const page = Math.max(1, Number(q.get("page")) || 1);
          const body = await nb(`${kind}?page=${page}&per_page=30&sort=latest&order=desc`);
          return json({ items: (body.data ?? []).filter((i: any) => i.is_playable !== false && (kind === "tv-shows" || i.videoUrl)).map((i: any) => ({ id: `nb-${kind}-${i.id}`, title: i.title, poster: i.thumbnail, backdrop: i.backdrop, year: i.releaseDate?.slice(0, 4) ?? null, genre: (i.genre ?? []).join(", "), type: kind === "movies" ? "movie" : "series", vj: i.vj })) }, 300);
        }
        case "title": {
          if (!id) return json({ error: "Missing id" });
          if (id.startsWith("up-")) {
            const rawId = id.slice(3);
            if (!rawId) return json({ error: "Invalid id" });
            const cached = uploadsCache?.rows.find((t) => t.id === rawId) ?? null;
            const t = cached ?? await restGetTitle(rawId);
            if (!t) return json({ error: "Not found" });
            const episodes = t.kind === "series" || !t.videoUrl ? await restListEpisodes(rawId) : [];
            return json({ id, title: t.title, description: t.description, poster: t.poster, backdrop: t.poster, year: t.year, genre: t.genre ?? "", vj: t.vj, seasons: [], luganda: { url: t.videoUrl ?? null, episodes } }, 300);
          }
          const m = /^nb-(movies|tv-shows)-(\d+)$/.exec(id);
          if (m) {
            const raw = await nb(`${m[1]}/${m[2]}`); const d = raw.data ?? raw ?? {};
            const eps = (d.seasons ?? []).flatMap((s: any) => s.episodes.filter((e: any) => e.videoUrl).map((e: any) => ({ season: s.number, episode: e.number, title: e.title, url: e.videoUrl })));
            return json({ id, title: d.title, description: d.description, poster: d.thumbnail, backdrop: d.backdrop, year: d.releaseDate?.slice(0, 4) ?? null, genre: (d.genre ?? []).join(", "), vj: d.vj, seasons: [], luganda: { url: d.videoUrl ?? null, episodes: eps } });
          }
          if (!/^\d{1,80}$/.test(id)) return json({ error: "Invalid id" });
          return json(await fetchDetails(id), 300);
        }
        case "related": {
          if (!id || !/^\d{1,80}$/.test(id)) return json({ items: [] });
          const d = await fetchDetails(id);
          return json({ items: (await fetchRelated(d)).filter((i) => !isAdultItem(i)).slice(0, 18) }, 600);
        }
        case "play": {
          if (!id || !/^\d{1,80}$/.test(id)) return json({ sources: [] });
          const se = Number(q.get("se")) || 0, ep = Number(q.get("ep")) || 0;
          const list = await fetchSources(id, se, ep);
          const sources = list.filter((s) => !s.promo).map((s) => {
            const p = new URLSearchParams({ subjectId: id, se: String(se), ep: String(se > 0 ? Math.max(1, ep) : 0), resourceId: s.id, res: String(s.resolution || 0) });
            const d = new URLSearchParams(p); d.set("dl", `${(q.get("name") || "movie").replace(/[^\w\s.()-]+/g, "").trim().slice(0, 80) || "movie"} ${s.resolution}p.mp4`);
            return { resolution: s.resolution, size: s.size, url: `${url.origin}/api/public/movie?${p}`, download: `${url.origin}/api/public/movie?${d}`, subtitles: s.captions.map((c) => ({ label: c.label, url: `${url.origin}/api/public/subtitle?url=${encodeURIComponent(c.url)}` })) };
          }).sort((a, b) => b.resolution - a.resolution);
          return json({ sources }, 20);
        }
      }
      return json({ error: "Unknown action" });
    } catch {
      return Response.json({ error: "Unavailable" }, { status: 503, headers: cors });
    }
  } } },
});
