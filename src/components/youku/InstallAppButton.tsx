import { useEffect, useState } from "react";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFbAuth } from "@/lib/firebase";
import { buildOpenInAppUrl, isAndroidBrowser, isNativeApp } from "@/lib/native-app";

/**
 * Android phones: open this same page in the Movie max app (signed in as the same
 * account), or download the app when it is not installed yet.
 */
function openInApp() {
  let session: string | null = null;
  try {
    const user = getFbAuth().currentUser;
    if (user) session = JSON.stringify(user.toJSON());
  } catch { /* signed out */ }
  const apk = `${window.location.origin}/downloads/MovieMax.apk`;
  window.location.href = buildOpenInAppUrl(window.location.pathname + window.location.search, apk, session);
}

type AppVersion = { versionName?: string; notes?: string };

/** Android: a real APK download (works in Chrome and in-app browsers), plus "open in app" for installed phones. */
function AndroidAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [info, setInfo] = useState<AppVersion | null>(null);
  useEffect(() => {
    if (!open || info) return;
    fetch("/app-version.json", { cache: "no-store" }).then((r) => r.json()).then(setInfo).catch(() => setInfo({}));
  }, [open, info]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[200] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Smartphone className="size-5 text-app-accent" />Movie max app</DialogTitle>
          <DialogDescription>
            Android app{info?.versionName ? ` · version ${info.versionName}` : ""}. Watch, download and get new movie alerts.
          </DialogDescription>
        </DialogHeader>
        <Button asChild className="app-gradient h-12 gap-2 rounded-xl text-base font-bold text-app-accent-foreground">
          <a href="/downloads/MovieMax.apk" download="MovieMax.apk" type="application/vnd.android.package-archive" onClick={() => setTimeout(() => onOpenChange(false), 400)}>
            <Download className="size-5" />Download app
          </a>
        </Button>
        <Button variant="secondary" onClick={openInApp} className="h-11 gap-2 rounded-xl">
          <ExternalLink className="size-4" />Already installed? Open in app
        </Button>
        <p className="text-xs text-muted-foreground">
          After downloading, open MovieMax.apk and tap Install. If asked, allow installing from this browser.
        </p>
      </DialogContent>
    </Dialog>
  );
}

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Public R2 file: Lovable asset URLs do not exist on independent deployments.
export const desktopSetup = { url: "https://pub-12f7d967af73467f908bdcc926df41e7.r2.dev/media/admin/4fd8e34b-67e1-48ae-9ae7-5f4c56c7a526-MovieMax-Setup.exe" };

/** Device type comes from the browser itself, never the window width, so a resized desktop browser still gets the desktop setup. */
export function desktopMode(): "windows" | "electron" | null {
  const ua = navigator.userAgent;
  if (/Electron/i.test(ua)) return "electron";
  return /Windows NT/i.test(ua) && !/Mobile|Android/i.test(ua) ? "windows" : null;
}

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const [mode, setMode] = useState<"web" | "android" | "native" | "desktop" | "electron">("web");
  useEffect(() => {
    const desk = desktopMode();
    setMode(isNativeApp() ? "native" : isAndroidBrowser() ? "android" : desk === "electron" ? "electron" : desk === "windows" ? "desktop" : "web");
  }, []);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const sync = () => {
      let remembered = false;
      try { remembered = localStorage.getItem("moviemax-app-installed") === "yes"; } catch { /* unavailable */ }
      setInstalled(remembered || standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    };
    const ready = (event: Event) => {
      event.preventDefault(); setInstalled(false); setPrompt(event as InstallPrompt);
      try { localStorage.removeItem("moviemax-app-installed"); } catch { /* unavailable */ }
    };
    const done = () => {
      setInstalled(true); setPrompt(null);
      try { localStorage.setItem("moviemax-app-installed", "yes"); } catch { /* unavailable */ }
    };
    sync();
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    standalone.addEventListener("change", sync);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
      standalone.removeEventListener("change", sync);
    };
  }, []);
  const install = async () => {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") {
        setInstalled(true);
        try { localStorage.setItem("moviemax-app-installed", "yes"); } catch { /* unavailable */ }
      }
    } finally { setPrompt(null); setBusy(false); }
  };
  if (mode === "native") return <Button size="sm" variant="secondary" aria-label="Check app updates" onClick={() => (window as unknown as { MovieMaxApp?: { checkUpdates?: () => void } }).MovieMaxApp?.checkUpdates?.()} className="h-9 shrink-0 gap-1 rounded-full bg-app-install px-2 text-[11px] font-bold text-app-install-foreground"><Download className="size-3.5" />App</Button>;
  if (mode === "electron") return null;
  if (mode === "desktop") {
    // Real installable Windows desktop app (single setup .exe installer).
    return (
      <span className="shrink-0 rounded-full bg-app-install" title="Install the Movie max desktop app for Windows">
        <Button asChild size="sm" variant="secondary" className="h-9 w-auto gap-1 px-2 rounded-full bg-app-install font-bold uppercase tracking-normal text-app-install-foreground hover:bg-app-install/90 sm:h-8 sm:px-3.5 sm:text-[12px] [&_svg]:size-5 sm:[&_svg]:size-3.5">
          <a href={desktopSetup.url} download="MovieMax-Setup.exe" aria-label="Install the Movie max desktop app">
            <Download aria-hidden="true" strokeWidth={2} />
            <span className="inline">Install</span>
          </a>
        </Button>
      </span>
    );
  }
  if (mode === "android") {
    return (
      <span className="shrink-0 rounded-full bg-app-install" title="Download the Movie max app">
        <AndroidAppDialog open={androidOpen} onOpenChange={setAndroidOpen} />
        <Button size="sm" variant="secondary" onClick={() => setAndroidOpen(true)} aria-label="Download the Movie max app"
          className="h-9 w-auto gap-1 px-2 rounded-full bg-app-install font-bold uppercase tracking-normal text-app-install-foreground hover:bg-app-install/90 sm:h-8 sm:w-auto sm:px-3.5 sm:text-[12px] [&_svg]:size-5 sm:[&_svg]:size-3.5">
          <Download aria-hidden="true" strokeWidth={2} />
          <span className="inline">App</span>
        </Button>
      </span>
    );
  }
  if (installed) return null;
  return (
    <span className="shrink-0 rounded-full bg-app-install" title={!prompt ? "App installation is not available in this browser yet" : "Install MOVIE MAX"}>
      <Button size="sm" variant="secondary" onClick={() => void install()} disabled={installed || !prompt || busy}
        aria-label={installed ? "App installed" : "Download app"}
        className="h-9 w-auto gap-1 px-2 rounded-full bg-app-install font-bold uppercase tracking-normal text-app-install-foreground hover:bg-app-install/90 disabled:opacity-100 sm:h-8 sm:w-auto sm:px-3.5 sm:text-[12px] [&_svg]:size-5 sm:[&_svg]:size-3.5">
        <Download aria-hidden="true" strokeWidth={2} />
        <span className="inline">App</span>
      </Button>
    </span>
  );
}