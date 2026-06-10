/**
 * GRACE Companion — floating chat layer shared by all Central Henderson previews.
 *
 * GRACE is the ethical, self-learning companion with agency over the app
 * experience: she navigates, acts, remembers your rhythm, and talks.
 * She is deliberately separate from Verified Leader avatars — personal and
 * pastoral conversation is always handed off to a leader, and crisis
 * language routes straight to live care.
 *
 * Usage:
 *   GRACE_COMPANION.mount({
 *     mode: 'float' | 'sheet',
 *     container: HTMLElement,        // body (float) or device frame (sheet)
 *     zIndex: 8800,
 *     messaging: GRACE_MSG,          // from GRACE_MESSAGING.getMessaging()
 *     memberName: 'Maya',
 *     orbs: ['.sb-grace-orb', ...],  // selectors made clickable
 *     navigate: fn(key) -> bool,     // app navigation adapter
 *     openLeader: fn(),              // hand off to Verified Leader avatar
 *     toast: fn(msg),
 *     getState: fn() -> {goalPct, goalTarget, groupCount, viewers, ...}
 *     voiceProvider: 'elevenlabs' | 'browser',
 *     ttsUrl: '/api/grace-tts',
 *     autoDetectVoice: true
 *   });
 *   GRACE_COMPANION.open(); GRACE_COMPANION.ask('How do I give?');
 */
(function (global) {
  'use strict';

  let A = null;          // adapter
  let M = null;          // messaging
  let root = null;       // panel root element
  let isOpen = false;
  let thinking = false;
  let greeted = false;

  /* ══ MEMORY ENGINE — self-learning, scoped to this institution ══ */
  const Memory = {
    key: 'grace.companion.central-henderson',
    data: null,
    load() {
      try {
        this.data = JSON.parse(localStorage.getItem(this.key)) || null;
      } catch (e) { this.data = null; }
      if (!this.data) {
        this.data = {
          firstVisit: Date.now(), visits: 0, lastVisit: null,
          voiceOn: true, intents: {}, sessions: [], notes: []
        };
      }
      return this.data;
    },
    save() {
      try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
    },
    visit() {
      const d = new Date();
      this.data.visits++;
      this.data.lastVisit = Date.now();
      this.data.sessions.push({ day: d.getDay(), hour: d.getHours(), t: Date.now() });
      if (this.data.sessions.length > 60) this.data.sessions = this.data.sessions.slice(-60);
      this.save();
    },
    record(intent) {
      if (!intent) return;
      this.data.intents[intent] = (this.data.intents[intent] || 0) + 1;
      this.save();
    },
    topIntents(n) {
      return Object.entries(this.data.intents)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n || 3)
        .map((e) => e[0]);
    },
    favouriteHourLabel() {
      const s = this.data.sessions;
      if (s.length < 4) return null;
      const buckets = { morning: 0, afternoon: 0, evening: 0 };
      s.forEach((x) => {
        if (x.hour < 12) buckets.morning++;
        else if (x.hour < 17) buckets.afternoon++;
        else buckets.evening++;
      });
      const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
      return top[1] >= 3 ? top[0] : null;
    },
    clear() {
      try { localStorage.removeItem(this.key); } catch (e) {}
      this.data = null;
      this.load();
      this.save();
    }
  };

  /* ══ VOICE ENGINE — ElevenLabs (Vercel proxy) + browser speechSynthesis fallback ══ */
  const Voice = {
    provider: 'browser',
    browserSupported: typeof speechSynthesis !== 'undefined',
    voice: null,
    speaking: false,
    _audio: null,
    _objectUrl: null,
    _abort: null,
    _fallbackLogged: false,
    init(adapter) {
      const preferred = adapter.voiceProvider || 'browser';
      this.provider = preferred === 'elevenlabs' ? 'elevenlabs' : 'browser';
      this.ttsUrl = adapter.ttsUrl || '/api/grace-tts';
      this.autoDetect = adapter.autoDetectVoice !== false;
      if (this.browserSupported) this.pick();
    },
    detectProvider() {
      if (!A || A.voiceProvider !== 'elevenlabs') {
        this.provider = 'browser';
        updateVoiceStatusLabel();
        return Promise.resolve();
      }
      if (!this.autoDetect) {
        updateVoiceStatusLabel();
        return Promise.resolve();
      }
      const healthUrl = this.ttsUrl.replace(/\/$/, '') + '/health';
      return fetch(healthUrl, { method: 'GET' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          this.provider = j && j.ok ? 'elevenlabs' : 'browser';
          updateVoiceStatusLabel();
        })
        .catch(() => {
          this.provider = 'browser';
          updateVoiceStatusLabel();
        });
    },
    pick() {
      if (!this.browserSupported) return null;
      const voices = speechSynthesis.getVoices() || [];
      const prefs = ['Samantha', 'Victoria', 'Karen', 'Moira', 'Ava', 'Allison', 'Susan',
        'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira'];
      for (const p of prefs) {
        const v = voices.find((v) => v.name && v.name.indexOf(p) === 0 && /^en/i.test(v.lang || 'en'));
        if (v) return (this.voice = v);
      }
      const en = voices.filter((v) => /^en/i.test(v.lang || ''));
      return (this.voice = en.find((v) => /female/i.test(v.name)) || en[0] || voices[0] || null);
    },
    clean(text) {
      return String(text)
        .replace(/<[^>]+>/g, ' ')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}◈·…→✝💛🙏▶]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },
    _cleanupAudio() {
      if (this._audio) {
        try { this._audio.pause(); this._audio.src = ''; } catch (e) {}
        this._audio = null;
      }
      if (this._objectUrl) {
        try { URL.revokeObjectURL(this._objectUrl); } catch (e) {}
        this._objectUrl = null;
      }
      if (this._abort) {
        try { this._abort.abort(); } catch (e) {}
        this._abort = null;
      }
    },
    speakBrowser(text, onStart, onEnd) {
      if (!this.browserSupported || !Memory.data.voiceOn) return;
      const cleaned = this.clean(text);
      if (!cleaned) return;
      this._cleanupAudio();
      if (this.browserSupported) { try { speechSynthesis.cancel(); } catch (e) {} }
      const u = new SpeechSynthesisUtterance(cleaned);
      if (!this.voice) this.pick();
      if (this.voice) u.voice = this.voice;
      u.rate = 1.02;
      u.pitch = 1.05;
      u.onstart = () => { this.speaking = true; if (onStart) onStart(); setSpeaking(true); };
      u.onend = u.onerror = () => { this.speaking = false; if (onEnd) onEnd(); setSpeaking(false); };
      speechSynthesis.speak(u);
    },
    speakElevenLabs(text, onStart, onEnd) {
      if (!Memory.data.voiceOn) return;
      const cleaned = this.clean(text);
      if (!cleaned) return;
      this.stop();
      this._abort = new AbortController();
      const self = this;
      fetch(this.ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleaned }),
        signal: this._abort.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('TTS ' + res.status);
          return res.blob();
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          self._objectUrl = objectUrl;
          const audio = new Audio(objectUrl);
          self._audio = audio;
          audio.onplay = () => { self.speaking = true; if (onStart) onStart(); setSpeaking(true); };
          const done = () => {
            self._cleanupAudio();
            self.speaking = false;
            if (onEnd) onEnd();
            setSpeaking(false);
          };
          audio.onended = done;
          audio.onerror = done;
          return audio.play();
        })
        .catch((err) => {
          if (err && err.name === 'AbortError') return;
          self._cleanupAudio();
          if (!self._fallbackLogged) {
            self._fallbackLogged = true;
            console.info('GRACE voice: ElevenLabs unavailable, using browser speech');
          }
          self.speakBrowser(text, onStart, onEnd);
        });
    },
    speak(text, onStart, onEnd) {
      if (!Memory.data.voiceOn) return;
      if (this.provider === 'elevenlabs') this.speakElevenLabs(text, onStart, onEnd);
      else if (this.browserSupported) this.speakBrowser(text, onStart, onEnd);
    },
    stop() {
      this._cleanupAudio();
      if (this.browserSupported) { try { speechSynthesis.cancel(); } catch (e) {} }
      this.speaking = false;
      setSpeaking(false);
    }
  };
  if (Voice.browserSupported && typeof speechSynthesis.onvoiceschanged !== 'undefined') {
    speechSynthesis.onvoiceschanged = () => Voice.pick();
  }

  function voiceStatusIdle() {
    if (!M) return 'Companion';
    if (Voice.provider === 'elevenlabs') return 'Companion \u00b7 ' + M.churchName + ' \u00b7 Neural voice';
    return 'Companion \u00b7 ' + M.churchName;
  }

  function updateVoiceStatusLabel() {
    const status = q('#gcp-status');
    if (status && !Voice.speaking) status.textContent = voiceStatusIdle();
  }

  const Listen = {
    Ctor: global.SpeechRecognition || global.webkitSpeechRecognition || null,
    active: null,
    start(onText, onState) {
      if (!this.Ctor) {
        // Graceful mock for unsupported browsers
        onState(true);
        setTimeout(() => {
          onState(false);
          if (A && A.toast) A.toast('Voice input isn\u2019t supported in this browser');
        }, 2200);
        return;
      }
      this.stop();
      const r = new this.Ctor();
      r.lang = 'en-US';
      r.interimResults = true;
      r.continuous = false;
      let finalText = '';
      r.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript;
          else interim += ev.results[i][0].transcript;
        }
        onText(finalText || interim, false);
      };
      r.onend = () => {
        this.active = null;
        onState(false);
        if (finalText.trim()) onText(finalText.trim(), true);
      };
      r.onerror = () => { this.active = null; onState(false); };
      this.active = r;
      onState(true);
      try { r.start(); } catch (e) { this.active = null; onState(false); }
    },
    stop() {
      if (this.active) { try { this.active.stop(); } catch (e) {} this.active = null; }
    }
  };

  /* ══ ETHICAL BRAIN — intent routing with leader handoff + crisis care ══ */
  const RX = {
    crisis: /suicid|kill myself|self.?harm|hurt myself|hurting myself|end my life|don.?t want to live|overdose|abus(e|ive|ed)/i,
    personal: /lonely|alone|anxious|anxiety|depress|grie[fv]|grieving|struggl|afraid|scared|marriage|divorce|addict|confess|ashamed|broken|hopeless|heavy heart|on my heart|hurting|crying|lost my/i,
    greeting: /^(hi|hey|hello|hiya|yo|good (morning|afternoon|evening))\b/i,
    thanks: /\bthank(s| you)\b/i,
    whoAreYou: /who are you|what is grace|what are you|tell me about yourself|about grace\b/i,
    capabilities: /what can you do|what do you do|how do you work|what can i ask/i,
    memorySelf: /what do you (know|remember) about me|my (routine|rhythm|habits)|do you remember/i,
    memoryClear: /forget (me|everything|what you know)|clear (my )?memory|reset (your )?memory/i,
    voiceOn: /\b(talk to me|speak|voice on|unmute)\b/i,
    voiceOff: /\b(stop talking|be quiet|mute|voice off|silence)\b/i,
    balance: /balance|wallet|how much (have i|did i) (giv|spen)|card impact|spending/i,
    impact: /impact|reward|routed|allocat|where.*money go/i,
    serve: /\bserve\b|serving|volunteer|food pantry|greeting team|youth mentor/i,
    journal: /journal|reflect(ion)?\b|diary/i,
    goals: /\bgoal|streak|progress\b/i,
    rsvp: /rsvp|sign me up|count me in|i('| a)ll be there|reserve/i,
    checkin: /check ?in/i,
    leaders: /leader|pastor|deacon|elder|avatar|minister/i,
    schedule: /tonight|today|this week|schedule|what.?s (on|happening)|when is|what time/i
  };

  function S() { return (A && A.getState) ? (A.getState() || {}) : {}; }
  function name() { return (A && A.memberName) || 'friend'; }
  function know() { return M.knowledge || {}; }

  function timeOfDay() {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  }

  function todayRhythmLine() {
    const wk = know().weekly || {};
    const today = wk[new Date().getDay()];
    return today ? ('Today at ' + M.churchName + ': ' + today + '.') : null;
  }

  function intentLabel(key) {
    return ({
      give: 'giving', watch: 'watching services', groups: 'your groups',
      events: 'events', care: 'prayer & care', study: 'Bible study',
      impact: 'your impact', serve: 'serving', journal: 'journaling', goals: 'your goals'
    })[key] || key;
  }

  /** Core router. Returns {text, nav, navLabel, intent, handoff, care} */
  function think(text) {
    const t = (text || '').trim();
    const lower = t.toLowerCase();
    const st = S();
    const k = know();

    if (RX.crisis.test(lower)) {
      return {
        intent: 'care', care: true, nav: 'outreach', navLabel: 'Open Care now',
        text: 'I hear you, ' + name() + ', and I\u2019m taking this seriously. I\u2019m routing you to live pastoral care right now \u2014 a real person at ' + M.churchName + ' will be with you. If you are in immediate danger, please call or text 988. You are not alone.'
      };
    }
    if (RX.personal.test(lower)) {
      return {
        intent: 'care', handoff: true, nav: 'ai', navLabel: 'Open your leader\u2019s avatar',
        text: 'Thank you for trusting me with that, ' + name() + '. What\u2019s on your heart deserves more than a navigator \u2014 it belongs with your verified leader, in a private, siloed conversation that I never see. Shall I take you to them? I can also route a prayer or care request right away.'
      };
    }
    if (RX.memoryClear.test(lower)) {
      Memory.clear();
      return {
        intent: 'memory',
        text: 'Done \u2014 I\u2019ve cleared everything I\u2019d learned about your routine on this device. We start fresh, and you\u2019re always in control of what I remember.'
      };
    }
    if (RX.memorySelf.test(lower)) {
      const d = Memory.data;
      const tops = Memory.topIntents(3);
      const fav = Memory.favouriteHourLabel();
      let line = 'Here\u2019s what I\u2019ve learned so far \u2014 all kept on this device: we\u2019ve talked ' + d.visits + (d.visits === 1 ? ' time' : ' times');
      if (fav) line += ', usually in the ' + fav;
      line += '.';
      if (tops.length) line += ' You ask most about ' + tops.map(intentLabel).join(', ') + '.';
      line += ' Say \u201cclear memory\u201d anytime and I\u2019ll forget it all.';
      return { intent: 'memory', text: line };
    }
    if (RX.voiceOff.test(lower)) {
      Memory.data.voiceOn = false; Memory.save(); syncVoiceBtn(); Voice.stop();
      return { intent: 'voice', text: 'Going quiet \u2014 I\u2019ll keep replying in text. Tap the speaker icon whenever you\u2019d like my voice back.' };
    }
    if (RX.voiceOn.test(lower)) {
      Memory.data.voiceOn = true; Memory.save(); syncVoiceBtn();
      return { intent: 'voice', text: 'Happy to \u2014 voice is back on. It\u2019s good to talk with you, ' + name() + '.' };
    }
    if (RX.whoAreYou.test(lower)) {
      return {
        intent: 'about',
        text: 'I\u2019m GRACE \u2014 ' + M.system.acronymExpansion + ' \u2014 the companion for ' + M.churchName + '. I can take you anywhere in the app, act on your behalf, and I learn your rhythm so I can serve you better each week. One boundary I hold: deep personal conversation belongs with your verified leaders, not me \u2014 their avatars are siloed and confidential.'
      };
    }
    if (RX.capabilities.test(lower)) {
      return {
        intent: 'about', nav: 'give', navLabel: 'Try one \u2014 open Give',
        text: 'Quite a lot! I can open giving and your GRACE Card, take you to the live service, find groups and events, RSVP you, route prayer and care requests, open Bible study, journaling and goals, show your impact, and connect you with your leaders. Just ask in your own words \u2014 I\u2019m listening and learning.'
      };
    }
    if (RX.greeting.test(lower)) {
      const rhythm = todayRhythmLine();
      return {
        intent: 'greeting',
        text: 'Good ' + timeOfDay() + ', ' + name() + '! ' + (rhythm ? rhythm + ' ' : '') + 'What can I do for you \u2014 give, watch, groups, events, or something else?'
      };
    }
    if (RX.thanks.test(lower)) {
      return { intent: 'greeting', text: 'Always, ' + name() + '. Serving you is what I\u2019m here for \u2014 anything else on your mind?' };
    }
    if (RX.balance.test(lower)) {
      const given = st.givenMtd != null ? '$' + st.givenMtd : '$230';
      const impact = st.cardImpact != null ? '$' + st.cardImpact : '$18.42';
      return {
        intent: 'give', nav: 'wallet', navLabel: 'Open My GRACE Card',
        text: 'Here\u2019s your snapshot: direct gifts this month ' + given + ', and your card has routed ' + impact + ' of everyday impact. Your giving goal is at ' + (st.goalPct ?? 52) + '%. Want me to open your card?'
      };
    }
    if (RX.impact.test(lower)) {
      const impact = st.cardImpact != null ? '$' + st.cardImpact : '$18.42';
      const lives = st.lives != null ? st.lives : 23;
      return {
        intent: 'impact', nav: 'impact', navLabel: 'Review impact',
        text: 'Your everyday purchases routed ' + impact + ' this month \u2014 part of ' + lives + ' lives impacted through ' + M.churchName + '. You choose where it routes; right now it\u2019s supporting ' + (st.route || 'Food Pantry') + '. Want to review or redirect it?'
      };
    }
    if (RX.serve.test(lower)) {
      const ops = (k.serving || []).join(', ');
      return {
        intent: 'serve', nav: 'groups', navLabel: 'Find a serve team',
        text: 'I love that heart. Current opportunities at ' + M.churchName + ': ' + (ops || 'Food Pantry Saturdays, Greeting Team Sundays, Youth Mentors Wednesdays') + '. I can connect you with a team lead or open Groups so you can browse.'
      };
    }
    if (RX.journal.test(lower)) {
      const days = st.reflectionDays != null ? st.reflectionDays : 7;
      return {
        intent: 'journal', nav: 'journal', navLabel: 'Open Journal',
        text: 'You\u2019re on a ' + days + '-day reflection streak \u2014 beautiful consistency. Shall we keep it going? I\u2019ll open your journal.'
      };
    }
    if (RX.goals.test(lower)) {
      return {
        intent: 'goals', nav: 'goals', navLabel: 'Open Goals',
        text: 'Your giving goal is at ' + (st.goalPct ?? 52) + '% of $' + Number(st.goalTarget ?? 2400).toLocaleString() + ', and your reflection streak is ' + (st.reflectionDays ?? 7) + ' days. Small steps, faithfully \u2014 want to see all your goals?'
      };
    }
    if (RX.rsvp.test(lower) || RX.checkin.test(lower)) {
      const ev = (k.events && k.events[0]) || 'the next gathering';
      if (A.toast) A.toast('RSVP confirmed \u2014 ' + ev);
      Memory.data.notes.push({ t: Date.now(), note: 'RSVP: ' + ev });
      Memory.save();
      return {
        intent: 'events', nav: 'events', navLabel: 'See all events',
        text: 'Done \u2014 you\u2019re confirmed for ' + ev + '. I\u2019ve noted it so I can remind you. Want to see what else is coming up?'
      };
    }
    if (RX.leaders.test(lower)) {
      return {
        intent: 'care', handoff: true, nav: 'ai', navLabel: 'Open My Leadership',
        text: 'Your verified leadership team is ready \u2014 each leader has an independent avatar, siloed and confidential, with human follow-up available. Shall I take you to them?'
      };
    }
    if (RX.schedule.test(lower)) {
      const rhythm = todayRhythmLine();
      const events = (k.events || []).slice(0, 3).join(' \u00b7 ');
      return {
        intent: 'events', nav: 'events', navLabel: 'Open Events',
        text: (rhythm ? rhythm + ' ' : '') + 'Coming up: ' + (events || 'Sunday Service June 1, Women of Grace June 2, Prayer Night June 4') + '. Want me to RSVP you to any of them?'
      };
    }

    // Fall through to the shared consensus brain (give / watch / groups / events / care / study / faith)
    const base = global.GRACE_MESSAGING.buildAiResponseText(null, t, 'system', M);
    const navIntent = base.nav === 'outreach' ? 'care' : base.nav;
    return { intent: navIntent || 'general', text: base.text, nav: base.nav, navLabel: base.navLabel && base.navLabel.replace(/^[^\w]+\s*/, '') };
  }

  /* ══ GREETING — learned routine + church rhythm ══ */
  function buildGreeting() {
    const d = Memory.data;
    const rhythm = todayRhythmLine();
    let text;
    if (d.visits <= 1) {
      text = 'Hi ' + name() + ' \u2014 I\u2019m GRACE, your companion here at ' + M.churchName + '. I can take you anywhere in the app, act for you, and I\u2019ll quietly learn your rhythm as we go (only on this device, and you can clear it anytime). ' + (rhythm ? rhythm + ' ' : '') + 'What would you like to do first?';
    } else {
      const fav = Memory.favouriteHourLabel();
      const tops = Memory.topIntents(1);
      text = 'Good ' + timeOfDay() + ', ' + name() + ' \u2014 welcome back.';
      if (rhythm) text += ' ' + rhythm;
      if (tops.length) text += ' Lately you\u2019ve been asking most about ' + intentLabel(tops[0]) + ' \u2014 want to pick up there?';
      else if (fav) text += ' I\u2019ve noticed we usually talk in the ' + fav + ' \u2014 I\u2019m learning your rhythm.';
      else text += ' How can I help today?';
    }
    return text;
  }

  /* ══ PANEL UI ══ */
  const BASE_CHIPS = [
    { key: 'give', label: 'Give' },
    { key: 'watch', label: 'Watch live' },
    { key: 'groups', label: 'Groups' },
    { key: 'events', label: 'Events' },
    { key: 'care', label: 'Prayer & care' },
    { key: 'study', label: 'Bible study' }
  ];
  const CHIP_PROMPTS = {
    give: 'I\u2019d like to give', watch: 'Take me to the live service',
    groups: 'Show me my groups', events: 'What events are coming up?',
    care: 'I\u2019d like to request prayer', study: 'Open Bible study',
    impact: 'Show my impact', serve: 'How can I serve?',
    journal: 'Open my journal', goals: 'Show my goals'
  };

  function svgSpeaker(on) {
    return on
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  }
  function svgMic() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  }

  function buildPanel() {
    const orbHtml = global.GRACE_MESSAGING.renderGraceOrb('sm');
    root = document.createElement('div');
    root.className = 'gcp-root gcp-root--' + (A.mode === 'sheet' ? 'sheet' : 'float');
    root.style.zIndex = A.zIndex || 8800;
    root.innerHTML =
      '<div class="gcp-panel" role="dialog" aria-label="GRACE companion" aria-modal="false">' +
        '<div class="gcp-head">' +
          '<div class="gcp-head-orb" id="gcp-head-orb">' + orbHtml + '</div>' +
          '<div class="gcp-head-text">' +
            '<div class="gcp-title">GRACE <span class="gcp-tag">' + M.system.acronymExpansion + '</span></div>' +
            '<div class="gcp-sub" id="gcp-status">Companion \u00b7 ' + M.churchName + '</div>' +
          '</div>' +
          '<button type="button" class="gcp-icon-btn" id="gcp-voice-btn" aria-label="Toggle GRACE voice" title="Toggle voice"></button>' +
          '<button type="button" class="gcp-icon-btn gcp-close" id="gcp-close-btn" aria-label="Close GRACE">\u00d7</button>' +
        '</div>' +
        '<div class="gcp-thread" id="gcp-thread" aria-live="polite"></div>' +
        '<div class="gcp-chips" id="gcp-chips"></div>' +
        '<div class="gcp-inputrow">' +
          '<button type="button" class="gcp-icon-btn gcp-mic" id="gcp-mic" aria-label="Speak to GRACE">' + svgMic() + '</button>' +
          '<input type="text" class="gcp-input" id="gcp-input" placeholder="' + (M.system.homePlaceholder || 'Ask GRACE\u2026') + '" aria-label="Message GRACE">' +
          '<button type="button" class="gcp-send" id="gcp-send" aria-label="Send">\u2192</button>' +
        '</div>' +
        '<div class="gcp-foot">' +
          '<span class="gcp-foot-note">' + M.system.safetyNote + ' \u00b7 GRACE learns your routine on this device only.</span>' +
          '<button type="button" class="gcp-clear" id="gcp-clear">Clear memory</button>' +
        '</div>' +
      '</div>';
    A.container.appendChild(root);

    // Sheet backdrop closes
    if (A.mode === 'sheet') {
      root.addEventListener('click', (e) => { if (e.target === root) api.close(); });
    }
    q('#gcp-close-btn').addEventListener('click', () => api.close());
    q('#gcp-send').addEventListener('click', sendFromInput);
    q('#gcp-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendFromInput(); }
    });
    q('#gcp-voice-btn').addEventListener('click', () => {
      Memory.data.voiceOn = !Memory.data.voiceOn;
      Memory.save();
      syncVoiceBtn();
      if (!Memory.data.voiceOn) Voice.stop();
      else Voice.speak('Voice on. It\u2019s good to talk with you, ' + name() + '.');
    });
    q('#gcp-mic').addEventListener('click', micToggle);
    q('#gcp-clear').addEventListener('click', () => {
      Memory.clear();
      if (A.toast) A.toast('GRACE memory cleared on this device');
      appendGrace('All cleared \u2014 I\u2019ve forgotten what I\u2019d learned about your routine here. We start fresh.', null, null, true);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) api.close();
    });
    syncVoiceBtn();
    renderChips();
  }

  function q(sel) { return root ? root.querySelector(sel) : null; }

  function syncVoiceBtn() {
    const b = q('#gcp-voice-btn');
    if (!b) return;
    const on = !!Memory.data.voiceOn;
    b.innerHTML = svgSpeaker(on);
    b.classList.toggle('gcp-voice-on', on);
    b.title = on ? 'GRACE voice on \u2014 tap to mute' : 'GRACE voice off \u2014 tap to enable';
  }

  function setSpeaking(on) {
    if (!root) return;
    const orb = q('#gcp-head-orb .grace-orb');
    if (orb) orb.classList.toggle('is-speaking', on);
    document.querySelectorAll('.gcp-orb-bound .grace-orb, .gcp-orb-bound.grace-orb').forEach((o) => o.classList.toggle('is-speaking', on));
    const status = q('#gcp-status');
    if (status) status.textContent = on ? 'Speaking\u2026' : voiceStatusIdle();
  }

  function renderChips() {
    const el = q('#gcp-chips');
    if (!el) return;
    const tops = Memory.topIntents(6);
    const ordered = BASE_CHIPS.slice().sort((a, b) => {
      const ai = tops.indexOf(a.key), bi = tops.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    el.innerHTML = ordered.map((c) =>
      '<button type="button" class="gcp-chip" data-key="' + c.key + '">' + c.label + '</button>'
    ).join('');
    el.querySelectorAll('.gcp-chip').forEach((btn) => {
      btn.addEventListener('click', () => api.ask(CHIP_PROMPTS[btn.dataset.key] || btn.textContent));
    });
  }

  function appendUser(text) {
    const th = q('#gcp-thread');
    if (!th) return;
    const div = document.createElement('div');
    div.className = 'gcp-msg gcp-msg--user';
    div.innerHTML = '<div class="gcp-bubble"></div>';
    div.querySelector('.gcp-bubble').textContent = text;
    th.appendChild(div);
    th.scrollTop = th.scrollHeight;
  }

  function appendGrace(text, nav, navLabel, instant) {
    const th = q('#gcp-thread');
    if (!th) return;
    const div = document.createElement('div');
    div.className = 'gcp-msg gcp-msg--grace';
    let action = '';
    if (nav && navLabel) {
      action = '<button type="button" class="gcp-action">' + navLabel + ' \u2192</button>';
    }
    div.innerHTML = '<span class="gcp-msg-orb" aria-hidden="true"></span><div class="gcp-bubble">' + escapeHtml(text) + action + '</div>';
    th.appendChild(div);
    if (action) {
      div.querySelector('.gcp-action').addEventListener('click', () => {
        doNavigate(nav);
      });
    }
    th.scrollTop = th.scrollHeight;
    if (!instant) Voice.speak(text);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function showTyping() {
    const th = q('#gcp-thread');
    if (!th) return;
    const div = document.createElement('div');
    div.className = 'gcp-msg gcp-msg--grace';
    div.id = 'gcp-typing';
    div.innerHTML = '<span class="gcp-msg-orb" aria-hidden="true"></span><div class="gcp-bubble gcp-typing"><span></span><span></span><span></span></div>';
    th.appendChild(div);
    th.scrollTop = th.scrollHeight;
  }
  function removeTyping() {
    const t = q('#gcp-typing');
    if (t) t.remove();
  }

  function doNavigate(nav) {
    if (!nav) return;
    let handled = false;
    if (nav === 'ai' && A.openLeader) { A.openLeader(); handled = true; }
    else if (A.navigate) handled = !!A.navigate(nav);
    if (handled && A.mode === 'sheet') api.close();
    if (!handled && A.toast) A.toast('That lives in the full GRACE experience \u2014 coming to this preview soon');
  }

  function sendFromInput() {
    const inp = q('#gcp-input');
    if (!inp || !inp.value.trim()) return;
    const text = inp.value.trim();
    inp.value = '';
    api.ask(text);
  }

  let micActive = false;
  function micToggle() {
    const btn = q('#gcp-mic');
    if (micActive) { Listen.stop(); return; }
    Voice.stop();
    Listen.start(
      (text, isFinal) => {
        const inp = q('#gcp-input');
        if (inp) inp.value = text;
        if (isFinal && text) { if (inp) inp.value = ''; api.ask(text); }
      },
      (listening) => {
        micActive = listening;
        if (btn) btn.classList.toggle('listening', listening);
        const status = q('#gcp-status');
        if (status) status.textContent = listening ? 'Listening\u2026' : voiceStatusIdle();
      }
    );
  }

  /* ══ ORB BINDING ══ */
  function bindOrbs() {
    (A.orbs || []).forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.dataset.gcpBound) return;
        el.dataset.gcpBound = '1';
        el.classList.add('gcp-orb-bound');
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', 'Talk with GRACE');
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => api.toggle());
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api.toggle(); }
        });
      });
    });
  }

  /* ══ PUBLIC API ══ */
  const api = {
    mount(adapter) {
      A = adapter;
      M = adapter.messaging;
      Memory.load();
      Memory.visit();
      Voice.init(adapter);
      buildPanel();
      bindOrbs();
      Voice.detectProvider();
      return api;
    },
    open(prefill) {
      if (!root) return;
      root.classList.add('open');
      isOpen = true;
      if (!greeted) {
        greeted = true;
        const greeting = buildGreeting();
        showTyping();
        setTimeout(() => {
          removeTyping();
          appendGrace(greeting);
        }, 500);
      }
      setTimeout(() => q('#gcp-input')?.focus(), 250);
      if (prefill) setTimeout(() => api.ask(prefill), greeted ? 900 : 1300);
    },
    close() {
      if (!root) return;
      root.classList.remove('open');
      isOpen = false;
      Voice.stop();
      Listen.stop();
    },
    toggle() { isOpen ? api.close() : api.open(); },
    isOpen() { return isOpen; },
    /** Send a message to GRACE (appends user bubble, thinks, replies). */
    ask(text) {
      if (!root || thinking || !text) return;
      if (!isOpen) api.open();
      appendUser(text);
      thinking = true;
      showTyping();
      setTimeout(() => {
        removeTyping();
        thinking = false;
        const resp = think(text);
        Memory.record(resp.intent);
        renderChips();
        appendGrace(resp.text, resp.nav, resp.navLabel);
        if (resp.care && !resp.handoff) {
          // Crisis: also notify live care, mirroring existing dispatch behavior
          if (A.onCrisis) A.onCrisis();
        }
      }, 650 + Math.random() * 350);
    }
  };

  global.GRACE_COMPANION = api;
})(typeof window !== 'undefined' ? window : globalThis);
