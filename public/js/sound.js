// Web Audio API sound effects - no external files needed
var SoundFX = (function() {
  var ctx = null;
  var enabled = true;

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { enabled = false; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function playTone(freq, duration, type, volume) {
    if (!enabled) return;
    var c = getCtx();
    if (!c) return;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(volume || 0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  }

  function playNoise(duration, volume) {
    if (!enabled) return;
    var c = getCtx();
    if (!c) return;
    var bufferSize = c.sampleRate * duration;
    var buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/bufferSize, 2);
    var src = c.createBufferSource();
    src.buffer = buffer;
    var gain = c.createGain();
    gain.gain.setValueAtTime(volume || 0.1, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(gain);
    gain.connect(c.destination);
    src.start(c.currentTime);
  }

  function playFilteredNoise(duration, volume, lowFreq, highFreq) {
    if (!enabled) return;
    var c = getCtx();
    if (!c) return;
    var bufferSize = c.sampleRate * duration;
    var buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/bufferSize, 2);
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime((lowFreq + highFreq) / 2, c.currentTime);
    filter.Q.setValueAtTime(0.5, c.currentTime);
    var gain = c.createGain();
    gain.gain.setValueAtTime(volume || 0.1, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(c.currentTime);
  }

  // Layered explosion: sharp crack + low boom + debris rattle
  function playExplosion() {
    if (!enabled) return;
    var c = getCtx();
    if (!c) return;
    var now = c.currentTime;

    // 1. Initial sharp crack (filtered noise burst)
    var crackLen = 0.08;
    var crackBuf = c.createBuffer(1, c.sampleRate * crackLen, c.sampleRate);
    var cd = crackBuf.getChannelData(0);
    for (var i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/cd.length, 0.5);
    var crackSrc = c.createBufferSource();
    crackSrc.buffer = crackBuf;
    var crackGain = c.createGain();
    crackGain.gain.setValueAtTime(0.25, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackLen);
    crackSrc.connect(crackGain);
    crackGain.connect(c.destination);
    crackSrc.start(now);
    crackSrc.stop(now + crackLen);

    // 2. Low boom (sine sweep 80->25Hz)
    var boomLen = 0.5;
    var boomOsc = c.createOscillator();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(80, now);
    boomOsc.frequency.exponentialRampToValueAtTime(25, now + boomLen);
    var boomGain = c.createGain();
    boomGain.gain.setValueAtTime(0.2, now);
    boomGain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + boomLen);
    boomOsc.connect(boomGain);
    boomGain.connect(c.destination);
    boomOsc.start(now);
    boomOsc.stop(now + boomLen);

    // 3. Debris rattle (filtered noise, mid-high)
    var rattleLen = 0.35;
    var rattleBuf = c.createBuffer(1, c.sampleRate * rattleLen, c.sampleRate);
    var rd = rattleBuf.getChannelData(0);
    for (var i = 0; i < rd.length; i++) rd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/rd.length, 1.5);
    var rattleSrc = c.createBufferSource();
    rattleSrc.buffer = rattleBuf;
    var rattleFilter = c.createBiquadFilter();
    rattleFilter.type = 'highpass';
    rattleFilter.frequency.setValueAtTime(800, now);
    var rattleGain = c.createGain();
    rattleGain.gain.setValueAtTime(0.08, now + 0.02);
    rattleGain.gain.exponentialRampToValueAtTime(0.001, now + rattleLen);
    rattleSrc.connect(rattleFilter);
    rattleFilter.connect(rattleGain);
    rattleGain.connect(c.destination);
    rattleSrc.start(now + 0.02);
    rattleSrc.stop(now + rattleLen);
  }

  // Layered bomb plant: click + thud + faint hiss
  function playBombPlant() {
    if (!enabled) return;
    var c = getCtx();
    if (!c) return;
    var now = c.currentTime;

    // 1. Metallic click (short high ping)
    var clickOsc = c.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(800, now);
    clickOsc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
    var clickGain = c.createGain();
    clickGain.gain.setValueAtTime(0.06, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    clickOsc.connect(clickGain);
    clickGain.connect(c.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.06);

    // 2. Low thud (impact of bomb hitting ground)
    var thudOsc = c.createOscillator();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(120, now + 0.02);
    thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    var thudGain = c.createGain();
    thudGain.gain.setValueAtTime(0.15, now + 0.02);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    thudOsc.connect(thudGain);
    thudGain.connect(c.destination);
    thudOsc.start(now + 0.02);
    thudOsc.stop(now + 0.15);

    // 3. Faint fuse sizzle (soft noise)
    var sizzleLen = 0.2;
    var sizBuf = c.createBuffer(1, c.sampleRate * sizzleLen, c.sampleRate);
    var sd = sizBuf.getChannelData(0);
    for (var i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1) * (1 - i/sd.length);
    var sizSrc = c.createBufferSource();
    sizSrc.buffer = sizBuf;
    var sizGain = c.createGain();
    sizGain.gain.setValueAtTime(0.03, now + 0.06);
    sizGain.gain.exponentialRampToValueAtTime(0.001, now + sizzleLen);
    sizSrc.connect(sizGain);
    sizGain.connect(c.destination);
    sizSrc.start(now + 0.06);
    sizSrc.stop(now + sizzleLen);
  }

  return {
    toggle: function() { enabled = !enabled; return enabled; },
    isEnabled: function() { return enabled; },
    bomb: function() { playBombPlant(); },
    explode: function() { playExplosion(); },
    death: function() { playTone(300, 0.1, "square", 0.1); setTimeout(function() { playTone(200, 0.15, "square", 0.1); }, 100); setTimeout(function() { playTone(100, 0.3, "square", 0.08); }, 250); },
    powerup: function() { playTone(600, 0.08, "sine", 0.12); setTimeout(function() { playTone(900, 0.1, "sine", 0.1); }, 80); },
    gameStart: function() { playTone(400, 0.1, "sine", 0.12); setTimeout(function() { playTone(600, 0.1, "sine", 0.1); }, 120); setTimeout(function() { playTone(800, 0.15, "sine", 0.1); }, 240); },
    gameOver: function() { playTone(500, 0.15, "sine", 0.1); setTimeout(function() { playTone(400, 0.15, "sine", 0.1); }, 200); setTimeout(function() { playTone(300, 0.2, "sine", 0.08); }, 400); setTimeout(function() { playTone(200, 0.4, "sine", 0.08); }, 600); },
    victory: function() { playTone(523, 0.12, "sine", 0.12); setTimeout(function() { playTone(659, 0.12, "sine", 0.12); }, 120); setTimeout(function() { playTone(784, 0.12, "sine", 0.12); }, 240); setTimeout(function() { playTone(1047, 0.3, "sine", 0.15); }, 360); }
  };
})();
