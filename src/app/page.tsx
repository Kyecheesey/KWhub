const hubCards = [
  {
    title: "Team Hub",
    description: "Staff details, roles, onboarding notes and internal contacts.",
    button: "Open Team Hub",
  },
  {
    title: "Policies & Procedures",
    description: "Central place for company policies, guides, templates and SOPs.",
    button: "View Policies",
  },
  {
    title: "Client Projects",
    description: "Track active client work, website builds, automations and support jobs.",
    button: "View Projects",
  },
  {
    title: "AI Tools",
    description: "Internal AI tools for documents, workflows, client support and automation.",
    button: "Open AI Tools",
  },
];

const tasks = [
  "Build staff onboarding checklist",
  "Add client project tracker",
  "Create document and policy library",
  "Add AI assistant later",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            KW | Innovations
          </p>

          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Internal Hub
            </h1>

            <p className="max-w-3xl text-lg text-zinc-300">
              A central workspace for staff, clients, projects, documents,
              procedures and internal AI tools.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <button className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-cyan-300">
              Get Started
            </button>

            <button className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
              View Roadmap
            </button>
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {hubCards.map((card) => (
            <article
              key={card.title}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl"
            >
              <h2 className="text-xl font-bold">{card.title}</h2>
              <p className="mt-3 min-h-24 text-sm leading-6 text-zinc-400">
                {card.description}
              </p>
              <button className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">
                {card.button}
              </button>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-2">
            <h2 className="text-2xl font-bold">Today&apos;s Focus</h2>
            <p className="mt-2 text-zinc-400">
              Start by building the core pages for your team and clients.
            </p>

            <div className="mt-6 grid gap-3">
              {tasks.map((task, index) => (
                <div
                  key={task}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900 p-4"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 font-bold text-zinc-950">
                    {index + 1}
                  </div>
                  <p className="text-zinc-200">{task}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <h2 className="text-2xl font-bold">Hub Status</h2>

            <div className="mt-6 space-y-4">
              <div>
                <p className="text-sm text-zinc-400">Version</p>
                <p className="text-xl font-bold">Starter Build</p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">Access</p>
                <p className="text-xl font-bold">Internal Only</p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">Next Step</p>
                <p className="text-xl font-bold">Add Login</p>
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
