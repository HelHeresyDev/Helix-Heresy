"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("@playwright/test");

function format(value) {
  return `${Number(value || 0).toFixed(2)} ms`;
}

async function main() {
  const mode = process.argv.includes("--full") ? "full" : "quick";
  const jsonOnly = process.argv.includes("--json");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    const fixtureUrl = pathToFileURL(path.resolve(__dirname, "../benchmarks/map-population.html")).href;
    await page.goto(fixtureUrl);
    const report = await page.evaluate((benchmarkMode) =>
      window.HelixMapPopulationBenchmark.run(
        document.getElementById("benchmarkCanvas"),
        { mode: benchmarkMode }
      ), mode);
    if (!jsonOnly) {
      console.log(`Helix Heresy map population benchmark (${mode})`);
      console.table(Object.entries(report.scenarios).map(([name, result]) => ({
        scenario: name,
        entities: `${result.population.visibleEntities}/${result.population.entities}`,
        effects: `${result.population.visibleEffects}/${result.population.effects}`,
        query_p95: format(result.stagesMs.queryP95),
        scene_p95: format(result.stagesMs.sceneP95),
        plan_p95: format(result.stagesMs.drawPlanP95),
        draw_p95: format(result.stagesMs.drawP95),
        advisory_budget: result.budgets.scenePass && result.budgets.drawPass ? "pass" : "review"
      })));
      console.log(`Navigation scene + plan p95: ${format(report.navigation.sceneAndPlanP95Ms)}`);
      console.log(`Update index + scene + plan p95: ${format(report.update.indexSceneAndPlanP95Ms)}`);
      console.log(`Structural invariants: ${report.valid ? "pass" : "FAIL"}`);
      console.log("Timing budgets are advisory because host hardware and browser load vary.");
    }
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
