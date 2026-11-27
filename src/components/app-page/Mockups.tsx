import previewMobile from "@/assets/app-guide/preview-mobile.jpg";
import previewDesktop from "@/assets/app-guide/preview-desktop.jpg";
import android1 from "@/assets/app-guide/android-1-download.jpg";
import android2 from "@/assets/app-guide/android-2-harmful.jpg";
import android3 from "@/assets/app-guide/android-3-open-apk.jpg";
import android4 from "@/assets/app-guide/android-4-unknown-sources.jpg";
import android5 from "@/assets/app-guide/android-5-play-protect-1.jpg";
import android6 from "@/assets/app-guide/android-6-play-protect-2.jpg";
import android7 from "@/assets/app-guide/android-7-installing.jpg";
import android8 from "@/assets/app-guide/android-8-open.jpg";
import win1 from "@/assets/app-guide/win-1-download.jpg";
import win2 from "@/assets/app-guide/win-2-smartscreen.jpg";
import win3 from "@/assets/app-guide/win-3-welcome.jpg";
import win4 from "@/assets/app-guide/win-4-location.jpg";
import win5 from "@/assets/app-guide/win-5-installing.jpg";
import win6 from "@/assets/app-guide/win-6-finish.jpg";

export const APP_PREVIEWS = {
  mobile: previewMobile,
  desktop: previewDesktop,
} as const;

export const ANDROID_STEPS = [
  { img: android1, title: "Tap Download", text: "Tap Download for Android on this page to start downloading MovieMax.apk." },
  { img: android2, title: "Keep the file", text: "If Chrome warns that the file might be harmful, tap Download anyway." },
  { img: android3, title: "Open MovieMax.apk", text: "Open MovieMax.apk from your browser Downloads list or top notification." },
  { img: android4, title: "Allow this source", text: "Open Settings, switch on Allow from this source for your browser, then go back." },
  { img: android5, title: "Play Protect · More details", text: "If Blocked by Play Protect appears, tap More details to expand it." },
  { img: android6, title: "Tap Install anyway", text: "Tap Install anyway. The app is safe; it is simply installed directly from our site." },
  { img: android7, title: "Installing Movie max", text: "Wait a few seconds while Android finishes installing Movie max." },
  { img: android8, title: "Open & enjoy", text: "Tap Open to launch Movie max with offline downloads and alerts." },
] as const;

export const WINDOWS_STEPS = [
  { img: win1, title: "Download & open setup", text: "Click Download for Windows, then open MovieMax-Setup.exe from your browser downloads." },
  { img: win2, title: "Pass Windows warning", text: "If Windows protected your PC appears, click More info, then click Run anyway." },
  { img: win3, title: "Welcome screen", text: "On Welcome to Movie max Setup, click Next > to continue." },
  { img: win4, title: "Choose install folder", text: "Keep the default Program Files folder and click Install." },
  { img: win5, title: "Wait for install", text: "Wait a moment while Movie max extracts and sets up your desktop app." },
  { img: win6, title: "Finish & launch", text: "Keep Launch Movie max and Create a desktop shortcut ticked, then click Finish." },
] as const;

/** Realistic titanium smartphone hardware frame holding a real screenshot image. */
export function PhoneDevice({
  src,
  alt,
  compact = false,
  statusBar = false,
  className = "",
}: {
  src: string;
  alt: string;
  compact?: boolean;
  statusBar?: boolean;
  className?: string;
}) {
  return (
    <div className={`device-phone ${compact ? "device-phone-compact" : ""} mx-auto w-full select-none ${className}`}>
      <div className={`device-phone-inner flex flex-col ${statusBar ? "aspect-[9/20.4]" : "aspect-[9/19.5]"}`}>
        <div className="device-phone-island" aria-hidden="true" />
        {statusBar && (
          <div className="flex h-7 shrink-0 items-center justify-between bg-background px-4 text-[10px] font-semibold text-foreground/85" aria-hidden="true">
            <span>9:41</span>
            <span>5G</span>
          </div>
        )}
        <img
          src={src}
          alt={alt}
          draggable={false}
          loading={compact ? "lazy" : "eager"}
          className="min-h-0 w-full flex-1 object-cover object-top"
        />
      </div>
    </div>
  );
}

/** Realistic desktop monitor hardware frame holding a real desktop screenshot image. */
export function DesktopDevice({
  src,
  alt,
  compact = false,
  className = "",
}: {
  src: string;
  alt: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full select-none ${className}`}>
      <div className={`device-desktop-bezel ${compact ? "device-desktop-compact" : ""}`}>
        <div className="mx-auto mb-1.5 size-1.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />
        <div className="device-desktop-screen aspect-[16/10]">
          <img
            src={src}
            alt={alt}
            draggable={false}
            loading={compact ? "lazy" : "eager"}
            className="h-full w-full object-cover object-top"
          />
        </div>
      </div>
      <div className={`device-desktop-neck ${compact ? "device-desktop-compact-neck" : ""}`} aria-hidden="true" />
      <div className={`device-desktop-base ${compact ? "device-desktop-compact-base" : ""}`} aria-hidden="true" />
    </div>
  );
}
