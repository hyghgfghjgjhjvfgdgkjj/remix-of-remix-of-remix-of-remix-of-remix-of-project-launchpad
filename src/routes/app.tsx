import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Monitor, Smartphone, Tv, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desktopSetup } from "@/components/youku/InstallAppButton";
import movieMaxLogo from "@/assets/moviemax-logo.png";
import { APP_PREVIEWS, ANDROID_STEPS, WINDOWS_STEPS, PhoneDevice, DesktopDevice, TvDevice } from "@/components/app-page/Mockups";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Download the MOVIE MAX App — Android & Windows" },
      { name: "description", content: "Preview and download the official MOVIE MAX apps for Android and Windows with real step-by-step installation screenshots." },
      { property: "og:title", content: "Download the MOVIE MAX App" },
      { property: "og:description", content: "Android and Windows apps with real device previews and step-by-step install screenshots." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppPage,
});

function StepNo({ n }: { n: number }) {
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">{n}</span>;
}

function AppPage() {
  return (
    <main className="-mt-7 min-h-screen w-full overflow-x-clip bg-background pb-20 text-foreground lg:mt-0">
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
        <Link to="/" className="flex items-center gap-2.5 text-sm font-bold text-foreground">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <img src={movieMaxLogo} alt="MOVIE MAX" className="h-7 w-auto" draggable={false} />
          <span className="tracking-wide">MOVIE MAX</span>
        </Link>
        <nav className="flex items-center gap-2 text-xs font-semibold sm:gap-4 sm:text-sm">
          <a href="#mobile" className="text-muted-foreground transition-colors hover:text-foreground">Android</a>
          <a href="#desktop" className="text-muted-foreground transition-colors hover:text-foreground">Windows</a>
          <a href="#tv" className="text-muted-foreground transition-colors hover:text-foreground">TV</a>
        </nav>
      </header>

      <section className="relative w-full border-b border-border/60 bg-linear-to-b from-primary/10 via-background to-background px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
        <div className="grid w-full items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-xs font-bold uppercase tracking-widest text-primary sm:text-sm">MOVIE MAX apps</p>
            <h1 className="mt-2 text-4xl font-black leading-tight tracking-tight sm:text-5xl xl:text-6xl">
              Watch &amp; download on phone and PC.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Official standalone apps for Android and Windows with faster streaming, offline downloads, Luganda, Luo &amp; Teso rails, and Live TV.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2 rounded-full">
                <a href="/downloads/MovieMax.apk" download="MovieMax.apk"><Smartphone className="size-4" />Download for Android</a>
              </Button>
              <Button asChild size="lg" variant="secondary" className="gap-2 rounded-full">
                <a href={desktopSetup.url}><Monitor className="size-4" />Download for Windows</a>
              </Button>
              <Button size="lg" variant="outline" disabled className="gap-2 rounded-full">
                <Tv className="size-4" />TV · Coming soon
              </Button>
            </div>
          </div>
          <div className="relative lg:col-span-7">
            <div className="pointer-events-none absolute inset-6 -z-0 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-center sm:gap-0">
              <DesktopDevice src={APP_PREVIEWS.desktop} alt="Movie max Windows desktop app preview" className="w-full sm:w-[79%] sm:max-w-[700px]" />
              <PhoneDevice src={APP_PREVIEWS.mobile} alt="Movie max Android mobile app preview" statusBar className="z-20 max-w-[235px] shrink-0 sm:-ml-14 sm:w-[27%] sm:max-w-[205px]" />
            </div>
          </div>
        </div>
      </section>

      <section id="mobile" className="w-full border-b border-border/60 px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <div className="grid w-full items-center gap-8 rounded-3xl border border-border/70 bg-card/55 p-6 sm:p-8 lg:grid-cols-12 lg:p-10">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2 text-primary">
              <Smartphone className="size-6" />
              <h2 className="text-2xl font-black text-foreground sm:text-3xl">MOVIE MAX for Android</h2>
            </div>
            <p className="mt-3 text-muted-foreground">
              Browse Trending, Luganda, Luo, Teso, Music, and Live TV inside the dedicated mobile app — with background downloads and new-movie notifications.
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary" />Includes every step to pass Google Play Protect safely.
            </p>
            <Button asChild size="lg" className="mt-6 gap-2 rounded-full">
              <a href="/downloads/MovieMax.apk" download="MovieMax.apk"><Download className="size-4" />Download Android app</a>
            </Button>
          </div>
          <div className="flex justify-center lg:col-span-7">
            <PhoneDevice src={APP_PREVIEWS.mobile} alt="Movie max Android app screen preview" statusBar className="max-w-[260px] sm:max-w-[285px]" />
          </div>
        </div>

        <h3 className="mt-12 text-xl font-black sm:text-2xl">Android Installation Procedure</h3>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ANDROID_STEPS.map((step, i) => (
            <article key={step.title} className="flex flex-col rounded-2xl border border-border bg-card p-4">
              <PhoneDevice src={step.img} alt={`Android install step ${i + 1}: ${step.title}`} compact className="max-w-[220px]" />
              <div className="mt-4 flex items-start gap-2.5">
                <StepNo n={i + 1} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="desktop" className="w-full border-b border-border/60 bg-card/30 px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <div className="grid w-full items-center gap-8 rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8 lg:grid-cols-12 lg:p-10">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2 text-primary">
              <Monitor className="size-6" />
              <h2 className="text-2xl font-black text-foreground sm:text-3xl">MOVIE MAX for Windows</h2>
            </div>
            <p className="mt-3 text-muted-foreground">
              Standalone desktop software built for big screens — full sidebar categories, built-in HD player, multiple simultaneous downloads, and desktop shortcut.
            </p>
            <Button asChild size="lg" className="mt-6 gap-2 rounded-full">
              <a href={desktopSetup.url}><Download className="size-4" />Download for Windows</a>
            </Button>
          </div>
          <div className="lg:col-span-7">
            <DesktopDevice src={APP_PREVIEWS.desktop} alt="Movie max Windows desktop app screen preview" className="max-w-[760px]" />
          </div>
        </div>

        <h3 className="mt-12 text-xl font-black sm:text-2xl">Windows Installation Procedure</h3>
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {WINDOWS_STEPS.map((step, i) => (
            <article key={step.title} className="flex flex-col rounded-2xl border border-border bg-card p-4">
              <DesktopDevice src={step.img} alt={`Windows install step ${i + 1}: ${step.title}`} compact />
              <div className="mt-4 flex items-start gap-2.5">
                <StepNo n={i + 1} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="tv" className="w-full px-4 pt-14 sm:px-6 lg:px-10 lg:pt-20">
        <div className="grid w-full items-center gap-8 rounded-3xl border border-border bg-linear-to-br from-primary/15 via-card to-accent/15 p-6 sm:p-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Tv className="size-9 text-primary" />
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">MOVIE MAX for TV</h2>
            <p className="mt-2 text-muted-foreground">Coming soon to Android TV, Google TV, and smart TVs with remote-ready navigation.</p>
            <span className="mt-5 inline-block rounded-full bg-muted px-4 py-1.5 text-sm font-bold text-foreground">Coming soon</span>
          </div>
          <div className="lg:col-span-7">
            <TvDevice className="max-w-[600px]">
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
                <img src={movieMaxLogo} alt="MOVIE MAX TV" className="h-12 w-auto" draggable={false} />
                <p className="text-lg font-black text-foreground">MOVIE MAX TV</p>
                <p className="text-xs text-muted-foreground">Big-screen TV experience · Coming soon</p>
              </div>
            </TvDevice>
          </div>
        </div>
      </section>
    </main>
  );
}
