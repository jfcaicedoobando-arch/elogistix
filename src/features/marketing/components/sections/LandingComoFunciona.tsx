import { PASOS } from "../../routes/landingCopy";

export function LandingComoFunciona() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="pasos-title"
      className="bg-muted/40 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">
            Cómo funciona
          </p>
          <h2
            id="pasos-title"
            className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            De la solicitud al cobro en tres pasos
          </h2>
        </div>

        <div className="relative mt-16 grid gap-10 md:grid-cols-3">
          <div
            aria-hidden="true"
            className="absolute left-[16.66%] right-[16.66%] top-9 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          {PASOS.map((p) => (
            <div key={p.n} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-raised)]">
                <span className="text-2xl font-bold tracking-tight">{p.n}</span>
              </div>
              <h3 className="mb-2 text-xl font-semibold tracking-tight text-foreground">
                {p.title}
              </h3>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
