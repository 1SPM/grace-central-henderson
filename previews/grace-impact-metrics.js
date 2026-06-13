/**
 * GRACE impact metrics — demo constants for member prototypes.
 * Kingdom Impact Score is internal-only (not shown in UI).
 */
(function (global) {
  const GRACE_METRICS = {
    graceImpact: { month: 18.42, ytd: 1240, lifetime: 4380 },
    pulse: {
      score: 248,
      week: { service: 45, volunteer: 80, care: 25, learning: 30, community: 68 },
      recent: [
        { label: 'Volunteer Event', delta: 40 },
        { label: 'Live Service', delta: 15 },
        { label: 'Care Response', delta: 25 },
        { label: 'Bible Study', delta: 10 },
      ],
    },
    commitment: {
      level: 'Partner',
      pct: 6,
      next: 'Champion',
      nextPct: 8,
      dailyToNext: 1.67,
      progressPct: 62,
    },
    livesImpacted: { month: 23 },
    impactRouteLabel: 'Food Pantry',
    allocation: [
      { cause: 'Missions Fund', pct: 40 },
      { cause: 'Building Fund', pct: 25 },
      { cause: 'Youth Ministry', pct: 20 },
      { cause: 'Food Pantry', pct: 10 },
      { cause: 'Care Fund', pct: 5 },
    ],
    givingGoal: { pct: 52, raised: 1240, target: 2400 },
    givenMonth: 230,
    walletAvailable: 3240,
    leadership: {
      participationWeek: 4,
      verifiedLeaders: 18,
      pendingFollowUps: 0,
    },
    home: {
      memberName: 'Maya',
      pillarUpdates: 5,
      careLabel: '24/7 available',
    },
    watch: {
      viewerCount: 342,
      serviceTime: '9:45 AM',
      series: 'Honor Each Other',
      part: 4,
      title: 'Honor Each Other',
      speaker: 'Pastor James Wilson',
      serviceDate: 'May 25, 2026',
      videoUrl: 'https://divinity-agi.s3.ca-central-1.amazonaws.com/Church-Stage-video.mp4',
    },
    church: {
      name: 'Central Henderson',
      values: ['Grace', 'Honor', 'Community', 'Generosity', 'Mission'],
      coreBeliefs: [
        {
          id: 'honor',
          title: 'Honor One Another',
          summary: 'We treat every person with dignity — at home, at church, and in the city — because Christ honored us first.',
          anchor: 'Romans 12:10',
        },
        {
          id: 'grace',
          title: 'Rooted in Grace',
          summary: 'We are saved by grace through faith, and we grow by abiding in Christ — not by striving alone.',
          anchor: 'Ephesians 2:8',
        },
        {
          id: 'community',
          title: 'Better Together',
          summary: 'Faith is lived in community — small groups, serving teams, and Sunday worship shape us together.',
          anchor: 'Hebrews 10:24',
        },
        {
          id: 'generosity',
          title: 'Open Hands',
          summary: 'We give time, talent, and treasure so others can encounter the love of Jesus.',
          anchor: '2 Corinthians 9:7',
        },
        {
          id: 'mission',
          title: 'Sent Locally',
          summary: 'Central Henderson exists to bless Henderson and beyond — every member has a part to play.',
          anchor: 'Matthew 28:19',
        },
      ],
      sermonThemes: {
        'HONOR EACH OTHER': 'honor',
        'Honor Each Other': 'honor',
        ROOTED: 'grace',
        'THE GIFT': 'grace',
      },
    },
    pastoralCare: {
      categories: [
        { id: 'marriage', title: 'Marriage & Relationships', subtitle: 'Relationship guidance & support', tint: 'pink', icon: 'heart', leaderIdx: 4, prefill: 'I need support with marriage and relationships' },
        { id: 'addiction', title: 'Addiction & Recovery', subtitle: 'Freedom from substance & behavioral addiction', tint: 'yellow', icon: 'help', leaderIdx: 9, prefill: 'I need support with addiction and recovery' },
        { id: 'grief', title: 'Grief & Loss', subtitle: 'Support through loss and mourning', tint: 'blue', icon: 'prayer', leaderIdx: 1, prefill: 'I need support with grief and loss' },
        { id: 'faith', title: 'Faith Questions', subtitle: 'Exploring faith, doubt, and spiritual growth', tint: 'gray', icon: 'resources', leaderIdx: 0, prefill: 'I have questions about faith and spiritual growth' },
        { id: 'crisis', title: 'Crisis / Urgent', subtitle: 'Immediate help for an urgent situation', tint: 'red', icon: 'crisis', action: 'crisis' },
        { id: 'financial', title: 'Financial Help', subtitle: 'Financial counseling & assistance', tint: 'green', icon: 'give', leaderIdx: 1, prefill: 'I need financial counseling and assistance' },
        { id: 'anxiety', title: 'Anxiety & Depression', subtitle: 'Mental health support & encouragement', tint: 'cyan', icon: 'help', leaderIdx: 9, prefill: 'I need support with anxiety or depression' },
        { id: 'parenting', title: 'Parenting', subtitle: 'Parenting guidance & family support', tint: 'orange', icon: 'kids', leaderIdx: 4, prefill: 'I need parenting guidance and family support' },
        { id: 'other', title: 'Something Else', subtitle: 'General pastoral support & conversation', tint: 'gray', icon: 'prayer', leaderIdx: null, prefill: 'I need pastoral support and someone to talk with' },
      ],
    },
  };

  global.GRACE_METRICS = GRACE_METRICS;
})(typeof window !== 'undefined' ? window : globalThis);
