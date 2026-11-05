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
  if (actx.state === 'suspended') actx.resume();
  master.gain.value = 0.9 * (prefs.volume ?? 0.8);
  return actx;
}
function sfx(kind){
  if (!prefs.sound || !(prefs.volume ?? 0.8)) return;
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
