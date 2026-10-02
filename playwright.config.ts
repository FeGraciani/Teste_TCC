import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta (navegador real). Exigem o banco com os dados de
 * demonstração (npm run db:setup) e o app compilado (npm run build).
 * Para usar um servidor já em execução: E2E_BASE_URL=http://localhost:3000
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start -- -p 3100",
        url: `${baseURL}/api/saude`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
