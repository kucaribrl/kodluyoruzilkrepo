/* IQ Basics — WhatsApp Kuyruğu Dinleyicisi (ÖRNEK)
 * Mevcut whatsapp-web.js sistemine EKLENECEK modül.
 *
 * Ne yapar: Uygulamada "WhatsApp Otomasyonu" açıkken fiş/makbuz/hatırlatma
 * mesajları buluttaki isletme/iqbasics/wa_kuyruk koleksiyonuna yazılır.
 * Bu modül kuyruğu dinler, mesajı whatsapp-web.js Client ile gönderir,
 * durumu 'gonderildi' (ya da 'hata') yapar. Yazıcı ajanıyla aynı desen;
 * iki sistem aynı anda çalışsa bile transaction sayesinde mesaj İKİ KEZ gitmez.
 *
 * Kurulum:
 *   1) npm i firebase   (whatsapp-web.js projenin içinde)
 *   2) Bu dosyayı projene kopyala; yanına yazici-agent'taki gibi bir
 *      config.json koy: { "email": "...", "sifre": "..." }  (bulut hesabın)
 *   3) whatsapp-web.js Client 'ready' olduktan sonra:
 *        const { waKuyrukBaslat } = require('./ornek-dinleyici');
 *        client.on('ready', () => waKuyrukBaslat(client));
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, query, where, onSnapshot, getDocs,
        doc, updateDoc, runTransaction } = require('firebase/firestore');

// Uygulamayla aynı (herkese açık) bulut ayarı — yazici-agent/agent.js ile birebir
const FB_CONFIG = {
  apiKey: "AIzaSyCQWOyx02CEhuvzeo068pKucYwjxl6gS-k",
  authDomain: "iq-basics.firebaseapp.com",
  projectId: "iq-basics",
  storageBucket: "iq-basics.firebasestorage.app",
  messagingSenderId: "432547902086",
  appId: "1:432547902086:web:0ad08ac8e04df637951707"
};
const MAGAZA_ID = 'iqbasics';

const log = (...a) => console.log(new Date().toLocaleTimeString('tr-TR'), '[wa-kuyruk]', ...a);

async function waKuyrukBaslat(client, configYolu) {
  const cfgPath = configYolu || path.join(__dirname, 'config.json');
  if (!fs.existsSync(cfgPath)) { log('❌ config.json yok (email+sifre) —', cfgPath); return; }
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
  catch (e) { throw new Error('config.json okunamadı (yazım hatası olabilir): ' + e.message); }

  const app = initializeApp(FB_CONFIG, 'wa-kuyruk');
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, cfg.email, cfg.sifre);
  const db = getFirestore(app);
  log('✅ Buluta bağlandı — kuyruk dinleniyor.');

  // 🧟 Açılışta takılı kalmış mesajları kurtar: önceki süreç 'gonderiliyor' derken kapandıysa
  // (baslama 5 dk'dan eski ya da hiç yok) mesajı tekrar 'bekliyor'a al.
  try {
    const takili = await getDocs(query(collection(db, 'isletme', MAGAZA_ID, 'wa_kuyruk'), where('durum', '==', 'gonderiliyor')));
    for (const d of takili.docs) {
      const b = +(d.data().baslama || 0);
      if (!b || Date.now() - b > 5 * 60 * 1000) {
        log('♻️  Takılı mesaj tekrar kuyruğa alındı:', d.id);
        try { await updateDoc(d.ref, { durum: 'bekliyor', baslama: null }); } catch (e) { log('⚠️ Takılı mesaj güncellenemedi:', d.id, String(e).slice(0, 120)); }
      }
    }
  } catch (e) { log('⚠️ Takılı mesaj kontrolü yapılamadı:', String(e).slice(0, 120)); }

  const q = query(collection(db, 'isletme', MAGAZA_ID, 'wa_kuyruk'), where('durum', '==', 'bekliyor'));
  // 🐢 SIRALI gönderim: mesajlar tek tek, aralarında 3-8 sn rastgele bekleyerek gider
  // (30 mesaj aynı anda gitmesin — WhatsApp hesabı için ban riski). Numara kayıtlı değilse 'hata'.
  const kuyruk = []; let calisiyor = false;
  const bekle = ms => new Promise(r => setTimeout(r, ms));
  async function isle() {
    if (calisiyor) return; calisiyor = true;
    while (kuyruk.length) {
      const id = kuyruk.shift();
      const ref = doc(db, 'isletme', MAGAZA_ID, 'wa_kuyruk', id);
      let veri = null;
      try {
        veri = await runTransaction(db, async tr => {
          const d0 = await tr.get(ref);
          if (!d0.exists() || d0.data().durum !== 'bekliyor') return null;
          tr.update(ref, { durum: 'gonderiliyor', baslama: Date.now() });
          return d0.data();
        });
      } catch (e) { continue; }
      if (!veri) continue;
      try {
        let no = String(veri.tel || '').replace(/\D/g, '');
        if (no.startsWith('00')) no = no.slice(2);          // 0049… uluslararası önek
        if (no.length === 10) no = '90' + no;               // 5xx… → 90 5xx…
        else if (no.startsWith('0') && no.length === 11) no = '9' + no; // 05xx… → 905xx…
        if (no.length < 11) throw new Error('geçersiz numara: ' + veri.tel);
        let hedef = no + '@c.us';
        try { const nid = await client.getNumberId(no); if (!nid) throw new Error('WhatsApp\'ta kayıtlı değil: ' + no); hedef = nid._serialized; } catch (e) { if (/kayıtlı değil/.test(String(e))) throw e; }
        await client.sendMessage(hedef, String(veri.mesaj || ''));
        await updateDoc(ref, { durum: 'gonderildi', gonderim: Date.now() });
        log('📤 Gönderildi →', no, '(' + (veri.tip || 'genel') + ')');
      } catch (e) {
        try { await updateDoc(ref, { durum: 'hata', hata: String(e).slice(0, 200) }); } catch (x) {}
        log('⚠️ Gönderilemedi:', String(e).slice(0, 120));
      }
      if (kuyruk.length) await bekle(3000 + Math.floor(Math.random() * 5000));
    }
    calisiyor = false;
  }
  onSnapshot(q, snap => {
    snap.docChanges().forEach(ch => { if (ch.type === 'added' && !kuyruk.includes(ch.doc.id)) kuyruk.push(ch.doc.id); });
    isle();
  }, e => {
    // Dinleyici koptu (izin/ağ/kota) — SDK yeniden bağlanmaz; süreç kapanır, baslat.bat/vbs yeniden başlatır.
    log('❌ Dinleme hatası:', (e && e.code) || e, '— süreç kapanıyor, yeniden başlatılacak.');
    process.exit(1);
  });
}

module.exports = { waKuyrukBaslat };
