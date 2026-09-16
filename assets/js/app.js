/* Elif & Yusuf Çağrı — misafir sitesi */
(function () {
  "use strict";
  var S = window.SITE;
  var API = "api/public.php";
  var UP = "api/upload.php";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ─── yardımcılar ─── */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function randHex(n) {
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var TOKEN = store("ey_token");
  if (!TOKEN || !/^[a-f0-9]{32,64}$/.test(TOKEN)) { TOKEN = randHex(24); store("ey_token", TOKEN); }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function get(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function fmtDate(s) { try { var d = new Date(s.replace(" ", "T") + "+03:00"); return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }); } catch (e) { return ""; } }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; }

  var toastT;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  function api(action, opts) {
    opts = opts || {};
    var url = API + "?a=" + encodeURIComponent(action) + (opts.query || "");
    var init = { method: opts.body ? "POST" : "GET", headers: { "X-Guest-Token": TOKEN }, credentials: "same-origin" };
    if (opts.body) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    return fetch(url, init).then(function (r) {
      return r.json().catch(function () { throw new Error("Sunucudan beklenmeyen yanıt geldi (" + r.status + ")."); });
    }).then(function (d) { if (!d.ok) throw new Error(d.error || "İşlem tamamlanamadı."); return d; });
  }

  /* ─── içerik bağlama ─── */
  $$("[data-bind]").forEach(function (el) { el.textContent = get(S, el.getAttribute("data-bind")) || ""; });
  $$("[data-mono]").forEach(function (el) { el.textContent = S.monogram[+el.getAttribute("data-mono")]; });
  $("#cDavet").innerHTML = S.davetBaslik.map(esc).join("<br>");
  $("#cAile").innerHTML = S.aileler.map(esc).join("<br>");
  $("#mapLink").href = S.mekan.harita;
  $("#webLink").href = S.mekan.web;
  if (!S.mekan.web) $("#webLink").hidden = true;
  $("#families").innerHTML = S.aileDetay.map(function (f, i) {
    return (i ? '<div class="sep"></div>' : "") + '<div><div class="fam-n">' + esc(f.isimler) + '</div><div class="fam-s">' + esc(f.soyad) + "</div></div>";
  }).join("");
  $("#timeline").innerHTML = S.program.map(function (p) {
    return '<li><div class="tl-t">' + esc(p.saat) + '</div><div class="tl-d"></div><div><div class="tl-n">' + esc(p.baslik) + "</div>" + (p.aciklama ? '<div class="tl-s">' + esc(p.aciklama) + "</div>" : "") + "</div></li>";
  }).join("");

  // harita (görünür olunca yüklenir)
  (function () {
    var box = $("#map");
    var load = function () {
      if (box.firstChild) return;
      box.innerHTML = '<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Harita" src="https://www.google.com/maps?q=' +
        encodeURIComponent(S.mekan.ad + ", " + S.mekan.adres) + '&output=embed"></iframe>';
    };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: "300px" });
      io.observe(box);
    } else load();
  })();

  /* ─── geri sayım ─── */
  var target = new Date(S.tarihISO).getTime();
  function tick() {
    var el = $("#count"), diff = target - Date.now();
    if (diff <= 0) {
      el.innerHTML = diff > -864e5 ? '<p class="count-today">Bugün o gün!</p>' : '<p class="count-today">Evlendik!</p>';
      return;
    }
    var d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5), m = Math.floor(diff % 36e5 / 6e4), s = Math.floor(diff % 6e4 / 1e3);
    var p = function (n) { return ("0" + n).slice(-2); };
    el.innerHTML = "<div><b>" + d + "</b><span>gün</span></div><i></i><div><b>" + p(h) + "</b><span>saat</span></div><i></i><div><b>" + p(m) + "</b><span>dakika</span></div><i></i><div><b>" + p(s) + "</b><span>saniye</span></div>";
  }
  tick(); setInterval(tick, 1000);

  /* ─── sunucu ayarları ─── */
  var CFG = { rsvp_open: true, memories_open: true, uploads_open: true, max_upload_mb: 500, chunk_mb: 4 };
  var cfgReady = api("config").then(function (d) { CFG = d.config; applyCfg(); }).catch(function () { applyCfg(); });
  function applyCfg() {
    $("#memForm").hidden = !CFG.memories_open; $("#memClosed").hidden = CFG.memories_open;
    $("#drop").hidden = !CFG.uploads_open; $("#upClosed").hidden = CFG.uploads_open;
    $("#upHint").textContent = "Birden çok dosya seçebilirsiniz. Dosya başına en fazla " + CFG.max_upload_mb + " MB. Yükleme bitene kadar sayfayı kapatmayın.";
    if (!CFG.rsvp_open) {
      $("#rsvpForm").hidden = true; $("#rsvpDone").hidden = true;
      var n = document.createElement("p"); n.className = "closed-note"; n.textContent = "Katılım bildirimi kapandı. Sorularınız için bizimle doğrudan iletişime geçebilirsiniz.";
      $("#katilim").appendChild(n);
    }
  }

  /* ─── sayfa yönlendirme ─── */
  var PAGES = ["davetiye", "anilar", "album", "oyun"];
  var loaded = {};
  function route() {
    var h = (location.hash || "").replace("#", "");
    var page = PAGES.indexOf(h) >= 0 ? h : "davetiye";
    $$(".page").forEach(function (p) { p.hidden = p.getAttribute("data-page") !== page; });
    $$("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === page); if (a.classList.contains("on")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (PAGES.indexOf(h) >= 0) window.scrollTo(0, 0);
    if (!loaded[page]) {
      loaded[page] = true;
      if (page === "anilar") loadNotes(true);
      if (page === "album") loadGallery(true);
      if (page === "oyun") { renderQuizStart(); loadBoard(); }
    }
  }
  window.addEventListener("hashchange", route);
  route();

  /* ─── zarf açılışı ─── */
  (function () {
    var intro = $("#intro");
    var h = (location.hash || "").replace("#", "");
    var seen = false; try { seen = sessionStorage.getItem("ey_opened") === "1"; } catch (e) {}
    if (seen || (h && h !== "davetiye")) return;
    intro.hidden = false;
    document.body.style.overflow = "hidden";
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function close() {
      try { sessionStorage.setItem("ey_opened", "1"); } catch (e) {}
      intro.classList.add("out");
      document.body.style.overflow = "";
      setTimeout(function () { intro.hidden = true; }, reduce ? 0 : 800);
    }
    $("#introOpen").addEventListener("click", function () {
      if (reduce) return close();
      $("#env").classList.add("open");
      this.disabled = true;
      setTimeout(close, 1400);
    });
    $("#introSkip").addEventListener("click", close);
  })();

  /* ─── isim hatırlama ─── */
  function fillNames(n) {
    [$("#memForm").author, $("#upName")].forEach(function (el) { if (el && !el.value.trim()) el.value = n; });
  }
  function rememberName(n) {
    if (!n || !n.trim()) return;
    n = n.trim().slice(0, 80);
    store("ey_name", n); fillNames(n);
  }
  fillNames(store("ey_name") || "");

  /* ─── LCV ─── */
  (function () {
    var f = $("#rsvpForm"), err = $(".form-err", f), done = $("#rsvpDone");
    var LABEL = { geliyor: "Katılacağınızı not ettik. Görüşmek üzere!", gelmiyor: "Katılamayacağınızı not ettik. Aklınız bizimle olsun.", belki: "Kararınızı verince buradan güncelleyebilirsiniz." };
    function toggleGuests() { var st = (f.querySelector("input[name=status]:checked") || {}).value; $("#guestField").hidden = st !== "geliyor"; }
    $$("input[name=status]", f).forEach(function (r) { r.addEventListener("change", toggleGuests); });
    toggleGuests();
    function showDone(st) { f.hidden = true; done.hidden = false; $("#rsvpDoneText").textContent = LABEL[st] || ""; }
    var prev = store("ey_rsvp");
    if (prev) { try { prev = JSON.parse(prev); } catch (e) { prev = null; } }
    if (prev && prev.status) {
      ["first_name", "last_name", "phone", "note"].forEach(function (k) { if (prev[k]) f[k].value = prev[k]; });
      f.guests.value = String(prev.guests || 0);
      var r = f.querySelector('input[name=status][value="' + prev.status + '"]'); if (r) r.checked = true;
      toggleGuests();
      cfgReady.then(function () { if (CFG.rsvp_open) showDone(prev.status); });
    }
    $("#rsvpEdit").addEventListener("click", function () { done.hidden = true; f.hidden = false; });
    f.addEventListener("submit", function (e) {
      e.preventDefault(); err.textContent = "";
      var st = (f.querySelector("input[name=status]:checked") || {}).value;
      var body = { first_name: f.first_name.value.trim(), last_name: f.last_name.value.trim(), status: st, guests: st === "geliyor" ? +f.guests.value : 0, phone: f.phone.value.trim(), note: f.note.value.trim() };
      if (!body.first_name || !body.last_name) { err.textContent = "Adınızı ve soyadınızı yazın."; return; }
      if (!st) { err.textContent = "Katılım durumunuzu seçin."; return; }
      var btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Gönderiliyor…";
      api("rsvp", { body: body }).then(function () {
        store("ey_rsvp", JSON.stringify(body)); rememberName(body.first_name + " " + body.last_name);
        showDone(st);
      }).catch(function (x) { err.textContent = x.message; })
        .then(function () { btn.disabled = false; btn.textContent = "Yanıtımı gönder"; });
    });
  })();

  /* ─── görsel küçültme ─── */
  function loadImage(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function drawScaled(source, w, h, max, q) {
    var r = Math.min(1, max / Math.max(w, h));
    var c = document.createElement("canvas");
    c.width = Math.round(w * r); c.height = Math.round(h * r);
    var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  }
  function imageFileToJpeg(file, max, q) {
    var url = URL.createObjectURL(file);
    return loadImage(url).then(function (img) { var d = drawScaled(img, img.naturalWidth, img.naturalHeight, max, q); URL.revokeObjectURL(url); return d; })
      .catch(function (e) { URL.revokeObjectURL(url); throw e; });
  }
  function videoThumb(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), v = document.createElement("video"), doneF = false;
      var finish = function (d) { if (doneF) return; doneF = true; URL.revokeObjectURL(url); res(d); };
      v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
      v.onloadedmetadata = function () { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
      v.onseeked = function () { try { finish(drawScaled(v, v.videoWidth, v.videoHeight, 640, .8)); } catch (e) { finish(null); } };
      v.onerror = function () { finish(null); };
      setTimeout(function () { finish(null); }, 8000);
    });
  }

  /* ─── anı defteri ─── */
  var memPhotoData = null;
  $("#memPhoto").addEventListener("change", function () {
    var file = this.files[0]; this.value = "";
    if (!file) return;
    imageFileToJpeg(file, 1600, .85).then(function (d) {
      memPhotoData = d; $("#memPreview").src = d; $("#memPreview").hidden = false; $("#memPhotoRemove").hidden = false;
    }).catch(function () { toast("Bu fotoğraf açılamadı. JPG veya PNG bir fotoğraf seçin."); });
  });
  $("#memPhotoRemove").addEventListener("click", function () { memPhotoData = null; $("#memPreview").hidden = true; this.hidden = true; });

  $("#memForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, err = $(".form-err", f); err.textContent = "";
    var body = { name: f.author.value.trim(), message: f.message.value.trim(), photo: memPhotoData };
    if (!body.name) { err.textContent = "Adınızı yazın."; return; }
    if (body.message.length < 2) { err.textContent = "Bir mesaj yazın."; return; }
    var btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Gönderiliyor…";
    api("memory", { body: body }).then(function (d) {
      rememberName(body.name);
      f.message.value = ""; memPhotoData = null; $("#memPreview").hidden = true; $("#memPhotoRemove").hidden = true;
      if (d.item.approved) { notes.unshift(d.item); renderNotes(); toast("Mesajınız deftere eklendi."); }
      else toast("Mesajınız alındı, onaylandıktan sonra görünecek.");
    }).catch(function (x) { err.textContent = x.message; })
      .then(function () { btn.disabled = false; btn.textContent = "Mesajı gönder"; });
  });

  var notes = [], notesMore = false;
  function loadNotes(reset) {
    var off = reset ? 0 : notes.length;
    api("memories", { query: "&offset=" + off }).then(function (d) {
      notes = reset ? d.items : notes.concat(d.items); notesMore = d.more; renderNotes();
    }).catch(function (x) { toast(x.message); });
  }
  function renderNotes() {
    $("#notes").innerHTML = notes.map(function (n, i) {
      return '<article class="note">' + (n.image ? '<img src="' + esc(n.image) + '" alt="" loading="lazy" data-ni="' + i + '">' : "") +
        '<p class="note-m">' + esc(n.message) + '</p><p class="note-n">' + esc(n.name) + "</p>" +
        '<p class="note-d"><span>' + fmtDate(n.created_at) + "</span>" + (n.mine ? '<button type="button" data-del-note="' + n.id + '">Sil</button>' : "") + "</p></article>";
    }).join("");
    $("#notesEmpty").hidden = notes.length > 0;
    $("#notesMore").hidden = !notesMore;
  }
  $("#notesMore").addEventListener("click", function () { loadNotes(false); });
  $("#notes").addEventListener("click", function (e) {
    var id = e.target.getAttribute("data-del-note");
    if (id) {
      if (!confirm("Mesajınız silinsin mi?")) return;
      api("memory_delete", { body: { id: +id } }).then(function () {
        notes = notes.filter(function (n) { return n.id !== +id; }); renderNotes(); toast("Mesajınız silindi.");
      }).catch(function (x) { toast(x.message); });
      return;
    }
    var ni = e.target.getAttribute("data-ni");
    if (ni !== null) openLightbox([{ kind: "image", url: notes[+ni].image, uploader: notes[+ni].name }], 0);
  });

  /* ─── albüm ─── */
  var media = [], mediaMore = false;
  function loadGallery(reset) {
    var off = reset ? 0 : media.length;
    api("media", { query: "&offset=" + off }).then(function (d) {
      media = reset ? d.items : media.concat(d.items); mediaMore = d.more; renderGallery();
    }).catch(function (x) { toast(x.message); });
  }
  function renderGallery() {
    $("#gallery").innerHTML = media.map(function (m, i) {
      var inner = m.thumb ? '<img src="' + esc(m.thumb) + '" alt="" loading="lazy">' : '<span class="ph">' + (m.kind === "video" ? "Video" : "Fotoğraf") + "</span>";
      return '<button type="button" class="tile" data-mi="' + i + '" aria-label="' + (m.kind === "video" ? "Videoyu aç" : "Fotoğrafı aç") + '">' + inner +
        (m.kind === "video" ? '<span class="play"></span>' : "") + (m.uploader ? '<span class="who">' + esc(m.uploader) + "</span>" : "") + "</button>";
    }).join("");
    $("#galleryEmpty").hidden = media.length > 0;
    $("#galleryMore").hidden = !mediaMore;
  }
  $("#galleryMore").addEventListener("click", function () { loadGallery(false); });
  $("#gallery").addEventListener("click", function (e) {
    var t = e.target.closest("[data-mi]"); if (t) openLightbox(media, +t.getAttribute("data-mi"), true);
  });

  // yükleme kuyruğu
  var busy = 0;
  window.addEventListener("beforeunload", function (e) { if (busy > 0) { e.preventDefault(); e.returnValue = ""; } });
  var drop = $("#drop");
  ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) enqueue(e.dataTransfer.files); });
  $("#upFiles").addEventListener("change", function () { enqueue(this.files); this.value = ""; });

  var queue = [], running = false;
  function enqueue(fileList) {
    var name = $("#upName").value.trim();
    if (!name) { toast("Önce adınızı yazın, kimin yüklediğini bilelim."); $("#upName").focus(); return; }
    rememberName(name);
    Array.prototype.forEach.call(fileList, function (file) {
      var li = document.createElement("li");
      li.innerHTML = '<div class="q-top"><span class="q-name"></span><span class="q-stat">Sırada</span></div><div class="q-bar"><i></i></div>';
      $(".q-name", li).textContent = file.name + " · " + fmtSize(file.size);
      $("#queue").appendChild(li);
      var ok = /^(image|video)\//.test(file.type) || /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|m4v|webm|3gp)$/i.test(file.name);
      if (!ok) return fail(li, "Desteklenmeyen dosya");
      if (file.size > CFG.max_upload_mb * 1048576) return fail(li, "En fazla " + CFG.max_upload_mb + " MB");
      queue.push({ file: file, li: li, name: name });
    });
    if (!running) next();
  }
  function fail(li, msg) { li.classList.add("q-err"); $(".q-stat", li).textContent = msg; }
  function setProg(li, pct, txt) { $(".q-bar i", li).style.width = pct + "%"; $(".q-stat", li).textContent = txt; }

  function next() {
    var job = queue.shift();
    if (!job) { running = false; return; }
    running = true; busy++;
    uploadOne(job).then(function (item) {
      setProg(job.li, 100, item.approved ? "Yüklendi" : "Yüklendi, onay bekliyor");
      if (item.approved) { media.unshift(item); renderGallery(); }
    }).catch(function (x) { fail(job.li, x.message || "Yüklenemedi"); })
      .then(function () { busy--; next(); });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function uploadOne(job) {
    var file = job.file, id = randHex(16), CH = Math.max(1, CFG.chunk_mb) * 1048576, offset = 0, tries = 0;
    var isVideo = /^video\//.test(file.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name);
    var thumbP = (isVideo ? videoThumb(file) : imageFileToJpeg(file, 640, .8).catch(function () { return null; }));
    function sendChunk() {
      if (offset >= file.size) return Promise.resolve();
      var end = Math.min(file.size, offset + CH);
      var url = UP + "?a=chunk&id=" + id + "&offset=" + offset + "&total=" + file.size;
      return fetch(url, { method: "POST", headers: { "X-Guest-Token": TOKEN, "Content-Type": "application/octet-stream" }, body: file.slice(offset, end), credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) { offset = d.received; tries = 0; }
          else if (typeof d.expected === "number") { offset = d.expected; }
          else throw new Error(d.error || "Yüklenemedi");
          setProg(job.li, Math.floor(offset / file.size * 97), "%" + Math.floor(offset / file.size * 100));
          return sendChunk();
        }, function (netErr) {
          if (++tries > 6) throw new Error("Bağlantı koptu, tekrar deneyin");
          $(".q-stat", job.li).textContent = "Bağlantı bekleniyor…";
          return sleep(1500 * tries).then(function () {
            return fetch(UP + "?a=status&id=" + id, { headers: { "X-Guest-Token": TOKEN } }).then(function (r) { return r.json(); })
              .then(function (s) { if (s.ok) offset = s.received; }, function () {}).then(sendChunk);
          });
        });
    }
    setProg(job.li, 0, "Başlıyor…");
    return sendChunk().then(function () {
      $(".q-stat", job.li).textContent = "Kaydediliyor…";
      return thumbP;
    }).then(function (thumb) {
      return fetch(UP + "?a=finish", {
        method: "POST", headers: { "X-Guest-Token": TOKEN, "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ id: id, name: file.name, type: file.type, size: file.size, uploader: job.name, thumb: thumb })
      }).then(function (r) { return r.json(); });
    }).then(function (d) { if (!d.ok) throw new Error(d.error || "Kaydedilemedi"); return d.item; });
  }

  /* ─── lightbox ─── */
  var lbItems = [], lbIdx = 0, lbFromGallery = false;
  function openLightbox(items, i, fromGallery) {
    lbItems = items; lbIdx = i; lbFromGallery = !!fromGallery;
    $("#lb").hidden = false; document.body.style.overflow = "hidden"; showLb();
    $("#lbClose").focus();
  }
  function showLb() {
    var m = lbItems[lbIdx]; if (!m) return closeLb();
    var fig = $("#lbFig");
    fig.innerHTML = m.kind === "video"
      ? '<video src="' + esc(m.url) + '" controls playsinline autoplay preload="metadata"></video>'
      : '<img src="' + esc(m.url) + '" alt="">';
    $("#lbInfo").textContent = m.uploader ? "Yükleyen: " + m.uploader : "";
    $("#lbDl").href = m.url; $("#lbDl").setAttribute("download", m.original_name || "");
    $("#lbDel").hidden = !(lbFromGallery && m.mine);
    var multi = lbItems.length > 1; $("#lbPrev").hidden = !multi; $("#lbNext").hidden = !multi;
  }
  function closeLb() { $("#lb").hidden = true; $("#lbFig").innerHTML = ""; document.body.style.overflow = ""; }
  $("#lbClose").addEventListener("click", closeLb);
  $("#lbPrev").addEventListener("click", function () { lbIdx = (lbIdx - 1 + lbItems.length) % lbItems.length; showLb(); });
  $("#lbNext").addEventListener("click", function () { lbIdx = (lbIdx + 1) % lbItems.length; showLb(); });
  $("#lb").addEventListener("click", function (e) { if (e.target === this) closeLb(); });
  document.addEventListener("keydown", function (e) {
    if ($("#lb").hidden) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft" && lbItems.length > 1) $("#lbPrev").click();
    if (e.key === "ArrowRight" && lbItems.length > 1) $("#lbNext").click();
  });
  (function () { // kaydırma ile geçiş
    var x0 = null;
    $("#lb").addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    $("#lb").addEventListener("touchend", function (e) {
      if (x0 === null || lbItems.length < 2) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 60) (dx > 0 ? $("#lbPrev") : $("#lbNext")).click();
    });
  })();
  $("#lbDel").addEventListener("click", function () {
    var m = lbItems[lbIdx];
    if (!confirm("Bu dosya albümden silinsin mi?")) return;
    api("media_delete", { body: { id: m.id } }).then(function () {
      media = media.filter(function (x) { return x.id !== m.id; }); renderGallery(); closeLb(); toast("Dosya silindi.");
    }).catch(function (x) { toast(x.message); });
  });

  /* ─── quiz ─── */
  var Q = S.quiz, qi = 0, score = 0, player = "";
  function renderQuizStart() {
    var nm = esc(store("ey_name") || "");
    $("#quiz").innerHTML = '<p class="muted">' + Q.length + ' soru. Bakalım bizi ne kadar yakından tanıyorsunuz.</p>' +
      '<form class="form" id="qStart"><label class="field"><span>Adınız</span><input name="n" maxlength="60" value="' + nm + '" required></label>' +
      '<button class="btn btn-wide" type="submit">Oyuna başla</button></form>';
    $("#qStart").addEventListener("submit", function (e) {
      e.preventDefault(); player = this.n.value.trim();
      if (!player) { this.n.focus(); return; }
      rememberName(player); qi = 0; score = 0; renderQ();
    });
  }
  function renderQ() {
    var q = Q[qi];
    $("#quiz").innerHTML = '<div class="qbox"><p class="q-prog">Soru ' + (qi + 1) + " / " + Q.length + '</p><p class="q-q">' + esc(q.soru) + "</p>" +
      q.siklar.map(function (o, i) { return '<button type="button" class="q-o" data-o="' + i + '">' + esc(o) + "</button>"; }).join("") + "</div>";
    $$(".q-o").forEach(function (b) {
      b.addEventListener("click", function () {
        var pick = +b.getAttribute("data-o");
        $$(".q-o").forEach(function (x) { x.disabled = true; });
        if (pick === q.dogru) { score++; b.classList.add("ok"); }
        else { b.classList.add("no"); $$(".q-o")[q.dogru].classList.add("ok"); }
        setTimeout(function () { qi++; if (qi < Q.length) renderQ(); else finishQuiz(); }, 1100);
      });
    });
  }
  function finishQuiz() {
    var msg = score === Q.length ? "Kusursuz! Bizi bizden iyi tanıyorsunuz." : score >= Q.length - 2 ? "Çok iyi, neredeyse hepsini bildiniz." : "Düğünde bizi daha yakından tanıma fırsatınız olacak.";
    $("#quiz").innerHTML = '<div class="qbox" style="text-align:center"><p class="q-score">' + score + " / " + Q.length + '</p><p class="muted">' + msg + '</p><div class="row-btns"><button type="button" class="btn btn-line" id="qAgain">Tekrar oyna</button></div></div>';
    $("#qAgain").addEventListener("click", renderQuizStart);
    api("quiz", { body: { name: player, score: score, total: Q.length } }).then(loadBoard).catch(function () {});
  }
  function loadBoard() {
    api("leaderboard").then(function (d) {
      $("#board").innerHTML = d.items.map(function (r, i) {
        return '<li><span class="r">' + (i + 1) + '.</span><span class="n">' + esc(r.name) + '</span><span class="s">' + r.score + " / " + r.total + "</span></li>";
      }).join("");
      $("#boardEmpty").hidden = d.items.length > 0;
    }).catch(function () {});
  }
})();
