/* Elif & Yusuf Çağrı — hareket ve geçişler */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  root.classList.add("js");
  if (reduce) root.classList.add("reduce");

  /* ---------- harf harf beliren başlıklar ---------- */
  function splitLetters(node, base) {
    if (node.getAttribute("data-split")) return;
    node.setAttribute("data-split", "1");
    var text = node.textContent;
    node.setAttribute("aria-label", text);
    node.textContent = "";
    var i = 0;
    text.split(" ").forEach(function (word, wi, arr) {
      var w = document.createElement("span");
      w.className = "w"; w.setAttribute("aria-hidden", "true");
      Array.prototype.forEach.call(word, function (ch) {
        var c = document.createElement("span");
        c.className = "ch"; c.textContent = ch;
        c.style.setProperty("--i", i++);
        w.appendChild(c);
      });
      node.appendChild(w);
      if (wi < arr.length - 1) node.appendChild(document.createTextNode(" "));
    });
    node.style.setProperty("--base", base || 0);
  }
  $$("[data-letters]").forEach(function (n) { splitLetters(n, +n.getAttribute("data-letters")); });

  /* ---------- kaydırınca beliren öğeler ---------- */
  var io = null;
  if ("IntersectionObserver" in window && !reduce) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  }
  function watch(scope) {
    $$("[data-rv]:not(.in)", scope).forEach(function (n, i) {
      if (!n.style.getPropertyValue("--rd")) n.style.setProperty("--rd", (+n.getAttribute("data-rv-delay") || 0) + "ms");
      if (io) io.observe(n); else n.classList.add("in");
    });
  }
  watch(document);

  // sonradan eklenen listeler (anı kartları, albüm karoları, oyun) da yumuşakça gelsin
  if ("MutationObserver" in window && !reduce) {
    ["notes", "gallery", "quiz", "board", "timeline", "families", "queue"].forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      new MutationObserver(function () {
        Array.prototype.forEach.call(box.children, function (c, i) {
          if (c.getAttribute("data-rv") !== null) return;
          c.setAttribute("data-rv", "up");
          c.style.setProperty("--rd", Math.min(i, 12) * 60 + "ms");
          if (io) io.observe(c); else c.classList.add("in");
        });
      }).observe(box, { childList: true });
    });
  }

  /* ---------- sayfa geçişi ---------- */
  function visiblePage() { return $$(".page").filter(function (p) { return !p.hidden; })[0]; }
  var current = null;
  function onRoute() {
    var p = visiblePage();
    if (!p || p === current) return;
    current = p;
    if (!reduce) {
      p.classList.remove("enter");
      void p.offsetWidth;
      p.classList.add("enter");
    }
    watch(p);
  }
  window.addEventListener("hashchange", function () { requestAnimationFrame(onRoute); });
  onRoute();

  /* ---------- açılış sonrası kahraman bölümü ---------- */
  var intro = document.getElementById("intro");
  function heroGo() { root.classList.add("hero-go"); }
  if (!intro || intro.hidden) heroGo();
  else {
    new MutationObserver(function (m, obs) {
      if (intro.classList.contains("out") || intro.hidden) { setTimeout(heroGo, 200); obs.disconnect(); }
    }).observe(intro, { attributes: true, attributeFilter: ["class", "hidden"] });
  }

  /* ---------- çiçek katmanının hafif derinliği ---------- */
  if (!reduce) {
    var layers = $$("[data-depth]"), ticking = false;
    var update = function () {
      var y = window.scrollY || 0;
      layers.forEach(function (l) { l.style.transform = "translate3d(0," + (y * -(+l.getAttribute("data-depth"))).toFixed(1) + "px,0)"; });
      ticking = false;
    };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- süzülen yapraklar ---------- */
  if (!reduce) {
    var sky = document.getElementById("petals");
    if (sky) {
      var count = window.innerWidth < 700 ? 7 : 12;
      for (var i = 0; i < count; i++) {
        var p = document.createElement("span");
        p.className = "petal" + (i % 3 === 0 ? " petal-o" : "");
        p.style.left = (Math.random() * 100).toFixed(1) + "%";
        p.style.setProperty("--dur", (14 + Math.random() * 12).toFixed(1) + "s");
        p.style.setProperty("--del", (-Math.random() * 26).toFixed(1) + "s");
        p.style.setProperty("--dx", ((Math.random() - .5) * 220).toFixed(0) + "px");
        p.style.setProperty("--sc", (.6 + Math.random() * .7).toFixed(2));
        sky.appendChild(p);
      }
    }
  }

  /* ---------- kayan bant ---------- */
  $$(".marquee-track").forEach(function (t) {
    var html = t.innerHTML;
    t.innerHTML = html + html;
  });
})();
