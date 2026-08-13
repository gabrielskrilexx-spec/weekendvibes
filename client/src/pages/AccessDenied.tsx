import { ArrowLeft, Home, LockKeyhole } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AccessDenied() {
  const [, setLocation] = useLocation();

  return (
    <main className="min-h-screen w-full bg-background px-4 py-10 text-foreground sm:flex sm:items-center sm:justify-center">
      <Card className="mx-auto w-full max-w-xl overflow-hidden border-border/70 bg-card/95 shadow-2xl shadow-purple-950/10">
        <CardContent className="relative px-6 py-10 text-center sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-yellow-300 to-fuchsia-500" />
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300" aria-hidden="true">
            <LockKeyhole className="h-8 w-8" />
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-orange-600 dark:text-orange-300">Acesso protegido</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Esse rolê é reservado</h1>
          <p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
            Sua conta está conectada, mas não tem permissão para acessar esta área. Volte para a agenda pública ou escolha outra página do WeekendVibes.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={() => setLocation("/")} className="bg-gradient-to-r from-orange-500 to-fuchsia-600 text-white hover:from-orange-600 hover:to-fuchsia-700">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Voltar para a agenda
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
