export type ConnectSubjectKind = 'topics' | 'scripture' | 'illustrations';

export const sermonTopics = [
  'Fathers Day',
  'Pride Before A Fall',
  'Help The Broken',
  'Speaking Blessings',
  'New Purpose',
  'Beings',
  'First Advent',
  'John The Apostle',
  'Unchanging Truth',
  'Plot Of The Bible',
  'Honor Each Other',
  'Rooted in Grace',
] as const;

export const scriptureRefs = [
  'Matthew 10:24-39',
  'Genesis 21:8-21',
  'Luke 15:11-32',
  'Proverbs 20:7',
  'Romans 6:1-11',
  'Matthew 10:40-42',
  'Matthew 10:26-33',
  'Ephesians 6:1-4',
  'Joshua 24:15',
  'Matthew 10:21-33',
  '1 Peter 4:8',
  'James 5:16',
] as const;

export const illustrationTopics = [
  'Fathers Day',
  'Fathers',
  'Fathers Love',
  'Father',
  'Dad Jokes',
  'Prayer',
  'The 24 Elders',
  'God The Father',
  'Gods Plan',
  'Fruit Of The Spirit',
  'Forgiveness',
  'Community',
] as const;

export const browseAllLabels: Record<ConnectSubjectKind, string> = {
  topics: 'Browse All Sermon Topics',
  scripture: 'Browse All Sermon Scripture',
  illustrations: 'Browse All Sermon Illustration Topics',
};

export const connectColumnTitles: Record<ConnectSubjectKind, string> = {
  topics: 'Sermons',
  scripture: 'Scripture',
  illustrations: 'Sermon Illustrations',
};

/** Keyword → scripture refs used when mapping archive sermons to connect subjects. */
export const themeScripture: Array<{ keywords: string[]; values: string[] }> = [
  { keywords: ['forgiveness', 'honor', 'speaking'], values: ['Ephesians 4:32', 'Matthew 10:40-42', 'Romans 12:10'] },
  { keywords: ['father', 'family', 'fathers'], values: ['Ephesians 6:1-4', 'Proverbs 20:7', 'Joshua 24:15'] },
  { keywords: ['grace', 'rooted'], values: ['Romans 6:1-11', '2 Corinthians 12:9', 'Ephesians 2:8-9'] },
  { keywords: ['compassion', 'broken', 'blessing'], values: ['Luke 15:11-32', 'Matthew 25:35-40', 'James 5:16'] },
  { keywords: ['faith', 'truth', 'spirit'], values: ['Hebrews 11:1', 'Galatians 5:22-23', 'John 14:6'] },
  { keywords: ['bible', 'story', 'plot'], values: ['2 Timothy 3:16-17', 'Psalm 119:105', 'Genesis 1:1'] },
  { keywords: ['pride', 'fall', 'purpose'], values: ['Proverbs 16:18', 'Jeremiah 29:11', 'Romans 8:28'] },
  { keywords: ['advent', 'john'], values: ['John 1:1-14', 'Matthew 10:24-39', 'Revelation 4:4'] },
];

/** Keyword → illustration topics derived from sermon archive themes. */
export const themeIllustrations: Array<{ keywords: string[]; values: string[] }> = [
  { keywords: ['forgiveness', 'honor'], values: ['Forgiveness', 'Honor Each Other', 'Restoration'] },
  { keywords: ['father', 'family', 'fathers'], values: ['Fathers Day', 'Fathers Love', 'Family Legacy'] },
  { keywords: ['grace', 'rooted'], values: ['Rooted in Grace', 'New Beginnings', 'Gods Plan'] },
  { keywords: ['compassion', 'broken', 'blessing'], values: ['Help The Broken', 'Speaking Blessings', 'Community Care'] },
  { keywords: ['faith', 'truth', 'spirit'], values: ['Fruit Of The Spirit', 'Unchanging Truth', 'Prayer'] },
  { keywords: ['bible', 'story', 'plot'], values: ['Plot Of The Bible', 'The 24 Elders', 'Gods Story'] },
  { keywords: ['pride', 'fall', 'purpose'], values: ['Pride Before A Fall', 'New Purpose', 'Humility'] },
  { keywords: ['advent', 'john'], values: ['First Advent', 'John The Apostle', 'Light In Darkness'] },
];
