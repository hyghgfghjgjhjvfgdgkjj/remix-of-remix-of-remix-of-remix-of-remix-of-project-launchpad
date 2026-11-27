# MovieBox homepage feed
- Append MovieBox's web suggestions pager below the existing home sections, using browser-first requests with the existing server fallback. Why: scrolling must retain exact upstream titles and continuation pages.
- Phone website shows FloatNav inside AppTopBar; the native WebView header is logo + search bar + tabs with no FloatNav (subscribe lives in the sections grid). Why: the app must match the MovieBox reference screen exactly.
- Android app shows no WhatsApp/App/referral pop-ups; WhatsApp + referral appear as small landscape cards in the home feed (InAppPromos) and referral keeps only its bottom Share button. Why: owner wants in-app ads, not floats.
- Native search uses AppTopBar's input and submits to /search, whose secondary form is web-only; keep the profile link beside that input. Why: the app must have one search field, not a second search screen to type into.
- Native LIVE links open /live-tv; web external TV links and /channels remain unchanged. Why: TV must play inside the app without replacing its navigation.
- Native LIVE opens /live-tv full screen (no header/nav) in the Android app; the website keeps header + nav. Why: owner wants TV to fill the app.
- InstallAppButton links the desktop setup .exe from public R2 storage, not a Lovable asset URL. Why: `/__l5e/` URLs return "No file" on the independent luofilm.site deployment.
- Home page renders one dark, crisp (no-blur) floating billboard (`AppDownloadBanner` in `src/routes/index.tsx`) with a 5s auto-timeout and Download App button opening `/app`, shown only on the website (not in Android native app or Electron). `MovieMaxTvPrompt` skips `/`. Why: owner wants one bold commercial app-download banner on the website home page.
