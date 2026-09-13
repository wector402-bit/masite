/* =========================================================
   ASTROPLOY — interactions & animations (sans librairie)
   Scroll fluide · texte lettre par lettre · bulle WebGL ·
   chiffres animés · tarifs · calendrier de rendez-vous
   ========================================================= */
(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.remove("no-js");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (reduced) root.classList.add("reduced");

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  let vw = innerWidth, vh = innerHeight;
  const isMobile = () => vw <= 760;

  /* ---------------------------------------------------------
     1. Découpage du texte en lettres (les <br> sont conservés)
     --------------------------------------------------------- */
  function split(el) {
    const host = { i: 0 };
    if (el.hasAttribute("data-fill") && !el.hasAttribute("aria-label")) {
      el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    }
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            w.setAttribute("aria-hidden", "true");
            for (const c of part) {
              const s = document.createElement("span");
              s.className = "ch";
              s.textContent = c;
              s.style.setProperty("--i", host.i++);
              w.appendChild(s);
            }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(el);
    el.style.setProperty("--n", host.i);
  }
  $$("[data-split], [data-fill]").forEach(split);

  /* ---------------------------------------------------------
     2. Chargement
     --------------------------------------------------------- */
  const start = () => setTimeout(() => root.classList.add("is-loaded"), 40);
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(start);
  } else start();

  /* ---------------------------------------------------------
     3. Scroll fluide (souris / pavé tactile, desktop)
     --------------------------------------------------------- */
  const smooth = finePointer && !reduced;
  let target = scrollY, current = scrollY, smoothing = false, lock = false;
  const maxScroll = () => document.documentElement.scrollHeight - vh;

  if (smooth) {
    addEventListener("wheel", (e) => {
      if (e.ctrlKey || lock || e.defaultPrevented) return;
      if (e.target.closest("textarea, select, [data-native-scroll]")) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? vh : 1;
      if (!smoothing) { current = scrollY; target = scrollY; }
      target = clamp(target + e.deltaY * unit, 0, maxScroll());
      smoothing = true;
    }, { passive: false });
  }
  addEventListener("scroll", () => { if (!smoothing) current = target = scrollY; }, { passive: true });
  ["keydown", "pointerdown", "touchstart"].forEach((ev) =>
    addEventListener(ev, (e) => {
      if (ev === "keydown" && !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) return;
      if (ev === "pointerdown" && e.target !== document.documentElement) return;
      smoothing = false;
    }, { passive: true })
  );

  function scrollToY(y) {
    y = clamp(y, 0, maxScroll());
    if (smooth) { current = scrollY; target = y; smoothing = true; }
    else window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    const el = id === "#" ? null : document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();
    closeMenu();
    const plan = a.getAttribute("data-plan");
    if (plan) { const sel = $("#bk-plan"); if (sel) sel.value = plan; }
    scrollToY(el.getBoundingClientRect().top + scrollY - (id === "#accueil" ? 0 : vw * .05));
  });

  /* ---------------------------------------------------------
     4. Menu mobile
     --------------------------------------------------------- */
  const burger = $("[data-burger]"), menu = $("[data-menu]");
  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("is-open")));
    document.body.classList.add("menu-open");
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Fermer le menu");
    lock = true;
  }
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Ouvrir le menu");
    lock = false;
    setTimeout(() => { if (!menu.classList.contains("is-open")) menu.hidden = true; }, 800);
  }
  burger && burger.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  /* ---------------------------------------------------------
     5. Apparitions : remplissage des lettres, boutons, chiffres
     --------------------------------------------------------- */
  // Compte de 0 jusqu'à la valeur finale (utilisé pour « Objectifs visés » et les statistiques)
  function countUp(el, end, format) {
    if (reduced) { el.textContent = format(end); return; }
    const t0 = performance.now(), dur = 1800;
    const tick = (now) => {
      const t = clamp((now - t0) / dur);
      el.textContent = format(Math.round(end * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    el.textContent = format(0);
    requestAnimationFrame(tick);
  }
  function countKpis(box) {
    $$("[data-kpi]", box).forEach((b) => countUp(b, +b.dataset.kpi, (v) => `+${v}%`));
    $$("[data-count]", box).forEach((b) => countUp(b, +b.dataset.count, (v) => v + (b.dataset.suffix ?? "+")));
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      io.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0 });
  $$("[data-fill], [data-pop], [data-reveal]").forEach((el) => io.observe(el));

  const kpiIo = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countKpis(en.target);
      kpiIo.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .55 });
  $$("[data-kpis], .stat").forEach((el) => kpiIo.observe(el));

  /* ---------------------------------------------------------
     6. Curseur + boutons magnétiques
     --------------------------------------------------------- */
  const cursor = $(".cursor");
  let mx = -100, my = -100, cx = -100, cy = -100;
  if (finePointer && cursor) {
    addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      if (!root.classList.contains("has-cursor")) { cx = mx; cy = my; root.classList.add("has-cursor"); }
    }, { passive: true });
    document.addEventListener("pointerleave", () => root.classList.remove("has-cursor"));

    if (!reduced) $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = "transform .3s cubic-bezier(.22,1,.36,1), background .45s, color .45s, opacity .7s, scale .9s";
        el.style.transform = `translate3d(${dx * .22}px, ${dy * .22}px, 0)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transition = "transform .9s cubic-bezier(.22,1,.36,1), background .45s, color .45s, opacity .7s, scale .9s";
        el.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------------
     7. Boule irisée : image fournie (js/boule.js = assets/boule.jpg) animée en WebGL
        Une seule boule qui voyage au scroll : Hero -> À propos -> Services
     --------------------------------------------------------- */
  const bubble = (() => {
    const canvas = $(".bubble");
    const img = $(".orb-img");
    const anchors = ["hero", "about", "services"].map((k) => $(`[data-bubble-anchor="${k}"]`)).filter(Boolean);
    const stick = $(".services__stick");
    const SRC = window.ASTROPLOY_BOULE || "assets/boule.jpg";
    if (!canvas || !anchors.length) return null;
    let el = canvas, gl = null, uR, uT, uM, ready = false;

    // Boule « liquide » : l'image est déformée en continu (respiration, étirement/contraction,
    // torsion, lobes façon metaball, flux interne) puis revient toujours à sa forme d'origine.
    const PAD = 1.22; // marge autour de la boule pour que les déformations ne soient jamais coupées
    const fs = `
precision highp float;
uniform vec2 r;uniform float t;uniform vec3 m;uniform sampler2D img;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
void main(){
 vec2 p0=(gl_FragCoord.xy-.5*r)/r.y*2.*${PAD.toFixed(2)};
 vec2 p=p0;
 p/=1.+.03*sin(t*.62)+.015*sin(t*1.07+1.3);
 float th=t*.11+.9*sin(t*.23);
 float k=.075*sin(t*.41)+.035*sin(t*.73+2.1);
 vec2 e=rot(-th)*p; e.x/=1.+k; e.y*=1.+k*.85; p=rot(th)*e;
 float along=dot(p,m.xy);
 p=p-m.xy*along*(m.z/(1.+m.z))+(p-m.xy*along)*m.z*.45;
 float d=length(p);
 p=rot(.2*sin(t*.37)*smoothstep(.15,.95,d)+.07*sin(t*.19+d*3.))*p;
 d=length(p);
 float a=atan(p.y,p.x),bulge=-.02;
 for(int i=0;i<4;i++){
  float fi=float(i);
  float ang=fi*1.62+.35*fi*fi+t*(.09+.035*fi)+1.2*sin(t*(.17+.05*fi)+fi);
  float dA=atan(sin(a-ang),cos(a-ang));
  bulge+=(.055+.035*sin(t*(.5+.13*fi)+fi*2.))*exp(-dA*dA/.5);
 }
 p/=1.+bulge*smoothstep(.2,.9,d);
 vec2 w=vec2(noise(p*1.6+vec2(t*.18,0.)),noise(p*1.6+vec2(0.,-t*.15)+7.))-.5;
 p+=w*.05*smoothstep(.05,.8,d);
 vec2 st=p*.5+.5;
 vec3 col=texture2D(img,st).rgb;
 col*=step(0.,st.x)*step(st.x,1.)*step(0.,st.y)*step(st.y,1.);
 col*=1.-smoothstep(${(PAD * .9).toFixed(3)},${PAD.toFixed(2)},length(p0));
 gl_FragColor=vec4(col,1.);
}`;

    function initGL() {
      gl = canvas.getContext("webgl", { antialias: false, alpha: false });
      if (!gl) return false;
      const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uR = gl.getUniformLocation(prog, "r"); uT = gl.getUniformLocation(prog, "t"); uM = gl.getUniformLocation(prog, "m");
      return true;
    }

    let base = 600;
    function size() {
      base = Math.max(...anchors.map((a) => a.offsetWidth), 200) * 1.12 * (gl ? PAD : 1);
      el.style.width = el.style.height = base + "px";
      if (gl) {
        const dpr = Math.min(devicePixelRatio || 1, isMobile() ? 1.5 : 2);
        const px = Math.min(Math.round(base * dpr), isMobile() ? 1000 : 1600);
        canvas.width = canvas.height = px;
        gl.viewport(0, 0, px, px);
        gl.uniform2f(uR, px, px);
      }
    }

    // Solution de secours sans WebGL : l'image seule, avec la même trajectoire
    let spin = false;
    function useImg() {
      gl = null; canvas.style.display = "none";
      img.src = SRC; img.hidden = false; el = img; spin = true;
      size();
      setTimeout(() => (img.style.opacity = "1"), 50);
    }

    const pic = new Image();
    pic.onload = () => {
      if (!gl) return useImg();
      try {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, pic);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        ready = true;
        setTimeout(() => (canvas.style.opacity = "1"), 100);
      } catch (e) { useImg(); }
    };
    if (!initGL()) canvas.style.display = "none";
    size();
    pic.src = SRC;

    const center = (a) => { const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width }; };
    const ease = (l) => l * l * (3 - 2 * l);

    // Position « idéale » de la boule pour le scroll actuel
    function goal() {
      const pts = anchors.map(center), y = scrollY;
      const arrive = [0];
      if (pts[1]) arrive.push(Math.max(1, pts[1].y + y - vh * .3));
      if (pts[2]) {
        // arrivée dans « Services » au moment où le titre de gauche se colle en haut
        const st = stick && !isMobile()
          ? stick.parentElement.getBoundingClientRect().top + y - vh * .059
          : pts[2].y + y - vh * .5;
        arrive.push(Math.max(arrive[1] + 1, st));
      }
      let k = 0;
      while (k < arrive.length - 1 && y > arrive[k + 1]) k++;
      if (k >= pts.length - 1) return pts[pts.length - 1];
      const a = pts[k], b = pts[k + 1];
      const l = clamp((y - arrive[k]) / (arrive[k + 1] - arrive[k]));
      const tp = k === 0 ? l : ease(l);
      const ts = k === 0 ? Math.pow(l, 1.5) : ease(l);
      return { x: lerp(a.x, b.x, tp), y: lerp(a.y, b.y, tp), s: lerp(a.s, b.s, ts) };
    }

    const t0 = performance.now();
    let cur = null, px = 0, py = 0;
    // petit ressort très souple : flottement en apesanteur avec de légers rebonds
    let sx = 0, sy = 0, svx = 0, svy = 0, kick = 1.5, lastScroll = scrollY;
    return {
      resize() { size(); cur = null; },
      update(now, dt) {
        const g = goal();
        if (!cur || reduced) cur = { ...g };
        else {
          const k = 1 - Math.exp(-dt / 90); // léger amorti : trajectoire fluide
          cur.x = lerp(cur.x, g.x, k); cur.y = lerp(cur.y, g.y, k); cur.s = lerp(cur.s, g.s, k);
        }
        const s = cur.s * 1.12, tt = (now - t0) / 1000;
        const scaleK = gl ? PAD : 1;
        let fx = 0, fy = 0, stretch = [0, 1, 0];
        if (!reduced) {
          const h = Math.min(dt, 50) / 1000;
          // impulsions douces et aléatoires (la boule « dérive » puis revient)
          kick -= h;
          if (kick <= 0) { svx += (Math.random() - .5) * s * .09; svy += (Math.random() - .55) * s * .1; kick = 2.4 + Math.random() * 3; }
          // le scroll donne un petit élan, comme une matière qui a de l'inertie
          const ds = scrollY - lastScroll; lastScroll = scrollY;
          svy += clamp(-ds * 2.2, -s * .12, s * .12);
          // ressort sous-amorti = rebond très doux
          svx += (-5 * sx - 1.5 * svx) * h; svy += (-5 * sy - 1.5 * svy) * h;
          sx = clamp(sx + svx * h, -s * .09, s * .09); sy = clamp(sy + svy * h, -s * .09, s * .09);
          // la vitesse étire légèrement la matière dans le sens du mouvement
          const sp = Math.hypot(svx, svy);
          if (sp > .01) stretch = [svx / sp, -svy / sp, Math.min(.14, (sp / s) * .5)];
          fx = Math.sin(tt * .53) * s * .012 + Math.sin(tt * .21 + 1.3) * s * .008 + sx;
          fy = Math.sin(tt * .71) * s * .016 + Math.cos(tt * .29) * s * .009 + sy;
          const hc = root.classList.contains("has-cursor");
          px = lerp(px, hc ? (mx / vw - .5) * 22 : 0, 1 - Math.exp(-dt / 400));
          py = lerp(py, hc ? (my / vh - .5) * 16 : 0, 1 - Math.exp(-dt / 400));
        }
        const x = cur.x + fx + px, y = cur.y + fy + py;
        const visible = y + s / 2 > -60 && y - s / 2 < vh + 60;
        el.style.transform = `translate3d(${x - base / 2}px, ${y - base / 2}px, 0) scale(${(s * scaleK) / base})` + (spin ? ` rotate(${tt * 5}deg)` : "");
        el.style.visibility = visible ? "visible" : "hidden";
        if (!visible || !gl || !ready) return;
        gl.uniform1f(uT, reduced ? 0 : tt);
        gl.uniform3f(uM, stretch[0], stretch[1], stretch[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  })();

  /* ---------------------------------------------------------
     8. Boucle principale
     --------------------------------------------------------- */
  const nav = $("[data-nav]");
  const speeds = $$("[data-speed]");
  const wa = $(".wa-float");
  let lastY = -1, lastNavY = scrollY, lastT = performance.now();

  function frame(now) {
    const dt = Math.min(64, now - lastT); lastT = now;

    if (smoothing) {
      current = lerp(current, target, 1 - Math.exp(-dt / 110));
      if (Math.abs(target - current) < .4) { current = target; smoothing = false; }
      window.scrollTo(0, current);
    }

    const y = scrollY;
    if (y !== lastY) {
      if (!reduced && !isMobile()) {
        const sp = speeds.map((el) => el.getBoundingClientRect());
        speeds.forEach((el, k) => {
          const r = sp[k];
          const c = r.top + r.height / 2 - (parseFloat(el.dataset.ty) || 0) - vh / 2;
          const ty = c * +el.dataset.speed;
          el.dataset.ty = ty;
          el.style.transform = `translate3d(0, ${ty}px, 0)`;
        });
      }
      if (nav) {
        nav.classList.toggle("is-scrolled", y > 40);
        if (Math.abs(y - lastNavY) > 6) {
          nav.classList.toggle("is-hidden", y > lastNavY && y > 80 && !document.body.classList.contains("menu-open"));
          lastNavY = y;
        }
      }
      if (wa) wa.classList.toggle("is-visible", y > vh * 1.5);
      lastY = y;
    }

    if (bubble) bubble.update(now, dt);

    if (finePointer && cursor) {
      cx = lerp(cx, mx, 1 - Math.exp(-dt / 35));
      cy = lerp(cy, my, 1 - Math.exp(-dt / 35));
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  let rz;
  addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      vw = innerWidth; vh = innerHeight; lastY = -1;
      speeds.forEach((el) => { el.style.transform = ""; el.dataset.ty = 0; });
      bubble && bubble.resize();
    }, 120);
  });

  /* ---------------------------------------------------------
     9. Services : « En savoir plus »
     --------------------------------------------------------- */
  $$("[data-acc]").forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      if (!open) {
        panel.hidden = false;
        if (!reduced) panel.animate([{ height: "0px", opacity: 0 }, { height: panel.scrollHeight + "px", opacity: 1 }], { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" });
      } else if (reduced) {
        panel.hidden = true;
      } else {
        panel.animate([{ height: panel.scrollHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 450, easing: "cubic-bezier(.65,0,.35,1)" }).onfinish = () => (panel.hidden = true);
      }
    });
  });

  /* ---------------------------------------------------------
     10. Tarifs : mensuel / trimestriel (prix en euros)
     --------------------------------------------------------- */
  const fmt = (v) => v.toLocaleString("fr-FR").replace(/[\u202F\u00A0]/g, " ");
  let billing = "month";

  function renderPrices(animate) {
    $$(".plan").forEach((plan) => {
      const b = $("[data-price]", plan), base = +b.dataset.price;
      const monthly = billing === "quarter" ? Math.round(base * .9 / 5) * 5 : base;
      b.textContent = fmt(monthly);
      const note = $("[data-note]", plan);
      note.textContent = billing === "quarter" ? `Soit ${fmt(monthly * 3)} € facturés par trimestre` : note.dataset.commit || "";
      if (animate && !reduced) { b.classList.remove("price-anim"); void b.offsetWidth; b.classList.add("price-anim"); }
    });
  }
  const billBtns = $$("[data-billing]");
  billBtns.forEach((btn, idx) => btn.addEventListener("click", () => {
    billing = btn.dataset.billing;
    billBtns.forEach((o) => { o.classList.toggle("is-on", o === btn); o.setAttribute("aria-pressed", String(o === btn)); });
    btn.parentElement.classList.toggle("is-second", idx === 1);
    renderPrices(true);
  }));
  renderPrices(false);

  /* ---------------------------------------------------------
     11. Calendrier de prise de rendez-vous
     --------------------------------------------------------- */
  const form = $("[data-booker]");
  if (form) {
    const PHONE = "22873273772", EMAIL = "contact@astroploy.com";
    const MAX_DAYS = 60;
    const monthEl = $("[data-cal-month]"), grid = $("[data-cal-grid]");
    const prev = $("[data-cal-prev]"), next = $("[data-cal-next]");
    const slotsEl = $("[data-slots]"), slotsLabel = $("[data-slots-label]");
    const summary = $("[data-summary]"), summaryText = $("[data-summary-text]");
    const errorEl = $("[data-form-error]");
    const modal = $("[data-modal]");

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + MAX_DAYS);
    let view = new Date(today.getFullYear(), today.getMonth(), 1);
    let selDate = null, selTime = null;

    const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const longDate = (d) => cap(d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));

    // Horaires (GMT) : lun–ven 9h–12h / 14h–17h30, sam 9h–12h
    function slotsFor(d) {
      const day = d.getDay();
      if (day === 0) return [];
      const ranges = day === 6 ? [[9, 12]] : [[9, 12], [14, 17.5]];
      const out = [];
      ranges.forEach(([a, b]) => { for (let h = a; h < b; h += .5) out.push(h); });
      return out;
    }
    const hhmm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
    const nowGmt = () => { const n = new Date(); return { date: new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()), h: n.getUTCHours() + n.getUTCMinutes() / 60 }; };
    const hasFreeSlot = (d) => { const nl = nowGmt(); return slotsFor(d).some((h) => !(sameDay(d, nl.date) && h < nl.h + 1)); };

    function renderCal(dir) {
      monthEl.textContent = cap(view.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
      grid.innerHTML = "";
      const first = (view.getDay() + 6) % 7;
      const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (let k = 0; k < first; k++) grid.appendChild(document.createElement("span"));
      for (let dnum = 1; dnum <= days; dnum++) {
        const d = new Date(view.getFullYear(), view.getMonth(), dnum);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cal__day";
        b.textContent = dnum;
        b.setAttribute("aria-label", longDate(d));
        b.disabled = d < today || d > maxDate || !hasFreeSlot(d);
        if (sameDay(d, today)) b.classList.add("is-today");
        if (sameDay(d, selDate)) { b.classList.add("is-selected"); b.setAttribute("aria-pressed", "true"); }
        b.addEventListener("click", () => { selDate = d; selTime = null; renderCal(); renderSlots(); updateSummary(); });
        grid.appendChild(b);
      }
      prev.disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
      next.disabled = new Date(view.getFullYear(), view.getMonth() + 1, 1) > maxDate;
      if (dir && !reduced) {
        grid.style.setProperty("--dir", dir > 0 ? "24px" : "-24px");
        grid.classList.remove("is-anim"); void grid.offsetWidth; grid.classList.add("is-anim");
      }
    }

    function renderSlots() {
      slotsEl.innerHTML = "";
      if (!selDate) { slotsLabel.textContent = "Choisissez d'abord une date"; return; }
      slotsLabel.textContent = longDate(selDate);
      const nl = nowGmt();
      slotsFor(selDate).forEach((h, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.textContent = hhmm(h);
        b.style.setProperty("--i", i);
        b.setAttribute("role", "option");
        b.disabled = sameDay(selDate, nl.date) && h < nl.h + 1;
        if (selTime === h) { b.classList.add("is-selected"); b.setAttribute("aria-selected", "true"); }
        b.addEventListener("click", () => {
          selTime = h;
          $$(".slot", slotsEl).forEach((s) => { s.classList.toggle("is-selected", s === b); s.setAttribute("aria-selected", String(s === b)); });
          updateSummary();
          errorEl.textContent = "";
        });
        slotsEl.appendChild(b);
      });
    }

    function updateSummary() {
      const ok = selDate && selTime != null;
      summary.classList.toggle("is-set", !!ok);
      summaryText.textContent = ok
        ? `${longDate(selDate)} · ${hhmm(selTime)} (30 min)`
        : selDate ? `${longDate(selDate)} · choisissez un horaire` : "Aucun créneau sélectionné";
    }

    prev.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(-1); });
    next.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(1); });

    renderCal();
    if (!$(".cal__day:not(:disabled)", grid) && !next.disabled) { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); }
    renderSlots();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      errorEl.textContent = "";
      const data = Object.fromEntries(new FormData(form));
      const name = form.elements.name, email = form.elements.email, phone = form.elements.phone;
      [name, email, phone].forEach((f) => f.classList.remove("is-invalid"));
      let msg = "";
      if (!selDate || selTime == null) msg = "Sélectionnez une date et un horaire dans le calendrier.";
      else if (data.name.trim().length < 2) { msg = "Indiquez votre nom."; name.classList.add("is-invalid"); name.focus(); }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) { msg = "Adresse email invalide."; email.classList.add("is-invalid"); email.focus(); }
      else if (data.phone.replace(/\D/g, "").length < 8) { msg = "Numéro de téléphone invalide."; phone.classList.add("is-invalid"); phone.focus(); }
      if (msg) { errorEl.textContent = msg; return; }

      const when = `${longDate(selDate)} à ${hhmm(selTime)} (GMT)`;
      const lines = [
        "Bonjour Astroploy, je souhaite réserver un appel stratégique.",
        "",
        `Date : ${when}`,
        `Nom : ${data.name.trim()}`,
        `Email : ${data.email.trim()}`,
        `Téléphone : ${data.phone.trim()}`,
        `Besoin : ${data.service}`,
        `Formule : ${data.plan}`,
        `Format : ${data.mode}`,
      ];
      if (data.message.trim()) lines.push(`Projet : ${data.message.trim()}`);
      const text = lines.join("\n");

      const startD = new Date(Date.UTC(selDate.getFullYear(), selDate.getMonth(), selDate.getDate(), Math.floor(selTime), selTime % 1 ? 30 : 0));
      const endD = new Date(startD.getTime() + 30 * 60000);
      const gfmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

      $("[data-modal-recap]").textContent = `${when} · ${data.mode}`;
      $("[data-send-wa]").href = `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
      $("[data-send-mail]").href = `mailto:${EMAIL}?subject=${encodeURIComponent("Réservation appel stratégique — " + data.name.trim())}&body=${encodeURIComponent(text)}`;
      $("[data-send-gcal]").href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Appel stratégique Astroploy")}&dates=${gfmt(startD)}/${gfmt(endD)}&details=${encodeURIComponent("Format : " + data.mode + "\nContact : " + EMAIL + " · +228 73 27 37 72")}`;

      if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
      lock = true;
    });

    const closeModal = () => { if (modal.close) modal.close(); else modal.removeAttribute("open"); };
    $("[data-modal-close]").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    modal.addEventListener("close", () => (lock = false));
  }

  /* ---------------------------------------------------------
     12. Divers
     --------------------------------------------------------- */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
