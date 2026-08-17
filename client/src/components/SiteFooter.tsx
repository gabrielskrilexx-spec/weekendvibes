import React from "react";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-4 pb-28 pt-8 text-sm text-zinc-500 sm:px-6 sm:pb-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>WeekendVibes. Descubra o que vai rolar na Baixada Santista.</p>
        <nav aria-label="Links legais" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="/legal#privacidade" className="transition hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Política de Privacidade</a>
          <a href="/legal#termos" className="transition hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Termos de Uso</a>
        </nav>
      </div>
    </footer>
  );
}
