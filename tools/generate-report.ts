import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

// --- Types matching src/types/report.ts ---

interface HttpExchange {
  request: { method: string; url: string; body?: unknown };
  response: { status: number; body?: unknown };
}

interface TestResult {
  testId: string;
  name: string;
  rfc: string;
  section: string;
  required: boolean;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  error?: string;
  exchanges?: HttpExchange[];
}

interface TestReport {
  server: string;
  serverInfo?: string;
  timestamp: string;
  durationMs: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    requiredPassed: number;
    requiredFailed: number;
    recommendedPassed: number;
    recommendedFailed: number;
  };
  results: TestResult[];
}

// --- CLI args ---

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error(
    "Usage: npx tsx tools/generate-report.ts report1.json [report2.json ...]"
  );
  process.exit(1);
}

// --- Load reports ---

interface ServerInfo {
  name: string;
  report: TestReport;
}

const servers: ServerInfo[] = files.map((f) => {
  const raw = readFileSync(f, "utf-8");
  const report: TestReport = JSON.parse(raw);
  const name = basename(f).replace(/-report\.json$|\.json$/, "");
  return { name, report };
});

// --- Load test sources ---

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else if (full.endsWith(".test.ts")) {
      results.push(full);
    }
  }
  return results;
}

interface SourceInfo {
  path: string;
  source: string;
}

const sourceMap = new Map<string, SourceInfo>();
const testDir = join(process.cwd(), "src/tests");

try {
  const testFiles = walkDir(testDir);
  for (const filePath of testFiles) {
    const source = readFileSync(filePath, "utf-8");
    const relPath = relative(process.cwd(), filePath);

    // Extract category from defineTests call
    const catMatch = source.match(/category:\s*["']([^"']+)["']/);
    if (!catMatch) continue;
    const category = catMatch[1];

    // Extract all test IDs
    const idRegex = /\bid:\s*["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = idRegex.exec(source)) !== null) {
      const testId = `${category}/${m[1]}`;
      sourceMap.set(testId, { path: relPath, source });
    }
  }
} catch {
  // src/tests may not exist when running from a different directory
}

// --- Build test index ---

interface TestInfo {
  testId: string;
  name: string;
  rfc: string;
  section: string;
  required: boolean;
  results: Map<string, TestResult>;
}

const testIndex = new Map<string, TestInfo>();
const categories = new Set<string>();

for (const { name, report } of servers) {
  for (const r of report.results) {
    const cat = r.testId.split("/")[0];
    categories.add(cat);

    let info = testIndex.get(r.testId);
    if (!info) {
      info = {
        testId: r.testId,
        name: r.name,
        rfc: r.rfc,
        section: r.section,
        required: r.required,
        results: new Map(),
      };
      testIndex.set(r.testId, info);
    }
    info.results.set(name, r);
  }
}

// Sort categories and tests within them
const sortedCategories = [...categories].sort();
const testsByCategory = new Map<string, TestInfo[]>();
for (const cat of sortedCategories) {
  const tests = [...testIndex.values()]
    .filter((t) => t.testId.startsWith(cat + "/"))
    .sort((a, b) => a.testId.localeCompare(b.testId));
  testsByCategory.set(cat, tests);
}

// --- Collect unique source files for embedding ---

const sourceFiles = new Map<string, { path: string; source: string }>();
for (const [, info] of sourceMap) {
  if (!sourceFiles.has(info.path)) {
    sourceFiles.set(info.path, info);
  }
}

// --- Emit HTML ---

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rfcUrl(rfc: string, section: string): string {
  const num = rfc.replace(/^RFC/i, "").trim();
  return `https://datatracker.ietf.org/doc/html/rfc${num}#section-${section}`;
}

function statusClass(r: TestResult): string {
  if (r.status === "pass") return "pass";
  if (r.status === "skip") return "skip";
  // fail
  return r.required ? "fail-required" : "fail-recommended";
}

function statusLabel(r: TestResult): string {
  if (r.status === "pass") return "PASS";
  if (r.status === "skip") return "SKIP";
  return "FAIL";
}

let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JMAP Compliance Report</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; font-size: 14px; }
header { background: #1a1a2e; color: #fff; padding: 20px 24px; }
header h1 { font-size: 22px; margin-bottom: 8px; }
header .meta { font-size: 13px; color: #aaa; }
.summary-cards { display: flex; gap: 16px; padding: 16px 24px; flex-wrap: wrap; }
.card { background: #fff; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,.1); min-width: 200px; flex: 1; }
.card h3 { font-size: 14px; margin-bottom: 8px; color: #555; }
.card .stats { display: flex; gap: 12px; flex-wrap: wrap; }
.card .stat { text-align: center; }
.card .stat .num { font-size: 24px; font-weight: 700; }
.card .stat .label { font-size: 11px; color: #888; text-transform: uppercase; }
.stat.pass .num { color: #2e7d32; }
.stat.fail .num { color: #c62828; }
.stat.skip .num { color: #f9a825; }
.controls { padding: 12px 24px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.controls button { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }
.controls button.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
.controls input[type="text"] { padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; width: 220px; }
.table-wrap { padding: 0 24px 24px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
thead th { background: #1a1a2e; color: #fff; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; position: sticky; top: 0; z-index: 2; }
.category-header td { background: #e8eaf6; font-weight: 700; padding: 8px 12px; font-size: 13px; text-transform: uppercase; cursor: pointer; user-select: none; }
.category-header td .arrow { display: inline-block; transition: transform .2s; margin-right: 6px; }
.category-header.collapsed td .arrow { transform: rotate(-90deg); }
tr.test-row td { padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
tr.test-row:hover td { background: #f0f4ff; }
tr.test-row td.test-id { font-family: monospace; cursor: pointer; color: #1565c0; white-space: nowrap; }
tr.test-row td.test-id:hover { text-decoration: underline; }
tr.test-row a { color: #1565c0; text-decoration: none; }
tr.test-row a:hover { text-decoration: underline; }
td.result-cell { text-align: center; font-weight: 600; font-size: 12px; cursor: pointer; min-width: 80px; }
td.result-cell.pass { background: #e8f5e9; color: #2e7d32; }
td.result-cell.fail-required { background: #ffebee; color: #c62828; }
td.result-cell.fail-recommended { background: #fff8e1; color: #f57f17; }
td.result-cell.skip { background: #fff8e1; color: #f9a825; }
td.result-cell.not-run { background: #f5f5f5; color: #bbb; }
.badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; }
.badge.req { background: #e3f2fd; color: #1565c0; }
.badge.rec { background: #f3e5f5; color: #7b1fa2; }
tr.detail-row { display: none; }
tr.detail-row.visible { display: table-row; }
tr.detail-row td { padding: 0; }
.detail-content { padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #eee; font-size: 13px; }
.detail-content .error-msg { background: #fff5f5; border-left: 3px solid #c62828; padding: 8px 12px; margin: 4px 0; font-family: monospace; white-space: pre-wrap; word-break: break-word; font-size: 12px; }
.detail-content .duration { color: #888; font-size: 12px; margin-top: 4px; }
tr.source-row { display: none; }
tr.source-row.visible { display: table-row; }
tr.source-row td { padding: 0; }
.source-content { background: #1e1e1e; color: #d4d4d4; padding: 16px; overflow-x: auto; }
.source-content .source-path { color: #888; font-size: 12px; margin-bottom: 8px; font-family: monospace; }
.source-content pre { font-family: "SF Mono", "Fira Code", "Fira Mono", monospace; font-size: 12px; line-height: 1.5; margin: 0; }
.source-content pre .line-num { color: #666; display: inline-block; width: 3em; text-align: right; margin-right: 1em; user-select: none; }
.source-content pre .highlight-line { background: #2a2d3e; display: block; }
.exchange { border: 1px solid #ddd; border-radius: 4px; margin: 8px 0; overflow: hidden; }
.exchange summary { padding: 6px 10px; background: #f0f0f0; cursor: pointer; font-size: 12px; font-family: monospace; }
.exchange summary:hover { background: #e0e0e0; }
.exchange .exchange-body { padding: 8px 12px; font-size: 12px; }
.exchange .exchange-body pre { background: #1e1e1e; color: #d4d4d4; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 11px; line-height: 1.4; margin: 4px 0; white-space: pre-wrap; word-break: break-word; }
.exchange .exchange-label { font-weight: 600; font-size: 11px; color: #555; margin-top: 6px; }
.hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>JMAP Compliance Report</h1>
  <div class="meta">Generated ${new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")}</div>
</header>
<div class="summary-cards">
`;

// Summary cards
for (const { name, report } of servers) {
  const s = report.summary;
  html += `  <div class="card">
    <h3>${escapeHtml(name)}${report.serverInfo ? ` <span style="font-weight:400;font-size:12px;color:#888">${escapeHtml(report.serverInfo)}</span>` : ""}</h3>
    <div class="stats">
      <div class="stat pass"><div class="num">${s.passed}</div><div class="label">Pass</div></div>
      <div class="stat fail"><div class="num">${s.failed}</div><div class="label">Fail</div></div>
      <div class="stat skip"><div class="num">${s.skipped}</div><div class="label">Skip</div></div>
    </div>
    <div style="margin-top:8px;font-size:12px;color:#888">
      Required: ${s.requiredPassed}/${s.requiredPassed + s.requiredFailed} &middot;
      Recommended: ${s.recommendedPassed}/${s.recommendedPassed + s.recommendedFailed}
    </div>
  </div>
`;
}

html += `</div>
<div class="controls">
  <button class="active" data-filter="all">All</button>
  <button data-filter="fail">Failures</button>
  <button data-filter="pass">Passes</button>
  <input type="text" id="search" placeholder="Filter by test ID...">
</div>
<div class="table-wrap">
<table>
<thead><tr>
  <th>Test ID</th>
  <th>Name</th>
  <th>RFC</th>
  <th>Type</th>
`;

for (const { name } of servers) {
  html += `  <th>${escapeHtml(name)}</th>\n`;
}

html += `</tr></thead>
<tbody>
`;

const serverNames = servers.map((s) => s.name);
const totalCols = 4 + serverNames.length;

for (const cat of sortedCategories) {
  const tests = testsByCategory.get(cat)!;

  html += `<tr class="category-header" data-category="${escapeHtml(cat)}">
  <td colspan="${totalCols}"><span class="arrow">&#9660;</span>${escapeHtml(cat)} (${tests.length})</td>
</tr>
`;

  for (const test of tests) {
    // Determine aggregate status for filtering
    const statuses = serverNames.map((s) => test.results.get(s)?.status);
    const hasFail = statuses.some((s) => s === "fail");
    const allPass = statuses.every((s) => s === "pass");
    const filterClass = hasFail ? "has-fail" : allPass ? "all-pass" : "";

    const srcInfo = sourceMap.get(test.testId);
    const srcFile = srcInfo?.path ?? "";

    html += `<tr class="test-row ${filterClass}" data-category="${escapeHtml(cat)}" data-testid="${escapeHtml(test.testId)}" data-src="${escapeHtml(srcFile)}">
  <td class="test-id">${escapeHtml(test.testId)}</td>
  <td>${escapeHtml(test.name)}</td>
  <td style="white-space:nowrap"><a href="${rfcUrl(test.rfc, test.section)}" target="_blank">${escapeHtml(test.rfc)} &sect;${escapeHtml(test.section)}</a></td>
  <td><span class="badge ${test.required ? "req" : "rec"}">${test.required ? "Required" : "Recommended"}</span></td>
`;

    for (const sName of serverNames) {
      const r = test.results.get(sName);
      if (!r) {
        html += `  <td class="result-cell not-run">-</td>\n`;
      } else {
        html += `  <td class="result-cell ${statusClass(r)}" data-server="${escapeHtml(sName)}" data-testid="${escapeHtml(test.testId)}">${statusLabel(r)}</td>\n`;
      }
    }

    html += `</tr>\n`;

    // Detail rows (one per server, for errors)
    for (const sName of serverNames) {
      const r = test.results.get(sName);
      html += `<tr class="detail-row" data-detail-for="${escapeHtml(test.testId)}__${escapeHtml(sName)}">
  <td colspan="${totalCols}"><div class="detail-content">
    <strong>${escapeHtml(sName)}</strong>: ${r ? statusLabel(r) : "Not run"}
    ${r?.error ? `<div class="error-msg">${escapeHtml(r.error)}</div>` : ""}
    ${r ? `<div class="duration">${r.durationMs}ms</div>` : ""}
  </div></td>
</tr>\n`;
    }

    // Source row (content populated by JS from embedded source data)
    if (srcInfo) {
      const testIdShort = test.testId.split("/").slice(1).join("/");
      html += `<tr class="source-row" data-source-for="${escapeHtml(test.testId)}" data-src-path="${escapeHtml(srcInfo.path)}" data-highlight-id="${escapeHtml(testIdShort)}">
  <td colspan="${totalCols}"><div class="source-content">
    <div class="source-path">${escapeHtml(srcInfo.path)}</div>
    <pre></pre>
  </div></td>
</tr>\n`;
    }
  }
}

html += `</tbody>
</table>
</div>

`;

// Embed source files as a JSON object keyed by path
const sourceData: Record<string, string> = {};
for (const [path, info] of sourceFiles) {
  sourceData[path] = info.source;
}
html += `<script id="source-data" type="application/json">${JSON.stringify(sourceData).replace(/<\//g, "<\\/")}</script>\n`;

// Embed exchange data keyed by testId__serverName
const exchangeData: Record<string, HttpExchange[]> = {};
for (const { name, report } of servers) {
  for (const r of report.results) {
    if (r.exchanges && r.exchanges.length > 0) {
      exchangeData[`${r.testId}__${name}`] = r.exchanges;
    }
  }
}
html += `<script id="exchange-data" type="application/json">${JSON.stringify(exchangeData).replace(/<\//g, "<\\/")}</script>\n`;

html += `<script>
(function() {
  var sourceData = JSON.parse(document.getElementById('source-data').textContent);
  var exchangeData = JSON.parse(document.getElementById('exchange-data').textContent);

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderSource(row) {
    if (row.dataset.rendered) return;
    row.dataset.rendered = '1';
    var path = row.dataset.srcPath;
    var highlightId = row.dataset.highlightId;
    var source = sourceData[path];
    if (!source) return;
    var lines = source.split('\\n');
    var highlightLine = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('"' + highlightId + '"') !== -1 || lines[i].indexOf("'" + highlightId + "'") !== -1) {
        highlightLine = i;
        break;
      }
    }
    var html = '';
    for (var i = 0; i < lines.length; i++) {
      var cls = (i === highlightLine) ? ' class="highlight-line"' : '';
      html += '<span' + cls + '><span class="line-num">' + (i + 1) + '</span>' + escapeHtml(lines[i]) + '\\n</span>';
    }
    row.querySelector('pre').innerHTML = html;
  }
  // Category collapse
  document.querySelectorAll('.category-header').forEach(function(hdr) {
    hdr.addEventListener('click', function() {
      hdr.classList.toggle('collapsed');
      var cat = hdr.dataset.category;
      var collapsed = hdr.classList.contains('collapsed');
      var rows = document.querySelectorAll('tr[data-category="' + cat + '"]:not(.category-header)');
      rows.forEach(function(r) {
        if (collapsed) r.classList.add('hidden');
        else r.classList.remove('hidden');
      });
      // Also hide detail/source rows for this category
      var testIds = document.querySelectorAll('tr.test-row[data-category="' + cat + '"]');
      testIds.forEach(function(tr) {
        var tid = tr.dataset.testid;
        document.querySelectorAll('tr[data-detail-for^="' + tid + '__"]').forEach(function(d) {
          if (collapsed) { d.classList.add('hidden'); d.classList.remove('visible'); }
          else d.classList.remove('hidden');
        });
        var src = document.querySelector('tr[data-source-for="' + tid + '"]');
        if (src) {
          if (collapsed) { src.classList.add('hidden'); src.classList.remove('visible'); }
          else src.classList.remove('hidden');
        }
      });
    });
  });

  function renderExchanges(detailRow, key) {
    if (detailRow.dataset.exchangesRendered) return;
    detailRow.dataset.exchangesRendered = '1';
    var exchanges = exchangeData[key];
    if (!exchanges || exchanges.length === 0) return;
    var container = detailRow.querySelector('.detail-content');
    var html = '<div style="margin-top:8px"><strong>HTTP Exchanges (' + exchanges.length + ')</strong></div>';
    for (var i = 0; i < exchanges.length; i++) {
      var ex = exchanges[i];
      var reqBody = ex.request.body ? JSON.stringify(ex.request.body, null, 2) : '';
      var resBody = ex.response.body ? JSON.stringify(ex.response.body, null, 2) : '';
      var label = ex.request.method + ' ' + ex.request.url.replace(/^https?:\\/\\/[^/]+/, '') + ' → ' + ex.response.status;
      html += '<details class="exchange"><summary>' + escapeHtml(label) + '</summary><div class="exchange-body">';
      html += '<div class="exchange-label">Request</div>';
      html += '<pre>' + escapeHtml(ex.request.method + ' ' + ex.request.url) + (reqBody ? '\\n\\n' + escapeHtml(reqBody) : '') + '</pre>';
      html += '<div class="exchange-label">Response (' + ex.response.status + ')</div>';
      html += '<pre>' + (resBody ? escapeHtml(resBody) : '(empty)') + '</pre>';
      html += '</div></details>';
    }
    container.insertAdjacentHTML('beforeend', html);
  }

  // Result cell click -> toggle detail row
  document.querySelectorAll('td.result-cell[data-server]').forEach(function(cell) {
    cell.addEventListener('click', function(e) {
      e.stopPropagation();
      var key = cell.dataset.testid + '__' + cell.dataset.server;
      var detail = document.querySelector('tr[data-detail-for="' + key + '"]');
      if (detail) {
        detail.classList.toggle('visible');
        if (detail.classList.contains('visible')) {
          renderExchanges(detail, key);
        }
      }
    });
  });

  // Test ID click -> toggle source row
  document.querySelectorAll('td.test-id').forEach(function(td) {
    td.addEventListener('click', function(e) {
      e.stopPropagation();
      var testId = td.parentElement.dataset.testid;
      var src = document.querySelector('tr[data-source-for="' + testId + '"]');
      if (src) {
        renderSource(src);
        src.classList.toggle('visible');
        // Scroll highlighted line into view
        if (src.classList.contains('visible')) {
          var hl = src.querySelector('.highlight-line');
          if (hl) hl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    });
  });

  // Filter buttons
  var currentFilter = 'all';
  document.querySelectorAll('.controls button[data-filter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.controls button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  // Search
  var searchInput = document.getElementById('search');
  searchInput.addEventListener('input', function() { applyFilters(); });

  function applyFilters() {
    var query = searchInput.value.toLowerCase();
    document.querySelectorAll('tr.test-row').forEach(function(row) {
      var testId = row.dataset.testid.toLowerCase();
      var matchSearch = !query || testId.indexOf(query) !== -1;
      var matchFilter = true;
      if (currentFilter === 'fail') matchFilter = row.classList.contains('has-fail');
      else if (currentFilter === 'pass') matchFilter = row.classList.contains('all-pass');

      if (matchSearch && matchFilter) row.classList.remove('hidden');
      else row.classList.add('hidden');
    });
    // Update category header visibility
    document.querySelectorAll('.category-header').forEach(function(hdr) {
      var cat = hdr.dataset.category;
      var visibleTests = document.querySelectorAll('tr.test-row[data-category="' + cat + '"]:not(.hidden)');
      if (visibleTests.length === 0) hdr.classList.add('hidden');
      else hdr.classList.remove('hidden');
    });
  }
})();
</script>
</body>
</html>`;

process.stdout.write(html);
