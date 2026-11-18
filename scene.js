"use strict";

window.arboriaScene = (() => {
  const stage = document.querySelector("#explorer");
  const tree = document.querySelector("#tree");
  const sky = document.querySelector("#landscape");
  const weather = document.querySelector("#weather");
  const crown = document.querySelector("#canopy");
  const skyCtx = sky.getContext("2d");
  const air = weather.getContext("2d");
  const branches = crown.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const atlas = new Image();
  const blend = document.createElement("canvas");
  const layers = blend.getContext("2d");
  const tau = 2 * Math.PI;
  let width, height, base, treeBox, pixelRatio;
  let position = 0, clock = 0, lastFrame = 0, frameId = 0, backgroundStep = -1;
  let seed = 8801;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const stars = Array.from({length: 190}, () => ({
    x: random(), y: random() * .77, size: .28 + random() ** 2 * 1.05, light: .22 + random() * .56
  }));
  const particles = Array.from({length: 125}, () => ({
    x: random(), y: random(), p: random() * tau, r: .32 + random() * .8,
    speed: .55 + random() * .9, drift: random()
  }));
  const palettes = [
    [[13,16,33],[30,33,59],[89,65,92],[39,39,57]],
    [[9,20,36],[25,42,61],[64,89,91],[29,48,50]],
    [[22,20,35],[50,42,61],[119,79,82],[57,44,50]],
    [[12,20,38],[38,55,80],[103,118,145],[50,61,81]]
  ];
  function tint(index) {
    const start = Math.floor(position), t = position - start;
    return palettes[start][index].map((a, i) =>
      Math.round(a + (palettes[Math.min(start + 1, 3)][index][i] - a) * t));
  }
  function ridge(x, level) {
    const amplitudes = [18, 14, 9, 6];
    const scale = Math.min(1.3, width / 1150);
    return base + [-54,-31,-11,10][level] * scale
      + (Math.sin(x * .007 + level * 23) * .8 + Math.cos(x * .011 + level * 7) * .5
      + Math.sin(x * .025 + level) * .2) * amplitudes[level] * scale;
  }
  function landscape() {
    const ctx = skyCtx;
    const skyColors = [0,1,2,3].map(tint);
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "rgb(" + skyColors[0] + ")");
    g.addColorStop(.48, "rgb(" + skyColors[1] + ")");
    g.addColorStop(Math.max(.50, base / height), "rgb(" + skyColors[2] + ")");
    g.addColorStop(1, "#101320");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    for (const s of stars) {
      const y = s.y * height;
      if (y > base - 28) continue;
      ctx.fillStyle = "rgba(231,222,245," + s.light + ")";
      ctx.beginPath(); ctx.arc(s.x * width, y, s.size, 0, tau); ctx.fill();
      if (s.size > 1.23) {
        ctx.fillStyle = "#e9e4fd50";
        ctx.fillRect(s.x * width - 2.7, y - .35, 5.4, .7);
        ctx.fillRect(s.x * width - .35, y - 2.7, .7, 5.4);
      }
    }
    const moonX = width * (width < 510 ? .82 : .833);
    const moonY = Math.max(114, height * .214);
    const radius = width < 510 ? 13 : 18;
    const halo = ctx.createRadialGradient(moonX,moonY,0,moonX,moonY,radius * 4);
    halo.addColorStop(0, "#ffe9d718"); halo.addColorStop(1, "#ffe9d700");
    ctx.fillStyle = halo; ctx.fillRect(moonX-radius*4,moonY-radius*4,radius*8,radius*8);
    ctx.save(); ctx.translate(moonX, moonY); ctx.rotate(-.48);
    ctx.fillStyle = "#f4e5d1"; ctx.shadowColor = "#ffe4c67a"; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(0,0,radius,-Math.PI/2,.45,true);
    ctx.bezierCurveTo(-radius*.15,radius*.6,-radius*.65,-radius*.3,0,-radius);
    ctx.fill(); ctx.restore();

    seed = 24011;
    for (let level = 0; level < 4; level++) {
      const factor = [1.2,.99,.73,.46][level];
      const top = skyColors[3].map(n => Math.round(n * factor + (3-level)*4));
      const ground = ctx.createLinearGradient(0,base-48,0,height);
      ground.addColorStop(0, "rgb(" + top + ")"); ground.addColorStop(1, "#0c101a");
      ctx.fillStyle = ground; ctx.beginPath(); ctx.moveTo(-3, height);
      for (let x = -3; x <= width + 4; x += 3) ctx.lineTo(x, ridge(x,level) + random()*1.8);
      ctx.lineTo(width + 4,height); ctx.closePath(); ctx.fill();
      if (level === 1 || level === 2) {
        ctx.fillStyle = "rgb(" + top + ")";
        for (let x = 0; x < width; x += 3 + random()*9) {
          const y = ridge(x,level) + 2, h = (3 + random()**2*11)*(level===1?.6:1);
          ctx.beginPath(); ctx.moveTo(x-h*.24,y); ctx.lineTo(x,y-h); ctx.lineTo(x+h*.26,y); ctx.fill();
        }
      }
    }
    // Small foreground grasses tie the illuminated tree bank into the valley.
    ctx.strokeStyle = "#101524aa"; ctx.lineWidth = .8;
    ctx.beginPath();
    for (let i = 0; i < Math.min(1100, width); i++) {
      const x = random()*width, y = base+random()*32;
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x-1,y-4,x-3-random()*3,y-4-random()*8);
    }
    ctx.stroke();
  }
  function mixTree() {
    if (!atlas.naturalWidth) return;
    const w = blend.width, h = blend.height, low = Math.floor(position);
    const fraction = position-low;
    layers.clearRect(0,0,w,h);
    function layer(index, alpha) {
      layers.globalAlpha = alpha;
      layers.drawImage(atlas, index%2*w, Math.floor(index/2)*h, w,h, 0,0,w,h);
    }
    layers.globalCompositeOperation = "source-over";
    layer(low,1-fraction);
    if (fraction > 0) {
      layers.globalCompositeOperation = "lighter"; layer(low+1,fraction);
    }
    layers.globalAlpha = 1;
  }
  function paintTree(time) {
    if (!atlas.naturalWidth) return;
    const w = crown.width, h = crown.height;
    branches.clearRect(0,0,w,h);
    const sway = reducedMotion.matches ? 0 : Math.sin(time*.65)*.0018 + Math.sin(time*1.29)*.0007;
    // Horizontal bands flex more at the crown while the roots stay planted.
    for (let y=0; y<h; y+=4) {
      const band = Math.min(4,h-y);
      const flex = Math.max(0,1-y/(h*.86))**1.5;
      branches.drawImage(blend,0,y,w,band,w*sway*flex, y, w,band);
    }
  }
  function paintWeather(t) {
    air.clearRect(0,0,width,height);
    const box = treeBox, spring = Math.max(0,1-position);
    const summer = Math.max(0,1-Math.abs(position-1));
    const autumn = Math.max(0,1-Math.abs(position-2));
    const winter = Math.max(0,position-2);
    function falling(i, p, opacity, fallLeaf) {
      if (opacity <= 0 || i > (fallLeaf ? 42 : 57)) return;
      const progress = (p.y + t * .045 * p.speed) % 1;
      const x = box.x + (.06 + p.x*.88)*box.width + progress * (p.drift*115+28) + Math.sin(progress*tau + p.p)*18;
      const y = box.y + box.height*(.13+p.drift*.31+progress*(.82-p.drift*.31));
      const size = (fallLeaf ? 4.5 : 3.15)*p.r;
      air.save(); air.translate(x,y); air.rotate(p.p + t*.65);
      air.scale(.3+.7*Math.abs(Math.sin(t*.95+p.p)),1);
      air.globalAlpha = Math.min(1,progress*12,(1-progress)*9)*opacity*(.45+p.r*.4);
      air.fillStyle = fallLeaf ? (i%2 ? "#e5a159" : "#d17751") : (i%3 ? "#ecacc9" : "#ffdae6");
      air.beginPath(); air.moveTo(0,-size); air.bezierCurveTo(size*1.4,-size*.7,size*.8,size*.7,0,size);
      air.bezierCurveTo(-size*.65,size*.5,-size*.7,-size*.6,0,-size); air.fill(); air.restore();
    }
    for (let i=0;i<particles.length;i++) {
      const p = particles[i];
      falling(i,p,spring,false); falling(i,p,autumn,true);
      if (winter > 0) {
        const progress = (p.y + t*.057*p.speed)%1, y=progress*(base+12);
        const x=(p.x*width + 17*Math.sin(t*.46+p.p) + progress*45)%width;
        air.globalAlpha = winter * (.3+p.r*.47)*Math.min(1,(1-progress)*10);
        air.fillStyle="#e4edf8"; air.beginPath(); air.arc(x,y,p.r*1.9,0,tau); air.fill();
      }
      if (i<27) {
        const brightness=(.2+.8*(.5+.5*Math.sin(p.p+t*p.speed))) * (summer*.85 + spring*.35 + autumn*.14);
        if (brightness < .01) continue;
        const x=(.07+.85*p.x)*width + Math.sin(t*.36+p.p)*17;
        const y=base-5-p.y**2*box.height*.4+Math.cos(t*.39+p.p)*5;
        air.globalAlpha=brightness; air.fillStyle="#f5df91"; air.shadowColor="#f1d982"; air.shadowBlur=7;
        air.beginPath(); air.arc(x,y,1.3*p.r,0,tau); air.fill(); air.shadowBlur=0;
      }
      air.globalAlpha=1;
    }
    air.globalAlpha = 1;
  }
  function render() { paintTree(clock); paintWeather(clock); }
  function tick(now) {
    if (now-lastFrame >= 32) {
      clock += Math.min((now-lastFrame)/1000,.06);
      render(); lastFrame = now;
    }
    frameId = requestAnimationFrame(tick);
  }
  function motion() {
    cancelAnimationFrame(frameId);
    if (!document.hidden && !reducedMotion.matches) { lastFrame=performance.now(); frameId=requestAnimationFrame(tick); }
    else render();
  }
  function resize() {
    const bounds = stage.getBoundingClientRect(), box = tree.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    treeBox = {x: box.x-bounds.x, y: box.y-bounds.y, width: box.width, height: box.height};
    base = treeBox.y + treeBox.height*.94;
    pixelRatio = Math.min(devicePixelRatio || 1,2);
    for (const canvas of [sky, weather]) {
      canvas.width=Math.round(width*pixelRatio); canvas.height=Math.round(height*pixelRatio);
      canvas.getContext("2d").setTransform(pixelRatio,0,0,pixelRatio,0,0);
    }
    landscape(); render();
  }
  atlas.onload = () => {
    blend.width = crown.width = atlas.naturalWidth / 2;
    blend.height = crown.height = atlas.naturalHeight / 2;
    mixTree(); render();
  };
  atlas.src = "canopy.png";
  new ResizeObserver(resize).observe(stage);
  reducedMotion.addEventListener("change",motion);
  document.addEventListener("visibilitychange",motion);
  resize(); motion();
  return { setSeason(value) {
    position = value; mixTree();
    const step = Math.round(position*16);
    if (step !== backgroundStep) { landscape(); backgroundStep = step; }
    render();
  }};
})();
