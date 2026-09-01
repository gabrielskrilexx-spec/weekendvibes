import React from "react";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-4 pb-28 pt-8 text-sm text-zinc-500 sm:px-6 sm:pb-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <a href="/" aria-label="WeekendVibes" className="group inline-flex text-xl font-black tracking-[-0.06em] text-zinc-900 transition-[opacity,filter] duration-200 hover:opacity-90 hover:drop-shadow-[0_0_12px_rgba(251,146,60,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-white dark:hover:drop-shadow-[0_0_12px_rgba(253,186,116,0.35)]">
            <span className="text-orange-700 dark:text-orange-200">W</span>eekend<span className="text-orange-700 dark:text-orange-200">V</span>ibes<span className="text-yellow-700 dark:text-yellow-200">.</span>
          </a>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">Descubra o que vai rolar na Baixada Santista.</p>
        </div>
        <nav aria-label="Links legais" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="/legal#privacidade" className="transition hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Política de Privacidade</a>
          <a href="/legal#termos" className="transition hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Termos de Uso</a>
        </nav>
      </div>
    </footer>
  );
}
