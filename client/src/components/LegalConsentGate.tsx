import React, { useEffect, useState } from "react";
import { acceptLegalTerms, completePendingLogin } from "@/const";

export default function LegalConsentGate() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const handleRequired = () => {
      setChecked(false);
      setOpen(true);
    };
    window.addEventListener("weekendvibes:legal-consent-required", handleRequired);
    return () => window.removeEventListener("weekendvibes:legal-consent-required", handleRequired);
  }, []);

  const confirm = () => {
    if (!checked) return;
    acceptLegalTerms();
    setOpen(false);
    completePendingLogin();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="legal-consent-title" aria-describedby="legal-consent-description" className="w-full max-w-lg rounded-3xl border border-white/15 bg-zinc-900 p-6 text-zinc-100 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-200">Antes de continuar</p>
        <h2 id="legal-consent-title" className="mt-3 text-2xl font-black tracking-tight text-white">Confirme os documentos do WeekendVibes</h2>
        <p id="legal-consent-description" className="mt-3 text-sm leading-6 text-zinc-400">Para iniciar o login, leia e aceite os documentos que explicam as regras de uso e o tratamento de dados da plataforma.</p>
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-orange-300/40">
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="mt-1 h-5 w-5 accent-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" />
          <span className="text-sm leading-6 text-zinc-200">Li e aceito os <a href="/legal#termos" target="_blank" rel="noreferrer" className="font-bold text-orange-200 underline decoration-orange-200/50 underline-offset-4 hover:text-orange-100">Termos de Uso</a> e a <a href="/legal#privacidade" target="_blank" rel="noreferrer" className="font-bold text-orange-200 underline decoration-orange-200/50 underline-offset-4 hover:text-orange-100">Política de Privacidade</a>.</span>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Cancelar</button>
          <button type="button" onClick={confirm} disabled={!checked} className="rounded-xl bg-orange-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Aceitar e continuar</button>
        </div>
      </section>
    </div>
  );
}
