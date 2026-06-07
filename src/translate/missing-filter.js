function shouldSkipMissing(text) {
  const value = String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!value || !/[A-Za-z]/.test(value)) return true;
  if (/[\u4e00-\u9fff]/.test(value)) return true;
  if (value.length > 240) return true;

  const lower = value.toLowerCase();
  const exactNoise = [
    ".codex",
    ".codex_clone_launcher",
    "chrome-devtools",
    "context7",
    "copilot",
    "excel",
    "fetch",
    "figma",
    "filesystem",
    "github",
    "git mcp",
    "github mcp",
    "github ✓",
    "memory",
    "node_repl",
    "pat",
    "playwright mcp",
    "postgres-mcp pro",
    "powershell",
    "powershell code",
    "remove",
    "semgrep",
    "sequentialthinking",
    "server-everything",
    "sources:",
    "sqlite mcp",
    "time",
    "token",
  ];
  if (exactNoise.includes(lower)) return true;

  if (/^(?:\d+s|\d+m\s+\d+s|\d+\s+seconds?\s+ago|\d+\s+of\s+\d+|\d{1,2}:\d{2}\s+[AP]M|\d+d|[\d.]+k)$/i.test(value)) return true;
  if (/^[a-z][a-z0-9]+(?:-[a-z0-9]+)+$/i.test(value)) return true;
  if (/^\(built-in:\s*[\d.]+\)$/i.test(value)) return true;
  if (/^(?:[A-Z]:\\|https?:\/\/|file:\/\/)/i.test(value)) return true;
  if (/[A-Z]:\\/.test(value)) return true;
  if (/^claude-(?:opus|sonnet|haiku)-[\w-]+$/i.test(value)) return true;
  if (/^(?:Claude|Anthropic|Opus|Sonnet|Haiku|MCP|API|URL|GitHub|C3|Anthropic Sans|Anthropic Serif|Claude Light|Claude Dark|Control\+Alt\+Space|Ctrl\+B|e\.g\. JetBrains Mono|Python|Node\.js|Reference_codex_config|User_profile|claude|claude chinese|context|consolidate-memory|setup-cowork|schedule|locate)$/i.test(value)) return true;

  if (/^[A-Za-z0-9_. -]+[。、，：；]$/.test(value)) return true;
  if (/[✓✗✅]/u.test(value) && /\b(?:Connected|Failed to connect)\b/i.test(value)) return true;
  if (/^(?:- )?[✓✗✅]?\s*(?:Connected|Failed to connect)(?:\b|$)/i.test(value)) return true;

  if (/(?:\$env:|github_pat_|Authorization:|Bearer\s+\$env:|GITHUB_TOKEN|GITHUB_PERSONAL_ACCESS_TOKEN|PERSONAL_ACCESS_TOKEN|SEMGREP_APP_TOKEN|CONTEXT7_API_KEY|Bad credentials)/i.test(value)) return true;
  if (/"?(?:message|status|documentation_url|url|avatar_url|node_id|login)"\s*:/.test(value)) return true;
  if (/\b(?:documentation_url|events_url|followers_url|following_url|gists_url|html_url|organizations_url|received_events_url|repos_url|starred_url|subscriptions_url|avatar_url|gravatar_id|installation_id)\b/i.test(value)) return true;
  if (/^[a-z_]+_url":?$/i.test(value)) return true;

  if (/\b(?:cmd \/c|npx|uvx|stdio|curl\.exe|claude mcp|mcp-server|@modelcontextprotocol|node_repl\.exe|headroom Done|Checking MCP server health|server\(s\) imported)\b/i.test(value)) return true;
  if (/\b(?:awesome-mcp-servers|postgres-mcp|playwright-mcp|servers\/src\/time|modelcontextprotocol\/servers)\b/i.test(value)) return true;
  if (/^[a-z0-9_.-]+\/[a-z0-9_.-]+(?:\s+\([^)]+\))?$/i.test(value)) return true;

  if (/^(?:[\w.-]+|\d+_image)\.(?:asar|bak|cjs|exe|gif|jpeg|jpg|js|json|log|mcp\.json|md|png|ps1|sqlite(?:-(?:shm|wal))?|svg|ts|tsx|webp|ya?ml)$/i.test(value)) return true;
  if (/\.(?:asar|bak|cjs|exe|gif|jpeg|jpg|js|json|log|mcp\.json|md|png|ps1|sqlite(?:-(?:shm|wal))?|svg|ts|tsx|webp|ya?ml)(?:\b|$)/i.test(value)) return true;
  if (/\b(?:npm|git status|README|WindowsApps|app\.asar|install\.ps1|restore\.ps1|patch-asar|latest\.json)\b/i.test(value)) return true;

  if (/\b(?:Phase|P\d+\.\d+|M\d+|N\d+|S\d+)\b/.test(value)) return true;
  if (/(?:rename session|preload|buildDir|bundle|needle|asar|exe hash)/i.test(value)) return true;
  if (/^(?:Claude responded:|You said:|I(?:'|\u2019|鈥檤)?(?: am | have |'ve |\u2019ve |鈥檝e |'ll |\u2019ll |鈥檒l )|Let me |Now I|Now let me |Now the |Before I|First,|The good news:|Happy to |To point you |A "what needs)/.test(value)) return true;
  if (/^(?:Set up a scheduled task that gives me|Which tools should this status page pull from|translation layer, patches locale JSON|Access to this website is blocked by your network egress settings)/.test(value)) return true;
  if (/^Summarize my calendar and inbox for the day$/i.test(value)) return true;

  return false;
}

module.exports = {
  shouldSkipMissing,
};
