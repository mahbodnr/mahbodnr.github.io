/* Bankroll · synthesised sound effects (no audio files): card flicks from filtered noise, chimes from layered tones */
'use strict';

let actx = null, master = null, noiseBuf = null;
function audio(){
  if (!actx){
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.4, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === 'suspended') actx.resume().catch(() => {});    // some webviews refuse audio at first; the next tap tries again
  master.gain.value = 0.9 * (prefs.volume ?? 0.8);
  return actx;
}
const portalMuted = () => typeof Portal !== 'undefined' && Portal.muted;   // CrazyGames' mute setting wins (js/portal.js)
function sfx(kind){
  if (!prefs.sound || !(prefs.volume ?? 0.8) || portalMuted()) return;
  try {
    const ac = audio(), t = ac.currentTime;
    const tone = (f, d, type, v, at, f2) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + at);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + d);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(v, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
      o.connect(g).connect(master); o.start(t + at); o.stop(t + at + d + 0.03);
    };
    // a short burst of band-passed noise: the sound of card stock
    const flick = (at, freq, d, v, q) => {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1.2;
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(v, t + at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
      s.connect(f).connect(g).connect(master); s.start(t + at, Math.random() * 0.2); s.stop(t + at + d + 0.02);
    };
    const chime = (f, at, v) => { tone(f, .5, 'sine', v, at); tone(f * 2.01, .32, 'sine', v * .35, at); tone(f * 3.02, .18, 'triangle', v * .12, at); };
    switch (kind){
      case 'deal':  flick(0, 2600, .07, .5); flick(.012, 1200, .05, .2); tone(180, .06, 'sine', .08, 0, 90); break;
      case 'place': flick(0, 1500, .05, .35, .9); tone(240, .05, 'sine', .07, 0, 140); break;
      case 'swish': flick(0, 3400, .16, .28, .6); break;
      case 'shuffle': for (let i = 0; i < 9; i++) flick(i * .045, 2200 + (i % 3) * 400, .05, .3); break;
      case 'coin':  chime(1568, 0, .07); chime(2093, .06, .06); break;
      case 'debt':  tone(311, .18, 'square', .03, 0, 196); flick(0, 700, .08, .12); break;
      case 'power': [659, 880, 1319].forEach((f, i) => chime(f, i * .06, .055)); break;
      case 'win':   [523, 659, 784, 1047, 1319].forEach((f, i) => chime(f, i * .075, .06)); tone(131, .5, 'triangle', .05, 0); break;
      case 'lose':  tone(247, .45, 'sawtooth', .035, 0, 82); tone(185, .55, 'triangle', .05, .08, 62); break;
    }
  } catch(e){}
}

/* ---------- background music: "Calculated Ante" ----------
   One file: the intro (played once), then a 20-bar body that loops without a gap (Web Audio loop points, so the
   loop is sample-exact). Encoders add a little silence at the start of a file, and how much differs between AAC and
   Opus decoders, so the loop points are found from the music itself: the drop is the first loud sample after the
   intro's pause. The level sits a few dB under the sound effects (measured: typical effect ≈ 0.018 RMS, music
   ≈ 0.18 RMS, so MUSIC_GAIN × the default volume ≈ 0.06). Browsers only allow sound after a tap, so it starts on
   the first one. */
const MUSIC = { files:['audio/calculated-ante.m4a', 'audio/calculated-ante.ogg'],
  drop:4.668345, loopStart:4.658345, loopEnd:50.813583 };      // seconds in the master file (44.1 kHz)
const MUSIC_GAIN = 0.075;
const music = { buf:null, loading:null, src:null, gain:null, started:false, introDone:false };
async function loadMusic(ac){
  if (music.buf) return music.buf;
  if (!music.loading) music.loading = (async () => {
    for (const f of MUSIC.files){
      try {
        const res = await fetch(f); if (!res.ok) continue;
        const buf = await ac.decodeAudioData(await res.arrayBuffer());
        // where the drop really is in this decode (encoder padding moves everything a little)
        const x = buf.getChannelData(0), from = Math.floor(4.3 * buf.sampleRate);
        let i = from; while (i < x.length && Math.abs(x[i]) <= 0.05) i++;
        if (i >= x.length) continue;
        buf.shift = i / buf.sampleRate - MUSIC.drop;
        return (music.buf = buf);
      } catch(e){}
    }
    return null;
  })();
  return music.loading;
}
const musicLevel = () => prefs.music && !portalMuted() ? MUSIC_GAIN * (prefs.musicVolume ?? 0.8) : 0;
async function startMusic(){
  if (!prefs.music || portalMuted() || music.src || music.starting) return;
  music.starting = true;
  try {
    const ac = audio(), buf = await loadMusic(ac);
    if (!buf || !prefs.music || music.src) return;
    if (!music.gain){ music.gain = ac.createGain(); music.gain.connect(ac.destination); }
    const s = ac.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.loopStart = MUSIC.loopStart + buf.shift; s.loopEnd = MUSIC.loopEnd + buf.shift;
    const t = ac.currentTime;
    music.gain.gain.cancelScheduledValues(t); music.gain.gain.setValueAtTime(0.0001, t);
    music.gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, musicLevel()), t + 0.6);
    s.connect(music.gain);
    // the intro plays once; turning the music back on later starts at the loop. Or where another view of the game had
    // got to (Reddit's feed post, opened in full: reddit/client/reddit-inline.js)
    let off = music.introDone ? s.loopStart : 0;
    if (music.resumeAt != null){ off = music.resumeAt; music.resumeAt = null; }
    if (off >= s.loopEnd) off = s.loopStart + (off - s.loopStart) % (s.loopEnd - s.loopStart);
    s.start(t, off);
    music.t0 = t; music.off0 = off;
    music.introDone = true; music.src = s;
  } catch(e){}
  finally { music.starting = false; }
}
// where in the track the music is now (seconds), or null when it isn't playing
function musicAt(){
  const s = music.src; if (!s || !actx) return null;
  const e = music.off0 + (actx.currentTime - music.t0);
  return e < s.loopEnd ? e : s.loopStart + (e - s.loopStart) % (s.loopEnd - s.loopStart);
}
function stopMusic(){
  const s = music.src; if (!s) return;
  music.src = null;
  try { const t = actx.currentTime; music.gain.gain.cancelScheduledValues(t); music.gain.gain.setTargetAtTime(0.0001, t, 0.12); s.stop(t + 0.6); } catch(e){}
}
// the volume slider and the switch
function applyMusic(){
  if (!prefs.music || portalMuted()){ stopMusic(); return; }
  if (music.src && music.gain && actx){ const t = actx.currentTime; music.gain.gain.cancelScheduledValues(t); music.gain.gain.setTargetAtTime(Math.max(0.0001, musicLevel()), t, 0.05); }
  else if (music.unlocked) startMusic();
}
// first tap or key: sound is allowed from now on
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { music.unlocked = true; startMusic(); }, { capture:true, passive:true }));
// quiet while the game is hidden (another tab, Telegram in the background)
document.addEventListener('visibilitychange', () => {
  if (!actx) return;
  try { if (document.hidden) actx.suspend().catch(() => {}); else if (music.src || prefs.sound) actx.resume().catch(() => {}); } catch(e){}
});

// the music button in the header: on or off at a glance
function musicBtnState(){ const b = document.getElementById('musicBtn'); if (b){ b.setAttribute('aria-pressed', String(!!prefs.music)); b.title = prefs.music ? 'Music on' : 'Music off'; b.setAttribute('aria-label', b.title); } }
