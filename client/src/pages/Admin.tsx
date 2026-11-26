import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { postAdminJson } from "@/lib/admin-rest";
import { friendlyAdminErrorMessage } from "@/lib/adminFeedback";
import { clearBeforeInstallPrompt, subscribeToBeforeInstallPrompt, type BeforeInstallPromptEvent } from "@/lib/pwa-install";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast as sonnerToast } from "sonner";
const AdminRoutinePanel = lazy(() => import("@/components/AdminRoutinePanel"));
const ManualReviewPanel = lazy(() => import("@/components/ManualReviewPanel"));
const GenreDiscoveryPanel = lazy(() => import("@/components/GenreDiscoveryPanel"));
const HeartbeatTimelinePanel = lazy(() => import("@/components/HeartbeatTimelinePanel"));
const AdminLiveLogsPanel = lazy(() => import("@/components/AdminLiveLogsPanel"));
const AdminReportsPanel = lazy(() => import("@/components/AdminReportsPanel"));
const AdminDryRunPanel = lazy(() => import("@/components/AdminDryRunPanel"));
const AdminHealthPanel = lazy(() => import("@/components/AdminHealthPanel"));
const AdminAlertsPanel = lazy(() => import("@/components/AdminAlertsPanel"));
const AdminSourcesPanel = lazy(() => import("@/components/AdminSourcesPanel"));
const LocationAliasesPanel = lazy(() => import("@/components/LocationAliasesPanel"));
const CollisionReviewPanel = lazy(() => import("@/components/CollisionReviewPanel"));
const AdminCircuitBreakerPanel = lazy(() => import("@/components/AdminCircuitBreakerPanel"));
const DraftEventsPanel = lazy(() => import("@/components/DraftEventsPanel"));
const AdminPushPanel = lazy(() => import("@/components/AdminPushPanel"));

const ADMIN_TABS = [
  { key: "saude", label: "Saúde & Push" },
  { key: "ingestao", label: "Ingestão & Cron" },
  { key: "curadoria", label: "Curadoria & Ranking" },
  { key: "telemetria", label: "Telemetria" },
  { key: "tudo", label: "Tudo" },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["key"];

function readAdminTab() {
  if (typeof window === "undefined") return "saude" as AdminTab;
  const requested = new URLSearchParams(window.location.search).get("tab");
  return ADMIN_TABS.some(tab => tab.key === requested) ? requested as AdminTab : "saude";
}

type SearchableAdminPanel = {
  tab: Exclude<AdminTab, "tudo">;
  terms: string[];
};

const SEARCHABLE_ADMIN_PANELS: SearchableAdminPanel[] = [
  { tab: "saude", terms: ["saúde", "health", "monitor", "transições", "meta", "oauth", "alertas", "push", "notificações", "vapid", "dispositivos"] },
  { tab: "ingestao", terms: ["ingestão", "manual", "cron", "rotinas", "frequência", "ledger", "heartbeat", "histórico", "logs", "execução", "ocr", "dry-run", "fontes"] },
  { tab: "curadoria", terms: ["curadoria", "revisão", "pendências", "rascunhos", "eventos", "colisões", "aliases", "gestão", "enriquecimento", "radar", "descoberta", "trap", "rap", "funk", "eletrônica"] },
  { tab: "telemetria", terms: ["telemetria", "relatórios", "gráfico", "exportação", "csv", "json", "fontes", "circuit", "breaker", "waf", "meta 110", "rede", "timeout"] },
];

function normalizeAdminSearch(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

type FormState = { title: string; slug: string; description: string; eventDate: string; locationName: string; address: string; city: "Santos" | "Guarujá"; category: "show" | "balada" | "evento_musical"; genre: "funk" | "house_eletronica" | "samba_pagode" | "rap_trap"; priceCents: number; sourceUrl: string; imageUrl: string; latitude: string; longitude: string };
const emptyForm: FormState = { title: "", slug: "", description: "", eventDate: "", locationName: "", address: "", city: "Santos", category: "show", genre: "funk", priceCents: 0, sourceUrl: "", imageUrl: "", latitude: "", longitude: "" };

function eventRowsCountForReview(rows: Array<{ isPublished?: number | null }> | undefined) {
  return (rows ?? []).filter(event => event.isPublished === 0).length;
}

function AdminPanelFallback() {
  return <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">Carregando módulos administrativos…</div>;
}

function SuspendedAdminPanel({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AdminPanelFallback />}>{children}</Suspense>;
}

export function mediaOriginLabel(sourceType: string | null | undefined) {
  const value = String(sourceType ?? "").toLowerCase();
  if (value.includes("highlight") || value.includes("destaque")) return "Destaque";
  if (value.includes("story")) return "Story";
  return "Post";
}

export function mediaOriginClass(origin: string) {
  if (origin === "Story") return "border-fuchsia-300/40 bg-gradient-to-r from-fuchsia-500/20 via-orange-400/20 to-yellow-300/20 text-fuchsia-100";
  if (origin === "Destaque") return "border-violet-300/30 bg-violet-400/15 text-violet-100";
  return "border-blue-300/30 bg-blue-400/15 text-blue-100";
}

function AdminLoginScreen() {
  const isPreviewBuild = !import.meta.env.PROD;
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installPending, setInstallPending] = useState(false);
  const [standalone, setStandalone] = useState(() => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches);
  const { returnTo, oauthError } = typeof window !== "undefined"
    ? (() => {
        const currentUrl = new URL(window.location.href);
        const error = currentUrl.searchParams.get("oauth_error");
        currentUrl.searchParams.delete("oauth_error");
        const search = currentUrl.searchParams.toString();
        return { returnTo: `${currentUrl.pathname}${search ? `?${search}` : ""}${currentUrl.hash}`, oauthError: error };
      })()
    : { returnTo: "/admin", oauthError: null };
  const oauthLoginUrl = `/api/oauth/login?redirect_to=${encodeURIComponent(returnTo)}`;
  const oauthErrorMessage = oauthError === "bad_verification_code"
    ? "O código do GitHub expirou ou já foi usado. Inicie o login novamente."
    : oauthError === "oauth_state_invalid"
      ? "A sessão de login expirou. Inicie o login novamente."
      : oauthError
        ? "Não foi possível concluir o login do GitHub. Tente novamente."
        : null;
  const startDevLogin = () => {
    window.location.assign(`/api/auth/dev-login?redirect_to=${encodeURIComponent(returnTo)}`);
  };

  useEffect(() => {
    const unsubscribe = subscribeToBeforeInstallPrompt(setInstallEvent);
    const onAppInstalled = () => {
      clearBeforeInstallPrompt();
      setStandalone(true);
    };
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      unsubscribe();
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const installAdminApp = async () => {
    if (!installEvent || installPending) return;
    setInstallPending(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setStandalone(true);
    } finally {
      clearBeforeInstallPrompt();
      setInstallPending(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-zinc-950 px-4 py-10 text-zinc-100 sm:flex sm:items-center sm:justify-center" data-testid="admin-login-screen">
      <section className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-orange-950/20">
        <div className="h-1 bg-gradient-to-r from-yellow-300 via-orange-500 to-fuchsia-500" />
        <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-orange-300">WeekendVibes Admin</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Acesse o painel administrativo</h1>
          <p className="mx-auto mt-4 max-w-md leading-7 text-zinc-400">
            Entre para revisar eventos, acompanhar ingestões e administrar as fontes monitoradas. Esta tela permanece em <code className="text-orange-200">/admin</code> após a instalação do app.
          </p>
          {oauthErrorMessage ? (
            <div role="alert" aria-live="assertive" className="mx-auto mt-5 max-w-md rounded-xl border border-red-300/30 bg-red-300/10 px-4 py-3 text-left text-sm text-red-100">
              {oauthErrorMessage}
            </div>
          ) : null}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={oauthLoginUrl}
              data-testid="admin-oauth-login"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-fuchsia-600 px-5 py-3 text-sm font-black text-white transition hover:from-orange-600 hover:to-fuchsia-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
            >
              Entrar como administrador
            </a>
            {isPreviewBuild ? (
              <button
                type="button"
                onClick={startDevLogin}
                data-testid="dev-admin-login"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
              >
                Entrar em modo de desenvolvimento
              </button>
            ) : null}
            <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200">
              Ver agenda pública
            </Link>
          </div>
          {!standalone && installEvent ? (
            <button
              type="button"
              onClick={() => void installAdminApp()}
              disabled={installPending}
              aria-busy={installPending}
              data-testid="admin-install-app"
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-5 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-wait disabled:opacity-60"
            >
              <Download size={16} aria-hidden="true" />
              {installPending ? "Abrindo instalação..." : "Instalar App Admin"}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function Admin() {
  const auth = trpc.auth.me.useQuery(); const events = trpc.events.list.useQuery({ size: 100 }, { enabled: auth.data?.isAdmin === true }); const utils = trpc.useUtils();
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>(readAdminTab);
  const [adminSearch, setAdminSearch] = useState("");
  const normalizedAdminSearch = normalizeAdminSearch(adminSearch);
  const showTab = (tab: Exclude<AdminTab, "tudo">) => activeTab === "tudo" || activeTab === tab;
  const panelMatchesSearch = (tab: Exclude<AdminTab, "tudo">, ...terms: string[]) => {
    if (!showTab(tab)) return false;
    if (!normalizedAdminSearch) return true;
    const queryTokens = normalizedAdminSearch.split(/\s+/).filter(Boolean);
    return terms.some(term => {
      const normalizedTerm = normalizeAdminSearch(term);
      return queryTokens.some(token => normalizedTerm.includes(token));
    });
  };
  const hasSearchMatch = SEARCHABLE_ADMIN_PANELS.some(panel => panelMatchesSearch(panel.tab, ...panel.terms));
  useEffect(() => {
    if (auth.data?.isAdmin !== true) return;
    const current = new URL(window.location.href);
    const requested = current.searchParams.get("tab");
    if (requested !== activeTab) {
      current.searchParams.set("tab", activeTab);
      window.history.replaceState({}, "", `${current.pathname}?${current.searchParams.toString()}${current.hash}`);
    }
  }, [activeTab, auth.data?.isAdmin]);
  const pendingReviewCount = eventRowsCountForReview(events.data);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; title: string } | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const create = trpc.events.create.useMutation({ onSuccess: () => { setNotice("Evento adicionado com sucesso."); sonnerToast.success("Evento adicionado", { description: "O evento já está disponível na listagem administrativa." }); setForm(emptyForm); setEditingId(null); void events.refetch(); }, onError: error => { setNotice(`Não foi possível adicionar: ${error.message}`); sonnerToast.error("Não foi possível adicionar", { description: error.message }); } });
  const importOneOff = trpc.events.importOneOffUrl.useMutation({ onSuccess: result => { setOneOffOpen(false); setOneOffUrl(""); setOneOffGenre(undefined); setOneOffCity(undefined); setNotice("URL importada com sucesso."); sonnerToast.success("Evento importado", { description: `${result.title} foi ${result.created ? "adicionado" : "atualizado"} diretamente na vitrine.` }); void events.refetch(); }, onError: error => { const message = error.message?.trim() || "Não foi possível importar a URL avulsa."; setNotice(`Não foi possível importar: ${message}`); sonnerToast.error("Falha na importação", { description: message }); } });
  const update = trpc.events.update.useMutation({ onSuccess: () => { setNotice("Alterações salvas com sucesso."); sonnerToast.success("Evento atualizado", { description: "As alterações foram salvas." }); setForm(emptyForm); setEditingId(null); void events.refetch(); }, onError: error => { setNotice(`Não foi possível editar: ${error.message}`); sonnerToast.error("Não foi possível editar", { description: error.message }); } });
  const remove = trpc.events.remove.useMutation({
    onSuccess: result => {
      setNotice(result.success ? "Evento removido com sucesso." : "O evento já não estava disponível.");
      setPendingDelete(null);
      if (result.success) utils.events.list.setData({ size: 100 }, current => current?.filter(event => String(event.id) !== result.deletedId));
      void events.refetch();
    },
      onError: error => { setPendingDelete(null); setNotice(`Não foi possível remover o evento: ${error.message}`); },
  });
  const [bulkAction, setBulkAction] = useState<"approve" | "remove" | null>(null);
  const runBulkAction = async (action: "approve" | "remove") => {
    if (bulkAction || selectedEventIds.length === 0) return;
    setBulkAction(action);
    const path = action === "approve" ? "/api/v2/admin/approve-events" : "/api/v2/admin/remove-events";
    try {
      const result = await postAdminJson<{ success: true; count: number; ids: string[] }>(path, { ids: selectedEventIds });
      setNotice(`${result.count} evento(s) ${action === "approve" ? "aprovados" : "removidos"} com sucesso.`);
      sonnerToast.success(action === "approve" ? "Eventos aprovados" : "Eventos removidos", { description: `${result.count} registro(s) ${action === "approve" ? "publicado(s)" : "excluído(s)"}.` });
      setSelectedEventIds([]);
      if (action === "remove") utils.events.list.setData({ size: 100 }, current => current?.filter(event => !result.ids.includes(String(event.id))));
      if (action === "approve") utils.events.list.setData({ size: 100 }, current => current?.map(event => result.ids.includes(String(event.id)) ? { ...event, isPublished: 1 } : event));
      void events.refetch();
    } catch (error) {
      const message = friendlyAdminErrorMessage(error, "Tente novamente.");
      setNotice(`Não foi possível ${action === "approve" ? "aprovar" : "remover"} os eventos: ${message}`);
      sonnerToast.error(action === "approve" ? "Falha na aprovação em massa" : "Falha na remoção em massa", { description: message });
    } finally {
      setBulkAction(null);
    }
  };
  const enrich = trpc.events.enrich.useMutation({ onSuccess: () => { setNotice("Dados extraídos com sucesso. Revise o formulário antes de salvar."); sonnerToast.success("Dados extraídos", { description: "Revise os campos preenchidos automaticamente." }); }, onError: error => { setNotice(`Não foi possível extrair os dados: ${error.message}`); sonnerToast.error("Falha ao extrair dados", { description: error.message }); } });
  const [form, setForm] = useState<FormState>(emptyForm); const [editingId, setEditingId] = useState<number | null>(null); const [rawText, setRawText] = useState(""); const [oneOffOpen, setOneOffOpen] = useState(false); const [oneOffUrl, setOneOffUrl] = useState(""); const [oneOffGenre, setOneOffGenre] = useState<FormState["genre"]>(); const [oneOffCity, setOneOffCity] = useState<FormState["city"]>();
  const eventRows = events.data ?? [];
  const bulkPending = bulkAction !== null || remove.isPending;
  const allEventsSelected = eventRows.length > 0 && eventRows.every(event => selectedEventIds.includes(event.id));
  const toggleEventSelection = (id: number) => setSelectedEventIds(current => current.includes(id) ? current.filter(selectedId => selectedId !== id) : [...current, id]);
  const toggleAllEvents = () => setSelectedEventIds(allEventsSelected ? [] : eventRows.map(event => event.id));
  useEffect(() => { if (enrich.data) setForm(current => ({ ...current, title: String(enrich.data.title ?? current.title), slug: String(enrich.data.title ?? current.title).toLowerCase().replace(/[^a-z0-9]+/g, "-"), description: String(enrich.data.summary ?? current.description), eventDate: String(enrich.data.eventDate ?? current.eventDate).slice(0, 16), locationName: String(enrich.data.locationName ?? current.locationName), address: String(enrich.data.address ?? current.address), city: (enrich.data.city === "Guarujá" ? "Guarujá" : "Santos"), category: (enrich.data.category as FormState["category"]) ?? current.category, genre: (enrich.data.genre as FormState["genre"]) || current.genre, priceCents: Number(enrich.data.priceCents ?? current.priceCents) })); }, [enrich.data]);
  if (auth.isLoading) return <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-300">Validando acesso...</main>;
  if (auth.error || !auth.data) return <AdminLoginScreen />;
  if (!auth.data.isAdmin) return <main className="grid min-h-screen place-items-center bg-zinc-950 px-6 text-center text-zinc-100"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">WeekendVibes Admin</p><h1 className="mt-3 text-3xl font-black">Acesso administrativo necessário</h1><p className="mt-3 text-zinc-400">Esta conta não possui permissão para acessar o painel.</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-200">Voltar para a agenda</Link></div></main>;
  const set = (key: keyof FormState, value: string | number) => setForm(current => ({ ...current, [key]: value }));
  const submit = () => { if (!form.title.trim() || !form.slug.trim() || !form.eventDate || !form.locationName.trim() || !form.city.trim()) { setNotice("Preencha título, slug, data, local e cidade."); return; } if (Number(form.priceCents) < 0) { setNotice("O preço não pode ser negativo."); return; } const data = { ...form, eventDate: new Date(form.eventDate), priceCents: Number(form.priceCents), isPublished: 1 }; editingId ? update.mutate({ id: editingId, data }) : create.mutate(data); };
  return <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6"><div className="mx-auto max-w-6xl"><Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Agenda pública</Link><div className="mt-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Backstage</p><h1 className="mt-2 text-4xl font-black tracking-tight">Painel de eventos</h1></div><div className="mt-5"><label className="relative block"><span className="sr-only">Buscar painéis administrativos</span><input type="search" role="searchbox" aria-label="Buscar painéis administrativos" value={adminSearch} onChange={event => setAdminSearch(event.target.value)} placeholder="Buscar painéis..." className="field min-h-11 w-full rounded-2xl border-white/10 bg-white/[0.04] pl-4 pr-4 text-sm placeholder:text-zinc-500 focus:border-orange-300/50 focus:ring-2 focus:ring-orange-300/20" /></label></div><nav aria-label="Seções administrativas" data-testid="admin-tabs" className="sticky top-0 z-20 mt-5 -mx-1 overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/90 p-1.5 shadow-xl shadow-black/20 backdrop-blur-xl"><div className="flex min-w-max gap-1">{ADMIN_TABS.map(tab => <button key={tab.key} type="button" data-testid={`admin-tab-${tab.key}`} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => setActiveTab(tab.key)} className={`min-h-10 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black transition sm:px-4 ${activeTab === tab.key ? "bg-orange-300 text-zinc-950" : "text-zinc-300 hover:bg-white/10 hover:text-white"}`}>{tab.label}{tab.key === "curadoria" && pendingReviewCount > 0 ? <span className="ml-2 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[10px] text-white">{pendingReviewCount}</span> : null}</button>)}</div></nav>{normalizedAdminSearch && !hasSearchMatch ? <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-300/10 px-4 py-3 text-sm text-orange-100">Nenhum painel corresponde a “{adminSearch}” nesta aba.</div> : null}<span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-xs font-bold text-fuchsia-100">{events.isError ? "Falha ao carregar eventos" : events.isLoading ? "Carregando eventos…" : `${events.data?.length ?? 0} publicados`}</span></div><SuspendedAdminPanel>{panelMatchesSearch("saude", "push", "notificações", "vapid", "dispositivos") ? <AdminPushPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("curadoria", "revisão", "pendências", "curadoria") ? <ManualReviewPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("curadoria", "radar", "descoberta", "trap", "rap", "funk", "eletrônica") ? <GenreDiscoveryPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("curadoria", "rascunhos", "gestão", "eventos") ? <DraftEventsPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("ingestao", "rotinas", "cron", "manual", "frequência") ? <AdminRoutinePanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{(panelMatchesSearch("saude", "transições", "saúde", "heartbeat") || panelMatchesSearch("ingestao", "histórico", "heartbeat", "execuções")) ? <HeartbeatTimelinePanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("ingestao", "logs", "ocr", "execuções", "histórico") ? <AdminLiveLogsPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("saude", "saúde", "monitor", "transições") ? <AdminHealthPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("telemetria", "relatórios", "gráfico", "exportação", "csv", "json") ? <AdminReportsPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("ingestao", "dry-run", "ingestão", "simular") ? <AdminDryRunPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("saude", "alertas", "meta", "oauth") ? <AdminAlertsPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("telemetria", "circuit", "breaker", "waf", "timeout", "rede") ? <AdminCircuitBreakerPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("telemetria", "colisões", "waf", "meta 110") ? <CollisionReviewPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("saude", "fontes", "freshness", "fontes monitoradas", "sem novidades", "82 fontes", "integração") ? <AdminSourcesPanel /> : null}</SuspendedAdminPanel><SuspendedAdminPanel>{panelMatchesSearch("telemetria", "aliases", "localização", "fontes") ? <LocationAliasesPanel /> : null}</SuspendedAdminPanel>{panelMatchesSearch("curadoria", "gestão", "eventos", "novo evento") && <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">{editingId ? "Editar evento" : "Novo evento"}</h2>{!editingId && <button type="button" onClick={() => setOneOffOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-fuchsia-300/30 px-4 py-2 text-xs font-black text-fuchsia-100 hover:bg-fuchsia-300/10"><Plus size={15} /> Importar link avulso</button>}{editingId && <button onClick={() => { setEditingId(null); setForm(emptyForm); }} className="text-zinc-400"><X size={18} /></button>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Título" className="field" /><input value={form.slug} onChange={e => set("slug", e.target.value)} placeholder="Slug" className="field" /><input type="datetime-local" value={form.eventDate} onChange={e => set("eventDate", e.target.value)} className="field" /><input value={form.locationName} onChange={e => set("locationName", e.target.value)} placeholder="Local" className="field" /><input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Endereço" className="field" /><select value={form.city} onChange={e => set("city", e.target.value as FormState["city"])} className="field"><option value="Santos">Santos</option><option value="Guarujá">Guarujá</option></select><select value={form.category} onChange={e => set("category", e.target.value)} className="field"><option value="show">Show</option><option value="balada">Balada</option><option value="evento_musical">Evento musical</option></select><select value={form.genre} onChange={e => set("genre", e.target.value)} className="field"><option value="funk">Funk</option><option value="house_eletronica">House/Eletrônica</option><option value="samba_pagode">Samba/Pagode</option><option value="rap_trap">Rap/Trap</option></select><input type="number" value={form.priceCents} onChange={e => set("priceCents", Number(e.target.value))} placeholder="Preço em centavos" className="field" /><input value={form.sourceUrl} onChange={e => set("sourceUrl", e.target.value)} placeholder="URL de ingresso" className="field" /><input value={form.imageUrl} onChange={e => set("imageUrl", e.target.value)} placeholder="URL da imagem" className="field" /><textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descrição" className="field min-h-24 sm:col-span-2" /></div><button onClick={submit} disabled={!form.title || !form.slug || !form.eventDate || !form.locationName || create.isPending || update.isPending} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-fuchsia-500 px-5 py-3 text-sm font-black disabled:opacity-40">{(create.isPending || update.isPending) ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}{editingId ? "Salvar alterações" : "Adicionar evento"}</button>{notice && <div role="status" aria-live="polite" className={`mt-3 rounded-xl border px-4 py-3 text-sm ${notice.includes("sucesso") || notice.includes("removido") ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-orange-300/20 bg-orange-300/10 text-orange-100"}`}>{notice}</div>}</section>}{panelMatchesSearch("curadoria", "enriquecer", "fonte", "eventos") && <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7"><div className="flex items-center gap-2"><Sparkles size={18} className="text-yellow-200" /><h2 className="font-black">Enriquecer uma fonte bruta</h2></div><textarea value={rawText} onChange={e => setRawText(e.target.value)} placeholder="Cole aqui o texto de uma página, release ou importação..." className="field mt-4 min-h-28 w-full" /><button disabled={enrich.isPending || rawText.length < 20} onClick={() => enrich.mutate({ rawText })} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-yellow-300 px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-40">{enrich.isPending && <Loader2 size={16} className="animate-spin" />} {enrich.isPending ? "Processando..." : "Extrair e preencher formulário"}</button></section>}{panelMatchesSearch("curadoria", "gestão", "eventos", "selecionar") && <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"><div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><label className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-zinc-300"><input type="checkbox" checked={allEventsSelected} onChange={toggleAllEvents} disabled={eventRows.length === 0 || bulkPending} aria-label="Selecionar todos os eventos" className="h-5 w-5 accent-orange-400" /> <span>Selecionar todos</span></label><span className="text-xs text-zinc-500">{selectedEventIds.length} selecionado(s)</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void runBulkAction("approve")} disabled={selectedEventIds.length === 0 || bulkPending} aria-busy={bulkAction === "approve"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-zinc-950 disabled:cursor-wait disabled:opacity-40">{bulkAction === "approve" && <Loader2 size={14} className="animate-spin" />} {bulkAction === "approve" ? "Aprovando..." : "Aprovar selecionados"}</button><button type="button" onClick={() => { if (selectedEventIds.length > 0 && window.confirm(`Remover ${selectedEventIds.length} evento(s) selecionado(s)?`)) void runBulkAction("remove"); }} disabled={selectedEventIds.length === 0 || bulkPending} aria-busy={bulkAction === "remove"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/30 px-3 py-2 text-xs font-black text-red-100 disabled:cursor-wait disabled:opacity-40">{bulkAction === "remove" && <Loader2 size={14} className="animate-spin" />} {bulkAction === "remove" ? "Removendo..." : "Excluir selecionados"}</button></div></div><div className="divide-y divide-white/10">{events.isError ? <div role="alert" className="p-5 text-sm text-rose-100">Falha técnica ao carregar os eventos: {friendlyAdminErrorMessage(events.error, "tente novamente em instantes.")} <button type="button" onClick={() => void events.refetch()} className="ml-2 rounded-lg border border-rose-200/30 px-3 py-2 font-bold hover:bg-rose-300/10">Tentar novamente</button></div> : events.isLoading ? <div role="status" className="p-5 text-sm text-zinc-400">Carregando eventos…</div> : eventRows.length > 0 ? eventRows.map(event => <div key={event.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><input type="checkbox" checked={selectedEventIds.includes(event.id)} onChange={() => toggleEventSelection(event.id)} disabled={bulkPending} aria-label={`Selecionar ${event.title}`} className="mt-1 h-5 w-5 shrink-0 accent-orange-400" />{event.imageUrl ? <img src={event.imageUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover" /> : <div aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-dashed border-white/10 text-[10px] font-black uppercase text-zinc-600">Sem arte</div>}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-bold text-white">{event.title}</p><span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${mediaOriginClass(mediaOriginLabel(event.sourceType))}`}>{mediaOriginLabel(event.sourceType)}</span></div><p className="text-xs text-zinc-500">{event.city} · {event.category} · {new Date(event.eventDate).toLocaleDateString("pt-BR")}</p></div></div><div className="flex flex-wrap gap-2 pl-8 sm:pl-0"><button onClick={() => { setEditingId(event.id); setForm({ ...emptyForm, ...event, city: event.city === "Guarujá" ? "Guarujá" : "Santos", description: event.description ?? "", address: event.address ?? "", sourceUrl: event.sourceUrl ?? "", imageUrl: event.imageUrl ?? "", latitude: event.latitude ?? "", longitude: event.longitude ?? "", genre: (event.genre as FormState["genre"]) || "funk", eventDate: new Date(event.eventDate).toISOString().slice(0, 16), priceCents: event.priceCents }); }} disabled={bulkPending} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 disabled:opacity-40"><Pencil size={14} /> Editar</button><button type="button" onClick={() => { if (remove.isPending || bulkPending) return; setPendingDelete({ id: event.id, title: event.title }); }} disabled={remove.isPending || bulkPending} aria-busy={remove.isPending} aria-label={`Remover ${event.title}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-200 disabled:cursor-wait disabled:opacity-50">{remove.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {remove.isPending ? "Removendo..." : "Remover"}</button></div></div>) : <div className="p-5 text-sm text-zinc-500">Nenhum evento publicado encontrado para a agenda atual.</div>}</div></section>}{oneOffOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="one-off-title"><section className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between gap-3"><h2 id="one-off-title" className="text-lg font-black">Importar link avulso</h2><button type="button" onClick={() => { if (!importOneOff.isPending) setOneOffOpen(false); }} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10" aria-label="Fechar importação"><X size={18} /></button></div><p className="mt-2 text-sm text-zinc-400">A fonte será consultada diretamente e o evento será salvo apenas em <code>events</code>, sem criar fonte ativa.</p><div className="mt-5 grid gap-3"><input type="url" value={oneOffUrl} onChange={event => setOneOffUrl(event.target.value)} placeholder="https://gandaya.dance/events/..." aria-label="URL pública do evento" className="field" /><select value={oneOffCity ?? ""} onChange={event => setOneOffCity((event.target.value || undefined) as FormState["city"] | undefined)} className="field" aria-label="Cidade opcional"><option value="">Cidade da fonte</option><option value="Santos">Santos</option><option value="Guarujá">Guarujá</option></select><select value={oneOffGenre ?? ""} onChange={event => setOneOffGenre((event.target.value || undefined) as FormState["genre"] | undefined)} className="field" aria-label="Gênero opcional"><option value="">Gênero da fonte</option><option value="funk">Funk</option><option value="house_eletronica">House/Eletrônica</option><option value="samba_pagode">Samba/Pagode</option><option value="rap_trap">Rap/Trap</option></select></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setOneOffOpen(false)} disabled={importOneOff.isPending} className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold">Cancelar</button><button type="button" onClick={() => importOneOff.mutate({ url: oneOffUrl, cityOverride: oneOffCity, genreOverride: oneOffGenre, publishImmediately: true })} disabled={importOneOff.isPending || !/^https:\/\//i.test(oneOffUrl.trim())} aria-busy={importOneOff.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-fuchsia-400 px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-40">{importOneOff.isPending && <Loader2 size={16} className="animate-spin" />}{importOneOff.isPending ? "Importando..." : "Importar e publicar"}</button></div></section></div>}<AlertDialog open={pendingDelete !== null} onOpenChange={open => { if (!open && !remove.isPending) setPendingDelete(null); }}><AlertDialogContent className="border-white/10 bg-zinc-900 text-zinc-100"><AlertDialogHeader><AlertDialogTitle>Remover evento?</AlertDialogTitle><AlertDialogDescription className="text-zinc-400">Você está prestes a remover <strong className="text-zinc-100">{pendingDelete?.title}</strong>. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} onClick={event => { event.preventDefault(); if (pendingDelete) remove.mutate({ id: pendingDelete.id }); }}>{remove.isPending ? <><Loader2 size={14} className="mr-2 animate-spin" /> Removendo...</> : "Sim, remover"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></main>;
}
