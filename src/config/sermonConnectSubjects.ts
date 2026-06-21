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
