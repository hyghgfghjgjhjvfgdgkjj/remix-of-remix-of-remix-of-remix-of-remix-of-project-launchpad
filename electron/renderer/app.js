const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const BASE = location.protocol.startsWith("http") ? "/api/public/desktop/" : null; // browser preview fallback
const api = window.mm || {
  api: (p) => fetch(BASE + p).then((r) => r.json()).catch(() => ({ offline: true })),
  login: () => alert("Sign-in opens in the desktop app"), open() {}, win() {},
};
const ICON = { home: "home", trending: "trending", latest: "trending", recommended: "home", "top-50": "trending", movies: "movies", drama: "series", tv: "series", "short-series": "series", "love-story": "romance", animation: "animation", "old-skull": "classics", "live-tv": "movies", luganda: "luganda", ltv: "tv", dl: "download" };
const ic = (k) => `ic-${ICON[k] || "trending"}.png`;
let cats = [], route = { v: "home" }, hist = [], timers = [];

const vjKey = (raw) => String(raw || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\bvj\b/g, " ").replace(/\s+/g, " ").trim();
const vjName = (raw) => "VJ " + vjKey(raw).replace(/\b[a-z]/g, (c) => c.toUpperCase());
function vjIndex(raw) { const key = vjKey(raw); if (key === "senior paul") return 0; if (key === "junior") return 1; let hash = 0; for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0; return hash % 8; }
const card = (i) => `<div class="card" data-t="${esc(i.id)}"${i.direct ? ` data-dir="${esc(i.direct)}" data-nm="${esc(i.title)}"` : ""}><div class="p">${i.poster ? `<img loading="lazy" src="${esc(i.poster)}" alt="">` : ""}${i.rating ? `<em>★ ${esc(i.rating)}</em>` : ""}${i.vj ? `<i class="vj vj-${vjIndex(i.vj)}">${esc(vjName(i.vj))}</i>` : ""}</div><b>${esc(i.title)}</b><small>${esc([i.year, i.genre?.split(",")[0]].filter(Boolean).join(" · "))}</small></div>`;
const cols = () => Math.max(3, Math.floor(($("#view").clientWidth - 44 + 12) / 140));
const rows2 = (list) => `<div class="grid">${list.slice(0, cols() * 2).map(card).join("")}</div>`;
const gridSk = (n) => `<div class="grid">${Array.from({ length: n }, () => `<div><div class="p sk" style="aspect-ratio:2/3;border-radius:9px"></div><div class="skt sk"></div></div>`).join("")}</div>`;
const skeleton = () => `<div class="hero"><div class="slide sk"></div><div class="slide sk"></div></div><div class="tiles">${"<div class='tile sk' style='height:60px'></div>".repeat(6)}</div><h3><span class="sk" style="width:140px;height:14px;border-radius:6px"></span></h3>${gridSk(cols() * 2)}`;
const status = (d) => { $("#status").textContent = d?.offline ? "Offline · showing saved titles" : ""; };

function nav() {
  const main = [["home", "Home", "home"], ["cat:movies", "Movies", "movies"], ["cat:drama", "Series", "drama"], ["luganda", "Luganda", "luganda"], ["up:luo", "Luo", "luganda"], ["up:teso", "Teso", "luganda"], ["tv", "Live TV", "ltv"], ["downloads", "Downloads", "dl"]];
  const extra = cats.filter((c) => !["movies", "drama"].includes(c.slug)).map((c) => [`cat:${c.slug}`, c.label, c.slug]);
  const b = ([k, l, i]) => `<button data-k="${k}"><img src="${ic(i)}" alt="">${esc(l)}</button>`;
  $("#nav").innerHTML = main.map(b).join("") + (extra.length ? `<h6>CATEGORIES</h6>${extra.map(b).join("")}` : "");
  mark();
}
const keyOf = (r) => r.v === "cat" ? `cat:${r.slug}` : r.v === "up" ? `up:${r.lang}` : r.v;
const mark = () => document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.k === keyOf(route)));

function go(r, push = true) {
  if (push) hist.push(route);
  route = r; timers.forEach(clearInterval); timers = [];
  $("#back").style.visibility = hist.length && r.v !== "home" ? "visible" : "hidden";
  mark(); $("#view").scrollTop = 0; render();
}

async function render() {
  const v = $("#view"), r = route;
  if (r.v === "tv") { v.innerHTML = `<iframe class="tv" src="https://livetv.luofilm.site/" allow="autoplay; fullscreen"></iframe>`; return; }
  if (r.v === "home") return home(v);
  if (r.v === "title") return title(v, r.id);
  if (r.v === "play") return play(v, r);
  if (r.v === "downloads") return downloads(v);
  const label = r.v === "search" ? `Results for “${esc(r.q)}”` : r.v === "luganda" ? "Luganda" : r.v === "up" ? (r.lang === "teso" ? "Teso translated" : "Luo translated") : esc(cats.find((c) => c.slug === r.slug)?.label || "Movies");
  v.innerHTML = `<h3>${label}</h3>${gridSk(cols() * 3)}`;
  let page = 1;
  const url = (p) => r.v === "search" ? `search?q=${encodeURIComponent(r.q)}` : r.v === "luganda" ? `luganda/movies?page=${p}` : r.v === "up" ? `uploads/${r.lang}` : `category/${r.slug}?page=${p}`;
  const d = await api.api(url(1)); if (route !== r) return; status(d);
  const items = d.items || [];
  v.innerHTML = `<h3>${label}</h3>${items.length ? `<div class="grid" id="g">${items.map(card).join("")}</div>${r.v !== "search" && r.v !== "up" ? `<button class="more" id="more">Load more</button>` : ""}` : `<div class="empty">${r.v === "up" ? "Couldn't load titles right now." : "Nothing here yet."}${r.v === "up" ? ` <button class="more" id="retry" style="margin:12px auto 0">Retry</button>` : ""}</div>`}`;
  const more = $("#more"); if (more) more.onclick = async () => { more.textContent = "Loading…"; const n = await api.api(url(++page)); $("#g").insertAdjacentHTML("beforeend", (n.items || []).map(card).join("")); more.textContent = (n.items || []).length ? "Load more" : "That's all"; };
  const retry = $("#retry"); if (retry) retry.onclick = () => render();
}

let homeData = null;
async function home(v) {
  if (!homeData) v.innerHTML = skeleton();
  const d = homeData || await api.api("home"); if (route.v !== "home") return;
  if (!d.trending && !d.rows) { v.innerHTML = `<div class="boot"><div><img src="ic-mascot.png"><p>No internet connection.<br>Reconnect to load movies.</p></div></div>`; return; }
  homeData = d; status(d);
  if (d.categories?.length && !cats.length) { cats = d.categories; nav(); }
  const slides = (d.trending?.length ? d.trending : d.rows?.[0]?.items || []).filter((i) => i.backdrop || i.poster).slice(0, 8);
  const tiles = [["cat:movies", "Movies", "movies"], ["cat:drama", "Series", "drama"], ["luganda", "Luganda", "luganda"], ["cat:animation", "Animation", "animation"], ["cat:love-story", "Romance", "love-story"], ["cat:trending", "Trending", "trending"], ["tv", "Live TV", "ltv"]];
  v.innerHTML = `<div class="hero"><div class="slide big" id="s1"></div><div class="slide side-s" id="s2"></div></div>
  <div class="tiles">${tiles.map(([k, l, i]) => `<button class="tile" data-k="${k}"><img src="${ic(i)}" alt="">${l}</button>`).join("")}</div>
  <div id="local"></div>
  ${(d.rows || []).filter((x) => x.items?.length).map((x) => `<h3>${esc(x.title)}</h3>${rows2(x.items)}`).join("")}`;
  const paint = (el, i, k, n) => {
    if (!i) return; el.classList.add("fade");
    setTimeout(() => {
      el.dataset.t = i.id;
      el.innerHTML = `<img class="bgi" src="${esc(i.backdrop || i.poster)}" alt=""><div class="cap">${el.id === "s1" ? "<small>NOW TRENDING</small>" : "<small>UP NEXT</small>"}<h2>${esc(i.title)}</h2>${el.id === "s1" ? `<p>${esc([i.year, i.genre, i.rating && "★ " + i.rating].filter(Boolean).join(" · "))}</p>` : ""}</div>${el.id === "s1" ? `<div class="dots">${Array.from({ length: n }, (_, j) => `<i class="${j === k ? "on" : ""}"></i>`).join("")}</div>` : ""}`;
      requestAnimationFrame(() => el.classList.remove("fade"));
    }, 350);
  };
  Promise.all([["luo", "Luo translated"], ["teso", "Teso translated"]].map(async ([l, t]) => { const r = await api.api(`uploads/${l}`); return r.items?.length ? `<h3>${t} <a data-k="up:${l}">See all ›</a></h3>${rows2(r.items)}` : ""; }))
    .then((h) => { const el = $("#local"); if (el && route.v === "home") el.innerHTML = h.join(""); });
  let k = 0; const n = slides.length;
  const tick = () => { paint($("#s1"), slides[k % n], k % n, n); timers.push(setTimeout(() => paint($("#s2"), slides[(k + 1) % n]), 2600)); };
  if (n) { tick(); paint($("#s2"), slides[1 % n]); timers.push(setInterval(() => { k++; tick(); }, 8000)); }
}

async function title(v, id) {
  v.innerHTML = `<div class="detail sk"></div>`;
  const d = await api.api(`title/${id}`); if (route.id !== id) return;
  if (!d.title) { v.innerHTML = `<div class="empty">This title can't be opened right now.</div>`; return; }
  const lg = d.luganda;
  const eps = lg ? lg.episodes.map((e, n) => `<button data-play="${n}">S${e.season} E${e.episode}</button>`).join("")
    : (d.seasons || []).map((s) => Array.from({ length: s.episodes }, (_, e) => `<button data-se="${s.season}" data-ep="${e + 1}">S${s.season} E${e + 1}</button>`).join("")).join("");
  v.innerHTML = `<div class="detail">${d.backdrop ? `<img class="bd" src="${esc(d.backdrop)}">` : ""}${d.poster ? `<img class="po" src="${esc(d.poster)}">` : ""}<div>
  <h2>${esc(d.title)}</h2><span class="chips">${esc([d.year, d.genre, d.duration, d.country, d.vj && "VJ " + d.vj].filter(Boolean).join(" · "))}</span><p>${esc(d.description || "")}</p>
  <div class="btns">${lg ? (lg.url || lg.episodes.length ? `<button class="pri" data-play="${lg.url ? -1 : 0}">▶ Play</button>` : "") : `<button class="pri" data-se="${d.seasons?.[0]?.season || 0}" data-ep="${d.seasons?.length ? 1 : 0}">▶ Play</button>`}${acc.admin ? "" : `<button class="sec" data-acc="plans">♛ Subscribe</button>`}</div>
  ${eps ? `<div class="eps">${eps}</div>` : ""}</div></div>`;
  v.onclick2 = (t) => {
    if (t.dataset.play !== undefined) { const e = lg.episodes[+t.dataset.play]; void ensureAccess().then((ok) => ok && go({ v: "play", id, title: d.title, meta: [d.rating && "★ " + d.rating, d.year, d.country, d.genre].filter(Boolean).join(" / "), poster: d.poster, direct: e ? e.url : lg.url, label: e ? `S${e.season} E${e.episode}` : "", eps: lg.episodes, at: +t.dataset.play })); return true; }
    if (t.dataset.se !== undefined) { const all = (d.seasons || []).flatMap((s) => Array.from({ length: s.episodes }, (_, e) => ({ season: s.season, episode: e + 1 }))); void ensureAccess().then((ok) => ok && go({ v: "play", id, title: d.title, meta: [d.rating && "★ " + d.rating, d.year, d.country, d.genre].filter(Boolean).join(" / "), poster: d.poster, se: +t.dataset.se, ep: +t.dataset.ep, label: +t.dataset.se ? `S${t.dataset.se} E${t.dataset.ep}` : "", eps: all, at: all.findIndex((x) => x.season === +t.dataset.se && x.episode === +t.dataset.ep) })); return true; }
  };
}

const fmt = (t) => { t = Math.max(0, t | 0); const h = t / 3600 | 0, m = (t % 3600) / 60 | 0, x = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
const SVG = { play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>', back: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>', fwd: '<svg viewBox="0 0 24 24"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/></svg>', vol: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zm12 3a4 4 0 0 0-2-3.5v7A4 4 0 0 0 16 12z"/></svg>', mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zm16 .4L18.6 8 16 10.6 13.4 8 12 9.4l2.6 2.6-2.6 2.6 1.4 1.4 2.6-2.6 2.6 2.6 1.4-1.4-2.6-2.6z"/></svg>', cc: '<svg viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1z"/></svg>', gear: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 2.7a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 1.7 1L11 21h4l.4-2.7a7 7 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>', full: '<svg viewBox="0 0 24 24"><path d="M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zM5 14h2v3h3v2H5zm12 0h2v5h-5v-2h3z"/></svg>', dl: '<svg viewBox="0 0 24 24"><path d="M11 4h2v8l3-3 1.4 1.4L12 15.8l-5.4-5.4L8 9l3 3zM5 18h14v2H5z"/></svg>' };

async function play(v, r) {
  const series = r.eps?.length > 1;
  v.innerHTML = `<div class="pwrap${series ? " has-eps" : ""}"><div class="pmain">
  <div class="player" id="pl"><video id="vid" playsinline crossorigin="anonymous"></video>
    <div class="pmsg" id="pm"><img src="ic-mascot.png"><span>Preparing your movie…</span></div>
    <div class="ptop"><b>${esc(r.title)}</b><span>${esc(r.label || "")}</span></div>
    <button class="bigplay" id="bp">${SVG.play}</button>
    <div class="pctl"><div class="seek" id="sk"><i class="buf"></i><i class="cur"></i><s></s><em id="tip"></em></div>
      <div class="prow"><button id="pp">${SVG.play}</button><button id="b10" title="Back 10s">${SVG.back}</button><button id="f10" title="Forward 10s">${SVG.fwd}</button>
      <div class="volw"><button id="mu">${SVG.vol}</button><input type="range" id="vo" min="0" max="1" step="0.05" value="1"></div>
      <span class="tm" id="tm">0:00 / 0:00</span><span class="sp"></span>
      <div class="menu"><button id="ccb" title="Subtitles">${SVG.cc}</button><div class="pop" id="ccm"></div></div>
      <div class="menu"><button id="qb" title="Quality & speed">${SVG.gear}<sup id="qtag"></sup></button><div class="pop" id="qm"></div></div>
      <button id="fs" title="Full screen">${SVG.full}</button></div></div>
  </div>
  <div class="pbar"><div><h2>${esc(r.title)}</h2><small>${esc(r.label || "")}</small></div><button class="sec" id="dlb">${SVG.dl} Download</button>${acc.admin ? "" : `<button class="sec" data-acc="plans">♛ Subscribe</button>`}</div>
  </div>${series ? (() => { const cur = r.eps[r.at] || r.eps[0], seasons = [...new Set(r.eps.map((e) => e.season))], list = r.eps.map((e, n) => ({ ...e, n })).filter((e) => e.season === cur.season);
    return `<aside class="eplist"><h5>Details</h5><b class="et">${esc(r.title)}</b><small class="em">${esc(r.meta || "")}</small><hr>
    <h4>Episode <small>Total ${list.length} EP</small></h4>${seasons.length > 1 ? `<div class="stabs">${seasons.map((x) => `<button data-sea="${x}" class="${x === cur.season ? "on" : ""}">S${x}</button>`).join("")}</div>` : ""}
    <div class="epg">${list.map((e) => `<button data-epi="${e.n}" class="${e.n === r.at ? "on" : e.n < r.at ? "seen" : ""}" title="${esc(e.title || "Episode " + e.episode)}">${e.n === r.at ? "<i class='eq'><u></u><u></u><u></u></i>" : e.episode}</button>`).join("")}</div></aside>`; })() : ""}</div>
  <h3>You may also like</h3><div id="rel">${gridSk(cols() * 2)}</div>`;
  if (!r.direct && /^\d+$/.test(r.id)) api.api(`related/${r.id}`).then((d) => { const el = $("#rel"); if (el && route === r) el.innerHTML = (d.items || []).length ? rows2(d.items) : ""; }); else $("#rel").innerHTML = "";
  const vid = $("#vid"), pl = $("#pl"), pm = $("#pm"), sk = $("#sk");
  let srcs = [], cur = 0, hide;
  const ui = () => { $("#pp").innerHTML = $("#bp").innerHTML = vid.paused ? SVG.play : SVG.pause; pl.classList.toggle("paused", vid.paused); };
  const wake = () => { pl.classList.add("show"); clearTimeout(hide); hide = setTimeout(() => !vid.paused && pl.classList.remove("show"), 2600); };
  const toggle = () => vid.paused ? vid.play().catch(() => {}) : vid.pause();
  pl.onmousemove = wake; vid.onclick = toggle; $("#bp").onclick = toggle; $("#pp").onclick = toggle; vid.ondblclick = () => $("#fs").click();
  vid.onplay = vid.onpause = () => { ui(); wake(); };
  vid.onwaiting = () => pl.classList.add("wait"); vid.onplaying = () => { pl.classList.remove("wait"); pm.style.display = "none"; };
  vid.ontimeupdate = vid.onprogress = () => { const d = vid.duration || 0; $("#tm").textContent = `${fmt(vid.currentTime)} / ${fmt(d)}`; sk.querySelector(".cur").style.width = (d ? vid.currentTime / d * 100 : 0) + "%"; const b = vid.buffered.length ? vid.buffered.end(vid.buffered.length - 1) : 0; sk.querySelector(".buf").style.width = (d ? b / d * 100 : 0) + "%"; };
  const at = (e) => { const b = sk.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)); };
  sk.onmousemove = (e) => { const t = $("#tip"); t.textContent = fmt(at(e) * (vid.duration || 0)); t.style.left = at(e) * 100 + "%"; };
  sk.onclick = (e) => { if (vid.duration) vid.currentTime = at(e) * vid.duration; };
  $("#b10").onclick = () => vid.currentTime -= 10; $("#f10").onclick = () => vid.currentTime += 10;
  $("#vo").oninput = (e) => { vid.volume = +e.target.value; vid.muted = false; $("#mu").innerHTML = vid.volume ? SVG.vol : SVG.mute; };
  $("#mu").onclick = () => { vid.muted = !vid.muted; $("#mu").innerHTML = vid.muted ? SVG.mute : SVG.vol; };
  $("#fs").onclick = () => document.fullscreenElement ? document.exitFullscreen() : pl.requestFullscreen();
  document.querySelectorAll(".menu > button").forEach((b) => b.onclick = (e) => { e.stopPropagation(); const p = b.nextElementSibling, o = p.classList.contains("open"); document.querySelectorAll(".pop").forEach((x) => x.classList.remove("open")); p.classList.toggle("open", !o); });
  pl.addEventListener("click", (e) => { if (!e.target.closest(".menu")) document.querySelectorAll(".pop").forEach((x) => x.classList.remove("open")); });
  onkeydown = (e) => { if (route !== r || e.target.tagName === "INPUT") return; const k = e.key; if (k === " ") { e.preventDefault(); toggle(); } else if (k === "ArrowRight") vid.currentTime += 10; else if (k === "ArrowLeft") vid.currentTime -= 10; else if (k === "f") $("#fs").click(); else if (k === "m") $("#mu").click(); else if (k === "ArrowUp") { vid.volume = Math.min(1, vid.volume + .1); $("#vo").value = vid.volume; } else if (k === "ArrowDown") { vid.volume = Math.max(0, vid.volume - .1); $("#vo").value = vid.volume; } wake(); };
  const menus = () => {
    $("#qtag").textContent = srcs[cur] ? (srcs[cur].resolution >= 1080 ? "HD" : srcs[cur].resolution + "p") : "";
    $("#qm").innerHTML = `<h5>Quality</h5>${srcs.map((x, n) => `<button data-q="${n}" class="${n === cur ? "on" : ""}">${x.resolution ? x.resolution + "p" : "Auto"}<small>${esc(x.size || "")}</small></button>`).join("") || "<p>Original</p>"}<h5>Speed</h5><div class="spd">${[0.5, 1, 1.25, 1.5, 2].map((x) => `<button data-sp="${x}" class="${vid.playbackRate === x ? "on" : ""}">${x}×</button>`).join("")}</div>`;
    const subs = srcs[cur]?.subtitles || [];
    $("#ccm").innerHTML = `<h5>Subtitles</h5><button data-cc="-1" class="on">Off</button>${subs.map((c, n) => `<button data-cc="${n}">${esc(c.label)}</button>`).join("")}`;
  };
  $("#qm").onclick = (e) => { const q = e.target.closest("[data-q]"), p = e.target.closest("[data-sp]"); if (q) load(+q.dataset.q); if (p) vid.playbackRate = +p.dataset.sp; menus(); };
  $("#ccm").onclick = (e) => { const c = e.target.closest("[data-cc]"); if (!c) return; [...vid.textTracks].forEach((t, n) => t.mode = n === +c.dataset.cc ? "showing" : "hidden"); $("#ccm").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === c)); };
  const load = (n) => { cur = n; const t = vid.currentTime, playing = !vid.paused || !t; vid.innerHTML = srcs[n].subtitles.map((c) => `<track kind="subtitles" label="${esc(c.label)}" src="${esc(c.url)}">`).join(""); vid.src = srcs[n].url; if (t) vid.addEventListener("loadedmetadata", () => vid.currentTime = t, { once: true }); if (playing) vid.play().catch(ui); menus(); };
  $("#dlb").onclick = () => void ensureAccess().then((ok) => ok && downloadSheet(r, srcs));
  ui(); wake();
  if (r.direct) { srcs = [{ resolution: 0, url: r.direct, download: r.direct, subtitles: [] }]; load(0); return; }
  const d = await api.api(`play/${r.id}?se=${r.se || 0}&ep=${r.ep || 0}&name=${encodeURIComponent(r.title + (r.label ? " " + r.label : ""))}`); if (route !== r) return;
  srcs = d.sources || [];
  if (!srcs.length) { pm.querySelector("span").textContent = "No playable file found for this title yet."; return; }
  load(srcs.findIndex((x) => x.resolution <= 1080) >= 0 ? srcs.findIndex((x) => x.resolution <= 1080) : 0);
}

function downloadSheet(r, srcs) {
  if (!srcs.length) return;
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div class="acc dls"><h2>Download</h2><p>${esc(r.title)} ${esc(r.label || "")}</p>${srcs.map((x, n) => `<button class="qrow" data-n="${n}"><b>${x.resolution ? x.resolution + "p" : "Original"}</b><span>${x.resolution >= 1080 ? "Full HD" : x.resolution >= 720 ? "HD" : "Data saver"}</span><small>${esc(x.size || "")}</small><i>${SVG.dl}</i></button>`).join("")}<button class="sec" data-a="close">Cancel</button></div>`;
  m.onclick = (e) => { const q = e.target.closest("[data-n]"); if (q) { const x = srcs[+q.dataset.n]; (api.dlStart || ((o) => open(o.url)))({ url: x.download || x.url, name: `${r.title} ${r.label || ""} ${x.resolution ? x.resolution + "p" : ""}`.trim(), poster: r.poster }); m.remove(); toast("Download started · see Downloads"); } else if (e.target.dataset.a || e.target === m) m.remove(); };
  document.body.append(m);
}
const toast = (t) => { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2600); };
const mb = (b) => b > 1e9 ? (b / 1e9).toFixed(2) + " GB" : (b / 1e6).toFixed(0) + " MB";
let dlList = [];
function downloads(v) {
  const act = dlList.some((d) => d.state === "downloading" || d.state === "paused" || d.state === "starting");
  const eta = (d) => d.speed > 0 && d.total ? Math.ceil((d.total - d.received) / d.speed) : 0;
  const tm = (s) => s > 3600 ? Math.floor(s / 3600) + "h " + Math.floor(s % 3600 / 60) + "m" : s > 60 ? Math.floor(s / 60) + "m " + (s % 60) + "s" : s + "s";
  v.innerHTML = `<h3>Downloads <a data-dall="folder">Open Videos › Movie max</a></h3><div class="dltools">${act ? `<button data-dall="pause">Pause all</button><button data-dall="resume">Resume all</button>` : ""}${dlList.some((d) => d.state === "done" || d.state === "failed") ? `<button data-dall="clear">Clear finished</button>` : ""}</div>${dlList.length ? `<div class="dlg">${dlList.slice().reverse().map((d) => { const p = d.total ? d.received / d.total * 100 : 0; return `<div class="dli"><div class="dp">${d.poster ? `<img src="${esc(d.poster)}">` : `<img src="ic-movies.png">`}</div><div class="dm"><b>${esc(d.name)}</b><div class="bar"><i style="width:${d.state === "done" ? 100 : p}%"></i></div><small>${d.state === "done" ? "Completed · " + mb(d.total) : d.state === "failed" ? "Failed" : `${d.paused ? "Paused" : "Downloading"} · ${mb(d.received)} of ${d.total ? mb(d.total) : "…"} · ${p.toFixed(0)}%${!d.paused && d.speed ? ` · ${mb(d.speed)}/s · ${tm(eta(d))} left` : ""}`}</small></div><div class="da">${d.state === "done" ? `<button data-d="open" data-id="${d.id}">Show file</button><button data-d="delete" data-id="${d.id}" title="Delete file">🗑</button><button data-d="remove" data-id="${d.id}" title="Remove from list">✕</button>` : d.state === "failed" ? `<button data-d="retry" data-id="${d.id}">Retry</button><button data-d="remove" data-id="${d.id}">Remove</button>` : `<button data-d="${d.paused ? "resume" : "pause"}" data-id="${d.id}">${d.paused ? "Resume" : "Pause"}</button><button data-d="cancel" data-id="${d.id}">Cancel</button>`}</div></div>`; }).join("")}</div>` : `<div class="boot" style="height:60vh"><div><img src="ic-mascot.png"><p>No downloads yet.<br>Open a title and press Download to choose a quality.</p></div></div>`}`;
}
api.onDl?.((l) => { dlList = l; if (route.v === "downloads") downloads($("#view")); });
api.dlList?.().then((l) => dlList = l || []);
document.addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (b) api.dlAct(+b.dataset.id, b.dataset.d); const a = e.target.closest("[data-dall]")?.dataset.dall; if (a) a === "folder" ? api.dlFolder?.() : api.dlAll?.(a); });

let acc = { user: null, subscribed: !window.mm };
let lastAccAt = 0;
function paintMe() {
  const u = acc.user, me = $("#me");
  me.innerHTML = `<span class="av">${u?.photo ? `<img src="${esc(u.photo)}">` : ""}</span><div><b>${u ? esc(u.name || u.email || "My account") : "Click to log in"}</b><small>${u ? (acc.admin ? `<em class="vip">ADMIN</em> Full access` : acc.subscribed ? `<em class="vip">VIP</em> ${esc(acc.plan || "Active")}` : "Free · Subscribe") : "Plans · Subscription"}</small></div>`;
}
async function loadAcc() {
  if (!api.account) return;
  acc = await api.account();
  lastAccAt = Date.now();
  paintMe();
}
async function ensureAccess() {
  if (acc.subscribed) return true;
  if (acc.user) await loadAcc();
  if (acc.subscribed) return true;
  account(acc.user ? "plans" : "login");
  return false;
}
api.onAccount?.(loadAcc);
addEventListener("focus", () => { if (acc.user && Date.now() - lastAccAt > 15_000) void loadAcc(); });
setInterval(() => { if (acc.user && !document.hidden) void loadAcc(); }, 120_000);
function account(which) {
  const m = document.createElement("div"); m.className = "modal"; const u = acc.user;
  const exp = acc.expires ? new Date(acc.expires).toLocaleDateString() : "";
  m.innerHTML = u && which !== "plans" ? `<div class="acc"><span class="av big">${u.photo ? `<img src="${esc(u.photo)}">` : ""}</span><h2>${esc(u.name || "My account")}</h2><p>${esc(u.email || "")}</p>
  <div class="plan ${acc.subscribed ? "on" : ""}"><b>${acc.admin ? "★ Admin · full access" : acc.subscribed ? "♛ " + esc(acc.plan || "VIP") : "Free account"}</b><small>${acc.subscribed ? (exp ? "Active until " + exp : "Active") : "Subscribe to watch and download"}</small></div>
  <button class="pri" data-a="plans">${acc.subscribed ? "Renew or upgrade" : "Subscribe now"}</button><button class="sec" data-a="refresh">Refresh status</button><button class="sec" data-a="logout">Log out</button></div>`
  : `<div class="acc"><img src="ic-mascot.png" alt=""><h2>${which === "plans" ? "Go Premium" : "Welcome to Movie max"}</h2><p>${which === "plans" ? "Subscribe to watch and download every title." : "Log in to watch with your Movie max subscription."}</p>
  <ul><li>Full HD movies and series</li><li>Latest Luganda translations</li><li>Downloads to your computer</li></ul>
  <button class="pri" data-a="${which === "plans" ? "plans" : "login"}">${which === "plans" ? "See plans" : "Log in / Sign up"}</button>${which === "plans" && u ? `<button class="sec" data-a="refresh">I've paid · refresh</button>` : ""}<button class="sec" data-a="close">Not now</button></div>`;
  m.onclick = async (e) => { const a = e.target.dataset.a;
    if (a === "login") return (m.remove(), loginFloat()); if (a === "plans") { m.remove(); return acc.user ? plansFloat() : loginFloat(); }
    if (a === "logout") { await api.logout?.(); acc = { user: null, subscribed: false }; paintMe(); }
    if (a === "refresh") { e.target.textContent = "Checking…"; await loadAcc(); toast(acc.subscribed ? "Subscription active" : "No active subscription yet"); }
    if (a || e.target === m) m.remove(); };
  document.body.append(m);
}




document.addEventListener("click", (e) => {
  const sea = e.target.closest("[data-sea]");
  if (sea && route.v === "play") { const n = route.eps.findIndex((x) => x.season === +sea.dataset.sea); e.target.closest("[data-epi]"); return document.querySelector(`[data-epi]`) && go({ ...route, at: n, label: `S${route.eps[n].season} E${route.eps[n].episode}`, se: route.eps[n].season, ep: route.eps[n].episode, direct: route.eps[n].url }, false); }
  const ep = e.target.closest("[data-epi]");
  if (ep && route.v === "play") { const r = route, n = +ep.dataset.epi, x = r.eps[n]; return go({ ...r, at: n, label: `S${x.season} E${x.episode}`, se: x.season, ep: x.episode, direct: x.url || (r.direct && !x.url ? r.direct : undefined) }, false); }
  const t = e.target.closest("[data-k],[data-t],[data-se],[data-play],[data-acc]"); if (!t) return;
  if (route.v === "title" && $("#view").onclick2?.(t)) return;
  if (t.dataset.acc) return account(t.dataset.acc);
  if (t.dataset.k) { const k = t.dataset.k; hist = []; return go(k.startsWith("cat:") ? { v: "cat", slug: k.slice(4) } : k.startsWith("up:") ? { v: "up", lang: k.slice(3) } : { v: k }, false); }
  if (t.dataset.dir) return void ensureAccess().then((ok) => ok && go({ v: "play", direct: t.dataset.dir, title: t.dataset.nm, id: t.dataset.t }));
  if (t.dataset.t) go({ v: "title", id: t.dataset.t });
});
$("#back").onclick = () => hist.length && go(hist.pop(), false);
let qt; $("#q").oninput = (e) => { clearTimeout(qt); const q = e.target.value.trim(); qt = setTimeout(() => q ? go({ v: "search", q }, route.v !== "search") : go({ v: "home" }, false), 450); };
$("#me").onclick = () => account("login");
document.querySelector(".wc").onclick = (e) => { const w = e.target.closest("button")?.dataset.w; if (w) api.win(w); };
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => route.v === "home" && homeData && home($("#view")), 200); });

cats = [{ slug: "trending", label: "Trending", icon: "trending" }, { slug: "latest", label: "Latest" }, { slug: "animation", label: "Animation" }, { slug: "love-story", label: "Romance" }, { slug: "old-skull", label: "Classics" }];
nav(); render(); loadAcc();

// Images and icons cannot be dragged out, copied or saved.
document.addEventListener("dragstart", (e) => { if (e.target instanceof HTMLImageElement) e.preventDefault(); });
document.addEventListener("contextmenu", (e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); });

// In-app sign-in float (Firebase email accounts; Google opens the account window).
function loginFloat(mode = "in") {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<form class="acc lg"><img src="logo.png" alt=""><h2>${mode === "in" ? "Log in to Movie max" : "Create your account"}</h2>
  <p>${mode === "in" ? "Use your Movie max email and password." : "Sign up with your email."}</p>
  ${mode === "up" ? `<input name="name" placeholder="Your name" autocomplete="name">` : ""}
  <input name="email" type="email" required placeholder="Email address" autocomplete="email">
  <input name="password" type="password" required minlength="6" placeholder="Password" autocomplete="current-password">
  <small class="err"></small>
  <button class="pri" type="submit">${mode === "in" ? "Log in" : "Sign up"}</button>
  <div class="or"><span>or</span></div>
  <button class="sec gg" type="button" data-a="google"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg> Continue with Google</button>
  <button class="lnk" type="button" data-a="swap">${mode === "in" ? "New here? Create an account" : "Have an account? Log in"}</button>
  ${mode === "in" ? `<button class="lnk" type="button" data-a="reset">Forgot password?</button>` : ""}</form>`;
  const f = m.querySelector("form"), err = m.querySelector(".err");
  m.onclick = async (e) => { const a = e.target.closest("[data-a]")?.dataset.a;
    if (e.target === m) m.remove();
    if (a === "google") { m.remove(); api.login("/profile"); }
    if (a === "swap") { m.remove(); loginFloat(mode === "in" ? "up" : "in"); }
    if (a === "reset") { const em = f.email.value.trim(); if (!em) { err.textContent = "Type your email first"; return; }
      const r = await api.emailAuth({ mode: "reset", email: em }); err.textContent = r.error || "Reset link sent to your email"; } };
  f.onsubmit = async (e) => { e.preventDefault(); const b = f.querySelector(".pri"); b.disabled = true; b.textContent = "Please wait…"; err.textContent = "";
    const r = await api.emailAuth({ mode, email: f.email.value.trim(), password: f.password.value, name: f.name?.value?.trim() });
    b.disabled = false; b.textContent = mode === "in" ? "Log in" : "Sign up";
    if (r.error) { err.textContent = r.error; return; }
    m.remove(); await loadAcc(); toast("Logged in as " + (acc.user?.name || acc.user?.email || "you")); };
  document.body.append(m); f.email.focus();
}
api.onClock?.(() => toast("Your computer's date and time look wrong. Movie max still works, but please fix the clock in Windows settings."));

// Dedicated desktop-themed checkout reuses Firebase plans and every live website method.
function plansFloat() { return api.plans ? api.plans() : api.login("/plans"); }
