import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import EventDetail from "./pages/EventDetail";
import Admin from "./pages/Admin";
import AccessDenied from "./pages/AccessDenied";
import SessionExpired from "./pages/SessionExpired";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/eventos/:slug" component={EventDetail} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route path="/acesso-negado" component={AccessDenied} /><Route path="/sessao-expirada" component={SessionExpired} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark" switchable><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
