// Browser tests (tests/e2e): the page is opened straight from index.html, on a
// desktop-sized window and on an emulated phone.
// Set CHROME_PATH to use a Chrome already installed instead of Playwright's own.

const { defineConfig, devices } = require("@playwright/test");

const launchOptions = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};

module.exports = defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  fullyParallel: true,
  reporter: [["list"]],
  projects: [
    {
      name: "desktop",
      testIgnore: /phone\.spec\.js/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 }, launchOptions }
    },
    {
      name: "phone",
      testMatch: /phone\.spec\.js/,
      use: { ...devices["Pixel 7"], launchOptions }
    }
  ]
});
