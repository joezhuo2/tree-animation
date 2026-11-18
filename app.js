"use strict";

(() => {
  const seasons = [
    {name: "Spring", effect: "Drifting petals", accent: "#efb1cd"},
    {name: "Summer", effect: "Dancing fireflies", accent: "#b6d39c"},
    {name: "Autumn", effect: "Falling leaves", accent: "#e6ad7e"},
    {name: "Winter", effect: "Gentle snowfall", accent: "#b2cfe9"}
  ];
  const range = document.querySelector("#season");
  const heading = document.querySelector("#season-name");
  const effect = document.querySelector("#effect-name");
  const stops = [...document.querySelectorAll(".stop")];
  const cycle = document.querySelector("#cycle");
  const sound = document.querySelector("#audio");
  const fullscreen = document.querySelector("#fullscreen");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let position = 0, currentSeason = -1, playing = false, animation = 0, direction = 1;
  let audio, gain, filter, audible = false;

  function icon(button, id) { button.querySelector("use").setAttribute("href","#"+id); }
  function display(value) {
    position = Math.min(3, Math.max(0,value));
    const index = Math.round(position), season = seasons[index];
    range.value = Math.round(position*100);
    const percentage = Math.round((position%1)*100);
    range.setAttribute("aria-valuetext", percentage && position < 3
      ? seasons[Math.floor(position)].name+" to "+seasons[Math.ceil(position)].name+", "+percentage+" percent"
      : season.name);
    if (currentSeason !== index) {
      currentSeason = index;
      heading.textContent = season.name; effect.textContent = season.effect;
      document.documentElement.style.setProperty("--accent",season.accent);
      stops.forEach((button,i) => {
        button.setAttribute("aria-pressed",String(i===index));
        button.classList.toggle("active",i===index);
      });
      if (filter) filter.frequency.setTargetAtTime([690,1200,820,450][index],audio.currentTime,.5);
    }
    window.arboriaScene.setSeason(position);
  }
  function setPlaying(value) {
    playing = value;
    cancelAnimationFrame(animation);
    cycle.setAttribute("aria-pressed",String(value));
    cycle.setAttribute("aria-label",value ? "Pause automatic season cycle" : "Start automatic season cycle");
    icon(cycle,value ? "pause" : "play");
  }
  range.addEventListener("input", () => {setPlaying(false); display(Number(range.value)/100);});
  range.addEventListener("pointerdown", () => setPlaying(false));
  stops.forEach((button,index) => button.addEventListener("click", event => {
    setPlaying(false);
    if (reduced.matches || event.detail===0) {display(index); return;}
    const from=position, start=performance.now();
    function step(now) {
      const progress=Math.min(1,(now-start)/580);
      display(from+(index-from)*(progress*progress*(3-2*progress)));
      if (progress<1) animation=requestAnimationFrame(step);
    }
    animation=requestAnimationFrame(step);
  }));
  cycle.addEventListener("click",() => {
    setPlaying(!playing);
    if (!playing) return;
    let previous=performance.now(), hold=0, target;
    function nextStop() {
      if (position>=3) direction=-1;
      if (position<=0) direction=1;
      return direction>0 ? Math.floor(position+.00001)+1 : Math.ceil(position-.00001)-1;
    }
    target=nextStop();
    function advance(now) {
      const dt=Math.min(80,now-previous); previous=now;
      if (hold>0) hold-=dt;
      else {
        const next=position+dt/4600*direction;
        if ((direction>0 && next>=target)||(direction<0 && next<=target)) {
          display(target); hold=2300; target=nextStop();
        } else display(next);
      }
      animation=requestAnimationFrame(advance);
    }
    animation=requestAnimationFrame(advance);
  });
  function makeAmbience() {
    audio=new AudioContext();
    const buffer=audio.createBuffer(1,audio.sampleRate*5,audio.sampleRate);
    const samples=buffer.getChannelData(0);
    let smooth=0;
    for (let i=0;i<samples.length;i++) {
      smooth=(smooth+(Math.random()*2-1)*.027)/1.025;
      samples[i]=smooth*3;
    }
    const breeze=audio.createBufferSource(); breeze.buffer=buffer; breeze.loop=true;
    filter=audio.createBiquadFilter(); filter.type="lowpass"; filter.frequency.value=[690,1200,820,450][currentSeason];
    gain=audio.createGain(); gain.gain.value=0;
    const gust=audio.createOscillator(), depth=audio.createGain(); gust.frequency.value=.12; depth.gain.value=200;
    gust.connect(depth).connect(filter.frequency); gust.start();
    breeze.connect(filter).connect(gain).connect(audio.destination); breeze.start();
  }
  sound.addEventListener("click",async () => {
    try {
      if (!audio) makeAmbience();
      await audio.resume(); audible=!audible;
      gain.gain.setTargetAtTime(audible ? .24 : 0,audio.currentTime,.15);
      icon(sound,audible ? "sound" : "mute");
      sound.querySelector("span").textContent=audible ? "Sound on" : "Sound off";
      sound.setAttribute("aria-pressed",String(audible));
    } catch { sound.querySelector("span").textContent="Sound unavailable"; }
  });
  if (!document.fullscreenEnabled) fullscreen.hidden=true;
  fullscreen.addEventListener("click",async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { fullscreen.title="Fullscreen unavailable in this window"; }
  });
  document.addEventListener("fullscreenchange",() => {
    const label=document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen";
    fullscreen.setAttribute("aria-label",label); fullscreen.title=label;
    icon(fullscreen,document.fullscreenElement ? "collapse" : "expand");
  });
  setPlaying(false); display(0);
})();
