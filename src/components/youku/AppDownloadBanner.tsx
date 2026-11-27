import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Download, Monitor, Smartphone, WifiOff, X } from "lucide-react";
import movieMaxLogo from "@/assets/moviemax-logo.png";
import crowdCutout from "@/assets/app-banner-crowd.webp";
import { TOUR_STATE_EVENT } from "@/components/luo/DownloadTour";
import { WHATSAPP_PROMPT_CLOSED_EVENT } from "@/components/youku/WhatsAppPrompt";
import { isNativeApp } from "@/lib/native-app";

const AUTO_EXIT_MS = 5000;
const EXIT_ANIM_MS = 280;
const TOUR_KEY = "luofilm-download-tour-v3";

/** Keeps the banner from re-popping on SPA back-navigation within the same tab load. */
let shownThisLoad = false;

function isWebsiteOnly(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativeApp()) return false;
  if (/Electron/i.test(navigator.userAgent)) return false;
  return true;
}

/** Home-page-only dark billboard float promoting the MOVIE MAX app (5s auto-timeout, website only). */
export function AppDownloadBanner() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      window.dispatchEvent(new Event(WHATSAPP_PROMPT_CLOSED_EVENT));
    }, EXIT_ANIM_MS);
  }, []);

  useEffect(() => {
    if (!isWebsiteOnly() || shownThisLoad) return;
    const tourInProgress = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(TOUR_KEY) ?? "null") as { active?: boolean; done?: boolean } | null;
        return saved?.active === true && saved?.done !== true;
      } catch {
        return false;
      }
    })();
    const showNow = () => {
      if (shownThisLoad) return;
      shownThisLoad = true;
      setSecondsLeft(5);
      setLeaving(false);
      setOpen(true);
    };
    let t: number | undefined;
    if (!tourInProgress) t = window.setTimeout(showNow, 450);
    const onTourState = (event: Event) => {
      const active = (event as CustomEvent<{ active?: boolean }>).detail?.active === true;
      if (!active) showNow();
    };
    window.addEventListener(TOUR_STATE_EVENT, onTourState);
    return () => {
      if (t !== undefined) window.clearTimeout(t);
      window.removeEventListener(TOUR_STATE_EVENT, onTourState);
    };
  }, []);

  useEffect(() => {
    if (!open || leaving) return;
    const exitTimer = window.setTimeout(close, AUTO_EXIT_MS);
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => (s > 1 ? s - 1 : 1));
    }, 1000);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearInterval(tick);
    };
  }, [open, leaving, close]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[70] grid place-items-center bg-background/80 px-3 py-4 transition-opacity duration-300 sm:px-6 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      onClick={close}
    >
      <aside
        role="dialog"
        aria-label="Download the MOVIE MAX App"
        onClick={(e) => e.stopPropagation()}
        className={`wa-prompt app-banner-surface relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-app-banner-cyan/35 text-app-banner-foreground shadow-2xl transition-all duration-300 sm:max-w-[384px] md:max-w-[920px] ${
          leaving ? "scale-95 opacity-0" : "animate-enter"
        }`}
      >
        {/* Mobile top header row: brand lockup on left, 5s countdown + close on right */}
        <div className="relative z-30 flex items-center justify-between px-4 pt-3.5 md:hidden">
          <div className="flex items-center gap-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-app-banner-foreground/15 bg-app-banner-bar p-1">
              <img src={movieMaxLogo} alt="MOVIE MAX" className="size-full object-contain" width={24} height={24} draggable={false} />
            </div>
            <span className="text-sm font-black tracking-tight text-app-banner-foreground">MOVIE MAX</span>
            <span aria-hidden className="h-4 w-px bg-app-banner-foreground/25" />
            <span className="text-[10px] font-extrabold tracking-wider text-app-banner-cyan uppercase">Official App</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-app-banner-foreground/15 bg-app-banner-bar px-2 py-0.5 text-[11px] font-bold tabular-nums text-app-banner-muted">
              {secondsLeft}s
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close app download banner"
              className="grid size-7 place-items-center rounded-full border border-app-banner-foreground/20 bg-app-banner-bar text-app-banner-foreground transition hover:border-app-banner-cyan hover:text-app-banner-cyan"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Desktop top-right 5s countdown + close button */}
        <div className="absolute top-3 right-3 z-30 hidden items-center gap-1.5 md:flex">
          <span className="rounded-full border border-app-banner-foreground/15 bg-app-banner-bar px-2 py-1 text-[11px] font-bold tabular-nums text-app-banner-muted">
            {secondsLeft}s
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close app download banner"
            className="grid size-8 place-items-center rounded-full border border-app-banner-foreground/20 bg-app-banner-bar text-app-banner-foreground transition hover:border-app-banner-cyan hover:text-app-banner-cyan"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-12">
          {/* Left editorial column: brand lockup, headline, accurate details, Download App CTA */}
          <div className="relative z-20 order-2 flex flex-col items-center justify-center px-4 pt-3.5 pb-4 text-center md:order-1 md:col-span-6 md:items-start md:py-9 md:pr-3 md:pl-9 md:text-left">
            {/* Desktop agency brand lockup (logo | wordmark | official app) */}
            <div className="hidden items-center gap-2.5 md:flex">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-app-banner-foreground/15 bg-app-banner-bar p-1.5 shadow-md">
                <img src={movieMaxLogo} alt="MOVIE MAX" className="size-full object-contain" width={32} height={32} draggable={false} />
              </div>
              <span className="text-base font-black tracking-tight text-app-banner-foreground md:text-lg">MOVIE MAX</span>
              <span aria-hidden className="h-5 w-px bg-app-banner-foreground/25" />
              <span className="text-[11px] font-extrabold tracking-widest text-app-banner-cyan uppercase">Official App</span>
            </div>

            {/* Bold agency display headline */}
            <h2 className="text-[26px] leading-[0.98] font-black tracking-tight uppercase md:mt-5 md:text-[44px]">
              Download the
              <span className="app-banner-headline-accent block">MOVIE MAX App</span>
              <span className="mt-0.5 block text-[17px] font-extrabold text-app-banner-foreground md:mt-0 md:text-[28px]">
                Watch &amp; Save Faster.
              </span>
            </h2>

            <p className="mt-2.5 max-w-[310px] text-[12.5px] leading-snug font-medium text-app-banner-muted md:mt-3 md:max-w-md md:text-sm md:leading-relaxed">
              Stream and download <strong className="font-bold text-app-banner-foreground">Luo, Luganda, Teso &amp; global movies</strong>. Enjoy <strong className="font-bold text-app-banner-foreground">up to 4K HD quality on Desktop</strong>, fast offline downloads &amp; Live TV on Android.
            </p>

            {/* Crisp sharp feature tags — even 3-column grid on mobile, inline flex on desktop */}
            <div className="mt-3 grid w-full grid-cols-3 gap-1.5 md:mt-4 md:flex md:w-auto md:flex-wrap">
              <span className="inline-flex items-center justify-center gap-1 rounded-md border border-app-banner-foreground/12 bg-app-banner-bar px-1.5 py-1.5 text-[10px] font-bold whitespace-nowrap text-app-banner-foreground md:gap-1.5 md:px-2.5 md:py-1 md:text-[11px]">
                <Monitor className="size-3 shrink-0 text-app-banner-cyan md:size-3.5" />
                <span className="md:hidden">PC · 4K HD</span>
                <span className="hidden md:inline">Desktop · Up to 4K HD</span>
              </span>
              <span className="inline-flex items-center justify-center gap-1 rounded-md border border-app-banner-foreground/12 bg-app-banner-bar px-1.5 py-1.5 text-[10px] font-bold whitespace-nowrap text-app-banner-foreground md:gap-1.5 md:px-2.5 md:py-1 md:text-[11px]">
                <Smartphone className="size-3 shrink-0 text-app-banner-cyan md:size-3.5" /> Android APK
              </span>
              <span className="inline-flex items-center justify-center gap-1 rounded-md border border-app-banner-foreground/12 bg-app-banner-bar px-1.5 py-1.5 text-[10px] font-bold whitespace-nowrap text-app-banner-foreground md:gap-1.5 md:px-2.5 md:py-1 md:text-[11px]">
                <WifiOff className="size-3 shrink-0 text-app-banner-cyan md:size-3.5" /> Offline
              </span>
            </div>

            {/* Signature Download App CTA button */}
            <div className="mt-3.5 flex w-full flex-wrap items-center justify-center gap-3 md:mt-6 md:w-auto md:justify-start">
              <Link
                to="/app"
                onClick={close}
                className="app-banner-cta inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl px-6 text-sm font-black tracking-wide text-primary-foreground uppercase shadow-lg transition hover:brightness-110 md:h-12 md:w-auto"
              >
                <Download className="size-4 stroke-[2.5]" />
                Download App
                <ArrowRight className="size-4 stroke-[2.5]" />
              </Link>
              <span className="hidden text-xs font-semibold text-app-banner-muted md:inline">
                Free install · Step-by-step guide
              </span>
            </div>
          </div>

          {/* Right visual stage: sharp vector brand circle + all 7 people studio group cutout */}
          <div className="relative order-1 flex h-[205px] items-end justify-center overflow-hidden border-b border-app-banner-foreground/10 pt-1 md:order-2 md:col-span-6 md:h-auto md:min-h-[445px] md:justify-end md:border-b-0 md:pt-0">
            {/* Crisp solid geometric brand circle + hairline accent ring (no blur) */}
            <div
              aria-hidden
              className="app-banner-circle pointer-events-none absolute left-1/2 bottom-1 size-[186px] -translate-x-1/2 rounded-full md:left-auto md:right-6 md:bottom-6 md:size-[348px] md:translate-x-0"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 -bottom-1 size-[202px] -translate-x-1/2 rounded-full border-2 border-app-banner-cyan/45 md:left-auto md:right-3.5 md:bottom-3.5 md:size-[372px] md:translate-x-0"
            />

            {/* Commercial studio group portrait featuring all 7 people from the campaign references */}
            <img
              src={crowdCutout}
              alt="Excited MOVIE MAX viewers enjoying movies on phone and desktop"
              width={920}
              height={920}
              decoding="async"
              draggable={false}
              className="pointer-events-none relative z-10 h-[198px] w-auto shrink-0 object-contain object-bottom md:h-[425px]"
            />
          </div>
        </div>

        {/* Signature crisp bottom brand strip + 5-second auto-dismiss timer bar */}
        <div className="relative border-t border-app-banner-foreground/10 bg-app-banner-bar px-4 py-2 text-[10.5px] font-medium text-app-banner-muted md:px-9 md:text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate md:hidden">Android &amp; Desktop · Up to 4K HD</span>
            <span className="hidden truncate md:inline">Official MOVIE MAX App · Android &amp; Desktop (Up to 4K HD)</span>
            <span className="shrink-0 font-bold text-app-banner-cyan">luofilm.site/app</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-app-banner-foreground/10">
            <div className="app-banner-timer app-banner-cta h-full" />
          </div>
        </div>
      </aside>
    </div>
  );
}
