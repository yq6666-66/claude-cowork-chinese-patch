const { shouldSkipMissing } = require("../src/translate/missing-filter");

test("filters private command and API noise from missing collection", () => {
  const noisy = [
    "$env:GITHUB_TOKEN=\"github_pat_secret\"",
    "- ✓ Connected fetch: uvx mcp-server-fetch",
    "{ \"message\": \"Bad credentials\", \"documentation_url\":",
    "events_url\":",
    "login\": \"user\", \"id\": 1, \"avatar_url\":",
    "goals_1.sqlite-wal",
    "1780744880166_image.png",
    "status\": \"401\" }",
    "remove",
    "daily-briefing",
    "Summarize my calendar and inbox for the day",
    "appcypher/awesome-mcp-servers",
    "Checking MCP server health... cmd /c npx tool --stdio",
    "Access to this website is blocked by your network egress settings. You can adjust this in",
    "A。",
  ];

  for (const item of noisy) {
    expect(shouldSkipMissing(item)).toBe(true);
  }
});

test("keeps short stable UI labels eligible for missing collection", () => {
  const stableUi = ["Classic", "Document", "More ways to open", "Open", "Type something else...", "User scope"];

  for (const item of stableUi) {
    expect(shouldSkipMissing(item)).toBe(false);
  }
});
