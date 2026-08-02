import { createClientAction } from "@/app/actions";

export default function NovoClientePage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-6">
      <h1 className="mb-6 text-lg font-semibold">Novo cliente</h1>

      <form action={createClientAction} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="nome">
            Nome *
          </label>
          <input
            id="nome"
            name="nome"
            required
            className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="empresa">
            Empresa
          </label>
          <input
            id="empresa"
            name="empresa"
            className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="segmento">
            Segmento
          </label>
          <input
            id="segmento"
            name="segmento"
            className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="aniversario_pessoal">
              Aniversário (pessoal)
            </label>
            <input
              id="aniversario_pessoal"
              name="aniversario_pessoal"
              type="date"
              className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="aniversario_empresa">
              Aniversário (empresa)
            </label>
            <input
              id="aniversario_empresa"
              name="aniversario_empresa"
              type="date"
              className="w-full rounded border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Cadastrar
        </button>
      </form>
    </main>
  );
}
