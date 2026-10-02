/** Esqueleto exibido enquanto a próxima tela carrega. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-3">
        <div className="h-8 w-64 max-w-full rounded-lg bg-nevoa-escura" />
        <div className="h-4 w-96 max-w-full rounded bg-nevoa-escura" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-[1.25rem] bg-papel" />
        <div className="h-40 rounded-[1.25rem] bg-papel" />
      </div>
      <div className="h-64 rounded-[1.25rem] bg-papel" />
    </div>
  );
}
