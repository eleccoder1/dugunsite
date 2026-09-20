/* Elif & Yusuf Çağrı — suluboya kır çiçekleri (davetiyedeki çiçeklerden) */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var C = {
    stem: "#8C9478", stemDark: "#6F7862", leaf: "#A7B096", leafDeep: "#7F8B6E",
    petal: "#FFFFFF", petalEdge: "#CFC8BC", petalShade: "#ECE6DC",
    eye: "#34322E", ochre: "#C9A765", ochreDeep: "#A98843", blush: "#E4D2C6",
    lilac: "#D9D6DF", lilacEdge: "#B9B4C4", lace: "#FBFAF6", laceEdge: "#BDB6A8", wash: "#C9CFBF"
  };

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function f(n) { return Math.round(n * 10) / 10; }

  function defs(svg, id) {
    var d = el("defs", {}, svg);
    var wc = el("filter", { id: id + "wc", x: "-20%", y: "-20%", width: "140%", height: "140%" }, d);
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.035", numOctaves: "2", seed: "7", result: "n" }, wc);
    el("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: "4", xChannelSelector: "R", yChannelSelector: "G" }, wc);
    var blur = el("filter", { id: id + "wash", x: "-50%", y: "-50%", width: "200%", height: "200%" }, d);
    el("feGaussianBlur", { stdDeviation: "14" }, blur);
    var pg = el("radialGradient", { id: id + "pet", cx: "50%", cy: "85%", r: "90%" }, d);
    el("stop", { offset: "0", "stop-color": C.petalShade }, pg);
    el("stop", { offset: ".55", "stop-color": C.petal }, pg);
    el("stop", { offset: "1", "stop-color": "#F7F4EE" }, pg);
    var lg = el("radialGradient", { id: id + "lil", cx: "50%", cy: "90%", r: "90%" }, d);
    el("stop", { offset: "0", "stop-color": "#C9C4D2" }, lg);
    el("stop", { offset: "1", "stop-color": C.lilac }, lg);
    var bg = el("radialGradient", { id: id + "blu", cx: "50%", cy: "90%", r: "90%" }, d);
    el("stop", { offset: "0", "stop-color": "#D9BFB1" }, bg);
    el("stop", { offset: "1", "stop-color": C.blush }, bg);
  }

  // yaprak/taç yaprak: tabanı (0,0), ucu (0,-len)
  function petalPath(len, wid, r) {
    var a = wid * (0.9 + r() * 0.2), b = wid * (0.9 + r() * 0.2);
    return "M0 0C" + f(-a) + " " + f(-len * .25) + " " + f(-a * 1.1) + " " + f(-len * .85) + " " + f(-len * .08) + " " + f(-len) +
      "Q0 " + f(-len * 1.04) + " " + f(len * .08) + " " + f(-len) +
      "C" + f(b * 1.1) + " " + f(-len * .85) + " " + f(b) + " " + f(-len * .25) + " 0 0Z";
  }

  function anemone(g, x, y, s, r, id, rot) {
    var fl = el("g", { class: "fl-bloom", transform: "translate(" + f(x) + " " + f(y) + ") rotate(" + f(rot) + ")" }, g);
    var n = 6 + Math.floor(r() * 2), off = r() * 60;
    for (var i = 0; i < n; i++) {
      el("path", {
        d: petalPath(s * (0.9 + r() * 0.25), s * 0.42, r),
        transform: "rotate(" + f(off + i * 360 / n + (r() - .5) * 14) + ")",
        fill: "url(#" + id + "pet)", stroke: C.petalEdge, "stroke-width": ".7", "stroke-opacity": ".8"
      }, fl);
    }
    for (i = 0; i < 18; i++) {
      var a = i / 18 * Math.PI * 2, rr = s * (0.26 + r() * 0.06);
      el("circle", { cx: f(Math.cos(a) * rr), cy: f(Math.sin(a) * rr), r: f(s * .03 + r() * .6), fill: C.eye, opacity: ".75" }, fl);
    }
    el("circle", { r: f(s * .2), fill: C.eye }, fl);
    el("circle", { r: f(s * .08), fill: "#6B7059" }, fl);
  }

  function smallBloom(g, x, y, s, r, fill, edge, rot) {
    var fl = el("g", { class: "fl-bloom", transform: "translate(" + f(x) + " " + f(y) + ") rotate(" + f(rot) + ")" }, g);
    var n = 5;
    for (var i = 0; i < n; i++) el("path", { d: petalPath(s, s * .5, r), transform: "rotate(" + f(i * 72) + ")", fill: fill, stroke: edge, "stroke-width": ".5", opacity: ".92" }, fl);
    el("circle", { r: f(s * .22), fill: C.ochreDeep }, fl);
  }

  function bud(g, x, y, s, r, id, ang) {
    var b = el("g", { class: "fl-bloom", transform: "translate(" + f(x) + " " + f(y) + ") rotate(" + f(ang) + ")" }, g);
    el("path", { d: petalPath(s, s * .4, r), fill: "url(#" + id + "blu)", stroke: "#C9AFA2", "stroke-width": ".5" }, b);
    el("path", { d: petalPath(s * .9, s * .3, r), transform: "rotate(18)", fill: C.blush, opacity: ".8" }, b);
    el("path", { d: "M0 0l-" + f(s * .25) + " " + f(-s * .3) + "M0 0l" + f(s * .25) + " " + f(-s * .3), stroke: C.leafDeep, "stroke-width": "1", fill: "none" }, b);
  }

  function lace(g, x, y, s, r) {
    var l = el("g", { class: "fl-bloom", transform: "translate(" + f(x) + " " + f(y) + ")" }, g);
    var rays = 9 + Math.floor(r() * 5);
    for (var i = 0; i < rays; i++) {
      var a = -Math.PI / 2 + (i / (rays - 1) - .5) * 2.4, len = s * (0.7 + r() * 0.35);
      var ex = Math.cos(a) * len, ey = Math.sin(a) * len * .75;
      el("path", { d: "M0 0L" + f(ex) + " " + f(ey), stroke: C.stem, "stroke-width": ".5", opacity: ".8" }, l);
      for (var k = 0; k < 6; k++) {
        var b = r() * Math.PI * 2, d = r() * s * .16;
        el("circle", { cx: f(ex + Math.cos(b) * d), cy: f(ey + Math.sin(b) * d), r: f(1 + r() * 1.2), fill: C.lace, stroke: C.laceEdge, "stroke-width": ".45" }, l);
      }
    }
  }

  function fern(g, x, y, len, ang, r) {
    var fe = el("g", { transform: "translate(" + f(x) + " " + f(y) + ") rotate(" + f(ang) + ")" }, g);
    el("path", { d: "M0 0Q" + f(len * .1) + " " + f(-len * .5) + " 0 " + f(-len), stroke: C.leafDeep, "stroke-width": ".9", fill: "none" }, fe);
    var n = Math.floor(len / 9);
    for (var i = 1; i < n; i++) {
      var t = i / n, py = -len * t, px = len * .1 * 4 * t * (1 - t) * .5, sz = (1 - t) * 11 + 3;
      [-1, 1].forEach(function (side) {
        el("ellipse", { cx: f(px + side * sz * .55), cy: f(py), rx: f(sz * .55), ry: f(sz * .2), transform: "rotate(" + f(side * -35) + " " + f(px + side * sz * .55) + " " + f(py) + ")", fill: r() > .5 ? C.leaf : C.leafDeep, opacity: ".85" }, fe);
      });
    }
  }

  function seedHead(g, x, y, len, ang, r) {
    var sh = el("g", { transform: "translate(" + f(x) + " " + f(y) + ") rotate(" + f(ang) + ")" }, g);
    var n = 7 + Math.floor(r() * 5);
    for (var i = 0; i < n; i++) {
      var t = i / n;
      el("ellipse", { cx: f((r() - .5) * 3), cy: f(-len * t), rx: f(2.2 - t), ry: f(4.5 - t * 2), transform: "rotate(" + f((i % 2 ? 1 : -1) * 22) + " 0 " + f(-len * t) + ")", fill: r() > .4 ? C.ochre : C.ochreDeep, opacity: ".85" }, sh);
    }
  }

  function tansy(g, x, y, r) {
    var t = el("g", { class: "fl-bloom", transform: "translate(" + f(x) + " " + f(y) + ")" }, g);
    for (var i = 0; i < 5; i++) el("circle", { cx: f((r() - .5) * 12), cy: f((r() - .5) * 8), r: f(2 + r() * 1.6), fill: C.ochre, stroke: C.ochreDeep, "stroke-width": ".4" }, t);
  }

  function iris(g, x, y, s, r, id, rot) {
    var ir = el("g", { class: "fl-bloom", transform: "translate(" + f(x) + " " + f(y) + ") rotate(" + f(rot) + ")" }, g);
    [-50, 0, 50, 180 - 30, 180 + 30].forEach(function (a, i) {
      el("path", { d: petalPath(s * (i < 3 ? 1 : .8), s * .5, r), transform: "rotate(" + a + ")", fill: "url(#" + id + "lil)", stroke: C.lilacEdge, "stroke-width": ".6", opacity: ".9" }, ir);
    });
    el("path", { d: "M0 0L0 " + f(-s * .5), stroke: C.ochre, "stroke-width": "2", "stroke-linecap": "round" }, ir);
  }

  function leafBlade(g, x, y, len, ang, r) {
    el("path", { d: petalPath(len, len * .12, r), transform: "translate(" + f(x) + " " + f(y) + ") rotate(" + f(ang) + ")", fill: r() > .5 ? C.leaf : C.leafDeep, opacity: ".7" }, g);
  }

  /* Köşeden sarkan buket. Kök (0,0) sol üst köşe, içerik sağa ve aşağı akar. */
  function cascade(svg, opt) {
    var r = rng(opt.seed || 1), id = "f" + (opt.seed || 1) + "_";
    var W = opt.w || 520, H = opt.h || 760;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    defs(svg, id);
    var wash = el("g", { filter: "url(#" + id + "wash)", opacity: ".32" }, svg);
    el("ellipse", { cx: W * .14, cy: H * .14, rx: W * .22, ry: H * .13, fill: C.wash }, wash);
    el("ellipse", { cx: W * .34, cy: H * .06, rx: W * .22, ry: H * .07, fill: "#E7DDCB" }, wash);

    var art = el("g", { filter: "url(#" + id + "wc)" }, svg);
    var stems = opt.stems || 26;
    for (var i = 0; i < stems; i++) {
      var t = i / stems;
      // açı: 0 = sağa, 90 = aşağı. Kısa saplar yataya, uzunlar dikeye yakın
      var ang = 8 + r() * 78;
      var down = (ang - 8) / 78;
      var len = Math.min(W, H) * (0.18 + Math.pow(r(), 1.6) * 0.62 + down * 0.3);
      var a = ang * Math.PI / 180;
      var x0 = -10 + r() * 40, y0 = -10 + r() * 30;
      var ex = x0 + Math.cos(a) * len, ey = y0 + Math.sin(a) * len;
      var bend = (r() - .5) * len * .18;
      var cx = (x0 + ex) / 2 - Math.sin(a) * bend, cy = (y0 + ey) / 2 + Math.cos(a) * bend - len * (.12 + r() * .1) * (1 - down);
      ey += len * .08 * (1 - down);

      var grp = el("g", { class: "fl-stem", style: "--d:" + f(t * 1.6 + r() * .4) + "s;--sw:" + f(0.6 + r() * 1.4) + "deg;--st:" + f(5 + r() * 4) + "s;transform-origin:" + f(x0) + "px " + f(y0) + "px" }, art);
      el("path", { class: "fl-line", d: "M" + f(x0) + " " + f(y0) + "Q" + f(cx) + " " + f(cy) + " " + f(ex) + " " + f(ey), stroke: r() > .5 ? C.stem : C.stemDark, "stroke-width": f(.6 + r() * .9), fill: "none", "stroke-linecap": "round", pathLength: "1" }, grp);

      // uç açısı (derece) — çiçekler dışa baksın
      var tipRot = ang - 90 + (r() - .5) * 30;
      var kind = r();
      if (i % 4 === 0) anemone(grp, ex, ey, (20 + r() * 14) * (1.15 - len / Math.min(W, H) * .5), r, id, tipRot + 180);
      else if (kind < .2) lace(grp, ex, ey, 14 + r() * 12, r);
      else if (kind < .32) seedHead(grp, ex, ey, 26 + r() * 20, tipRot + 180, r);
      else if (kind < .44) fern(grp, x0 + (ex - x0) * .35, y0 + (ey - y0) * .35, len * .5, ang - 90 + 180 + (r() - .5) * 30, r);
      else if (kind < .56) bud(grp, ex, ey, 10 + r() * 6, r, id, tipRot + 180);
      else if (kind < .66) tansy(grp, ex, ey, r);
      else if (kind < .76) smallBloom(grp, ex, ey, 7 + r() * 4, r, C.petal, C.petalEdge, r() * 60);
      else if (kind < .84 && down > .5) iris(grp, ex, ey, 18 + r() * 8, r, id, tipRot + 180);
      else {
        // yalnız ot: uçta küçük tohumlar
        for (var k = 0; k < 3; k++) el("circle", { cx: f(ex + (r() - .5) * 6), cy: f(ey + (r() - .5) * 6), r: f(1 + r()), fill: C.ochreDeep, opacity: ".8" }, grp);
      }
      // sapa yan yaprak
      for (var q = 0; q < 2; q++) if (r() > .4) {
        var tt = .15 + r() * .6, lx = (1 - tt) * (1 - tt) * x0 + 2 * (1 - tt) * tt * cx + tt * tt * ex, ly = (1 - tt) * (1 - tt) * y0 + 2 * (1 - tt) * tt * cy + tt * tt * ey;
        leafBlade(grp, lx, ly, 14 + r() * 18, ang - 90 + 180 + (r() > .5 ? 35 : -35), r);
      }
    }
    // köşedeki yoğun çiçekler
    var core = el("g", { class: "fl-stem fl-core", style: "--d:.2s;--sw:.4deg;--st:7s;transform-origin:0 0" }, art);
    anemone(core, W * .1, H * .045, 34, r, id, 20);
    anemone(core, W * .3, H * .06, 26, r, id, -15);
    lace(core, W * .2, H * .12, 28, r);
    bud(core, W * .05, H * .15, 14, r, id, 150);
    tansy(core, W * .38, H * .03, r);
    fern(core, W * .02, H * .02, H * .22, 150, r);
    fern(core, W * .06, H * .01, W * .32, 115, r);
    seedHead(core, W * .24, H * .02, 34, 110, r);
    seedHead(core, W * .08, H * .09, 30, 160, r);
    anemone(core, W * .2, H * .2, 22, r, id, 40);
    lace(core, W * .42, H * .1, 18, r);
    smallBloom(core, W * .15, H * .2, 9, r, C.petal, C.petalEdge, 10);
    return svg;
  }

  function build(node) {
    if (node.getAttribute("data-built")) return;
    node.setAttribute("data-built", "1");
    var svg = el("svg", { class: "flora-svg", preserveAspectRatio: "xMinYMin meet" }, null);
    cascade(svg, {
      seed: +node.getAttribute("data-seed") || 1,
      stems: +node.getAttribute("data-stems") || 26,
      w: +node.getAttribute("data-w") || 520,
      h: +node.getAttribute("data-h") || 760
    });
    node.appendChild(svg);
  }

  window.Flora = { build: build };
  Array.prototype.forEach.call(document.querySelectorAll("[data-flora]"), build);
})();
