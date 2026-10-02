import { expect, test, type Page } from "@playwright/test";

/**
 * Fluxos essenciais no navegador, com os dados de demonstração do seed.
 * Senha de todas as contas: Alento2026.
 */
async function signIn(page: Page, portal: "paciente" | "profissional" | "administracao", email: string) {
  await page.goto(portal === "paciente" ? "/entrar" : `/entrar?perfil=${portal}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("Alento2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

test("site apresenta a clínica, os valores e a demonstração do anonimato", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conte o que precisa. Mostre só o que quiser.");
  await page.getByText("Anônimo", { exact: true }).first().click();
  await expect(page.getByText("Jacarandá-27").first()).toBeVisible();
  await expect(page.getByText("Todos os direitos reservados").first()).toBeVisible();

  await page.goto("/valores");
  await expect(page.getByText("Psicoterapia individual").first()).toBeVisible();
  await expect(page.getByText(/R\$\s?220,00/).first()).toBeVisible();
});

test("áreas logadas exigem login e cada perfil fica na própria área", async ({ page }) => {
  await page.goto("/profissional/agenda");
  await expect(page).toHaveURL(/\/entrar\?perfil=profissional/);

  await signIn(page, "administracao", "admin@alento.example");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/profissional");
  await expect(page).toHaveURL(/\/admin$/);
});

test("credenciais de profissional no portal do paciente são recusadas", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("helena@alento.example");
  await page.getByLabel("Senha", { exact: true }).fill("Alento2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Esta é uma conta de profissional.")).toBeVisible();
});

test("o profissional vê o paciente anônimo só pelo codinome", async ({ page }) => {
  await signIn(page, "profissional", "thiago@alento.example");
  await page.goto("/profissional/pacientes");
  await expect(page.getByText("Jequitibá-41")).toBeVisible();
  await expect(page.getByText("João")).toHaveCount(0);
});

test("o paciente vê como aparece e pode ajustar a privacidade", async ({ page }) => {
  await signIn(page, "paciente", "mariana@alento.example");
  await expect(page.getByRole("heading", { name: "Olá, Mari" })).toBeVisible();
  await page.goto("/paciente/privacidade");
  await expect(page.getByText("pediu para ver: CPF, Endereço")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Prévia/ })).toBeVisible();
});

test("esqueci minha senha responde do mesmo jeito para qualquer e-mail", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await page.waitForURL(/esqueci-a-senha/);
  await page.getByLabel("E-mail").fill("alguem-que-nao-existe@alento.example");
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText("Se houver uma conta com alguem-que-nao-existe@alento.example")).toBeVisible();
  await expect(page.getByText("Todos os direitos reservados").first()).toBeVisible();
});

test("a administração cadastra profissional sem definir senha (o acesso é por convite)", async ({ page }) => {
  await signIn(page, "administracao", "admin@alento.example");
  await page.goto("/admin/profissionais/novo");
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  await page.getByLabel("Nome completo").fill("Profissional de Teste Automatizado");
  await page.getByLabel("Nome de exibição").fill("Teste Automatizado");
  await page.getByLabel("E-mail de acesso").fill(`e2e.${Date.now()}@alento.example`);
  await page.getByLabel("Título").fill("Psicóloga clínica");
  await page.getByLabel("Registro no conselho").fill("CRP 06/000999");
  await page.getByRole("button", { name: "Cadastrar profissional" }).click();
  // Com SMTP configurado o convite sai; sem SMTP (como na CI) a tela avisa que o e-mail não foi enviado.
  await expect(page.getByText(/Enviamos o convite|NÃO foi enviado/)).toBeVisible();
  await expect(page.getByText(/senha provisória/i)).toHaveCount(0);
});
