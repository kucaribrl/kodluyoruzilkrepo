// git-guvenlik-kontrolu Hook testi (.claude/hooks/git-guvenlik-kontrolu.mjs)
// Tarayıcı gerektirmez. Hook betiği ayrı süreç olarak, Claude Code'un verdiği JSON girdiyle çalıştırılır.
// Dal belirtilmeyen push senaryoları YALNIZCA geçici, yalıtılmış git depolarında kurulur;
// hiçbir gerçek uzak depoya bağlanılmaz, push yapılmaz (Hook yalnızca `git config` / `symbolic-ref` okur).
import { spawnSync, execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'git-guvenlik-kontrolu.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'git-guvenlik-'));
const BOS_AYAR = path.join(TMP, 'bos-gitconfig'); fs.writeFileSync(BOS_AYAR, '');
// Kullanıcının/sistemin genel git ayarları testi etkilemesin
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: BOS_AYAR, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', HOME: TMP };

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };

const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
function depo(ad, { dal = 'ozellik', uzakDal = null, ayar = {}, ayrik = false } = {}) {
  const d = path.join(TMP, ad);
  fs.mkdirSync(d, { recursive: true });
  git(d, 'init', '-q');
  git(d, 'config', 'remote.origin.url', path.join(TMP, 'olmayan-uzak.git')); // yerel, var olmayan yol — asla bağlanılmaz
  git(d, 'symbolic-ref', 'HEAD', 'refs/heads/' + dal);
  if (uzakDal) { git(d, 'config', `branch.${dal}.remote`, 'origin'); git(d, 'config', `branch.${dal}.merge`, 'refs/heads/' + uzakDal); }
  for (const [k, v] of Object.entries(ayar)) git(d, 'config', '--add', k, v);
  if (ayrik) { git(d, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x'); git(d, 'checkout', '-q', '--detach'); }
  return d;
}

function calistir(girdi, ham) {
  const r = spawnSync(process.execPath, [HOOK], { input: ham !== undefined ? ham : JSON.stringify(girdi), env: ENV, encoding: 'utf8', timeout: 15000 });
  let karar = 'none', neden = '', json = null;
  if (r.stdout.trim()) { try { json = JSON.parse(r.stdout); karar = json.hookSpecificOutput.permissionDecision; neden = json.hookSpecificOutput.permissionDecisionReason; } catch { karar = 'GECERSIZ_JSON'; } }
  return { kod: r.status, karar, neden, json, stderr: r.stderr };
}
const bash = (cmd, cwd) => calistir({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command: cmd, description: 'test' } });
const mcp = (arac, girdi, cwd = TMP) => calistir({ hook_event_name: 'PreToolUse', tool_name: 'mcp__github__' + arac, cwd, tool_input: girdi });

const tumSonuclar = [];
function bekle(ad, sonuc, beklenen) {
  tumSonuclar.push(sonuc);
  T(`${ad} → ${beklenen}`, sonuc.kod === 0 && sonuc.karar === beklenen, { kod: sonuc.kod, karar: sonuc.karar, neden: sonuc.neden, stderr: sonuc.stderr });
}

// ---- Geçici depolar ----
const ozellik = depo('ozellik', { dal: 'ozellik', uzakDal: 'ozellik' });
const anaDal = depo('ana', { dal: 'main', uzakDal: 'main' });
const upstreamYok = depo('upstreamyok', { dal: 'ozellik' });
const upstreamMain = depo('upstreammain', { dal: 'ozellik', uzakDal: 'main' });
const canli = depo('canli', { dal: 'claude/textile-wholesale-app-4zqrky', uzakDal: 'claude/textile-wholesale-app-4zqrky' });
const ayrik = depo('ayrik', { dal: 'ozellik', ayrik: true });
const modCurrent = depo('modcurrent', { dal: 'ozellik', uzakDal: 'main', ayar: { 'push.default': 'current' } });
const modUpstream = depo('modupstream', { dal: 'ozellik', uzakDal: 'main', ayar: { 'push.default': 'upstream' } });
const modMatching = depo('modmatching', { dal: 'ozellik', uzakDal: 'ozellik', ayar: { 'push.default': 'matching' } });
const modNothing = depo('modnothing', { dal: 'main', uzakDal: 'main', ayar: { 'push.default': 'nothing' } });
const remotePush = depo('remotepush', { dal: 'ozellik', uzakDal: 'ozellik', ayar: { 'remote.origin.push': 'refs/heads/ozellik:refs/heads/main' } });
const remoteMirror = depo('remotemirror', { dal: 'ozellik', uzakDal: 'ozellik', ayar: { 'remote.origin.mirror': 'true' } });
const pushDefaultUzak = depo('pushdefault', { dal: 'main', uzakDal: 'main', ayar: { 'remote.pushDefault': 'yedek', 'remote.yedek.url': path.join(TMP, 'yok2.git') } });
const depoDegil = path.join(TMP, 'depo-degil'); fs.mkdirSync(depoDegil);

// ---- 1) git push (dal belirtilmeden) ----
bekle('git push — özellik dalı, uzak dalı origin/ozellik', bash('git push', ozellik), 'none');
bekle('git push — mevcut dal main', bash('git push', anaDal), 'deny');
bekle('git push — mevcut dal canlı yayın dalı', bash('git push', canli), 'deny');
// push.default=simple + bağlı uzak dal yok: Git ya aynı adlı dala (ozellik) gönderir ya da hata verir — korunan dala gidemez
bekle('git push — bağlı uzak dal yok (hedef aynı ad: ozellik)', bash('git push', upstreamYok), 'none');
bekle('git push — main dalı, bağlı uzak dal yok', bash('git push', depo('anaupyok', { dal: 'main' })), 'deny');
bekle('git push — özellik dalı ama uzak dalı origin/main (simple)', bash('git push', upstreamMain), 'deny');
bekle('git push — HEAD ayrık (detached)', bash('git push', ayrik), 'ask');
bekle('git push -u origin ozellik (özellik dalı)', bash('git push -u origin ozellik', ozellik), 'none');
bekle('git push origin — mevcut dal main', bash('git push origin', anaDal), 'deny');
bekle('git push — depo olmayan dizin', bash('git push', depoDegil), 'ask');

// push.default / remote.<ad>.push / remote.pushDefault etkisi
bekle('push.default=current, upstream main → hedef ozellik', bash('git push', modCurrent), 'none');
bekle('push.default=upstream, upstream main', bash('git push', modUpstream), 'deny');
bekle('push.default=matching', bash('git push', modMatching), 'ask');
bekle('push.default=nothing (main üzerinde bile push olmaz)', bash('git push', modNothing), 'none');
bekle('remote.origin.push tanımlı, dal belirtilmeden', bash('git push', remotePush), 'ask');
bekle('remote.origin.push tanımlı, git push origin ozellik', bash('git push origin ozellik', remotePush), 'ask');
bekle('remote.origin.push tanımlı, açık hedef git push origin ozellik:yeni', bash('git push origin ozellik:yeni', remotePush), 'none');
bekle('remote.origin.mirror=true', bash('git push', remoteMirror), 'deny');
bekle('remote.pushDefault=yedek (farklı uzak), mevcut dal main', bash('git push', pushDefaultUzak), 'deny');

// ---- 2) HEAD ve refspec biçimleri ----
bekle('git push origin HEAD (özellik dalı)', bash('git push origin HEAD', ozellik), 'none');
bekle('git push origin HEAD (main dalı)', bash('git push origin HEAD', anaDal), 'deny');
bekle('git push origin HEAD:main', bash('git push origin HEAD:main', ozellik), 'deny');
bekle('git push origin HEAD:refs/heads/main', bash('git push origin HEAD:refs/heads/main', ozellik), 'deny');
bekle('git push origin main', bash('git push origin main', ozellik), 'deny');
bekle('git push origin MAIN (büyük harf)', bash('git push origin MAIN', ozellik), 'deny');
bekle('git push origin ozellik:master', bash('git push origin ozellik:master', ozellik), 'deny');
bekle('git push origin claude/textile-wholesale-app-4zqrky', bash('git push origin claude/textile-wholesale-app-4zqrky', ozellik), 'deny');
bekle('git push origin HEAD:claude/busy-einstein-wxx9a9', bash('git push origin HEAD:claude/busy-einstein-wxx9a9', ozellik), 'none');
bekle('git push origin v1.0:refs/tags/v1.0 (etiket)', bash('git push origin v1.0:refs/tags/v1.0', ozellik), 'none');
bekle("git push origin 'refs/heads/*:refs/heads/*' (joker)", bash("git push origin 'refs/heads/*:refs/heads/*'", ozellik), 'ask');
bekle('git push --repo=origin main', bash('git push --repo=origin main', ozellik), 'deny');

// ---- 3) git -C / -c / bileşik komutlar ----
bekle('git -C . push origin main', bash('git -C . push origin main', ozellik), 'deny');
bekle(`git -C <ana depo> push (main)`, bash(`git -C ${JSON.stringify(anaDal)} push`, TMP), 'deny');
bekle('cd ana && git push', bash(`cd ${JSON.stringify(anaDal)} && git push`, TMP), 'deny');
bekle('cd x && git -c a.b=c push origin claude/textile-wholesale-app-4zqrky', bash('cd x && git -c a.b=c push origin claude/textile-wholesale-app-4zqrky', ozellik), 'deny');
bekle('git status; git push origin main', bash('git status; git push origin main', ozellik), 'deny');
bekle('git log | head && git push origin main', bash('git log | head && git push origin main', ozellik), 'deny');
bekle('(git push origin main)', bash('(git push origin main)', ozellik), 'deny');
bekle('{ git push origin main; }', bash('{ git push origin main; }', ozellik), 'deny');
bekle('env GIT_TRACE=1 git push origin main', bash('env GIT_TRACE=1 git push origin main', ozellik), 'deny');
bekle('GIT_TRACE=1 /usr/bin/git push origin main', bash('GIT_TRACE=1 /usr/bin/git push origin main', ozellik), 'deny');
bekle('\\git push origin main', bash('\\git push origin main', ozellik), 'deny');
bekle('git push origin main 2>&1 | tail -3', bash('git push origin main 2>&1 | tail -3', ozellik), 'deny');
bekle('git -c alias.p=push p origin main', bash('git -c alias.p=push p origin main', ozellik), 'ask');
bekle('git --git-dir=/x push', bash('git --git-dir=/x push', ozellik), 'ask');

// ---- 4) force push / silme ----
bekle('git push --force-with-lease', bash('git push --force-with-lease', ozellik), 'deny');
bekle('git push --force-with-lease=ozellik:abc origin ozellik', bash('git push --force-with-lease=ozellik:abc origin ozellik', ozellik), 'deny');
bekle('git push --force origin ozellik', bash('git push --force origin ozellik', ozellik), 'deny');
bekle('git push -f origin ozellik', bash('git push -f origin ozellik', ozellik), 'deny');
bekle('git push -uf origin ozellik', bash('git push -uf origin ozellik', ozellik), 'deny');
bekle('git push origin +ozellik', bash('git push origin +ozellik', ozellik), 'deny');
bekle('git push origin :ozellik (silme)', bash('git push origin :ozellik', ozellik), 'deny');
bekle('git push --delete origin ozellik', bash('git push --delete origin ozellik', ozellik), 'deny');
bekle('git push --mirror', bash('git push --mirror', ozellik), 'deny');
bekle('git push --all', bash('git push --all', ozellik), 'deny');
bekle('git push --dry-run origin main', bash('git push --dry-run origin main', ozellik), 'deny');

// ---- 5) bash -c, eval, değişkenli komutlar ----
bekle('bash -c "git push origin ozellik"', bash('bash -c "git push origin ozellik"', ozellik), 'ask');
bekle("sh -c 'git status'", bash("sh -c 'git status'", ozellik), 'ask');
bekle('eval "git push"', bash('eval "git push"', ozellik), 'ask');
bekle('echo main | xargs git push origin', bash('echo main | xargs git push origin', ozellik), 'ask');
bekle('git push origin $DAL', bash('git push origin $DAL', ozellik), 'ask');
bekle('git push origin "${DAL}"', bash('git push origin "${DAL}"', ozellik), 'ask');
bekle('git push origin "$(git branch --show-current)"', bash('git push origin "$(git branch --show-current)"', ozellik), 'ask');
bekle('D=main; git push origin $D', bash('D=main; git push origin $D', ozellik), 'ask');
bekle('git push origin `echo main`', bash('git push origin `echo main`', ozellik), 'ask');
bekle('$GIT push origin ozellik (dinamik komut adı)', bash('$GIT push origin ozellik', ozellik), 'ask');
bekle('cd "$DIZIN" && git push', bash('cd "$DIZIN" && git push', ozellik), 'ask');
bekle('for d in a b; do git push origin $d; done', bash('for d in a b; do git push origin $d; done', ozellik), 'ask');
bekle('node -e "…git push…"', bash('node -e "require(\'child_process\').execSync(\'git push\')"', ozellik), 'ask');
bekle('echo "$(git push origin main)" (komut ikamesi içinde push)', bash('echo "$(git push origin main)"', ozellik), 'deny');

// ---- 6) tırnak içinde git push geçen ama push yapmayan komutlar ----
bekle('echo "git push origin main"', bash('echo "git push origin main"', ozellik), 'none');
bekle("printf '%s' 'git push --force'", bash("printf '%s' 'git push --force'", ozellik), 'none');
bekle('git commit -m "git push origin main yapma"', bash('git commit -m "git push origin main yapma"', ozellik), 'none');
bekle('grep -n "git push" dosya.txt', bash('grep -n "git push" dosya.txt', ozellik), 'none');
bekle('# git push origin main (yorum)', bash('ls # git push origin main', ozellik), 'none');
const heredocCommit = "git commit -q -F - <<'EOF'\nBaşlık\n\ngit push origin main yapılmadı (not)\nEOF";
bekle('heredoc commit mesajında git push metni', bash(heredocCommit, ozellik), 'none');
const heredocIkame = 'git commit -m "$(cat <<\'EOF\'\nSkill\'i ekledim (deneme)\n\ngit push --force değil\nEOF\n)"';
bekle('$(cat <<EOF …) commit mesajı (tırnak ve parantez içeriyor)', bash(heredocIkame, ozellik), 'none');

// ---- 7) riskli yerel işlemler → ASK ----
for (const c of ['git reset --hard', 'git reset --hard HEAD~1', 'git clean -fd', 'git clean -xdf', 'git clean --force', 'git branch -D eski', 'git branch -f x HEAD', 'git branch -M yeni', 'git checkout -- .', 'git checkout .', 'git checkout -f ozellik', 'git restore .', 'git restore --worktree x', 'git stash drop', 'git stash clear', 'git rm -f x', 'git reflog expire --all', 'git gc --prune=now', 'git update-ref -d refs/heads/x', 'git filter-branch', 'git remote set-url origin x', 'git config push.default matching', 'git switch -f main'])
  bekle(c, bash(c, ozellik), 'ask');

// ---- 8) güvenli komutlar → karar yok ----
for (const c of ['git status', 'git log --oneline -3', 'git diff --cached --name-only', 'git add .claude/x', 'git commit -m mesaj', 'git fetch origin claude/x', 'git merge --ff-only origin/claude/x', 'git branch --show-current', 'git branch -d eski', 'git checkout ozellik', 'git switch ozellik', 'git restore --staged x', 'git reset HEAD x', 'git reset --soft HEAD~1', 'git stash', 'git stash list', 'git remote -v', 'git remote get-url origin', 'git config --get push.default', 'git ls-remote --heads origin main', 'git rev-parse --abbrev-ref @{u}', 'git log -1 --format=%H', 'ls -la', 'npm test', 'cat .github/workflows/test.yml'])
  bekle(c, bash(c, ozellik), 'none');

// ---- 9) belirsiz / çözümlenemeyen ----
bekle('git p (bilinmeyen alt komut / takma ad)', bash('git p origin main', ozellik), 'ask');
bekle('kapanmamış tırnak: git push "origin', bash('git push "origin', ozellik), 'ask');
bekle('git push --tuhaf-secenek', bash('git push --tuhaf-secenek origin ozellik', ozellik), 'ask');

// ---- 10) GitHub MCP araçları ----
const R = { owner: 'kucaribrl', repo: 'kodluyoruzilkrepo' };
bekle('MCP create_or_update_file → main', mcp('create_or_update_file', { ...R, path: 'x.md', content: 'x', message: 'm', branch: 'main' }), 'deny');
bekle('MCP push_files → main', mcp('push_files', { ...R, branch: 'main', files: [{ path: 'x', content: 'x' }], message: 'm' }), 'deny');
bekle('MCP delete_file → refs/heads/main', mcp('delete_file', { ...R, path: 'x', message: 'm', branch: 'refs/heads/main' }), 'deny');
bekle('MCP push_files → master', mcp('push_files', { ...R, branch: 'master', files: [], message: 'm' }), 'deny');
bekle('MCP push_files → canlı yayın dalı', mcp('push_files', { ...R, branch: 'claude/textile-wholesale-app-4zqrky', files: [{ path: 'x', content: 'x' }], message: 'm' }), 'deny');
bekle('MCP create_or_update_file → canlı yayın dalı', mcp('create_or_update_file', { ...R, path: 'index.html', content: 'x', message: 'm', branch: 'claude/textile-wholesale-app-4zqrky' }), 'deny');
bekle('MCP create_or_update_file → branch alanı yok', mcp('create_or_update_file', { ...R, path: 'x', content: 'x', message: 'm' }), 'ask');
bekle('MCP push_files → geliştirme dalı', mcp('push_files', { ...R, branch: 'claude/busy-einstein-wxx9a9', files: [{ path: 'x', content: 'x' }], message: 'm' }), 'none');
bekle('MCP create_branch adı main', mcp('create_branch', { ...R, branch: 'main' }), 'deny');
bekle('MCP create_branch yeni dal', mcp('create_branch', { ...R, branch: 'claude/yeni', from_branch: 'main' }), 'none');
bekle('MCP merge_pull_request', mcp('merge_pull_request', { ...R, pullNumber: 1 }), 'deny');
bekle('MCP enable_pr_auto_merge', mcp('enable_pr_auto_merge', { ...R, pullNumber: 1 }), 'deny');
bekle('MCP update_pull_request_branch', mcp('update_pull_request_branch', { ...R, pullNumber: 1 }), 'ask');
bekle('MCP create_pull_request', mcp('create_pull_request', { ...R, title: 't', head: 'claude/x', base: 'main' }), 'ask');
bekle('MCP update_pull_request base=main', mcp('update_pull_request', { ...R, pullNumber: 1, base: 'main' }), 'ask');
bekle('MCP update_pull_request başlık', mcp('update_pull_request', { ...R, pullNumber: 1, title: 'yeni' }), 'none');
bekle('MCP actions_run_trigger run_workflow', mcp('actions_run_trigger', { ...R, method: 'run_workflow', workflow_id: 'test.yml', ref: 'main' }), 'ask');
bekle('MCP get_file_contents', mcp('get_file_contents', { ...R, path: 'x' }), 'none');
bekle('MCP list_commits', mcp('list_commits', { ...R }), 'none');
bekle('MCP pull_request_read', mcp('pull_request_read', { ...R, pullNumber: 1 }), 'none');
bekle('MCP tanınmayan yazma aracı (issue_write)', mcp('issue_write', { ...R }), 'ask');

// ---- 11) diğer araçlar ve hatalı girdi ----
bekle('Read aracı (kapsam dışı)', calistir({ tool_name: 'Read', tool_input: { file_path: '/x' } }), 'none');
bekle('bozuk JSON girdi', calistir(null, '{bozuk git'), 'ask');
bekle('boş girdi', calistir(null, ''), 'ask');
bekle('Bash ama command alanı yok', calistir({ tool_name: 'Bash', cwd: ozellik, tool_input: {} }), 'ask');

// ---- Genel kurallar ----
T('Hook hiçbir durumda "allow" vermedi', tumSonuclar.every(s => s.karar !== 'allow'), tumSonuclar.filter(s => s.karar === 'allow'));
T('Her çalıştırma çıkış kodu 0 ile bitti (karar JSON ile)', tumSonuclar.every(s => s.kod === 0));
T('Tüm çıktılar geçerli JSON veya boş', tumSonuclar.every(s => s.karar !== 'GECERSIZ_JSON'));
T('DENY/ASK gerekçesi Hook adını içeriyor', tumSonuclar.filter(s => s.karar !== 'none').every(s => s.neden.startsWith('[git-guvenlik-kontrolu]')));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
