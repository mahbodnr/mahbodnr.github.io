/* Bankroll · drawing a card from the player's own pack onto a canvas (the share pictures). The card is built exactly as
   the game shows it (cardHTML, the pack's CSS), off screen; then its parts are measured and redrawn: the paper, the
   corner indexes (with the page's fonts), the pips, aces and courts (each SVG piece made standalone, with the pack's
   colours filled in), and the Classic court pictures. Transforms (the upside-down half) are applied as the page does. */
'use strict';

let rasterHost = null;
function rasterHostEl(){
  if (!rasterHost){
    rasterHost = document.createElement('div');
    rasterHost.className = 'raster-host'; rasterHost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(rasterHost);
  }
  return rasterHost;
}
const rasterImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const clearColor = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
// var(--name) and currentColor resolved against an element's computed style (an SVG drawn as a picture has no CSS)
const resolveCss = (str, cs) => String(str)
  .replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (m, v, fb) => (cs.getPropertyValue(v) || fb || '').trim() || 'none')
  .replace(/currentColor/g, cs.color);
const SVG_PROPS = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'paint-order', 'stroke-linejoin', 'stroke-linecap',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'letter-spacing'];
// a DOM <svg> (with <use> references to the page's symbols) as standalone SVG markup
function standaloneSVG(svg, w, h){
  const clone = svg.cloneNode(true);
  const orig = [svg, ...svg.querySelectorAll('*')], copy = [clone, ...clone.querySelectorAll('*')];
  orig.forEach((el, i) => {
    const cs = getComputedStyle(el), cp = copy[i];
    if (el.tagName.toLowerCase() === 'use'){
      const id = (el.getAttribute('href') || el.getAttribute('xlink:href') || '').replace('#', ''), sym = id && document.getElementById(id);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ['x', 'y', 'width', 'height', 'transform'].forEach(a => { if (el.getAttribute(a) != null) g.setAttribute(a, el.getAttribute(a)); });
      if (sym && sym.getAttribute('viewBox')) g.setAttribute('viewBox', sym.getAttribute('viewBox'));
      g.setAttribute('overflow', 'visible');
      SVG_PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v && p !== 'opacity') g.setAttribute(p, v); });
      g.setAttribute('color', cs.color);
      g.innerHTML = sym ? resolveCss(sym.innerHTML, cs) : '';
      if (el.getAttribute('transform')){ const t = document.createElementNS('http://www.w3.org/2000/svg', 'g'); t.setAttribute('transform', el.getAttribute('transform')); g.removeAttribute('transform'); t.appendChild(g); cp.replaceWith(t); }
      else cp.replaceWith(g);
      return;
    }
    SVG_PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v) cp.setAttribute(p, v); });
    cp.setAttribute('color', cs.color);
    cp.removeAttribute('class'); cp.removeAttribute('style');
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', w); clone.setAttribute('height', h);
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  clone.setAttribute('overflow', 'visible');
  return new XMLSerializer().serializeToString(clone);
}
function roundRectPath(g, x, y, w, h, r){
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const matrixOf = t => { const m = /matrix\(([^)]+)\)/.exec(t || ''); return m ? m[1].split(',').map(Number) : null; };
// draws card {rank, suit} of pack `pack` with its top-left at (x, y), w wide; lit: a gold edge (the scoring cards)
async function drawPackCard(g, card, x, y, w, pack, lit){
  const host = rasterHostEl();
  host.innerHTML = cardHTML({ id:'rc-' + Math.random().toString(36).slice(2), rank:card.rank, suit:card.suit }, { pack, track:false });
  const el = host.firstElementChild;
  el.style.setProperty('--cw', w + 'px'); el.style.setProperty('--ch', w * 1.42 + 'px');
  const pics = [...el.querySelectorAll('img')];
  await Promise.all(pics.map(im => im.complete ? null : new Promise(r => { im.onload = im.onerror = r; })));
  // transforms first (as the page applies them), then everything measured untransformed
  const nodes = [...el.querySelectorAll('*')];
  const tf = new Map(nodes.map(n => { const cs = getComputedStyle(n); return [n, { m: matrixOf(cs.transform), o: cs.transformOrigin.split(' ').map(parseFloat) }]; }));
  host.classList.add('measuring');
  const base = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const rel = r => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
  const rects = new Map(nodes.map(n => [n, rel(n.getBoundingClientRect())]));      // all measured now, transforms off
  const rad = parseFloat(cs.borderTopLeftRadius) || w * .09, H = base.height;
  // the paper
  g.save(); g.translate(x, y);
  g.shadowColor = lit ? 'rgba(245,217,140,.8)' : 'rgba(0,0,0,.45)'; g.shadowBlur = lit ? w * .2 : w * .12; g.shadowOffsetY = lit ? 0 : w * .04;
  roundRectPath(g, 0, 0, w, H, rad);
  const hi = cs.getPropertyValue('--paper-hi').trim(), mid = cs.getPropertyValue('--paper').trim(), lo = cs.getPropertyValue('--paper-lo').trim();
  if (mid){ const gr = g.createLinearGradient(0, 0, w * .2, H); gr.addColorStop(0, hi || mid); gr.addColorStop(.6, mid); gr.addColorStop(1, lo || mid); g.fillStyle = gr; }
  else g.fillStyle = clearColor(cs.backgroundColor) ? '#fbf6ea' : cs.backgroundColor;
  g.fill(); g.shadowColor = 'transparent';
  g.lineWidth = lit ? Math.max(2, w * .03) : 1; g.strokeStyle = lit ? '#f5d98c' : 'rgba(0,0,0,.14)'; g.stroke();
  // a frame drawn by the card's ::before (Deco and friends)
  const be = getComputedStyle(el, '::before');
  if (be.content && be.content !== 'none' && parseFloat(be.borderTopWidth) > 0){
    const t = parseFloat(be.top) || 0, l = parseFloat(be.left) || 0, r = parseFloat(be.right) || 0, b = parseFloat(be.bottom) || 0;
    roundRectPath(g, l, t, w - l - r, H - t - b, parseFloat(be.borderTopLeftRadius) || 0);
    g.lineWidth = parseFloat(be.borderTopWidth); g.strokeStyle = be.borderTopColor; g.stroke();
  }
  // the parts, in page order, each under its ancestors' transforms
  const chain = n => { const list = []; for (let p = n; p && p !== el; p = p.parentElement) list.unshift(p); return list; };
  const withTransforms = (n, draw) => {
    g.save();
    for (const a of chain(n)){
      const t = tf.get(a); if (!t || !t.m) continue;
      const r = rects.get(a), ox = r.x + (t.o[0] || 0), oy = r.y + (t.o[1] || 0);
      g.translate(ox, oy); g.transform(...t.m); g.translate(-ox, -oy);
    }
    draw(); g.restore();
  };
  const jobs = [];
  for (const n of nodes){
    const tag = n.tagName.toLowerCase();
    if (n.closest('svg') && tag !== 'svg') continue;                     // drawn with its svg
    const ncs = getComputedStyle(n);
    if (ncs.display === 'none' || ncs.visibility === 'hidden') continue;
    const r = rects.get(n);
    if (tag === 'svg'){
      const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(standaloneSVG(n, r.w, r.h));
      jobs.push(rasterImg(src).then(im => ({ n, draw: () => { if (im) g.drawImage(im, r.x, r.y, r.w, r.h); } })));
      continue;
    }
    if (tag === 'img'){ jobs.push(Promise.resolve({ n, draw: () => { if (n.naturalWidth) g.drawImage(n, r.x, r.y, r.w, r.h); } })); continue; }
    const fill = !clearColor(ncs.backgroundColor), bw = parseFloat(ncs.borderTopWidth) || 0;
    const texts = [...n.childNodes].filter(t => t.nodeType === 3 && t.textContent.trim());
    if (!fill && !bw && !texts.length) continue;
    const boxes = texts.map(t => { const rg = document.createRange(); rg.selectNodeContents(t); return { t: t.textContent.trim(), r: rel(rg.getBoundingClientRect()) }; });
    jobs.push(Promise.resolve({ n, draw: () => {
      if (fill || bw){
        roundRectPath(g, r.x, r.y, r.w, r.h, parseFloat(ncs.borderTopLeftRadius) || 0);
        if (fill){ g.fillStyle = ncs.backgroundColor; g.fill(); }
        if (bw){ g.lineWidth = bw; g.strokeStyle = ncs.borderTopColor; g.stroke(); }
      }
      g.fillStyle = ncs.color; g.font = `${ncs.fontStyle} ${ncs.fontWeight} ${ncs.fontSize} ${ncs.fontFamily}`;
      if ('letterSpacing' in g) g.letterSpacing = ncs.letterSpacing === 'normal' ? '0px' : ncs.letterSpacing;
      const vertical = /^vertical/.test(ncs.writingMode);
      for (const b of boxes){
        if (vertical){ g.save(); g.translate(b.r.x + b.r.w / 2, b.r.y + b.r.h / 2); g.rotate(Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.t, 0, 0); g.restore(); }
        else { g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(b.t, b.r.x, b.r.y + b.r.h / 2); }
      }
    } }));
  }
  const ready = await Promise.all(jobs);
  host.classList.remove('measuring');
  for (const j of ready) withTransforms(j.n, j.draw);
  g.restore();
  host.innerHTML = '';
  return H;
}
