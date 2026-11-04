// Inline SVG icon set (24x24, stroke based). Built with createElementNS so it works under a strict CSP.
// Spec mini-language: "p:<path d>" path, "c:cx,cy,r" circle, "f:cx,cy,r" filled dot, "l:x1,y1,x2,y2" line,
// "r:x,y,w,h,rx" rect, "y:points" polyline, "g:points" polygon, "e:cx,cy,rx,ry" ellipse.

const ICONS = {
  home: ['p:M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  grid: ['r:3,3,7,7,1.5', 'r:14,3,7,7,1.5', 'r:3,14,7,7,1.5', 'r:14,14,7,7,1.5'],
  laptop: ['r:4,5,16,11,1.5', 'p:M2 20h20'],
  git: ['c:6,5.5,2.5', 'c:6,18.5,2.5', 'c:18,9,2.5', 'p:M6 8v8', 'p:M18 11.5v.5a3 3 0 0 1-3 3H9'],
  server: ['r:3,4,18,7,2', 'r:3,13,18,7,2', 'f:7,7.5,.9', 'f:7,16.5,.9'],
  sparkles: ['p:M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z', 'p:M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
  bot: ['r:4,8,16,11,3', 'p:M12 4.5V8', 'f:12,3.6,1.1', 'f:9,13.5,1.1', 'f:15,13.5,1.1', 'p:M9.5 16.5h5'],
  plug: ['p:M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0z', 'p:M12 17v4'],
  activity: ['y:3,12 7,12 10,4 14,20 17,12 21,12'],
  search: ['c:11,11,6.5', 'l:16,16,21,21'],
  sun: ['c:12,12,4', 'l:12,2.5,12,5', 'l:12,19,12,21.5', 'l:2.5,12,5,12', 'l:19,12,21.5,12', 'l:5.3,5.3,7,7', 'l:17,17,18.7,18.7', 'l:5.3,18.7,7,17', 'l:17,7,18.7,5.3'],
  moon: ['p:M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  auto: ['c:12,12,8.5', 'p:M12 3.5a8.5 8.5 0 0 1 0 17z'],
  check: ['y:5,12.5 10,17.5 19,7'],
  x: ['l:6,6,18,18', 'l:18,6,6,18'],
  alert: ['p:M12 3.5 2.8 19.5h18.4z', 'l:12,10,12,14', 'f:12,16.9,.9'],
  info: ['c:12,12,9', 'l:12,11,12,16', 'f:12,8,.9'],
  copy: ['r:9,9,11,11,2', 'p:M5 15V6a2 2 0 0 1 2-2h9'],
  download: ['p:M12 4v11M7 11l5 5 5-5M4 20h16'],
  upload: ['p:M12 16V5M7 9l5-5 5 5M4 20h16'],
  play: ['g:7,4 20,12 7,20'],
  external: ['p:M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  shield: ['p:M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'y:8.5,12 11,14.5 15.5,9.5'],
  globe: ['c:12,12,9', 'e:12,12,4,9', 'l:3,12,21,12'],
  cpu: ['r:6,6,12,12,2', 'r:10,10,4,4,.5', 'p:M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3'],
  route: ['c:6,18,2.5', 'c:18,6,2.5', 'p:M6 15.5V9.5a3 3 0 0 1 3-3h6.5'],
  zap: ['g:13,2 4,14 11,14 10,22 20,9 13,9'],
  chevron: ['y:9,6 15,12 9,18'],
  clock: ['c:12,12,9', 'y:12,7 12,12 15.5,14'],
  trash: ['p:M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'],
  save: ['p:M5 4h11l3 3v13H5z', 'p:M8 4v5h7V4', 'p:M8 20v-6h8v6'],
  restore: ['p:M3 12a9 9 0 1 0 3-6.7L3 8', 'p:M3 3v5h5'],
  terminal: ['r:3,4,18,16,2', 'y:7.5,10 11,12.5 7.5,15', 'l:13,15.5,16.5,15.5'],
  layers: ['g:12,3 22,8.5 12,14 2,8.5', 'p:M2 13l10 5.5L22 13'],
  box: ['p:M12 3l9 4.5v9L12 21l-9-4.5v-9z', 'p:M3 7.5l9 4.5 9-4.5M12 12v9'],
  refresh: ['p:M20 11a8 8 0 0 0-14-4.5L4 9', 'p:M4 4v5h5', 'p:M4 13a8 8 0 0 0 14 4.5L20 15', 'p:M20 20v-5h-5'],
  pull: ['p:M12 4v12M7 11l5 5 5-5', 'p:M5 20h14'],
  push: ['p:M12 20V8M7 13l5-5 5 5', 'p:M5 4h14'],
  plus: ['l:12,5,12,19', 'l:5,12,19,12'],
  command: ['p:M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z'],
  file: ['p:M6 3h8l4 4v14H6z', 'p:M14 3v4h4'],
  heart: ['p:M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z'],
  logo: ['p:M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z', 'p:M9 16V8.5h3.4a2.3 2.3 0 0 1 0 4.6H9', 'p:M12.2 13.1 15 16']
};

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function icon(name, size = 18) {
  const svg = el('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'icon'
  });
  for (const spec of ICONS[name] ?? ICONS.info) {
    const kind = spec[0];
    const v = spec.slice(2);
    const n = v.split(',').map(Number);
    if (kind === 'p') svg.append(el('path', { d: v }));
    else if (kind === 'c') svg.append(el('circle', { cx: n[0], cy: n[1], r: n[2] }));
    else if (kind === 'f') svg.append(el('circle', { cx: n[0], cy: n[1], r: n[2], fill: 'currentColor', stroke: 'none' }));
    else if (kind === 'l') svg.append(el('line', { x1: n[0], y1: n[1], x2: n[2], y2: n[3] }));
    else if (kind === 'r') svg.append(el('rect', { x: n[0], y: n[1], width: n[2], height: n[3], rx: n[4] }));
    else if (kind === 'y') svg.append(el('polyline', { points: v }));
    else if (kind === 'g') svg.append(el('polygon', { points: v }));
    else if (kind === 'e') svg.append(el('ellipse', { cx: n[0], cy: n[1], rx: n[2], ry: n[3] }));
  }
  return svg;
}

export const ICON_NAMES = Object.keys(ICONS);
export { el as svgEl, NS as SVG_NS };
