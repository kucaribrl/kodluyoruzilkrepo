#!/usr/bin/env node
/* git-guvenlik-kontrolu — Claude Code PreToolUse Hook'u (Bash + GitHub MCP araçları).
 *
 * Amaç: korunan dallara (main, master, canlı yayın dalı) yanlışlıkla push/yazmayı,
 * force push'u ve geri dönüşü zor yerel Git işlemlerini Claude Code içinde durdurmak.
 *
 * Kararlar (yalnızca bunlar; bu Hook ASLA "allow" vermez, izinleri sadece sıkılaştırır):
 *   - DENY : korunan dala push / force push / uzak dal silme / MCP ile korunan dala yazma, MCP merge.
 *   - ASK  : riskli yerel işlemler, dinamik/belirsiz/çözümlenemeyen Git komutları, Hook iç hatası.
 *   - (çıktı yok, çıkış 0) : karar yok → Claude Code'un normal izin akışı devam eder.
 *
 * GÜVENLİK SINIRLARI (bkz. test/OKU.md "Git güvenlik Hook'u"):
 *   - Claude Code belgesine göre Hook başlatılamazsa (node yok, dosya yok), 0/2 dışı kodla
 *     çıkarsa, geçersiz JSON basarsa veya zaman aşımına uğrarsa bu "engellemeyen hata"dır ve
 *     araç çağrısı ÇALIŞIR. Bunu kapatmak için ayarda "onFailure": "block" kullanılmalıdır
 *     (Claude Code ≥ 2.1.295). Betik içindeki hatalar burada yakalanıp ASK'e çevrilir.
 *   - Yalnızca Claude Code araç çağrılarını görür: kullanıcının kendi terminali, GitHub web
 *     arayüzü, `gh` CLI, CI ve bu ayar dosyası olmayan makineler korunmaz. Kesin koruma için
 *     GitHub branch protection kullanılmalıdır.
 *   - Metin çözümlemesi kazaları önler; kasıtlı gizleme (ör. `$(echo gi)t push`) için tasarlanmadı.
 *   - Dal belirtilmeyen push'ta hedef, Git ayarları okunarak tahmin edilir; emin olunamazsa ASK.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const KORUNAN_DALLAR = ['main', 'master', 'claude/textile-wholesale-app-4zqrky'];

/* ---------- karar birleştirme ---------- */
const SIRA = { none: 0, ask: 1, deny: 2 };
const sonuc = (karar, neden) => ({ karar, neden });
const YOK = sonuc('none', '');
function enGuclu(liste) { let s = YOK; for (const x of liste) if (SIRA[x.karar] > SIRA[s.karar]) s = x; return s; }

/* ---------- dal adı yardımcıları ---------- */
export function dalAdiNormal(ref) {
  let r = String(ref || '').trim();
  if (r.startsWith('refs/heads/')) r = r.slice('refs/heads/'.length);
  return r;
}
export function korunanMi(ref) {
  const r = dalAdiNormal(ref).toLowerCase();
  return KORUNAN_DALLAR.some(k => k.toLowerCase() === r);
}

/* ---------- kabuk sözcük çözümleyici ----------
 * Basit komutları (segment) ve her sözcüğün "dinamik" (değişken / komut ikamesi içerir)
 * olup olmadığını çıkarır. $(…) ve `…` içerikleri ayrıca komut olarak döndürülür.
 * Çözümlenemeyen girdi için hata fırlatır (çağıran ASK'e çevirir). */
export function kabukCozumle(src) {
  const segmentler = [];      // [{ words:[{t,dyn}], cd? }]
  const icKomutlar = [];      // $(...) / `...` / <(...) içerikleri
  let words = [], cur = '', curDyn = false, curVar = false;
  let i = 0;
  const n = src.length;
  const bekleyenHeredoc = [];
  const sozcukBitir = () => { if (curVar) { words.push({ t: cur, dyn: curDyn }); } cur = ''; curDyn = false; curVar = false; };
  const segmentBitir = () => { sozcukBitir(); if (words.length) segmentler.push({ words }); words = []; };
  const parantezIcerik = (start) => { // src[start] '(' sonrasından eşleşen ')' a kadar
    let d = 1, j = start, q = null;
    const icHeredoc = [];
    while (j < n) {
      const c = src[j];
      if (!q && c === '<' && src[j + 1] === '<' && src[j + 2] !== '<') { // $( … <<AYRAC … ) gövdesini atla
        let k = j + 2; let sekme = false; if (src[k] === '-') { sekme = true; k++; }
        while (src[k] === ' ' || src[k] === '\t') k++;
        let ayrac = '';
        while (k < n && !/[\s;&|<>()]/.test(src[k])) { const d2 = src[k]; if (d2 === "'" || d2 === '"') { const e = src.indexOf(d2, k + 1); if (e < 0) throw new Error('heredoc ayracı'); ayrac += src.slice(k + 1, e); k = e + 1; } else if (d2 === '\\') { ayrac += src[k + 1] || ''; k += 2; } else { ayrac += d2; k++; } }
        if (!ayrac) throw new Error('heredoc ayracı boş');
        icHeredoc.push({ ayrac, sekme }); j = k; continue;
      }
      if (!q && c === '\n' && icHeredoc.length) {
        j++;
        while (icHeredoc.length) {
          const { ayrac, sekme } = icHeredoc.shift(); let bulundu = false;
          while (j < n) { let k = src.indexOf('\n', j); if (k < 0) k = n; let satir = src.slice(j, k); if (sekme) satir = satir.replace(/^\t+/, ''); j = k < n ? k + 1 : n; if (satir === ayrac) { bulundu = true; break; } }
          if (!bulundu) throw new Error('kapanmamış heredoc');
        }
        continue;
      }
      if (q === "'") { if (c === "'") q = null; j++; continue; }
      if (q === '"') { if (c === '\\') { j += 2; continue; } if (c === '"') q = null; j++; continue; }
      if (c === '\\') { j += 2; continue; }
      if (c === "'" || c === '"') { q = c; j++; continue; }
      if (c === '(') d++;
      else if (c === ')') { d--; if (d === 0) return [src.slice(start, j), j + 1]; }
      j++;
    }
    throw new Error('kapanmamış parantez');
  };
  const backtickIcerik = (start) => {
    let j = start;
    while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '`') return [src.slice(start, j), j + 1]; j++; }
    throw new Error('kapanmamış ters tırnak');
  };
  const dolarIsle = () => { // src[i] === '$'
    const c2 = src[i + 1];
    if (c2 === '(') {
      if (src[i + 2] === '(') { const [ic, son] = parantezIcerik(i + 2); i = son; cur += '$(' + ic + ')'; curDyn = true; curVar = true; return; }
      const [ic, son] = parantezIcerik(i + 2); icKomutlar.push(ic); cur += '$(' + ic + ')'; curDyn = true; curVar = true; i = son; return;
    }
    if (c2 === '{') { const k = src.indexOf('}', i + 2); if (k < 0) throw new Error('kapanmamış ${'); cur += src.slice(i, k + 1); curDyn = true; curVar = true; i = k + 1; return; }
    if (c2 && /[A-Za-z0-9_@*#?$!-]/.test(c2)) { let j = i + 1; if (/[A-Za-z_]/.test(c2)) { while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++; } else j++; cur += src.slice(i, j); curDyn = true; curVar = true; i = j; return; }
    if (c2 === "'" ) { // $'...' ANSI-C tırnak — içerik belirsiz kabul edilir
      const k = src.indexOf("'", i + 2); if (k < 0) throw new Error("kapanmamış $'"); cur += src.slice(i + 2, k); curDyn = true; curVar = true; i = k + 1; return;
    }
    cur += '$'; curVar = true; i++;
  };
  const heredocAtla = () => { // satır sonundayız (src[i] === '\n' tüketildi); bekleyen heredoc gövdelerini atla
    while (bekleyenHeredoc.length) {
      const { ayrac, sekme } = bekleyenHeredoc.shift();
      let bulundu = false;
      while (i < n) {
        let k = src.indexOf('\n', i); if (k < 0) k = n;
        let satir = src.slice(i, k); if (sekme) satir = satir.replace(/^\t+/, '');
        i = k < n ? k + 1 : n;
        if (satir === ayrac) { bulundu = true; break; }
      }
      if (!bulundu) throw new Error('kapanmamış heredoc');
    }
  };

  while (i < n) {
    const c = src[i];
    if (c === '\\') { if (src[i + 1] === '\n') { i += 2; continue; } if (i + 1 < n) { cur += src[i + 1]; curVar = true; } i += 2; continue; }
    if (c === "'") { const k = src.indexOf("'", i + 1); if (k < 0) throw new Error('kapanmamış tek tırnak'); cur += src.slice(i + 1, k); curVar = true; i = k + 1; continue; }
    if (c === '"') {
      i++; curVar = true; let kapandi = false;
      while (i < n) {
        const d = src[i];
        if (d === '"') { i++; kapandi = true; break; }
        if (d === '\\') { const e = src[i + 1]; if ('$`"\\\n'.includes(e)) { if (e !== '\n') cur += e; i += 2; continue; } cur += d; i++; continue; }
        if (d === '$') { dolarIsle(); continue; }
        if (d === '`') { const [ic, son] = backtickIcerik(i + 1); icKomutlar.push(ic); cur += '`' + ic + '`'; curDyn = true; i = son; continue; }
        cur += d; i++;
      }
      if (!kapandi) throw new Error('kapanmamış çift tırnak');
      continue;
    }
    if (c === '$') { dolarIsle(); continue; }
    if (c === '`') { const [ic, son] = backtickIcerik(i + 1); icKomutlar.push(ic); cur += '`' + ic + '`'; curDyn = true; curVar = true; i = son; continue; }
    if (c === '#' && !curVar) { const k = src.indexOf('\n', i); i = k < 0 ? n : k; continue; }
    if (c === '\n') { segmentBitir(); i++; heredocAtla(); continue; }
    if (c === ';' || c === '&' || c === '|' || c === '(' || c === ')') {
      if (c === '&' && src[i + 1] === '>') { sozcukBitir(); i += 2; if (src[i] === '>') i++; redirHedefAtla(); continue; }
      segmentBitir(); i++;
      if ((c === '&' && src[i] === '&') || (c === '|' && (src[i] === '|' || src[i] === '&')) || (c === ';' && src[i] === ';')) i++;
      continue;
    }
    if (c === '<' || c === '>') {
      // n>&m, n>dosya: sözcük yalnızca rakamlardan oluşuyorsa fd numarasıdır
      if (curVar && /^\d+$/.test(cur)) { cur = ''; curVar = false; curDyn = false; } else sozcukBitir();
      if (c === '<' && src[i + 1] === '(') { const [ic, son] = parantezIcerik(i + 2); icKomutlar.push(ic); i = son; continue; }
      if (c === '>' && src[i + 1] === '(') { const [ic, son] = parantezIcerik(i + 2); icKomutlar.push(ic); i = son; continue; }
      if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') { // heredoc
        i += 2; let sekme = false; if (src[i] === '-') { sekme = true; i++; }
        while (src[i] === ' ' || src[i] === '\t') i++;
        let ayrac = '';
        while (i < n && !/[\s;&|<>()]/.test(src[i])) { const d = src[i]; if (d === "'" || d === '"') { const k = src.indexOf(d, i + 1); if (k < 0) throw new Error('heredoc ayracı'); ayrac += src.slice(i + 1, k); i = k + 1; } else if (d === '\\') { ayrac += src[i + 1] || ''; i += 2; } else { ayrac += d; i++; } }
        if (!ayrac) throw new Error('heredoc ayracı boş');
        bekleyenHeredoc.push({ ayrac, sekme });
        continue;
      }
      i++; if (src[i] === c || src[i] === '&' || src[i] === '|') i++;
      if (src[i - 1] === '&' && /\d|-/.test(src[i] || '')) { while (i < n && /[\d-]/.test(src[i])) i++; continue; }
      redirHedefAtla();
      continue;
    }
    if (c === ' ' || c === '\t') { sozcukBitir(); i++; continue; }
    cur += c; curVar = true; i++;
  }
  if (bekleyenHeredoc.length) throw new Error('kapanmamış heredoc');
  segmentBitir();
  return { segmentler, icKomutlar };

  function redirHedefAtla() { // yönlendirme hedef sözcüğünü tüket (segmente ekleme)
    while (src[i] === ' ' || src[i] === '\t') i++;
    const kayit = { words, cur, curDyn, curVar };
    words = []; cur = ''; curDyn = false; curVar = false;
    // tek sözcük oku
    while (i < n) {
      const c = src[i];
      if (/[\s;&|<>()]/.test(c)) break;
      if (c === "'") { const k = src.indexOf("'", i + 1); if (k < 0) throw new Error('kapanmamış tek tırnak'); i = k + 1; continue; }
      if (c === '"') { let j = i + 1; while (j < n && src[j] !== '"') { if (src[j] === '\\') j++; j++; } if (j >= n) throw new Error('kapanmamış çift tırnak'); i = j + 1; continue; }
      if (c === '$') { dolarIsle(); continue; }
      if (c === '\\') { i += 2; continue; }
      i++;
    }
    words = kayit.words; cur = kayit.cur; curDyn = kayit.curDyn; curVar = kayit.curVar;
  }
}

/* ---------- Git yardımcıları (yalnızca okuma) ---------- */
function gitOku(dizin, args) {
  try {
    return execFileSync('git', ['-C', dizin, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' } }).trim();
  } catch (e) { if (e && e.status === 1) return ''; /* config anahtarı yok */ throw e; }
}
function gitAyar(dizin, anahtar) { return gitOku(dizin, ['config', '--get', anahtar]); }
function gitAyarHepsi(dizin, anahtar) { const o = gitOku(dizin, ['config', '--get-all', anahtar]); return o ? o.split('\n') : []; }
function mevcutDal(dizin) { return gitOku(dizin, ['symbolic-ref', '--short', '-q', 'HEAD']); }

/* ---------- komut sarmalayıcıları ---------- */
const SARMALAYICI = new Set(['env', 'sudo', 'nohup', 'time', 'command', 'exec', 'nice', 'ionice', 'stdbuf', 'timeout', 'chronic']);
const CALISTIRICI = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish', 'eval', 'source', '.', 'xargs', 'parallel', 'watch', 'su', 'ssh', 'script', 'node', 'nodejs', 'python', 'python3', 'perl', 'ruby', 'php', 'deno', 'bun', 'npx', 'find', 'make', 'busybox', 'flock', 'setsid', 'unbuffer', 'doas']);
const gitSozcugu = /(^|[^A-Za-z0-9_-])git([^A-Za-z0-9_-]|$)/i; // büyük/küçük harf duyarsız ($GIT gibi)

function komutAdi(w) { return path.basename(w).replace(/\.exe$/i, ''); }

/* ---------- git alt komut sınıfları ---------- */
const GUVENLI_OKUMA = new Set(['status', 'log', 'diff', 'show', 'rev-parse', 'rev-list', 'ls-files', 'ls-tree', 'ls-remote', 'cat-file', 'blame', 'annotate', 'grep', 'shortlog', 'describe', 'show-ref', 'show-branch', 'version', 'help', 'whatchanged', 'name-rev', 'merge-base', 'for-each-ref', 'count-objects', 'fsck', 'verify-commit', 'verify-tag', 'check-ignore', 'check-attr', 'check-ref-format', 'var', 'diff-tree', 'diff-files', 'diff-index', 'format-patch', 'range-diff', 'cherry', 'instaweb', 'archive', 'bugreport', 'fetch', 'add', 'commit', 'pull', 'merge', 'rebase', 'cherry-pick', 'revert', 'am', 'apply', 'mv', 'init', 'clone', 'notes', 'submodule', 'sparse-checkout', 'bisect', 'tag', 'mergetool', 'difftool', 'citool', 'gui', 'maintenance', 'stage', 'request-pull', 'send-email', 'credential', 'hash-object', 'mktree', 'commit-tree', 'write-tree', 'read-tree', 'pack-refs', 'repack', 'switch', 'checkout', 'restore', 'branch', 'stash', 'reset', 'clean', 'rm', 'worktree', 'remote', 'config', 'reflog', 'gc', 'push']);

function gitIncele(words, dizin, ctx) {
  // words[0] = git
  let i = 1, d = dizin;
  while (i < words.length) {
    const w = words[i].t;
    if (w === '-C') { const v = words[i + 1]; if (!v || v.dyn) return sonuc('ask', 'git -C dizini dinamik veya eksik'); d = path.resolve(d, v.t); i += 2; continue; }
    if (w.startsWith('-C') && w.length > 2) { d = path.resolve(d, w.slice(2)); i++; continue; }
    if (w === '-c') { const v = words[i + 1]; if (!v || v.dyn) return sonuc('ask', 'git -c değeri dinamik veya eksik'); if (/^(alias|push|remote|branch|url|core\.hookspath|include)/i.test(v.t)) return sonuc('ask', 'git -c ile push/alias/remote ayarı değiştiriliyor: ' + v.t); i += 2; continue; }
    if (/^--(git-dir|work-tree|namespace|exec-path|config-env|super-prefix)/.test(w)) return sonuc('ask', 'git ' + w + ' — hedef depo belirsiz');
    if (['--no-pager', '-P', '-p', '--paginate', '--no-replace-objects', '--literal-pathspecs', '--glob-pathspecs', '--noglob-pathspecs', '--icase-pathspecs', '--no-optional-locks', '--bare', '--no-advice'].includes(w)) { i++; continue; }
    if (w === '--version' || w === '--help' || w === '-h' || w === '-v') return YOK;
    if (w.startsWith('-')) return sonuc('ask', 'tanınmayan git seçeneği: ' + w);
    break;
  }
  if (i >= words.length) return YOK;
  if (words[i].dyn) return sonuc('ask', 'git alt komutu dinamik');
  const alt = words[i].t;
  const args = words.slice(i + 1);
  const at = args.map(x => x.t);
  const argDinamik = args.some(x => x.dyn);
  if (!GUVENLI_OKUMA.has(alt)) return sonuc('ask', 'tanınmayan git alt komutu (takma ad olabilir): git ' + alt);
  const kisaBayrak = (harf) => at.some(a => /^-[A-Za-z]+$/.test(a) && a.includes(harf));
  const var_ = (...xs) => at.some(a => xs.includes(a) || xs.some(x => x.endsWith('=') && a.startsWith(x)));
  const risk = (neden) => sonuc('ask', neden);
  const ciftTireSonrasi = at.indexOf('--');

  switch (alt) {
    case 'push': return pushIncele(args, d, ctx);
    case 'reset':
      if (argDinamik) return risk('git reset dinamik argümanla');
      if (var_('--hard', '--merge', '--keep')) return risk('git reset --hard/--merge/--keep çalışma alanındaki değişiklikleri silebilir');
      return YOK;
    case 'clean':
      if (argDinamik) return risk('git clean dinamik argümanla');
      if (var_('--force') || kisaBayrak('f')) return risk('git clean -f izlenmeyen dosyaları kalıcı siler');
      return YOK;
    case 'branch': {
      if (argDinamik) return risk('git branch dinamik argümanla');
      if (var_('--force') || kisaBayrak('D') || kisaBayrak('f') || kisaBayrak('M') || kisaBayrak('C')) return risk('git branch -D/-f/-M/-C dal siler veya üzerine yazar');
      if (var_('--delete') && (var_('--force') || kisaBayrak('f'))) return risk('git branch --delete --force');
      return YOK;
    }
    case 'checkout':
      if (argDinamik) return risk('git checkout dinamik argümanla');
      if (var_('--force', '--ours', '--theirs', '--patch') || kisaBayrak('f') || kisaBayrak('B') || kisaBayrak('p')) return risk('git checkout -f/-B/--ours/--theirs değişiklikleri ezebilir');
      if (ciftTireSonrasi >= 0 || at.includes('.') || at.some(a => a.includes('*'))) return risk('git checkout dosya yollarıyla çalışma alanındaki değişiklikleri ezer');
      return YOK;
    case 'switch':
      if (argDinamik) return risk('git switch dinamik argümanla');
      if (var_('--force', '--discard-changes') || kisaBayrak('f') || kisaBayrak('C')) return risk('git switch -f/-C/--discard-changes');
      return YOK;
    case 'restore': {
      if (argDinamik) return risk('git restore dinamik argümanla');
      const sadeceStaged = (var_('--staged') || kisaBayrak('S')) && !(var_('--worktree') || kisaBayrak('W'));
      return sadeceStaged ? YOK : risk('git restore çalışma alanındaki değişiklikleri ezer');
    }
    case 'stash': {
      const s = at[0];
      if (s === 'drop' || s === 'clear') return risk('git stash ' + s + ' saklanan değişiklikleri siler');
      return YOK;
    }
    case 'rm':
      if (var_('--force') || kisaBayrak('f')) return risk('git rm -f kaydedilmemiş değişiklikleri siler');
      return YOK;
    case 'worktree':
      if (at[0] === 'remove' && (var_('--force') || kisaBayrak('f'))) return risk('git worktree remove --force');
      return YOK;
    case 'remote': {
      const s = at[0];
      if (!s || s === '-v' || s === '--verbose' || s === 'show' || s === 'get-url') return YOK;
      return risk('git remote ' + s + ' uzak depo ayarını değiştirir');
    }
    case 'config': {
      const okuma = at.some(a => /^(--get|--get-all|--get-regexp|--get-urlmatch|--list|-l|--show-origin|--show-scope|--name-only|get|list)$/.test(a));
      if (okuma && !at.some(a => /^(--unset|--unset-all|--add|--replace-all|--rename-section|--remove-section|set|unset)$/.test(a))) return YOK;
      return risk('git config ayar değiştiriyor (push/alias davranışını etkileyebilir)');
    }
    case 'reflog':
      if (at[0] === 'expire' || at[0] === 'delete') return risk('git reflog ' + at[0] + ' kurtarma kayıtlarını siler');
      return YOK;
    case 'gc':
      if (at.some(a => /^--prune(=now)?$/.test(a) || a === '--prune=all')) return risk('git gc --prune kurtarılabilir nesneleri siler');
      return YOK;
    default:
      return YOK;
  }
}

/* ---------- git push ---------- */
function pushIncele(args, dizin, ctx) {
  const pozisyonel = [];
  let repoSecenek = null;
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    const a = w.t;
    if (w.dyn) return sonuc('ask', 'git push dinamik argüman içeriyor (' + a + ') — hedef belirlenemiyor');
    if (a === '--') { for (const x of args.slice(i + 1)) { if (x.dyn) return sonuc('ask', 'git push dinamik argüman içeriyor'); pozisyonel.push(x.t); } break; }
    if (a.startsWith('--')) {
      const [ad, deger] = a.split(/=(.*)/s);
      if (['--force', '--force-with-lease', '--force-if-includes'].includes(ad)) return sonuc('deny', 'force push yasak (' + ad + ')');
      if (['--mirror', '--delete', '--prune'].includes(ad)) return sonuc('deny', 'git push ' + ad + ' uzak dalları silebilir/ezer — yasak');
      if (['--all', '--branches'].includes(ad)) return sonuc('deny', 'git push ' + ad + ' korunan dalları da gönderir — yasak');
      if (['--receive-pack', '--exec'].includes(ad)) return sonuc('ask', 'git push ' + ad + ' — alışılmadık seçenek');
      if (ad === '--repo') { if (deger !== undefined) repoSecenek = deger; else { const v = args[++i]; if (!v || v.dyn) return sonuc('ask', '--repo değeri belirsiz'); repoSecenek = v.t; } continue; }
      if (ad === '--push-option') { if (deger === undefined) i++; continue; }
      if (['--set-upstream', '--dry-run', '--verbose', '--quiet', '--porcelain', '--progress', '--no-progress', '--no-verify', '--verify', '--tags', '--follow-tags', '--no-follow-tags', '--atomic', '--no-atomic', '--signed', '--no-signed', '--thin', '--no-thin', '--ipv4', '--ipv6', '--recurse-submodules', '--no-recurse-submodules', '--no-force-with-lease', '--no-force-if-includes'].includes(ad)) continue;
      return sonuc('ask', 'tanınmayan git push seçeneği: ' + ad);
    }
    if (a.startsWith('-') && a.length > 1) {
      const h = a.slice(1);
      if (h.includes('f')) return sonuc('deny', 'force push yasak (' + a + ')');
      if (h.includes('d')) return sonuc('deny', 'git push -d uzak dal siler — yasak');
      if (h === 'o') { i++; continue; }
      if (/^[unvq46]+$/.test(h)) continue;
      return sonuc('ask', 'tanınmayan git push seçeneği: ' + a);
    }
    pozisyonel.push(a);
  }

  let uzak = repoSecenek || pozisyonel[0] || null;
  const refspecler = repoSecenek ? pozisyonel : pozisyonel.slice(1);

  let dal = null; // mevcut dal (gerekirse)
  const dalAl = () => { if (dal === null) dal = mevcutDal(dizin); return dal; };

  // remote.<uzak>.mirror / remote.<uzak>.push ayarları
  const uzakAyar = (u) => {
    if (!u || /[:/]/.test(u)) return { mirror: false, push: [], hata: false }; // URL/yol: isimli uzak ayarı yok
    try { return { mirror: gitAyar(dizin, `remote.${u}.mirror`) === 'true', push: gitAyarHepsi(dizin, `remote.${u}.push`), hata: false }; }
    catch { return { mirror: false, push: [], hata: true }; }
  };

  if (refspecler.length) {
    const ua = uzakAyar(uzak);
    if (ua.mirror) return sonuc('deny', `remote.${uzak}.mirror=true — tüm dallar ezilir`);
    const belirsiz = [];
    for (const rs of refspecler) {
      if (rs.startsWith('+')) return sonuc('deny', 'force push yasak (+' + rs.slice(1) + ')');
      if (rs.startsWith(':')) return sonuc('deny', 'uzak dal silme yasak (' + rs + ')');
      if (rs.includes('*')) return sonuc('ask', 'joker karakterli refspec: ' + rs);
      let hedef;
      const ix = rs.indexOf(':');
      if (ix >= 0) {
        hedef = rs.slice(ix + 1);
        if (!hedef) return sonuc('ask', 'boş hedefli refspec: ' + rs);
        if (/^(HEAD|@)$/.test(hedef)) { const b = dalAl(); if (!b) return sonuc('ask', 'HEAD ayrık (detached) — hedef belirlenemiyor'); hedef = b; }
        if (hedef.startsWith('refs/') && !hedef.startsWith('refs/heads/')) continue; // etiket vb.
        if (korunanMi(hedef)) return sonuc('deny', 'korunan dala push yasak: ' + dalAdiNormal(hedef));
      } else {
        if (/^(HEAD|@)$/.test(rs)) { const b = dalAl(); if (!b) return sonuc('ask', 'HEAD ayrık (detached) — hedef belirlenemiyor'); hedef = b; }
        else hedef = rs;
        if (korunanMi(hedef)) return sonuc('deny', 'korunan dala push yasak: ' + dalAdiNormal(hedef));
        if (hedef.startsWith('refs/') && !hedef.startsWith('refs/heads/')) continue;
        belirsiz.push(hedef);
      }
    }
    if (belirsiz.length && (ua.hata || ua.push.length)) return sonuc('ask', `remote.${uzak}.push ayarı okunamadı veya tanımlı — hedef dal kesin belirlenemiyor (${belirsiz.join(', ')})`);
    return YOK;
  }

  // refspec yok: hedef Git ayarlarından çıkarılır
  const b = dalAl();
  if (!b) return sonuc('ask', 'mevcut dal belirlenemedi (HEAD ayrık veya depo değil)');
  const bUzak = gitAyar(dizin, `branch.${b}.remote`);
  const bMerge = gitAyar(dizin, `branch.${b}.merge`);
  if (!uzak) uzak = gitAyar(dizin, `branch.${b}.pushRemote`) || gitAyar(dizin, 'remote.pushDefault') || bUzak || 'origin';
  const ua = uzakAyar(uzak);
  if (ua.mirror) return sonuc('deny', `remote.${uzak}.mirror=true — tüm dallar ezilir`);
  if (ua.hata) return sonuc('ask', 'Git ayarları okunamadı — hedef dal belirlenemiyor');
  if (ua.push.length) return sonuc('ask', `remote.${uzak}.push ayarı tanımlı — hedef dal kesin belirlenemiyor`);
  const mod = (gitAyar(dizin, 'push.default') || 'simple').toLowerCase();
  const upstreamDal = bMerge ? dalAdiNormal(bMerge) : '';
  const ayniUzak = bUzak && bUzak === uzak;
  let hedefler;
  if (mod === 'nothing') return YOK;
  else if (mod === 'current') hedefler = [b];
  else if (mod === 'upstream' || mod === 'tracking') { if (!upstreamDal) return sonuc('ask', 'push.default=upstream ama bağlı uzak dal yok'); hedefler = [upstreamDal]; }
  else if (mod === 'simple') {
    if (ayniUzak) { if (!upstreamDal) return sonuc('ask', 'bağlı uzak dal yok — hedef belirsiz'); hedefler = [b, upstreamDal]; }
    else hedefler = [b];
  }
  else if (mod === 'matching') return sonuc('ask', 'push.default=matching — eşleşen tüm dallar (korunanlar dahil) gönderilebilir');
  else return sonuc('ask', 'bilinmeyen push.default değeri: ' + mod);
  const k = hedefler.find(korunanMi);
  if (k) return sonuc('deny', `korunan dala push yasak: ${k} (dal belirtilmeden, push.default=${mod})`);
  return YOK;
}

/* ---------- Bash komutu ---------- */
export function bashIncele(komut, cwd, derinlik = 0) {
  if (typeof komut !== 'string') return sonuc('ask', 'komut okunamadı');
  if (!gitSozcugu.test(komut)) return YOK;
  if (derinlik > 4) return sonuc('ask', 'iç içe komut çok derin');
  let c;
  try { c = kabukCozumle(komut); } catch (e) { return sonuc('ask', 'komut çözümlenemedi (' + e.message + ') ve git içeriyor'); }
  const kararlar = [];
  let dizin = cwd, dizinBelirsiz = false;
  for (const ic of c.icKomutlar) kararlar.push(bashIncele(ic, cwd, derinlik + 1));
  for (const seg of c.segmentler) {
    let w = seg.words.slice();
    // baştaki anahtar sözcükler ve DEGISKEN=deger atamaları
    const ANAHTAR = new Set(['{', '}', '!', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', 'time']);
    while (w.length && ((ANAHTAR.has(w[0].t) && !w[0].dyn) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0].t))) w.shift();
    // sarmalayıcıları soy
    let soyuldu = true;
    while (soyuldu && w.length) {
      soyuldu = false;
      const ad = komutAdi(w[0].t);
      if (SARMALAYICI.has(ad) && !w[0].dyn) {
        w.shift(); soyuldu = true;
        if (ad === 'env') { while (w.length && (w[0].t.startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0].t))) { if (/^-(S|-split-string)/.test(w[0].t)) return sonuc('ask', 'env -S ile komut içeren metin'); w.shift(); } }
        else if (ad === 'timeout') { while (w.length && w[0].t.startsWith('-')) w.shift(); if (w.length) w.shift(); }
        else if (ad === 'nice' || ad === 'ionice' || ad === 'stdbuf' || ad === 'sudo') { while (w.length && w[0].t.startsWith('-')) { const o = w.shift().t; if (/^-(n|u|g|c|p|i|o|e)$/.test(o) && w.length) w.shift(); } }
        else { while (w.length && w[0].t.startsWith('-')) w.shift(); }
      }
    }
    if (!w.length) continue;
    const ilk = w[0];
    const segMetin = w.map(x => x.t).join(' ');
    if (ilk.dyn) { if (gitSozcugu.test(segMetin) || gitSozcugu.test(komut)) kararlar.push(sonuc('ask', 'komut adı dinamik ve git içeriyor')); continue; }
    const ad = komutAdi(ilk.t);
    if (ad === 'cd' || ad === 'pushd') {
      const hedef = w[1];
      if (!hedef) dizin = process.env.HOME || dizin;
      else if (hedef.dyn || hedef.t === '-') dizinBelirsiz = true;
      else dizin = path.resolve(dizin, hedef.t.replace(/^~(?=\/|$)/, process.env.HOME || '~'));
      continue;
    }
    if (ad === 'popd') { dizinBelirsiz = true; continue; }
    if (ad === 'git') {
      let k;
      try { k = gitIncele(w, dizin, {}); } catch (e) { k = sonuc('ask', 'git komutu incelenirken hata: ' + (e && e.message)); }
      if (dizinBelirsiz && k.karar === 'none' && w.some(x => x.t === 'push')) kararlar.push(sonuc('ask', 'çalışma dizini belirsiz (cd ile dinamik dizin) ve git push var'));
      kararlar.push(k);
      continue;
    }
    if (CALISTIRICI.has(ad) || ad.startsWith('python') || ad.startsWith('node')) {
      if (w.slice(1).some(x => gitSozcugu.test(x.t))) kararlar.push(sonuc('ask', `${ad} ile çalıştırılan metin git içeriyor — içerik doğrulanamadı`));
      continue;
    }
    if (ad === 'gh' || ad === 'hub') { /* kapsam dışı: bkz. sınırlar (gh CLI) */ continue; }
    // diğer komutlar (echo, grep, printf, cat …): git metni veri kabul edilir
  }
  return enGuclu(kararlar);
}

/* ---------- GitHub MCP araçları ---------- */
const MCP_OKUMA = /^(get_|list_|search_)|_read$|^run_secret_scanning$/;
export function mcpIncele(arac, girdi) {
  const ad = arac.replace(/^mcp__github__/, '');
  const g = girdi || {};
  const dalKontrol = (alan) => {
    const v = g[alan];
    if (typeof v !== 'string' || !v.trim()) return sonuc('ask', `${ad}: '${alan}' alanı boş — hedef dal belirlenemiyor`);
    if (korunanMi(v)) return sonuc('deny', `GitHub üzerinden korunan dala yazma yasak: ${dalAdiNormal(v)} (${ad})`);
    return YOK;
  };
  switch (ad) {
    case 'create_or_update_file':
    case 'push_files':
    case 'delete_file':
      return dalKontrol('branch');
    case 'create_branch':
      if (typeof g.branch === 'string' && korunanMi(g.branch)) return sonuc('deny', 'korunan dal adıyla dal oluşturma yasak: ' + dalAdiNormal(g.branch));
      return YOK;
    case 'merge_pull_request':
    case 'enable_pr_auto_merge':
      return sonuc('deny', `${ad}: hedef dal girdiden doğrulanamıyor; merge kullanıcı tarafından GitHub'da yapılmalı`);
    case 'update_pull_request_branch':
      return sonuc('ask', 'update_pull_request_branch PR dalına yazar — dal girdiden doğrulanamıyor');
    case 'create_pull_request':
      return sonuc('ask', `PR açma kullanıcı onayı gerektirir (base: ${g.base || '?'}, head: ${g.head || '?'})`);
    case 'update_pull_request':
      if (typeof g.base === 'string' && korunanMi(g.base)) return sonuc('ask', 'PR hedefi korunan dala çevriliyor: ' + dalAdiNormal(g.base));
      return YOK;
    case 'actions_run_trigger':
      if (g.method === 'run_workflow') return sonuc('ask', `iş akışı başlatma (${g.workflow_id || '?'} @ ${g.ref || '?'})`);
      return YOK;
    default:
      if (MCP_OKUMA.test(ad)) return YOK;
      return sonuc('ask', 'tanınmayan GitHub yazma aracı: ' + ad);
  }
}

/* ---------- ana karar ---------- */
export function karar(girdi) {
  const arac = girdi && girdi.tool_name;
  const cwd = (girdi && girdi.cwd) || process.cwd();
  if (arac === 'Bash') return bashIncele(girdi.tool_input && girdi.tool_input.command, cwd);
  if (typeof arac === 'string' && arac.startsWith('mcp__github__')) return mcpIncele(arac, girdi.tool_input);
  return YOK;
}

function yaz(k) {
  if (k.karar === 'none') return; // karar yok: çıktı basma
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: k.karar, // yalnızca 'deny' veya 'ask'
      permissionDecisionReason: '[git-guvenlik-kontrolu] ' + k.neden,
    },
  }));
}

const dogrudanCalisti = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (dogrudanCalisti) {
  let ham = '';
  try { ham = fs.readFileSync(0, 'utf8'); } catch { ham = ''; }
  let k;
  try {
    const girdi = JSON.parse(ham);
    k = karar(girdi);
    if (!k || !(k.karar in SIRA)) k = sonuc('ask', 'iç hata: geçersiz karar');
  } catch (e) {
    // girdi okunamadı / iç hata: git veya GitHub ile ilgili olabilecekse kullanıcıya sor
    k = (/git|mcp__github__/.test(ham) || !ham) ? sonuc('ask', 'Hook iç hatası: ' + (e && e.message)) : YOK;
  }
  yaz(k);
  process.exit(0);
}
