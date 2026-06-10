/**
 * GRACE messaging consensus — single source of truth.
 * GRACE = Growth · Resource · Assistance · Community · Engagement (navigation layer).
 * Leader avatars = independent, siloed agents where members confide.
 */
(function (global) {
  const DEFAULT_CHURCH = 'Central Henderson';
  const GRACE_ACRONYM = 'Growth · Resource · Assistance · Community · Engagement';

  function leaderFirstName(name) {
    if (!name) return 'Leader';
    const stripped = name.replace(/^(Pastor|Rev\.|Dr\.|Min\.|Sis\.|Bro\.|Deacon|Elder)\s+/i, '');
    return stripped.split(' ')[0] || name;
  }

  function getMessaging(churchName) {
    const church = churchName || DEFAULT_CHURCH;
    return {
      churchName: church,
      system: {
        name: 'GRACE',
        acronymExpansion: GRACE_ACRONYM,
        tagline: 'Your guide to growth, resources, and community at ' + church,
        homeStatus: 'Let\'s find your next step, Maya…',
        homeGreeting:
          'Start here when you want to give, watch a service, join a group, or see what\'s coming up. When you\'d like someone to walk with you, your verified leader avatar is just a tap away.',
        homePlaceholder: 'Ask GRACE — give, watch, groups, events…',
        disclaimer:
          'GRACE helps you navigate church life — for deeper conversation, connect with a leader avatar.',
        safetyNote: 'GRACE does not replace pastors, counselors, or emergency support.',
        topbarSub: 'Growth, resources, and community engagement at ' + church + '.',
        defaultResponse:
          'I can help you give, watch, find a group, browse events, or connect you with a leader avatar. What would you like to explore?',
        tellMeAboutResponse:
          'GRACE can share how this leader serves at ' +
          church +
          ' and open their avatar — or guide you to groups and resources.',
      },
      leaderAvatar: {
        badge: 'Verified Avatar',
        roleSuffix: '· Verified Avatar · Human follow-up available',
        chatPlaceholder: function (name) {
          return 'Share with ' + leaderFirstName(name) + '…';
        },
        disclaimer:
          'This is an isolated avatar grounded in this leader\'s approved teachings. Your conversation is siloed to their profile and kept confidential if saved at all — not shared with GRACE.',
        profileDisclaimer:
          'Avatar reflects approved teachings — not a live person. Human follow-up available.',
        homeStripLabel: 'Your leader',
        homeStripSub: 'Verified avatar · not GRACE',
        homeStripCta: 'Open avatar →',
        reachableLive: 'Reachable now · real person available',
        reachableAway: 'Avatar available · human follow-up by schedule',
        defaultResponse:
          'I hear you. I\'m here with you — we can pray, talk through what\'s on your heart, or I can request human follow-up when you need it.',
        dmBanner: function (name) {
          return (
            'Direct message to ' +
            name +
            ' — goes to their inbox, not the avatar chat or GRACE.'
          );
        },
      },
      faq: {
        title: 'About GRACE & Leader Avatars',
        subtitle: 'GRACE guides your journey · Leader avatars are where you confide',
        items: [
          {
            icon: 'brain',
            q: 'What is GRACE?',
            a:
              'GRACE stands for Growth, Resource, Assistance, Community, and Engagement — your guide through ' +
              church +
              '. Start here for giving, watching, groups, events, and care routing. When something personal is on your heart, connect with a verified leader avatar instead.',
          },
          {
            icon: 'people',
            q: 'What is a leader avatar?',
            a:
              'Each verified leader has an independent avatar — their pastoral essence captured in an isolated, grounded profile through our avatar program. It reflects their approved sermons and teachings, not a generic chatbot.',
          },
          {
            icon: 'chat',
            q: 'Where should I share something personal?',
            a:
              'With a verified leader avatar on My Leadership — not GRACE. GRACE helps you find your way; leader avatars are where pastoral conversation belongs.',
          },
          {
            icon: 'shield',
            q: 'Are conversations private?',
            a:
              'Avatar conversations are siloed per leader and kept confidential if saved at all — not shared with GRACE or other leaders. Crisis keywords (self-harm, abuse, suicidal thoughts) still route to live pastoral care immediately.',
          },
          {
            icon: 'people',
            q: 'Is this the real leader?',
            a:
              'The avatar reflects each leader\'s pastoral style and approved content, but it is not a live person. You can always request human follow-up or send a direct message.',
          },
          {
            icon: 'shield',
            q: 'How do I switch leaders?',
            a:
              'Open the Leaders directory and tap Switch. Your chat resets with a greeting from the new leader\'s avatar — each maintains its own isolated context.',
          },
        ],
      },
    };
  }

  function systemNameHtml(msg) {
    const m = msg || getMessaging();
    return (
      m.system.name +
      ' <span class="ai-mode-tag ai grace-acronym-tag">' +
      m.system.acronymExpansion +
      '</span>'
    );
  }

  function leaderNameHtml(name, msg) {
    const m = msg || getMessaging();
    return name + ' <span class="ai-mode-tag ai">' + m.leaderAvatar.badge + '</span>';
  }

  function leaderFollowUpLine(leader, msg) {
    const m = msg || getMessaging();
    if (leader && leader.role) {
      return leader.role.replace(/ · Grace AI with human follow-up/g, ' · Verified Avatar · Human follow-up available')
        .replace(/ · AI Companion/g, ' · Verified Avatar · Human follow-up available');
    }
    return m.churchName + ' ' + m.leaderAvatar.roleSuffix;
  }

  function avatarBio(name, churchName) {
    return (
      'An isolated avatar grounded in ' +
      name +
      '\'s approved sermons and teachings — a siloed duplicate of their pastoral essence, not GRACE. Human follow-up available when care is needed at ' +
      (churchName || DEFAULT_CHURCH) +
      '.'
    );
  }

  function normalizeLeadersArray(leaders, churchName) {
    const church = churchName || DEFAULT_CHURCH;
    if (!Array.isArray(leaders)) return leaders;
    leaders.forEach(function (l) {
      if (!l) return;
      l.role = (l.role || '')
        .replace(/ · Grace AI with human follow-up/g, ' · Verified Avatar · Human follow-up available')
        .replace(/ · AI Companion/g, ' · Verified Avatar · Human follow-up available');
      if (!l.role && l.title) {
        l.role = l.title + ' · ' + church + ' · Verified Avatar · Human follow-up available';
      }
      l.hours = (l.hours || '')
        .replace(/Grace AI/g, 'Avatar')
        .replace(/24\/7 AI/g, '24/7 Avatar')
        .replace(/AI 24\/7/g, 'Avatar 24/7')
        .replace(/^AI /, 'Avatar ');
      if (l.greeting && /Grace is here|Grace AI companion|your Grace AI/i.test(l.greeting)) {
        l.greeting =
          '"Good morning Maya — I\'m ' +
          leaderFirstName(l.name) +
          '. What\'s on your heart today? This is a safe space to share."';
      }
      l.bio = avatarBio(l.name, church);
      if (l.name === 'Deacon Robert Hayes') {
        l.img = 'https://randomuser.me/api/portraits/men/68.jpg';
      }
    });
    return leaders;
  }

  function buildAiResponseText(navHint, text, context, msg) {
    const m = msg || getMessaging();
    const isSystem = context === 'system';
    const lower = (text || '').toLowerCase();
    const goalPct =
      typeof WALLET_STATE !== 'undefined'
        ? WALLET_STATE.givingGoalPct
        : global.GRACE_METRICS?.givingGoal?.pct ?? 52;
    const goalTarget =
      typeof WALLET_STATE !== 'undefined'
        ? WALLET_STATE.givingGoalTarget
        : global.GRACE_METRICS?.givingGoal?.target ?? 2400;
    const groupCount = typeof NET_STATE !== 'undefined' ? NET_STATE.groups : 2;

    if (navHint === 'give' || lower.includes('give') || lower.includes('tithe') || lower.includes('offer')) {
      return isSystem
        ? {
            text:
              'GRACE can take you to Give right now — tithe, one-time offering, or recurring gifts. Your 2026 goal is at ' +
              goalPct +
              '% ($' +
              Number(goalTarget).toLocaleString() +
              ' target).',
            nav: 'give',
            navLabel: '💛 Give Now',
          }
        : {
            text:
              'Giving is a beautiful act of worship. I can open the giving section for you — your 2026 goal is at ' +
              goalPct +
              '%. Would you like to set up a tithe or one-time gift?',
            nav: 'give',
            navLabel: '💛 Give Now',
          };
    }
    if (navHint === 'care' || lower.includes('prayer') || lower.includes('care') || lower.includes('crisis') || lower.includes('help')) {
      return isSystem
        ? {
            text:
              'GRACE is routing your request to Care Dispatch — prayer, visits, or urgent help. A verified leader can follow up right away.',
            nav: 'outreach',
            navLabel: '🙏 Open Care',
          }
        : {
            text:
              "You've been heard. I'm connecting you to our Care Dispatch — submit a prayer request, request a visit, or if this is urgent, I can alert a leader right now.",
            nav: 'outreach',
            navLabel: '🙏 Open Care',
          };
    }
    if (navHint === 'watch' || lower.includes('watch') || lower.includes('sermon') || lower.includes('service') || lower.includes('live')) {
      const viewers = typeof watchViewerCount !== 'undefined' ? watchViewerCount : 342;
      return isSystem
        ? {
            text:
              'The 9:45 AM Sunday service is live with ' +
              viewers +
              ' watching. GRACE can take you there or find a previous message.',
            nav: 'watch',
            navLabel: '▶ Watch Live',
          }
        : {
            text:
              'The 9:45 AM Sunday service is live right now with ' +
              viewers +
              ' people watching! I can take you there, or find a previous message for you.',
            nav: 'watch',
            navLabel: '▶ Watch Live',
          };
    }
    if (navHint === 'groups' || lower.includes('group') || lower.includes('community') || lower.includes('connect')) {
      return isSystem
        ? {
            text:
              "You're in " +
              groupCount +
              ' groups. GRACE can find a new group, show your schedule, or connect you with a group leader.',
            nav: 'groups',
            navLabel: '◈ Groups & Events',
          }
        : {
            text:
              "You're in " +
              groupCount +
              ' groups on Connect. I can find you a new group, show your schedule, or connect you with a group leader directly.',
            nav: 'groups',
            navLabel: '◈ Groups & Events',
          };
    }
    if (navHint === 'events' || lower.includes('event') || lower.includes('sunday') || lower.includes('rsvp') || lower.includes('coming')) {
      return isSystem
        ? {
            text: 'Coming up: Sunday Service June 1, Women of Grace June 2, Prayer Night June 4. GRACE can RSVP you to any of them.',
            nav: 'events',
            navLabel: '📅 Groups & Events',
          }
        : {
            text: 'Coming up: Sunday Service June 1, Women of Grace June 2, Prayer Night June 4. Want me to RSVP you to any of them?',
            nav: 'events',
            navLabel: '📅 Groups & Events',
          };
    }
    if (lower.includes('jesus') || lower.includes('follow') || lower.includes('saved') || lower.includes('bapti')) {
      return isSystem
        ? {
            text:
              'That is the most important decision — GRACE will connect you with Pastor James and the team to celebrate and support you. 🙏',
            nav: 'outreach',
            navLabel: '✝️ Connect with a Leader',
          }
        : {
            text:
              "That is the most important decision of your life — and I'm honoured you're sharing it with me. Let me connect you with Pastor James and our team so we can celebrate and support you on this journey. 🙏",
            nav: 'outreach',
            navLabel: '✝️ Connect with a Leader',
          };
    }
    if (lower.includes('bible') || lower.includes('study') || lower.includes('scripture') || lower.includes('colossians')) {
      const ref =
        typeof LEADER_STATE !== 'undefined' && LEADER_STATE.scripture
          ? LEADER_STATE.scripture.ref.split(' · ')[0]
          : 'Colossians 2:7';
      if (typeof JOURNEY_STATE !== 'undefined') {
        JOURNEY_STATE.study.pendingTopic = lower.includes('colossians') ? 'grace' : 'honor';
      }
      return isSystem
        ? {
            text:
              'GRACE can open a guided Bible study path — Receive → Learn → Reflect → Apply → Connect — starting with ' +
              ref +
              '.',
            nav: 'study',
            navLabel: 'Open Bible Study path',
          }
        : {
            text:
              "Let's open the Word together in a guided study path. We'll walk through Receive → Learn → Reflect → Apply → Connect — starting with " +
              ref +
              '.',
            nav: 'study',
            navLabel: 'Open Bible Study path',
          };
    }
    if (lower.includes('tell me about')) {
      return isSystem
        ? { text: m.system.tellMeAboutResponse, nav: null }
        : {
            text:
              'Happy to go deeper on that. I can share how I serve at ' +
              m.churchName +
              ' and suggest a next step — prayer, a group, or human follow-up if you\'d like.',
            nav: null,
          };
    }
    return isSystem
      ? { text: m.system.defaultResponse, nav: null }
      : { text: m.leaderAvatar.defaultResponse, nav: null };
  }

  function renderFaqHtml(faq, containerId, toggleFn) {
    const el = document.getElementById(containerId);
    if (!el || el.dataset.rendered) return;
    el.dataset.rendered = '1';
    const fn = toggleFn || 'toggleGraceFaq';
    el.innerHTML = faq.items
      .map(function (f, i) {
        const open = i === 0;
        const icon =
          typeof graceIconTile === 'function'
            ? graceIconTile(f.icon, open)
            : '';
        const chev =
          typeof graceIcon === 'function'
            ? graceIcon(open ? 'chevronUp' : 'chevronDown', {
                size: 14,
                variant: open ? 'inverse' : 'default',
              })
            : '';
        return (
          '<div class="faq-card' +
          (open ? ' open' : '') +
          '" id="grace-faq-card-' +
          i +
          '">' +
          '<div class="faq-card-head" onclick="' +
          fn +
          '(' +
          i +
          ')">' +
          '<span id="grace-faq-tile-' +
          i +
          '">' +
          icon +
          '</span>' +
          '<div class="faq-card-q">' +
          f.q +
          '</div>' +
          '<span class="faq-toggle" id="grace-faq-toggle-' +
          i +
          '">' +
          chev +
          '</span>' +
          '</div>' +
          '<div class="faq-answer" id="grace-faq-body-' +
          i +
          '"' +
          (open ? '' : ' style="display:none"') +
          '>' +
          f.a +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderGraceOrb(size) {
    const s = size === 'sm' || size === 'md' || size === 'lg' ? size : 'lg';
    return (
      '<div class="grace-orb grace-orb--' +
      s +
      '" role="img" aria-label="GRACE">' +
      '<div class="grace-orb__halo grace-orb__halo--outer"></div>' +
      '<div class="grace-orb__halo"></div>' +
      '<div class="grace-orb__core">' +
      '<div class="grace-orb__mist"></div>' +
      '<div class="grace-orb__wave" aria-hidden="true">' +
      '<span></span><span></span><span></span><span></span><span></span><span></span><span></span>' +
      '</div></div></div>'
    );
  }

  function initGraceMessagingDom(msg) {
    const m = msg || getMessaging();
    const setPh = function (id, text) {
      const el = document.getElementById(id);
      if (el) el.placeholder = text;
    };
    const setText = function (id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const setHtml = function (id, html) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };
    setPh('home-chat-input', m.system.homePlaceholder);
    setPh('chat-input', m.leaderAvatar.chatPlaceholder('Leader'));
    setPh('mob-grace-input', m.system.homePlaceholder);
    setPh('card-grace-input', m.system.homePlaceholder);
    const chatInput = document.getElementById('chat-input');
    if (chatInput && typeof aiLeaders !== 'undefined' && aiLeaders[currentLeader]) {
      chatInput.placeholder = m.leaderAvatar.chatPlaceholder(aiLeaders[currentLeader].name);
    }
    setHtml('home-ai-name', systemNameHtml(m));
    setText('home-ai-role', m.system.tagline);
    setText('home-ai-status', m.system.homeStatus);
    setText('home-ai-greeting', m.system.homeGreeting);
    setText('home-ai-disclaimer', m.system.disclaimer);
    setText('tb-subtitle', m.system.topbarSub);
    setText('home-leader-strip-sub', m.leaderAvatar.homeStripSub);
    setText('home-leader-strip-label', m.leaderAvatar.homeStripLabel);
    setText('home-leader-strip-cta', m.leaderAvatar.homeStripCta);
    const mobGraceTitle = document.getElementById('mob-grace-title');
    if (mobGraceTitle) mobGraceTitle.innerHTML = systemNameHtml(m);
    const mobGraceSub = document.getElementById('mob-grace-sub');
    if (mobGraceSub) mobGraceSub.textContent = m.system.disclaimer;
    const mobGraceSection = document.getElementById('mob-grace-section-label');
    if (mobGraceSection) mobGraceSection.textContent = m.system.name;
    const cardGraceSection = document.getElementById('card-grace-section-label');
    if (cardGraceSection) cardGraceSection.textContent = m.system.name;
    const mobLeaderStripSub = document.getElementById('mob-leader-strip-sub');
    if (mobLeaderStripSub) mobLeaderStripSub.textContent = m.leaderAvatar.homeStripSub;
    const cardLeaderStripSub = document.getElementById('card-leader-strip-sub');
    if (cardLeaderStripSub) cardLeaderStripSub.textContent = m.leaderAvatar.homeStripSub;
    const desktopFaqTitle = document.getElementById('desktop-faq-title');
    if (desktopFaqTitle) desktopFaqTitle.textContent = m.faq.title;
    const desktopFaqSubtitle = document.getElementById('desktop-faq-subtitle');
    if (desktopFaqSubtitle) desktopFaqSubtitle.textContent = m.faq.subtitle;
    if (mobFaqTitle) mobFaqTitle.textContent = m.faq.title;
    const mobFaqSubtitle = document.getElementById('mob-faq-subtitle');
    if (mobFaqSubtitle) mobFaqSubtitle.textContent = m.faq.subtitle;
    const mobChatDisclaimer = document.getElementById('mob-chat-disclaimer');
    if (mobChatDisclaimer) {
      mobChatDisclaimer.textContent =
        'Isolated avatar — conversation siloed to this leader and kept confidential if saved at all, not shared with GRACE. Crisis requests route to a live leader immediately.';
    }
    const ldDisclaimer = document.querySelector('.ld-disclaimer');
    if (ldDisclaimer) {
      ldDisclaimer.textContent =
        m.leaderAvatar.disclaimer +
        (ldDisclaimer.id === 'ld-disclaimer'
          ? ' For crisis support, use Help now or call 988.'
          : '');
    }
    const aiLeaderDisclaimer = document.getElementById('ai-leader-disclaimer');
    if (aiLeaderDisclaimer) aiLeaderDisclaimer.textContent = m.leaderAvatar.disclaimer;
  }

  global.GRACE_MESSAGING = {
    DEFAULT_CHURCH: DEFAULT_CHURCH,
    GRACE_ACRONYM: GRACE_ACRONYM,
    getMessaging: getMessaging,
    leaderFirstName: leaderFirstName,
    systemNameHtml: systemNameHtml,
    leaderNameHtml: leaderNameHtml,
    leaderFollowUpLine: leaderFollowUpLine,
    avatarBio: avatarBio,
    normalizeLeadersArray: normalizeLeadersArray,
    buildAiResponseText: buildAiResponseText,
    renderFaqHtml: renderFaqHtml,
    renderGraceOrb: renderGraceOrb,
    initGraceMessagingDom: initGraceMessagingDom,
  };
})(typeof window !== 'undefined' ? window : globalThis);
