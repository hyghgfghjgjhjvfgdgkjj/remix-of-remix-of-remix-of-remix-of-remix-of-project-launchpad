/**
 * Runtime-agnostic reads of the Luo/Luganda `media` collection over the
 * Firestore REST API. The Firebase JS SDK needs a browser-ish environment, so
 * SSR / server routes (link-preview metadata, sitemap) use this instead.
 * Every failure resolves to an empty result — metadata must never break a page.
 */
import { firebaseConfig } from "./firebase";

const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

export type LuoPublicTitle = {
  id: string;
  title: string;
  description: string | null;
  poster: string | null;
  language: "luo" | "luganda" | "teso";
  kind: "movie" | "series";
  updatedAt: string | null;
  vj: string | null;
  videoUrl: string | null;
  genre: string | null;
  year: number | null;
};
export type LuoRestEpisode = { season: number; episode: number; title: string | null; url: string };

type RestValue = Record<string, unknown>;

function val(v: RestValue | undefined): unknown {
  if (!v) return null;
  if ("stringValue" in v) return v['stringValue'];
  if ("integerValue" in v) return Number(v['integerValue']);
  if ("doubleValue" in v) return Number(v['doubleValue']);
  if ("booleanValue" in v) return v['booleanValue'];
  if ("timestampValue" in v) return v['timestampValue'];
  if ("nullValue" in v) return null;
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function imageUrl(v: unknown): string | null {
  const value = str(v);
  if (!value) return null;
  if (value.startsWith("https://")) return value;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return null;
}

function mapDoc(doc: { name?: string; fields?: Record<string, RestValue>; updateTime?: string }) {
  const f = doc.fields ?? {};
  const id = (doc.name ?? "").split("/").pop() ?? "";
  const published = val(f['published']) ?? val(f['is_published']) ?? true;
  const lang = (str(val(f['language'])) ?? "luo").toLowerCase();
  const kindRaw = (str(val(f['kind'])) ?? "movie").toLowerCase();
  const item: LuoPublicTitle = {
    id,
    title: str(val(f['title'])) ?? str(val(f['caption'])) ?? "Untitled",
    description: str(val(f['description'])),
    poster:
      imageUrl(val(f['poster_url'])) ??
      imageUrl(val(f['poster'])) ??
      imageUrl(val(f['thumbnail'])) ??
      imageUrl(val(f['backdrop_url'])),
    language: lang.startsWith("lug") ? "luganda" : lang.startsWith("tes") ? "teso" : "luo",
    kind: kindRaw === "series" ? "series" : "movie",
    updatedAt: str(val(f['created_at'])) ?? str(val(f['updated_at'])) ?? str(doc.updateTime),
    vj: str(val(f['vj'])) ?? str(val(f['actors'])),
    videoUrl: imageUrl(val(f['video_url'])) ?? imageUrl(val(f['stream_url'])) ?? imageUrl(val(f['url'])),
    genre: str(val(f['genre'])) ?? str(val(f['section'])),
    year: Number(val(f['year'])) || null,
  };
  return { item, published: published !== false };
}

let lastGoodTitles: LuoPublicTitle[] = [];

/** All published Luo/Luganda titles (paged through the REST cursor). */
export async function restListTitles(): Promise<LuoPublicTitle[]> {
  const out: LuoPublicTitle[] = [];
  let pageToken = "";
  let ok = false;
  try {
    for (let page = 0; page < 20; page++) {
      const url = `${BASE}/media?key=${firebaseConfig.apiKey}&pageSize=300${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) break;
      ok = true;
      const json = (await res.json()) as {
        documents?: Parameters<typeof mapDoc>[0][];
        nextPageToken?: string;
      };
      for (const doc of json.documents ?? []) {
        const { item, published } = mapDoc(doc);
        if (published && item.id) out.push(item);
      }
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
  } catch {
    /* metadata is best-effort */
  }
  if (ok && out.length) lastGoodTitles = out;
  return out.length ? out : lastGoodTitles;
}

/** A single title, for link-preview metadata. */
export async function restGetTitle(id: string): Promise<LuoPublicTitle | null> {
  try {
    const res = await fetch(`${BASE}/media/${encodeURIComponent(id)}?key=${firebaseConfig.apiKey}`);
    if (!res.ok) return null;
    const doc = (await res.json()) as Parameters<typeof mapDoc>[0];
    const { item } = mapDoc(doc);
    return item.id ? item : null;
  } catch {
    return null;
  }
}

/** Episodes for an uploaded Luo/Teso/Luganda series over Firestore REST. */
export async function restListEpisodes(titleId: string): Promise<LuoRestEpisode[]> {
  const queryField = async (fieldPath: string) => {
    const res = await fetch(`${BASE}:runQuery?key=${firebaseConfig.apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "episodes" }],
          where: { fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { stringValue: titleId } } },
        },
      }),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { document?: { fields?: Record<string, RestValue> }; error?: unknown }[];
    if (!Array.isArray(rows) || rows.some((r) => r.error)) return [];
    return rows.map((r) => r.document?.fields).filter(Boolean) as Record<string, RestValue>[];
  };
  try {
    let docs = await queryField("title_id");
    if (!docs.length) docs = await queryField("media_id");
    return docs
      .map((f) => {
        const url = imageUrl(val(f['video_url'])) ?? imageUrl(val(f['url']));
        if (!url) return null;
        return {
          season: Number(val(f['season'])) || 1,
          episode: Number(val(f['episode']) ?? val(f['episode_number'])) || 1,
          title: str(val(f['name'])) ?? str(val(f['title'])),
          url,
        };
      })
      .filter((e): e is LuoRestEpisode => !!e)
      .sort((a, b) => a.season - b.season || a.episode - b.episode);
  } catch {
    return [];
  }
}
