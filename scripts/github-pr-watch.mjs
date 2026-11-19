import fs from 'node:fs/promises';

const API = 'https://api.github.com';
const owner = process.env.WARLIKE_GITHUB_OWNER || 'Motherlode94';
const scanToken = process.env.WARLIKE_GITHUB_READ_TOKEN || process.env.GITHUB_TOKEN;
const reportToken = process.env.GITHUB_TOKEN;
const reportRepo = process.env.GITHUB_REPOSITORY;
const days = Number(process.env.WARLIKE_PR_STALE_DAYS || 7);
const now = new Date();
const MAX_REPOS = 500;

export function assess(pr, checks, staleDays = 7, clock = new Date()) {
  const ageDays = Math.floor((clock.getTime() - new Date(pr.updated_at).getTime()) / 86400000);
  const failed = checks.some(c => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(c.conclusion));
  const pending = checks.some(c => c.status !== 'completed');
  const conflict = pr.mergeable === false || pr.mergeable_state === 'dirty';
  const reasons = [];
  if (conflict) reasons.push('conflit de fusion');
  if (failed) reasons.push('CI échouée');
  if (pr.draft) reasons.push('Draft');
  if (ageDays >= staleDays) reasons.push('inactive depuis ' + ageDays + ' j');
  if (pending) reasons.push('CI en cours');
  const level = conflict || failed ? 'P0' : ageDays >= staleDays ? 'P1' : pr.draft ? 'P2' : 'P3';
  return { level, reasons, ageDays, failed, pending, conflict };
}

async function api(path, token = scanToken, options = {}) {
  if (!token) throw new Error('GitHub token absent');
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'warlike-pr-watch',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error('GitHub ' + response.status + ' ' + path + ': ' + (await response.text()).slice(0, 180));
  return response.status === 204 ? null : response.json();
}

async function pages(path, limit = 20) {
  const results = [];
  for (let page = 1; page <= limit; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const batch = await api(path + sep + 'per_page=100&page=' + page);
    if (!Array.isArray(batch)) throw new Error('Expected array for ' + path);
    results.push(...batch);
    if (batch.length < 100) break;
  }
  return results;
}

async function inspect(repo, number) {
  const key = repo.full_name;
  const pr = await api('/repos/' + key + '/pulls/' + number);
  let checks = [];
  let warning = null;
  try {
    const data = await api('/repos/' + key + '/commits/' + pr.head.sha + '/check-runs?per_page=100');
    checks = data.check_runs || [];
  } catch (error) {
    warning = 'checks non accessibles: ' + error.message;
  }
  const score = assess(pr, checks, days, now);
  return { repo: key, number, title: pr.title, url: pr.html_url, updated: pr.updated_at, author: pr.user?.login, ...score, checks: checks.length, warning };
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').slice(0, 180);
}

async function writeIssue(body) {
  if (!reportRepo || !reportToken || process.env.WARLIKE_PR_ISSUE !== 'true') return;
  const marker = '<!-- warlike-pr-watch -->';
  const [namespace, project] = reportRepo.split('/');
  const issues = await api('/repos/' + namespace + '/' + project + '/issues?state=open&per_page=100', reportToken);
  const existing = issues.find(i => !i.pull_request && i.body?.includes(marker));
  const payload = JSON.stringify({ title: 'WarLike PR Watch — suivi des Pull Requests', body: marker + '\n' + body });
  const path = '/repos/' + namespace + '/' + project + '/issues' + (existing ? '/' + existing.number : '');
  const method = existing ? 'PATCH' : 'POST';
  await api(path, reportToken, { method, headers: { 'Content-Type': 'application/json' }, body: payload });
}

async function main() {
  const repos = (await pages('/user/repos?affiliation=owner&sort=full_name', 10))
    .filter(r => r.owner?.login?.toLowerCase() === owner.toLowerCase() && !r.archived)
    .slice(0, MAX_REPOS);
  const results = [];
  const errors = [];
  for (const repo of repos) {
    try {
      const open = await pages('/repos/' + repo.full_name + '/pulls?state=open', 10);
      for (const pr of open) {
        try { results.push(await inspect(repo, pr.number)); }
        catch (e) { errors.push(repo.full_name + '#' + pr.number + ': ' + e.message); }
      }
    } catch (e) { errors.push(repo.full_name + ': ' + e.message); }
  }
  results.sort((a, b) => a.level.localeCompare(b.level) || b.ageDays - a.ageDays);
  const count = level => results.filter(r => r.level === level).length;
  const lines = [
    '# WarLike — audit des Pull Requests',
    '',
    'Date UTC : ' + now.toISOString(),
    '',
    '**' + repos.length + ' dépôts analysés, ' + results.length + ' PR ouvertes.** ' +
    'P0 : ' + count('P0') + ' · P1 : ' + count('P1') + ' · P2 : ' + count('P2') + ' · P3 : ' + count('P3'),
    '',
    '| Priorité | Dépôt / PR | Dernière activité | Motifs |',
    '|---|---|---|---|',
    ...results.map(r => '| ' + r.level + ' | [' + escapeCell(r.repo + '#' + r.number) + '](' + r.url + ') — ' + escapeCell(r.title) + ' | ' + r.ageDays + ' j | ' + escapeCell(r.reasons.join(', ') || 'à examiner') + ' |'),
    '',
    '> P0 : conflit/CI rouge ; P1 : inactivité ; P2 : Draft ; P3 : suivi normal. La CI non accessible n’est pas présumée verte.',
    '> Le module ne fusionne, ne ferme et ne supprime jamais les PR.',
    '',
    errors.length ? '## Limitations d’accès\n' + errors.map(e => '- ' + escapeCell(e)).join('\n') : '',
  ];
  const body = lines.join('\n');
  await fs.mkdir('reports', { recursive: true });
  await fs.writeFile('reports/pr-watch.md', body);
  await fs.writeFile('reports/pr-watch.json', JSON.stringify({ generatedAt: now.toISOString(), owner, repositoriesScanned: repos.length, results, errors }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, body + '\n');
  if (process.env.WARLIKE_PR_ISSUE === 'true') {
    try { await writeIssue(body); } catch (e) { console.warn('Rapport issue non publié: ' + e.message); }
  }
  console.log(repos.length + ' repos; ' + results.length + ' open PRs; ' + errors.length + ' errors');
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
