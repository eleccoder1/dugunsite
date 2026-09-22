/* Yönetim paneli */
(function () {
  "use strict";
  var API = "../api/admin.php";
  var CSRF = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtSize(b) { b = +b || 0; if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB"; if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB"; return Math.round(b / 1024) + " KB"; }
  function fmtDate(s) { if (!s) return ""; var d = new Date(s.replace(" ", "T") + "+03:00"); return d.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  var toastT;
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 3000); }

  $$(".pw-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var inp = btn.previousElementSibling;
      var show = inp.type === "password";
      inp.type = show ? "text" : "password";
      btn.textContent = show ? "Gizle" : "Göster";
    });
  });

  function api(action, body, query) {
    var init = { method: body ? "POST" : "GET", headers: {}, credentials: "same-origin" };
    if (body) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    if (CSRF) init.headers["X-CSRF"] = CSRF;
    return fetch(API + "?a=" + action + (query || ""), init).then(function (r) {
      return r.json().catch(function () { throw new Error("Sunucu yanıtı okunamadı (" + r.status + ")."); });
    }).then(function (d) {
      if (d.ok) return d;
      if (d.error && /Oturum/.test(d.error)) showLogin();
      throw new Error(d.error || "İşlem tamamlanamadı.");
    });
  }

  /* ─── giriş ─── */
  function showLogin() { $("#app").hidden = true; $("#login").hidden = false; CSRF = null; $("#loginForm").password.focus(); }
  function showApp() { $("#login").hidden = true; $("#app").hidden = false; openTab(location.hash.replace("#", "") || "ozet"); }
  api("me").then(function (d) { if (d.admin) { CSRF = d.csrf; showApp(); } else showLogin(); })
    .catch(function (e) { document.body.innerHTML = '<p style="padding:40px;text-align:center">' + esc(e.message) + "</p>"; });

  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, err = $(".form-err", f); err.textContent = "";
    api("login", { password: f.password.value }).then(function (d) { CSRF = d.csrf; f.password.value = ""; showApp(); })
      .catch(function (x) { err.textContent = x.message; });
  });
  $("#logout").addEventListener("click", function () { api("logout", {}).then(showLogin, showLogin); });

  /* ─── sekmeler ─── */
  var loaders = {};
  function openTab(t) {
    if (!$('[data-panel="' + t + '"]')) t = "ozet";
    $$("#tabs button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === t); });
    $$("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== t; });
    history.replaceState(null, "", "#" + t);
    if (loaders[t]) loaders[t]();
  }
  $("#tabs").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) openTab(b.getAttribute("data-tab")); });

  /* ─── özet ─── */
  loaders.ozet = function () {
    api("stats").then(function (d) {
      var r = d.rsvp, m = d.memories, md = d.media;
      $("#stats").innerHTML =
        '<div class="stat hl"><b>' + r.kisi + '</b><span>kişi geliyor</span><small>' + r.geliyor + " yanıt, eşlikçilerle birlikte</small></div>" +
        '<div class="stat"><b>' + r.toplam + '</b><span>katılım yanıtı</span><small>' + r.gelmiyor + " katılamayacak · " + r.belki + " belirsiz</small></div>" +
        '<div class="stat"><b>' + m.n + '</b><span>anı defteri mesajı</span><small>' + (m.bekleyen ? m.bekleyen + " onay bekliyor" : "Bekleyen yok") + "</small></div>" +
        '<div class="stat"><b>' + md.n + '</b><span>albüm dosyası</span><small>' + md.foto + " fotoğraf · " + md.video + " video" + (md.bekleyen ? " · " + md.bekleyen + " onay bekliyor" : "") + "</small></div>" +
        '<div class="stat"><b>' + d.quiz + '</b><span>oyun skoru</span></div>';
      $("#storage").innerHTML = '<h2 class="h3">Depolama</h2><p>Albüm şu an <b>' + fmtSize(md.boyut) + "</b> yer kaplıyor." +
        (d.disk_free !== null ? " Sunucuda görünen boş alan: <b>" + fmtSize(d.disk_free) + "</b> (hosting paket kotanız daha düşük olabilir, cPanel ana sayfasından kontrol edin)." : "") + "</p>" +
        (d.zip ? "" : '<p class="muted">Sunucuda ZIP eklentisi yok; toplu indirme için cPanel Dosya Yöneticisi\'ni kullanın.</p>');
    }).catch(function (e) { toast(e.message); });
  };

  /* ─── katılım ─── */
  var rsvp = [];
  var ST = { geliyor: "Katılacak", gelmiyor: "Katılamayacak", belki: "Belirsiz" };
  loaders.katilim = function () { api("rsvp_list").then(function (d) { rsvp = d.items; drawRsvp(); }).catch(function (e) { toast(e.message); }); };
  function drawRsvp() {
    var q = $("#rsvpSearch").value.trim().toLocaleLowerCase("tr"), f = $("#rsvpFilter").value;
    var rows = rsvp.filter(function (r) {
      return (!f || r.status === f) && (!q || (r.first_name + " " + r.last_name).toLocaleLowerCase("tr").indexOf(q) >= 0);
    });
    var people = rows.reduce(function (s, r) { return s + (r.status === "geliyor" ? r.adults + r.children : 0); }, 0);
    $("#rsvpSum").textContent = rows.length + " yanıt listeleniyor · bu listede gelecek toplam kişi: " + people;
    $("#rsvpTable").innerHTML = "<thead><tr><th>Ad soyad</th><th>Durum</th><th>Yetişkin</th><th>Çocuk</th><th>Tarih</th><th></th></tr></thead><tbody>" +
      (rows.length ? rows.map(function (r) {
        return "<tr><td>" + esc(r.first_name + " " + r.last_name) + '</td><td><span class="pill ' + r.status + '">' + ST[r.status] + '</span></td><td class="num">' +
          (r.status === "geliyor" ? r.adults : "–") + '</td><td class="num">' + (r.status === "geliyor" ? r.children : "–") +
          '</td><td class="num">' + fmtDate(r.updated_at) + '</td><td><button type="button" class="del" data-del="' + r.id + '">Sil</button></td></tr>';
      }).join("") : '<tr><td colspan="6" class="muted">Henüz yanıt yok.</td></tr>') + "</tbody>";
  }
  $("#rsvpSearch").addEventListener("input", drawRsvp);
  $("#rsvpFilter").addEventListener("change", drawRsvp);
  $("#rsvpTable").addEventListener("click", function (e) {
    var id = e.target.getAttribute("data-del"); if (!id) return;
    var r = rsvp.filter(function (x) { return x.id === +id; })[0];
    if (!confirm(r.first_name + " " + r.last_name + " adlı kişinin yanıtı silinsin mi?")) return;
    api("rsvp_delete", { id: +id }).then(function () { rsvp = rsvp.filter(function (x) { return x.id !== +id; }); drawRsvp(); toast("Yanıt silindi."); })
      .catch(function (x) { toast(x.message); });
  });

  /* ─── anı defteri ─── */
  var mems = [];
  loaders.anilar = function () { api("memories_list").then(function (d) { mems = d.items; drawMems(); }).catch(function (e) { toast(e.message); }); };
  function drawMems() {
    $("#memList").innerHTML = mems.length ? mems.map(function (m) {
      return '<div class="a-item' + (m.approved ? "" : " pending") + '">' + (m.image ? '<img src="' + esc(m.image) + '" alt="" data-view="' + esc(m.image) + '">' : "") +
        '<div class="body"><div class="who">' + esc(m.name) + (m.private ? ' <span class="tag-private">Sadece biz</span>' : "") + '</div><div class="msg">' + esc(m.message) + '</div><div class="meta">' + fmtDate(m.created_at) +
        (m.approved ? " · Yayında" : " · Onay bekliyor") + '</div><div class="acts">' +
        '<button type="button" data-mset="' + m.id + '" data-v="' + (m.approved ? 0 : 1) + '">' + (m.approved ? "Gizle" : "Onayla") + "</button>" +
        '<button type="button" class="danger" data-mdel="' + m.id + '">Sil</button></div></div></div>';
    }).join("") : '<p class="muted">Henüz mesaj yok.</p>';
  }
  $("#memList").addEventListener("click", function (e) {
    var t = e.target, id;
    if ((id = t.getAttribute("data-mset"))) {
      var v = +t.getAttribute("data-v");
      api("memory_set", { id: +id, approved: v }).then(function () { mems.forEach(function (m) { if (m.id === +id) m.approved = !!v; }); drawMems(); toast(v ? "Mesaj yayında." : "Mesaj gizlendi."); }).catch(function (x) { toast(x.message); });
    } else if ((id = t.getAttribute("data-mdel"))) {
      if (!confirm("Mesaj kalıcı olarak silinsin mi?")) return;
      api("memory_delete", { id: +id }).then(function () { mems = mems.filter(function (m) { return m.id !== +id; }); drawMems(); toast("Mesaj silindi."); }).catch(function (x) { toast(x.message); });
    } else if (t.getAttribute("data-view")) {
      view({ kind: "image", url: t.getAttribute("data-view") });
    }
  });

  /* ─── albüm ─── */
  var med = [], medMore = false;
  function loadMedia(reset) {
    var off = reset ? 0 : med.length;
    api("media_list", null, "&offset=" + off + "&filter=" + $("#mediaFilter").value).then(function (d) {
      med = reset ? d.items : med.concat(d.items); medMore = d.more; drawMedia();
    }).catch(function (e) { toast(e.message); });
  }
  loaders.album = function () { loadMedia(true); };
  $("#mediaFilter").addEventListener("change", function () { loadMedia(true); });
  $("#mediaMore").addEventListener("click", function () { loadMedia(false); });
  function drawMedia() {
    $("#mediaGrid").innerHTML = med.length ? med.map(function (m, i) {
      return '<div class="a-tile' + (m.approved ? "" : " pending") + '"><button type="button" class="th" data-i="' + i + '">' +
        (m.thumb ? '<img src="' + esc(m.thumb) + '" alt="" loading="lazy">' : "") + '<span class="tag">' + (m.kind === "video" ? "Video" : "Foto") + " · " + fmtSize(m.size) + "</span>" +
        (m.private ? '<span class="tag tag-private">Sadece biz</span>' : "") + "</button>" +
        '<div class="meta" title="' + esc(m.original_name) + '">' + esc(m.uploader) + " · " + fmtDate(m.created_at) + "</div>" +
        '<div class="acts"><a href="' + esc(m.url) + '" download="' + esc(m.original_name) + '">İndir</a>' +
        '<button type="button" data-set="' + i + '">' + (m.approved ? "Gizle" : "Onayla") + "</button>" +
        '<button type="button" class="danger" data-del="' + i + '">Sil</button></div></div>';
    }).join("") : '<p class="muted">Gösterilecek dosya yok.</p>';
    $("#mediaMore").hidden = !medMore;
  }
  $("#mediaGrid").addEventListener("click", function (e) {
    var t = e.target.closest("[data-i],[data-set],[data-del]"); if (!t) return;
    if (t.hasAttribute("data-i")) return view(med[+t.getAttribute("data-i")]);
    if (t.hasAttribute("data-set")) {
      var m = med[+t.getAttribute("data-set")], v = m.approved ? 0 : 1;
      api("media_set", { id: m.id, approved: v }).then(function () { m.approved = !!v; drawMedia(); toast(v ? "Dosya yayında." : "Dosya gizlendi."); }).catch(function (x) { toast(x.message); });
    }
    if (t.hasAttribute("data-del")) {
      var d = med[+t.getAttribute("data-del")];
      if (!confirm("Dosya kalıcı olarak silinsin mi? Bu işlem geri alınamaz.")) return;
      api("media_delete", { id: d.id }).then(function () { med = med.filter(function (x) { return x.id !== d.id; }); drawMedia(); toast("Dosya silindi."); }).catch(function (x) { toast(x.message); });
    }
  });

  function view(m) {
    $("#lbFig").innerHTML = m.kind === "video" ? '<video src="' + esc(m.url) + '" controls playsinline autoplay></video>' : '<img src="' + esc(m.url) + '" alt="">';
    $("#lb").hidden = false;
  }
  function closeView() { $("#lb").hidden = true; $("#lbFig").innerHTML = ""; }
  $("#lbClose").addEventListener("click", closeView);
  $("#lb").addEventListener("click", function (e) { if (e.target === this) closeView(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeView(); });

  /* ─── oyun ─── */
  var quiz = [];
  loaders.oyun = function () {
    api("quiz_list").then(function (d) { quiz = d.items; drawQuiz(); }).catch(function (e) { toast(e.message); });
    loadQuizQ();
  };
  function drawQuiz() {
    $("#quizTable").innerHTML = "<thead><tr><th>#</th><th>İsim</th><th>Skor</th><th>Tarih</th><th></th></tr></thead><tbody>" +
      (quiz.length ? quiz.map(function (q, i) {
        return '<tr><td class="num">' + (i + 1) + "</td><td>" + esc(q.name) + '</td><td class="num">' + q.score + " / " + q.total + '</td><td class="num">' + fmtDate(q.created_at) +
          '</td><td><button type="button" class="del" data-del="' + q.id + '">Sil</button></td></tr>';
      }).join("") : '<tr><td colspan="5" class="muted">Henüz kimse oynamadı.</td></tr>') + "</tbody>";
  }
  $("#quizTable").addEventListener("click", function (e) {
    var id = e.target.getAttribute("data-del"); if (!id) return;
    api("quiz_delete", { id: +id }).then(loaders.oyun).catch(function (x) { toast(x.message); });
  });
  $("#quizReset").addEventListener("click", function () {
    if (!confirm("Tüm oyun skorları silinsin mi?")) return;
    api("quiz_reset", {}).then(function () { toast("Skorlar sıfırlandı."); loaders.oyun(); }).catch(function (x) { toast(x.message); });
  });

  /* ─── oyun soruları ─── */
  var quizQ = [];
  function loadQuizQ() { return api("quiz_questions_list").then(function (d) { quizQ = d.items; drawQuizQ(); }).catch(function (e) { toast(e.message); }); }
  function questionCard(q, i, total) {
    return '<div class="a-item qedit"><div class="body">' +
      '<label class="field"><span>Soru</span><input class="q-soru" maxlength="300" value="' + esc(q.soru) + '"></label>' +
      '<div class="q-opts">' + q.siklar.map(function (o, oi) {
        return '<div class="q-opt"><input type="radio" class="q-dogru" data-oi="' + oi + '"' + (oi === q.dogru ? " checked" : "") + '>' +
          '<input type="text" class="q-opt-text" maxlength="120" placeholder="Şık ' + (oi + 1) + '" value="' + esc(o) + '">' +
          '<button type="button" class="q-opt-del" data-oi="' + oi + '" title="Şıkkı sil">×</button></div>';
      }).join("") + "</div>" +
      '<div class="acts">' +
      '<button type="button" class="linkbtn q-opt-add">+ Şık ekle</button>' +
      '<button type="button" class="q-save">Kaydet</button>' +
      (i > 0 ? '<button type="button" class="q-up">↑</button>' : "") +
      (i < total - 1 ? '<button type="button" class="q-down">↓</button>' : "") +
      '<button type="button" class="danger q-del">Sil</button>' +
      "</div></div></div>";
  }
  function drawQuizQ() {
    $("#quizQList").innerHTML = quizQ.length ? quizQ.map(function (q, i) { return questionCard(q, i, quizQ.length); }).join("") : '<p class="muted">Henüz soru yok.</p>';
  }
  $("#quizQAdd").addEventListener("click", function () {
    quizQ.push({ id: 0, soru: "", siklar: ["", ""], dogru: 0 });
    drawQuizQ();
  });
  $("#quizQList").addEventListener("click", function (e) {
    var card = e.target.closest(".qedit"); if (!card) return;
    var idx = $$(".qedit", $("#quizQList")).indexOf(card);
    var q = quizQ[idx]; if (!q) return;
    if (e.target.classList.contains("q-opt-add")) {
      if (q.siklar.length >= 6) { toast("En fazla 6 şık eklenebilir."); return; }
      q.siklar.push(""); drawQuizQ(); return;
    }
    if (e.target.classList.contains("q-opt-del")) {
      if (q.siklar.length <= 2) { toast("En az 2 şık olmalı."); return; }
      var oi = +e.target.getAttribute("data-oi");
      q.siklar.splice(oi, 1);
      if (oi === q.dogru) q.dogru = 0;
      else if (oi < q.dogru) q.dogru--;
      drawQuizQ(); return;
    }
    if (e.target.classList.contains("q-up")) { api("quiz_question_move", { id: q.id, dir: "up" }).then(loadQuizQ).catch(function (x) { toast(x.message); }); return; }
    if (e.target.classList.contains("q-down")) { api("quiz_question_move", { id: q.id, dir: "down" }).then(loadQuizQ).catch(function (x) { toast(x.message); }); return; }
    if (e.target.classList.contains("q-del")) {
      if (!q.id) { quizQ.splice(idx, 1); drawQuizQ(); return; }
      if (!confirm("Bu soru kalıcı olarak silinsin mi?")) return;
      api("quiz_question_delete", { id: q.id }).then(loadQuizQ).catch(function (x) { toast(x.message); });
      return;
    }
    if (e.target.classList.contains("q-save")) {
      var soru = $(".q-soru", card).value.trim();
      var opts = $$(".q-opt-text", card).map(function (el) { return el.value.trim(); });
      var dogruEl = card.querySelector(".q-dogru:checked");
      var dogru = dogruEl ? +dogruEl.getAttribute("data-oi") : 0;
      api("quiz_question_save", { id: q.id, soru: soru, siklar: opts, dogru: dogru })
        .then(function () { toast("Soru kaydedildi."); loadQuizQ(); })
        .catch(function (x) { toast(x.message); });
    }
  });

  /* ─── ayarlar ─── */
  var TOG = [
    ["rsvp_open", "Katılım formu açık", "Kapatınca misafirler yanıt gönderemez."],
    ["auto_wedding_day", "Düğün günü otomatik aç", "Açıkken anı defteri, albüm ve oyun düğün tarihinden (config.php > wedding_date) itibaren kendiliğinden açılır; aşağıdaki anahtarları erken açmak için yine kullanabilirsiniz."],
    ["memories_open", "Anı Defteri açık", "Kapatınca yeni mesaj yazılamaz; mevcutlar görünmeye devam eder."],
    ["uploads_open", "Albüme yükleme açık", "Kapatınca misafirler dosya yükleyemez; albüm görünmeye devam eder."],
    ["oyun_open", "Oyun açık", "Kapatınca misafirler oyunu oynayamaz; sıralama görünmeye devam eder."],
    ["auto_approve", "Yeni içerikler hemen yayınlansın", "Kapatırsanız mesaj ve fotoğraflar siz onaylayana kadar gizli kalır."]
  ];
  loaders.ayarlar = function () {
    api("settings").then(function (d) {
      $("#toggles").innerHTML = TOG.map(function (t) {
        return '<label class="toggle"><span>' + t[1] + "<small>" + t[2] + '</small></span><input type="checkbox" data-key="' + t[0] + '"' + (d.settings[t[0]] ? " checked" : "") + "></label>";
      }).join("") + (d.settings.wedding_day_reached ? '<p class="muted small">Düğün günü gelmiş görünüyor.</p>' : '<p class="muted small">Düğün gününe daha var; otomatik açılış tarihi geldiğinde devreye girecek.</p>');
    }).catch(function (e) { toast(e.message); });
    drawQr();
  };
  $("#toggles").addEventListener("change", function (e) {
    var k = e.target.getAttribute("data-key"); if (!k) return;
    var v = e.target.checked ? 1 : 0;
    api("settings_set", { key: k, value: v }).then(function () { toast("Ayar kaydedildi."); })
      .catch(function (x) { e.target.checked = !v; toast(x.message); });
  });

  function drawQr() {
    var url = location.origin + location.pathname.replace(/yonetim\/.*$/, "") + "#album";
    $("#qrUrl").textContent = url;
    var box = $("#qr"); box.innerHTML = "";
    if (!window.QRCode) { box.textContent = "QR kütüphanesi yüklenemedi."; $("#qrDl").hidden = true; return; }
    new window.QRCode(box, { text: url, width: 512, height: 512, colorDark: "#3A3B37", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
  }
  $("#qrDl").addEventListener("click", function () {
    var c = $("#qr canvas"); if (!c) return;
    var a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "album-qr.png"; a.click();
  });

  $("#pwForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, err = $(".form-err", f); err.textContent = "";
    api("password", { current: f.current.value, new: f["new"].value }).then(function () { f.reset(); toast("Şifre değiştirildi."); })
      .catch(function (x) { err.textContent = x.message; });
  });
})();
