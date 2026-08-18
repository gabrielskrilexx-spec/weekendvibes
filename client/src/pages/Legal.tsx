import React from "react";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";

const updatedAt = "17 de agosto de 2026";

export default function Legal() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 bg-zinc-950/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 transition hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar para a agenda
          </a>
          <span className="text-xl font-black tracking-[-0.06em] text-orange-200">WeekendVibes<span className="text-yellow-200">.</span></span>
        </div>
      </header>

      <section className="border-b border-white/10 px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-200">Informações legais</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.06em] text-white sm:text-6xl">Privacidade e uso do WeekendVibes</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400">Transparência sobre os dados tratados e as regras para utilizar a agenda de eventos de Santos e Guarujá.</p>
          <p className="mt-4 text-sm text-zinc-500">Última atualização: {updatedAt}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Navegação da página legal" className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:sticky lg:top-6">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Nesta página</p>
          <div className="grid gap-2 text-sm">
            <a href="#privacidade" className="rounded-lg px-2 py-2 text-zinc-300 transition hover:bg-white/[0.06] hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Política de Privacidade</a>
            <a href="#termos" className="rounded-lg px-2 py-2 text-zinc-300 transition hover:bg-white/[0.06] hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Termos de Uso</a>
            <a href="#contato" className="rounded-lg px-2 py-2 text-zinc-300 transition hover:bg-white/[0.06] hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Contato</a>
          </div>
        </nav>

        <article className="space-y-12 text-[15px] leading-7 text-zinc-300">
          <section id="privacidade" aria-labelledby="privacy-title" className="scroll-mt-8">
            <div className="mb-5 flex items-center gap-3"><ShieldCheck className="text-orange-200" size={24} aria-hidden="true" /><h2 id="privacy-title" className="text-2xl font-black text-white sm:text-3xl">Política de Privacidade</h2></div>
            <p>Esta política explica, de forma resumida, como o WeekendVibes trata informações quando você consulta a agenda, utiliza filtros, abre detalhes de eventos ou entra na área administrativa. O texto deve ser complementado pelos dados formais do controlador e revisado juridicamente antes de ser usado como documento definitivo de conformidade.</p>
            <h3 className="mt-8 text-lg font-black text-white">1. Dados tratados</h3>
            <p className="mt-2">Podemos tratar dados técnicos necessários ao funcionamento, como endereço IP, navegador, horários de acesso e registros de segurança. Quando você realiza login, o serviço pode receber dados básicos de identificação fornecidos pelo provedor de autenticação, como identificador da conta, nome e e-mail, quando disponibilizados.</p>
            <p className="mt-3">A agenda também processa informações públicas sobre eventos, locais, datas, imagens e links de origem. Esses dados são utilizados para organizar a descoberta de eventos e indicar a fonte verificável ao visitante.</p>
            <h3 className="mt-8 text-lg font-black text-white">2. Finalidades e bases</h3>
            <p className="mt-2">Os dados são utilizados para disponibilizar a agenda, manter a segurança, autenticar administradores, corrigir falhas, medir desempenho e cumprir obrigações aplicáveis. Métricas não essenciais somente devem ser ativadas após uma escolha afirmativa no banner de consentimento.</p>
            <h3 className="mt-8 text-lg font-black text-white">3. Compartilhamento e fornecedores</h3>
            <p className="mt-2">O serviço pode utilizar provedores técnicos de hospedagem, autenticação, mapas, armazenamento, observabilidade e processamento de conteúdo. O compartilhamento deve ser limitado ao necessário para cada finalidade, com controles de acesso e contratos adequados. Não vendemos dados pessoais.</p>
            <h3 className="mt-8 text-lg font-black text-white">4. Segurança e retenção</h3>
            <p className="mt-2">Aplicamos controles como cookies de sessão protegidos, validação de entradas, limitação de requisições, cabeçalhos de segurança, respostas sem detalhes internos e redaction de logs. Os dados devem ser mantidos somente pelo período necessário às finalidades, à segurança e às obrigações legais.</p>
            <h3 className="mt-8 text-lg font-black text-white">5. Direitos do titular</h3>
            <p className="mt-2">Você pode solicitar informações sobre o tratamento de seus dados, correção, eliminação quando aplicável, revogação de consentimento e demais direitos previstos na legislação. O atendimento depende da confirmação de identidade e das exceções legais aplicáveis.</p>
          </section>

          <section id="termos" aria-labelledby="terms-title" className="scroll-mt-8 border-t border-white/10 pt-12">
            <div className="mb-5 flex items-center gap-3"><FileText className="text-orange-200" size={24} aria-hidden="true" /><h2 id="terms-title" className="text-2xl font-black text-white sm:text-3xl">Termos de Uso</h2></div>
            <h3 className="text-lg font-black text-white">1. Objetivo do serviço</h3>
            <p className="mt-2">O WeekendVibes é uma plataforma de descoberta e organização de eventos musicais e de entretenimento na Baixada Santista. As informações são apresentadas para facilitar a pesquisa e podem sofrer alterações pelos organizadores ou estabelecimentos.</p>
            <h3 className="mt-8 text-lg font-black text-white">2. Responsabilidade pelas informações</h3>
            <p className="mt-2">A fonte original, o organizador e o estabelecimento são responsáveis pelas condições comerciais, horários, preços, disponibilidade, classificação etária e realização do evento. Confirme os dados diretamente no link de origem antes de comprar ingressos ou se deslocar.</p>
            <h3 className="mt-8 text-lg font-black text-white">3. Uso permitido</h3>
            <p className="mt-2">Você deve utilizar a plataforma de forma legítima, sem tentar contornar controles de acesso, sobrecarregar a infraestrutura, extrair dados em volume abusivo, inserir conteúdo malicioso ou utilizar a agenda para finalidades ilícitas.</p>
            <h3 className="mt-8 text-lg font-black text-white">4. Links externos</h3>
            <p className="mt-2">A plataforma pode apontar para sites de ingressos, redes sociais e estabelecimentos. Esses ambientes possuem políticas próprias; o WeekendVibes não controla suas práticas, disponibilidade ou conteúdo.</p>
            <h3 className="mt-8 text-lg font-black text-white">5. Alterações</h3>
            <p className="mt-2">Podemos atualizar estes termos para refletir mudanças no produto, na legislação ou nos provedores utilizados. A data de atualização será exibida no início desta página.</p>
          </section>

          <section id="contato" aria-labelledby="contact-title" className="border-t border-white/10 pt-12">
            <h2 id="contact-title" className="text-2xl font-black text-white sm:text-3xl">Contato e solicitações</h2>
            <p className="mt-4">Para dúvidas sobre privacidade, solicitações de titulares ou correções de informações de eventos, utilize o e-mail <a href="mailto:weekendvibes.of@gmail.com" className="font-semibold text-orange-200 underline decoration-orange-200/60 underline-offset-4 transition hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">weekendvibes.of@gmail.com</a>.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
