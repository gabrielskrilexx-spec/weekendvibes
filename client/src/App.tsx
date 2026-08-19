import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AccessDenied from "./pages/AccessDenied";
import SessionExpired from "@/pages/SessionExpired";
import Legal from "@/pages/Legal";
import CookieConsent from "./components/CookieConsent";
import LegalConsentGate from "./components/LegalConsentGate";

const EventDetail = lazy(() => import("@/pages/EventDetail"));
const Admin = lazy(() => import("@/pages/Admin"));

function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6" role="status" aria-live="polite">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-zinc-300 shadow-xl">
        Carregando esta área…
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/eventos/:slug" component={EventDetail} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/health" component={Admin} />
        <Route path="/404" component={NotFound} />
        <Route path="/acesso-negado" component={AccessDenied} />
        <Route path="/sessao-expirada" component={SessionExpired} />
        <Route path="/legal" component={Legal} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark" switchable><TooltipProvider><Toaster /><Router /><CookieConsent /><LegalConsentGate /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
