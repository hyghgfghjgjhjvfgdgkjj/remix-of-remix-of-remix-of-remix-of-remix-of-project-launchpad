import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getFbAuth, firebaseConfig } from '@/lib/firebase';
import { signInWithGoogleButton } from '@/lib/google-one-tap';
import { fdb } from '@/lib/fdb';
import type { PlansSetting } from '@/lib/admin';
import { SubscribeModal } from '@/components/auth/SubscribeModal';
import { Button } from '@/components/ui/button';
import logo from '@/assets/moviemax-logo.png';

export const Route = createFileRoute('/desktop-account')({
  head: () => ({ meta: [
    { title: 'Movie max Desktop — Secure account and membership' },
    { name: 'description', content: 'Verify your Movie max desktop account and manage membership securely.' },
    { property: 'og:title', content: 'Movie max Desktop — Secure account and membership' },
    { property: 'og:description', content: 'Secure account verification and membership for Movie max desktop.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: DesktopAccount,
});

type DesktopBridge = { session: () => Promise<Record<string, unknown> | null>; ready: () => Promise<void>; close: () => void };
function DesktopAccount() {
  const { user, profile, loading } = useAuth();
  const [action, setAction] = useState('google');
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(true);
  const [allowContinue, setAllowContinue] = useState(false);
  const attempted = useRef(false);
  const bridge = () => (window as unknown as { movieMaxDesktop?: DesktopBridge }).movieMaxDesktop;
  const plans = useQuery({
    queryKey: ['desktop-configured-plans'], enabled: hydrated && action === 'plans' && !!user,
    queryFn: async () => {
      const result = await fdb.from('app_settings').select('*').eq('key', 'plans').maybeSingle();
      const value = result.data?.['value'] as PlansSetting | undefined;
      if (result.error || !value?.vip?.length || !value.svip?.length) throw new Error('Membership prices are temporarily unavailable. Please retry.');
      return value;
    }, retry: 1,
  });
  useEffect(() => {
    setAction(new URLSearchParams(window.location.search).get('action') === 'plans' ? 'plans' : 'google');
    document.documentElement.classList.add('desktop-account');
    void (async () => {
      const session = await bridge()?.session();
      if (session && getFbAuth().currentUser?.uid !== session['uid'] && !sessionStorage.getItem('desktop-session-restored')) {
        // Firebase's standard persistence store, scoped to this site's origin only.
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('firebaseLocalStorageDb', 1);
          request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('firebaseLocalStorage')) request.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' }); };
          request.onerror = () => reject(new Error('Could not restore your account'));
          request.onsuccess = () => {
            const transaction = request.result.transaction('firebaseLocalStorage', 'readwrite');
            transaction.objectStore('firebaseLocalStorage').put({ fbase_key: `firebase:authUser:${firebaseConfig.apiKey}:[DEFAULT]`, value: session });
            transaction.oncomplete = () => { request.result.close(); resolve(); };
            transaction.onerror = () => reject(new Error('Could not restore your account'));
          };
        });
        sessionStorage.setItem('desktop-session-restored', 'yes');
        window.location.reload(); return;
      }
      setHydrated(true);
    })().catch((e: unknown) => { setError(e instanceof Error ? e.message : 'Sign-in could not finish'); setHydrated(true); });
    return () => document.documentElement.classList.remove('desktop-account');
  }, []);
  const google = async () => {
    setError('');
    try { if (!(await signInWithGoogleButton())) setError('Google could not connect. Please try again.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Google sign-in is unavailable'); }
  };
  useEffect(() => {
    if (!hydrated || loading || action !== 'google' || user || attempted.current) return;
    attempted.current = true; void google();
  }, [hydrated, loading, action, user]);
  useEffect(() => {
    if (!hydrated || loading || action !== 'google' || !user || !profile?.phone) return;
    const timer = window.setTimeout(() => void bridge()?.ready(), 1200);
    return () => window.clearTimeout(timer);
  }, [hydrated, loading, action, user, profile]);
  useEffect(() => {
    if (!hydrated || loading || action !== 'google' || !user || profile) return;
    const timer = window.setTimeout(() => setAllowContinue(true), 3500);
    return () => window.clearTimeout(timer);
  }, [hydrated, loading, action, user, profile]);
  return <main className="desktop-account-screen min-h-dvh bg-background text-foreground grid place-items-center p-6">
    <div className="w-full max-w-sm text-center">
      <img src={logo} alt="Movie max" className="mx-auto mb-6 size-20 object-contain" />
      <h1 className="text-xl font-semibold">{action === 'plans' ? 'Movie max membership' : user ? 'Account verification' : 'Connecting to Google'}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{user ? profile?.phone ? 'Verified. Returning to Movie max…' : 'Complete your account verification to continue.' : 'Choose your Google account to continue.'}</p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {!user && hydrated && <Button onClick={() => void google()} variant="outline" className="google-desktop-button mt-6 gap-2"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>Continue with Google</Button>}
      {action === 'google' && user && !profile && allowContinue && <Button className="mt-6" onClick={() => void bridge()?.ready()}>Continue to Movie max</Button>}
      {action === 'plans' && plans.isError && <><p role="alert" className="mt-4 text-sm text-destructive">{plans.error.message}</p><Button className="mt-4" onClick={() => void plans.refetch()}>Retry prices</Button></>}
      {action === 'plans' && plans.data && user && <SubscribeModal open={open} plansOverride={plans.data} onPaid={() => void bridge()?.ready()} onOpenChange={(value) => { setOpen(value); if (!value) bridge()?.close(); }} />}
      <Button variant="ghost" className="mt-4 block mx-auto" onClick={() => bridge()?.close()}>Close</Button>
    </div>
  </main>;
}