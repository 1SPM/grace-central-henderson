import { Person, Task, SmallGroup, PrayerRequest, Interaction, Attendance, CalendarEvent, Giving } from './types';
import type {
  AgentLog,
  AgentStats,
  LifeEventConfig,
  DonationProcessingConfig,
  NewMemberConfig,
  LifeEvent,
} from './lib/agents/types';

// Helper to get dates relative to today for testing
const today = new Date();
const getDateString = (daysFromNow: number): string => {
  const date = new Date(today);
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
};
const getBirthDateForUpcoming = (daysFromNow: number): string => {
  const date = new Date(today);
  date.setDate(date.getDate() + daysFromNow);
  // Use a past year for birth date but same month/day
  return `1985-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const SAMPLE_PEOPLE: Person[] = [
  // === ORIGINAL PEOPLE (with birthDates added) ===
  {
    id: '1',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    email: 'sarah.mitchell@email.com',
    phone: '(555) 123-4567',
    status: 'visitor',
    firstVisit: '2024-12-29',
    birthDate: '1995-03-15',
    tags: ['first-time', 'young-adult'],
    smallGroups: [],
    notes: 'Came with friend Maria. Interested in small groups.'
  },
  {
    id: '2',
    firstName: 'James',
    lastName: 'Peterson',
    email: 'james.p@email.com',
    phone: '(555) 234-5678',
    status: 'member',
    joinDate: '2023-06-15',
    birthDate: getBirthDateForUpcoming(2), // Birthday in 2 days!
    tags: ['volunteer', 'greeter'],
    smallGroups: ['1'],
    notes: 'Serves on greeting team every 2nd Sunday.'
  },
  {
    id: '3',
    firstName: 'Maria',
    lastName: 'Garcia',
    email: 'maria.garcia@email.com',
    phone: '(555) 345-6789',
    status: 'regular',
    firstVisit: '2024-08-10',
    birthDate: '1992-07-22',
    tags: ['young-adult'],
    smallGroups: ['2'],
    notes: 'Brought friend Sarah on 12/29.'
  },
  {
    id: '4',
    firstName: 'Robert',
    lastName: 'Chen',
    email: 'robert.chen@email.com',
    phone: '(555) 456-7890',
    status: 'leader',
    joinDate: '2020-03-01',
    birthDate: getBirthDateForUpcoming(5), // Birthday in 5 days!
    tags: ['elder', 'small-group-leader'],
    smallGroups: ['1'],
    notes: 'Elder. Leads Tuesday night men\'s group.'
  },
  {
    id: '5',
    firstName: 'Emily',
    lastName: 'Johnson',
    email: 'emily.j@email.com',
    phone: '(555) 567-8901',
    status: 'inactive',
    joinDate: '2022-01-10',
    birthDate: '1988-11-30',
    tags: [],
    smallGroups: [],
    notes: 'Hasn\'t attended in 6 weeks. Last contact was about job stress.'
  },
  {
    id: '6',
    firstName: 'Cam',
    lastName: 'Deich',
    email: 'cdeichmiller11@gmail.com', // TEST: Birthday greeting (today!)
    phone: '(555) 678-9012',
    status: 'member',
    joinDate: '2021-09-20',
    birthDate: getBirthDateForUpcoming(0), // Birthday TODAY!
    tags: ['worship-team', 'musician'],
    smallGroups: ['2'],
    notes: 'Test user for AI email features.'
  },
  {
    id: '7',
    firstName: 'Lisa',
    lastName: 'Thompson',
    email: 'lisa.t@email.com',
    phone: '(555) 789-0123',
    status: 'visitor',
    firstVisit: '2025-01-01',
    birthDate: '1984-04-12',
    tags: ['first-time', 'family'],
    smallGroups: [],
    notes: 'New Year\'s service visitor. Has 2 kids (ages 5, 8).'
  },
  {
    id: '8',
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'michael.b@email.com',
    phone: '(555) 890-1234',
    status: 'member',
    joinDate: '2019-11-15',
    birthDate: '1975-08-03',
    tags: ['deacon', 'finance-team'],
    smallGroups: ['1'],
    notes: 'Serves on finance committee.'
  },

  // === NEW PEOPLE FOR AI TESTING ===

  // People with upcoming birthdays (for Life Event Agent)
  {
    id: '9',
    firstName: 'Amanda',
    lastName: 'Foster',
    email: 'amanda.foster@email.com',
    phone: '(555) 901-2345',
    status: 'member',
    joinDate: '2022-05-20',
    birthDate: getBirthDateForUpcoming(1), // Birthday tomorrow!
    tags: ['womens-ministry', 'prayer-team'],
    smallGroups: ['3'],
    notes: 'Active in women\'s Bible study. Great encourager.'
  },
  {
    id: '10',
    firstName: 'Kevin',
    lastName: 'Martinez',
    email: 'kevin.m@email.com',
    phone: '(555) 012-3456',
    status: 'member',
    joinDate: '2021-01-22', // Membership anniversary coming up!
    birthDate: getBirthDateForUpcoming(3), // Birthday in 3 days!
    tags: ['tech-team', 'young-professional'],
    smallGroups: ['2'],
    notes: 'Runs sound booth. Works in IT.'
  },
  {
    id: '11',
    firstName: 'Rachel',
    lastName: 'Kim',
    email: 'rachel.kim@email.com',
    phone: '(555) 123-4560',
    status: 'member',
    joinDate: getDateString(-365), // Joined exactly 1 year ago - anniversary!
    birthDate: getBirthDateForUpcoming(6), // Birthday in 6 days!
    tags: ['childrens-ministry', 'teacher'],
    smallGroups: ['3'],
    notes: 'Teaches 3rd grade Sunday school. Very dedicated.'
  },
  {
    id: '12',
    firstName: 'Thomas',
    lastName: 'Wright',
    email: 'tom.wright@email.com',
    phone: '(555) 234-5670',
    status: 'leader',
    joinDate: '2018-06-10',
    birthDate: '1970-12-25',
    tags: ['elder', 'missions-team'],
    smallGroups: ['1'],
    notes: 'Oversees missions committee. Went on 3 mission trips.'
  },

  // Recent visitors (for New Member Agent testing)
  {
    id: '13',
    firstName: 'Cam',
    lastName: '1993',
    email: 'camd1993@gmail.com', // TEST: Welcome/follow-up emails for recent visitor
    phone: '(555) 345-6780',
    status: 'visitor',
    firstVisit: getDateString(-3), // Visited 3 days ago
    birthDate: '1990-02-14',
    tags: ['first-time', 'young-family'],
    smallGroups: [],
    notes: 'Test user for AI email features.'
  },
  {
    id: '14',
    firstName: 'Marcus',
    lastName: 'Taylor',
    email: 'marcus.t@email.com',
    phone: '(555) 456-7801',
    status: 'visitor',
    firstVisit: getDateString(-1), // Visited yesterday
    birthDate: '1987-09-08',
    tags: ['first-time'],
    smallGroups: [],
    notes: 'Coworker of James Peterson. First church visit in 5 years.'
  },
  {
    id: '15',
    firstName: 'Ashley',
    lastName: 'Robinson',
    email: 'ashley.r@email.com',
    phone: '(555) 567-8902',
    status: 'visitor',
    firstVisit: getDateString(0), // Visiting today!
    birthDate: '1993-05-21',
    tags: ['first-time', 'college-student'],
    smallGroups: [],
    notes: 'Graduate student at local university. Interested in young adults group.'
  },

  // Regular attendees becoming members (status transitions)
  {
    id: '16',
    firstName: 'Brian',
    lastName: 'Cooper',
    email: 'brian.cooper@email.com',
    phone: '(555) 678-9013',
    status: 'regular',
    firstVisit: '2024-09-15',
    birthDate: '1982-10-30',
    tags: ['mens-group'],
    smallGroups: ['1'],
    notes: 'Been attending regularly for 4 months. Ready for membership class?'
  },
  {
    id: '17',
    firstName: 'Nicole',
    lastName: 'Davis',
    email: 'nicole.d@email.com',
    phone: '(555) 789-0124',
    status: 'regular',
    firstVisit: '2024-10-01',
    birthDate: getBirthDateForUpcoming(4), // Birthday in 4 days!
    tags: ['young-adult', 'creative'],
    smallGroups: ['2'],
    notes: 'Graphic designer. Volunteered for bulletin design.'
  },

  // Members with membership anniversaries this week
  {
    id: '18',
    firstName: 'Daniel',
    lastName: 'Lee',
    email: 'daniel.lee@email.com',
    phone: '(555) 890-1235',
    status: 'member',
    joinDate: getDateString(-730 + 2), // 2-year anniversary in 2 days!
    birthDate: '1979-06-18',
    tags: ['usher', 'parking-team'],
    smallGroups: ['1'],
    notes: 'Faithful usher. Never misses a Sunday.'
  },
  {
    id: '19',
    firstName: 'Stephanie',
    lastName: 'Moore',
    email: 'steph.moore@email.com',
    phone: '(555) 901-2346',
    status: 'member',
    joinDate: getDateString(-1095 + 5), // 3-year anniversary in 5 days!
    birthDate: '1986-01-07',
    tags: ['hospitality', 'events-team'],
    smallGroups: ['3'],
    notes: 'Coordinates fellowship meals. Amazing cook!'
  },

  // First-time givers (for Donation Agent testing)
  {
    id: '20',
    firstName: 'Christopher',
    lastName: 'Hall',
    email: 'chris.hall@email.com',
    phone: '(555) 012-3457',
    status: 'regular',
    firstVisit: '2024-11-10',
    birthDate: '1991-03-25',
    tags: ['young-professional'],
    smallGroups: [],
    notes: 'Attending for 2 months. Made first donation last week!'
  },
  {
    id: '21',
    firstName: 'Lauren',
    lastName: 'White',
    email: 'lauren.w@email.com',
    phone: '(555) 123-4561',
    status: 'member',
    joinDate: '2023-03-12',
    birthDate: '1989-08-14',
    tags: ['choir', 'worship-team'],
    smallGroups: ['3'],
    notes: 'Beautiful soprano voice. Joined choir immediately.'
  },

  // Inactive members for re-engagement
  {
    id: '22',
    firstName: 'Andrew',
    lastName: 'Clark',
    email: 'andrew.c@email.com',
    phone: '(555) 234-5671',
    status: 'inactive',
    joinDate: '2021-04-15',
    birthDate: getBirthDateForUpcoming(1), // Birthday tomorrow - good re-engagement opportunity!
    tags: [],
    smallGroups: [],
    notes: 'Stopped attending after job change. Moved across town.'
  },
  {
    id: '23',
    firstName: 'Michelle',
    lastName: 'Young',
    email: 'michelle.y@email.com',
    phone: '(555) 345-6781',
    status: 'inactive',
    joinDate: '2020-08-20',
    birthDate: '1983-04-02',
    tags: [],
    smallGroups: [],
    notes: 'Family health issues. Last contact 2 months ago.'
  },

  // Large donors (for Donation Agent alert testing)
  {
    id: '24',
    firstName: 'Richard',
    lastName: 'Anderson',
    email: 'richard.a@email.com',
    phone: '(555) 456-7802',
    status: 'member',
    joinDate: '2015-01-10',
    birthDate: '1965-11-12',
    tags: ['elder', 'major-donor'],
    smallGroups: ['1'],
    notes: 'Retired business owner. Very generous supporter of missions.'
  },
  {
    id: '25',
    firstName: 'Patricia',
    lastName: 'Thomas',
    email: 'patricia.t@email.com',
    phone: '(555) 567-8903',
    status: 'member',
    joinDate: '2017-06-25',
    birthDate: '1958-07-30',
    tags: ['prayer-team', 'major-donor'],
    smallGroups: ['3'],
    notes: 'Prayer warrior. Supports benevolence fund regularly.'
  },

  // Family members (testing family connections)
  {
    id: '26',
    firstName: 'Mark',
    lastName: 'Thompson',
    email: 'mark.thompson@email.com',
    phone: '(555) 789-0125',
    status: 'member',
    joinDate: '2025-01-05',
    birthDate: '1982-04-18',
    tags: ['family'],
    smallGroups: [],
    familyId: 'fam-1',
    notes: 'Lisa Thompson\'s husband. Joined after visiting on New Year\'s.'
  },
  {
    id: '27',
    firstName: 'Emma',
    lastName: 'Thompson',
    email: 'emma.thompson@email.com',
    phone: '(555) 789-0125',
    status: 'member',
    joinDate: '2025-01-05',
    birthDate: '2017-06-10',
    tags: ['child', 'kids-ministry'],
    smallGroups: [],
    familyId: 'fam-1',
    notes: 'Lisa & Mark\'s daughter, age 8. Loves Sunday school.'
  },
  {
    id: '28',
    firstName: 'Ethan',
    lastName: 'Thompson',
    email: '',
    phone: '',
    status: 'member',
    joinDate: '2025-01-05',
    birthDate: '2020-03-22',
    tags: ['child', 'kids-ministry'],
    smallGroups: [],
    familyId: 'fam-1',
    notes: 'Lisa & Mark\'s son, age 5. In preschool class.'
  }
];

export const SAMPLE_TASKS: Task[] = [
  // === ORIGINAL TASKS ===
  {
    id: '1',
    personId: '1',
    title: 'Follow up with Sarah Mitchell',
    description: 'First-time visitor on 12/29. Send welcome email and invite to coffee.',
    dueDate: '2025-01-05',
    completed: false,
    priority: 'high',
    category: 'follow-up',
    createdAt: '2024-12-29'
  },
  {
    id: '2',
    personId: '7',
    title: 'Connect Lisa Thompson with kids ministry',
    description: 'New visitor with 2 kids. Introduce to children\'s pastor.',
    dueDate: '2025-01-06',
    completed: false,
    priority: 'high',
    category: 'follow-up',
    createdAt: '2025-01-01'
  },
  {
    id: '3',
    personId: '5',
    title: 'Check in on Emily Johnson',
    description: 'Inactive 6 weeks. Last mentioned job stress. Care call needed.',
    dueDate: '2025-01-04',
    completed: false,
    priority: 'medium',
    category: 'care',
    createdAt: '2024-12-20'
  },
  {
    id: '4',
    title: 'Prepare Q1 giving report',
    description: 'Compile giving data for elder meeting.',
    dueDate: '2025-01-15',
    completed: false,
    priority: 'low',
    category: 'admin',
    createdAt: '2025-01-01'
  },
  {
    id: '5',
    personId: '3',
    title: 'Thank Maria for bringing guest',
    description: 'She brought Sarah to service. Send appreciation note.',
    dueDate: '2025-01-03',
    completed: true,
    priority: 'medium',
    category: 'outreach',
    createdAt: '2024-12-30'
  },

  // === NEW TASKS FOR AI TESTING ===

  // Follow-ups for recent visitors
  {
    id: '6',
    personId: '13',
    title: 'Follow up with Jennifer Adams',
    description: 'First-time visitor looking for church home. Send welcome email, invite to newcomers lunch.',
    dueDate: getDateString(1),
    completed: false,
    priority: 'high',
    category: 'follow-up',
    createdAt: getDateString(-3)
  },
  {
    id: '7',
    personId: '14',
    title: 'Follow up with Marcus Taylor',
    description: 'James Peterson\'s coworker. First church visit in 5 years. Personal call recommended.',
    dueDate: getDateString(2),
    completed: false,
    priority: 'high',
    category: 'follow-up',
    createdAt: getDateString(-1)
  },
  {
    id: '8',
    personId: '15',
    title: 'Connect Ashley Robinson with young adults',
    description: 'Graduate student interested in young adults group. Introduce to Kevin Martinez.',
    dueDate: getDateString(3),
    completed: false,
    priority: 'high',
    category: 'follow-up',
    createdAt: getDateString(0)
  },

  // Care tasks
  {
    id: '9',
    personId: '22',
    title: 'Birthday outreach to Andrew Clark',
    description: 'Inactive member with birthday tomorrow. Good re-engagement opportunity.',
    dueDate: getDateString(1),
    completed: false,
    priority: 'medium',
    category: 'care',
    createdAt: getDateString(0)
  },
  {
    id: '10',
    personId: '23',
    title: 'Check on Michelle Young\'s family',
    description: 'Family health issues. Send care package and follow up.',
    dueDate: getDateString(2),
    completed: false,
    priority: 'high',
    category: 'care',
    createdAt: getDateString(-14)
  },

  // Membership tasks
  {
    id: '11',
    personId: '16',
    title: 'Invite Brian Cooper to membership class',
    description: 'Regular attender for 4 months. Ready for next step.',
    dueDate: getDateString(7),
    completed: false,
    priority: 'medium',
    category: 'follow-up',
    createdAt: getDateString(-7)
  },
  {
    id: '12',
    personId: '17',
    title: 'Thank Nicole Davis for design help',
    description: 'Volunteered to redesign bulletin. Send thank you note.',
    dueDate: getDateString(0),
    completed: false,
    priority: 'low',
    category: 'outreach',
    createdAt: getDateString(-3)
  },

  // First-time giver follow-up
  {
    id: '13',
    personId: '20',
    title: 'Thank Christopher Hall for first gift',
    description: 'Made first donation last week. Personal thank you from pastor.',
    dueDate: getDateString(0),
    completed: false,
    priority: 'medium',
    category: 'outreach',
    createdAt: getDateString(-7)
  },

  // Large gift acknowledgment
  {
    id: '14',
    personId: '24',
    title: 'Acknowledge Richard Anderson\'s missions gift',
    description: '$5,000 missions gift. Schedule coffee with pastor.',
    dueDate: getDateString(1),
    completed: false,
    priority: 'high',
    category: 'outreach',
    createdAt: getDateString(-3)
  },

  // Admin tasks
  {
    id: '15',
    title: 'Send birthday greetings this week',
    description: 'Multiple birthdays: David (today), Amanda (tomorrow), James (2 days), Kevin (3 days), Nicole (4 days).',
    dueDate: getDateString(0),
    completed: false,
    priority: 'medium',
    category: 'admin',
    createdAt: getDateString(-1)
  },
  {
    id: '16',
    title: 'Process membership anniversaries',
    description: 'Rachel Kim - 1 year, Daniel Lee - 2 years, Stephanie Moore - 3 years.',
    dueDate: getDateString(5),
    completed: false,
    priority: 'low',
    category: 'admin',
    createdAt: getDateString(0)
  }
];

export const SAMPLE_GROUPS: SmallGroup[] = [
  {
    id: '1',
    name: 'Men of Faith',
    description: 'Tuesday night men\'s Bible study and accountability group.',
    leaderId: '4',
    meetingDay: 'Tuesday',
    meetingTime: '7:00 PM',
    location: 'Room 201',
    members: ['2', '4', '8', '12', '16', '18'],
    isActive: true
  },
  {
    id: '2',
    name: 'Young Adults',
    description: 'Community for 20s and 30s. Life, faith, and fellowship.',
    leaderId: '10',
    meetingDay: 'Thursday',
    meetingTime: '7:30 PM',
    location: 'Coffee House',
    members: ['3', '6', '10', '17'],
    isActive: true
  },
  {
    id: '3',
    name: 'Women of Grace',
    description: 'Wednesday morning women\'s Bible study and prayer group.',
    leaderId: '9',
    meetingDay: 'Wednesday',
    meetingTime: '9:30 AM',
    location: 'Fellowship Hall',
    members: ['9', '11', '19', '21', '25'],
    isActive: true
  }
];

export const SAMPLE_PRAYERS: PrayerRequest[] = [
  {
    id: '1',
    personId: '5',
    content: 'Please pray for guidance in my job search. Feeling overwhelmed.',
    isPrivate: false,
    isAnswered: false,
    createdAt: '2024-12-15',
    updatedAt: '2024-12-15'
  },
  {
    id: '2',
    personId: '2',
    content: 'Thankful for my mother\'s successful surgery. Praying for quick recovery.',
    isPrivate: false,
    isAnswered: false,
    createdAt: '2024-12-28',
    updatedAt: '2024-12-28'
  },
  {
    id: '3',
    personId: '8',
    content: 'Wisdom needed for a difficult family decision.',
    isPrivate: true,
    isAnswered: true,
    testimony: 'God provided clarity through counsel from Pastor and peace in prayer.',
    createdAt: '2024-11-10',
    updatedAt: '2024-12-20'
  }
];

export const SAMPLE_INTERACTIONS: Interaction[] = [
  {
    id: '1',
    personId: '1',
    type: 'note',
    content: 'First visit! Came with Maria Garcia. Very engaged during service. Asked about small groups.',
    createdAt: '2024-12-29',
    createdBy: 'Pastor John'
  },
  {
    id: '2',
    personId: '5',
    type: 'call',
    content: 'Called to check in. Emily shared she\'s been stressed with job situation. Prayed together.',
    createdAt: '2024-12-01',
    createdBy: 'Pastor John'
  },
  {
    id: '3',
    personId: '7',
    type: 'note',
    content: 'New Year\'s service visitor. Family of 4. Kids enjoyed children\'s church.',
    createdAt: '2025-01-01',
    createdBy: 'Welcome Team'
  }
];

export const SAMPLE_ATTENDANCE: Attendance[] = [
  { id: '1', personId: '2', eventType: 'sunday', date: '2025-01-05', checkedInAt: '2025-01-05T09:45:00' },
  { id: '2', personId: '4', eventType: 'sunday', date: '2025-01-05', checkedInAt: '2025-01-05T09:30:00' },
  { id: '3', personId: '6', eventType: 'sunday', date: '2025-01-05', checkedInAt: '2025-01-05T09:50:00' },
  { id: '4', personId: '8', eventType: 'sunday', date: '2025-01-05', checkedInAt: '2025-01-05T09:35:00' },
  { id: '5', personId: '3', eventType: 'sunday', date: '2025-01-05', checkedInAt: '2025-01-05T10:00:00' },
];

export const SAMPLE_GIVING: Giving[] = [
  // === ORIGINAL GIVING RECORDS ===
  { id: '1', personId: '2', amount: 250, fund: 'tithe', date: '2025-01-05', method: 'online', isRecurring: true },
  { id: '2', personId: '4', amount: 500, fund: 'tithe', date: '2025-01-05', method: 'check', isRecurring: false },
  { id: '3', personId: '8', amount: 150, fund: 'tithe', date: '2025-01-05', method: 'online', isRecurring: true },
  { id: '4', personId: '8', amount: 100, fund: 'missions', date: '2025-01-05', method: 'online', isRecurring: false },
  { id: '5', personId: '6', amount: 75, fund: 'offering', date: '2025-01-05', method: 'cash', isRecurring: false },

  // === FIRST-TIME GIVERS (for Donation Agent testing) ===
  { id: '6', personId: '20', amount: 50, fund: 'tithe', date: getDateString(-7), method: 'online', isRecurring: false, note: 'First gift! Welcome gift from Christopher.' },
  { id: '7', personId: '13', amount: 25, fund: 'offering', date: getDateString(-2), method: 'card', isRecurring: false, note: 'First-time visitor Jennifer\'s first gift.' },
  { id: '8', personId: '16', amount: 100, fund: 'tithe', date: getDateString(-1), method: 'online', isRecurring: false, note: 'Brian\'s first tithe - becoming more committed!' },

  // === LARGE GIFTS (for alert testing - threshold typically $1000+) ===
  { id: '9', personId: '24', amount: 5000, fund: 'missions', date: getDateString(-3), method: 'check', isRecurring: false, note: 'Year-end missions gift from Richard Anderson.' },
  { id: '10', personId: '24', amount: 2500, fund: 'building', date: getDateString(-10), method: 'bank', isRecurring: false, note: 'Building fund contribution.' },
  { id: '11', personId: '25', amount: 1500, fund: 'benevolence', date: getDateString(-5), method: 'check', isRecurring: false, note: 'Patricia\'s quarterly benevolence gift.' },
  { id: '12', personId: '12', amount: 2000, fund: 'missions', date: getDateString(0), method: 'online', isRecurring: false, note: 'Thomas Wright - missions trip sponsorship.' },

  // === RECURRING GIFTS (monthly givers) ===
  { id: '13', personId: '9', amount: 200, fund: 'tithe', date: getDateString(-30), method: 'online', isRecurring: true },
  { id: '14', personId: '9', amount: 200, fund: 'tithe', date: getDateString(0), method: 'online', isRecurring: true },
  { id: '15', personId: '10', amount: 150, fund: 'tithe', date: getDateString(-30), method: 'online', isRecurring: true },
  { id: '16', personId: '10', amount: 150, fund: 'tithe', date: getDateString(0), method: 'online', isRecurring: true },
  { id: '17', personId: '11', amount: 300, fund: 'tithe', date: getDateString(-30), method: 'online', isRecurring: true },
  { id: '18', personId: '11', amount: 300, fund: 'tithe', date: getDateString(0), method: 'online', isRecurring: true },
  { id: '19', personId: '18', amount: 175, fund: 'tithe', date: getDateString(-30), method: 'online', isRecurring: true },
  { id: '20', personId: '18', amount: 175, fund: 'tithe', date: getDateString(0), method: 'online', isRecurring: true },
  { id: '21', personId: '21', amount: 125, fund: 'tithe', date: getDateString(-30), method: 'online', isRecurring: true },
  { id: '22', personId: '21', amount: 125, fund: 'tithe', date: getDateString(0), method: 'online', isRecurring: true },

  // === VARIOUS FUND DONATIONS ===
  { id: '23', personId: '19', amount: 50, fund: 'benevolence', date: getDateString(-14), method: 'cash', isRecurring: false },
  { id: '24', personId: '17', amount: 40, fund: 'offering', date: getDateString(-7), method: 'card', isRecurring: false },
  { id: '25', personId: '3', amount: 75, fund: 'tithe', date: getDateString(-7), method: 'online', isRecurring: false },
  { id: '26', personId: '26', amount: 200, fund: 'tithe', date: getDateString(-3), method: 'online', isRecurring: false, note: 'Mark Thompson - new member first gift.' },

  // === RECENT DONATIONS (for dashboard/reports) ===
  { id: '27', personId: '2', amount: 250, fund: 'tithe', date: getDateString(0), method: 'online', isRecurring: true },
  { id: '28', personId: '4', amount: 500, fund: 'tithe', date: getDateString(0), method: 'check', isRecurring: false },
  { id: '29', personId: '8', amount: 150, fund: 'tithe', date: getDateString(0), method: 'online', isRecurring: true },
  { id: '30', personId: '6', amount: 100, fund: 'offering', date: getDateString(0), method: 'cash', isRecurring: false },
];

export const SAMPLE_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'Sunday Service',
    startDate: '2025-01-05T10:00:00',
    endDate: '2025-01-05T11:30:00',
    allDay: false,
    location: 'Main Sanctuary',
    category: 'service'
  },
  {
    id: '2',
    title: 'Men of Faith',
    startDate: '2025-01-07T19:00:00',
    endDate: '2025-01-07T20:30:00',
    allDay: false,
    location: 'Room 201',
    category: 'small-group'
  },
  {
    id: '3',
    title: 'Elder Meeting',
    startDate: '2025-01-08T18:00:00',
    endDate: '2025-01-08T19:30:00',
    allDay: false,
    location: 'Conference Room',
    category: 'meeting'
  },
  {
    id: '4',
    title: 'Young Adults',
    startDate: '2025-01-09T19:30:00',
    endDate: '2025-01-09T21:00:00',
    allDay: false,
    location: 'Coffee House',
    category: 'small-group'
  }
];

export const STATUS_COLORS: Record<string, string> = {
  visitor: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  regular: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400',
  member: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
  leader: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-400'
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
};

export const PRIORITY_COLORS_DARK: Record<string, string> = {
  low: 'bg-dark-700 text-dark-300',
  medium: 'bg-amber-500/15 text-amber-400',
  high: 'bg-red-500/15 text-red-400'
};

// ============================================
// AI MESSAGING SYSTEM SAMPLE DATA
// ============================================

// Sample Scheduled Messages for Content Calendar
export interface ScheduledMessage {
  id: string;
  personId?: string;
  personName?: string;
  channel: 'email' | 'sms' | 'both';
  subject?: string;
  body: string;
  scheduledFor: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'cancelled';
  sourceType: 'manual' | 'drip_campaign' | 'birthday' | 'anniversary' | 'donation' | 'follow_up' | 'ai_generated';
  sourceAgent?: string;
  aiGenerated: boolean;
}

export const SAMPLE_SCHEDULED_MESSAGES: ScheduledMessage[] = [
  // Birthday messages
  {
    id: 'sm-1',
    personId: '6',
    personName: 'David Williams',
    channel: 'email',
    subject: 'Happy Birthday, David! 🎂',
    body: 'Dear David,\n\nWishing you a wonderful birthday filled with God\'s blessings! We are so grateful for you and your gifts on the worship team.\n\nMay this year bring you closer to God\'s purpose for your life.\n\nWith love,\nGrace Community Church',
    scheduledFor: new Date().toISOString(),
    status: 'scheduled',
    sourceType: 'birthday',
    sourceAgent: 'life-event-agent',
    aiGenerated: true
  },
  {
    id: 'sm-2',
    personId: '9',
    personName: 'Amanda Foster',
    channel: 'both',
    subject: 'Happy Birthday Tomorrow, Amanda!',
    body: 'Dear Amanda,\n\nJust a note to let you know we\'re thinking of you as your special day approaches! Your heart for prayer and encouragement blesses so many.\n\nHave a blessed birthday!\n\nGrace Community Church',
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'birthday',
    sourceAgent: 'life-event-agent',
    aiGenerated: true
  },
  {
    id: 'sm-3',
    personId: '2',
    personName: 'James Peterson',
    channel: 'email',
    subject: 'Birthday Blessings, James!',
    body: 'Dear James,\n\nHappy birthday! Thank you for your faithful service on the greeting team. Your warm welcome makes such a difference to everyone who walks through our doors.\n\nMay God bless you abundantly this year!\n\nGrace Community Church',
    scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'birthday',
    sourceAgent: 'life-event-agent',
    aiGenerated: true
  },

  // Membership anniversary messages
  {
    id: 'sm-4',
    personId: '11',
    personName: 'Rachel Kim',
    channel: 'email',
    subject: 'Celebrating 1 Year Together!',
    body: 'Dear Rachel,\n\nCan you believe it\'s been a year since you joined our church family? We are so blessed to have you, especially your dedication to our children\'s ministry.\n\nThank you for being part of Grace Community Church!\n\nWith gratitude,\nPastor John',
    scheduledFor: new Date().toISOString(),
    status: 'scheduled',
    sourceType: 'anniversary',
    sourceAgent: 'life-event-agent',
    aiGenerated: true
  },
  {
    id: 'sm-5',
    personId: '18',
    personName: 'Daniel Lee',
    channel: 'email',
    subject: 'Happy 2-Year Anniversary!',
    body: 'Dear Daniel,\n\nTwo years ago you became part of our family, and we couldn\'t be more grateful! Your faithful service as an usher has been such a blessing.\n\nThank you for your commitment to Grace Community Church.\n\nBlessings,\nPastor John',
    scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'anniversary',
    sourceAgent: 'life-event-agent',
    aiGenerated: true
  },

  // Donation thank you messages
  {
    id: 'sm-6',
    personId: '24',
    personName: 'Richard Anderson',
    channel: 'email',
    subject: 'Thank You for Your Generous Missions Gift',
    body: 'Dear Richard,\n\nThank you for your extraordinary gift of $5,000 to our missions fund. Your generosity will help support missionaries around the world and spread the Gospel to those who haven\'t heard.\n\nYour heart for missions is truly inspiring. We would love to meet with you to share how your gift will be used.\n\nWith deep gratitude,\nPastor John\n\nP.S. Your gift is tax-deductible. A receipt will follow.',
    scheduledFor: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'donation',
    sourceAgent: 'donation-processing-agent',
    aiGenerated: true
  },
  {
    id: 'sm-7',
    personId: '20',
    personName: 'Christopher Hall',
    channel: 'email',
    subject: 'Thank You for Your First Gift!',
    body: 'Dear Christopher,\n\nThank you so much for your generous gift! We\'re honored that you chose to support Grace Community Church as you continue your journey with us.\n\nYour giving helps us serve our community and share God\'s love. We\'re so glad you\'re here!\n\nBlessings,\nGrace Community Church',
    scheduledFor: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'donation',
    sourceAgent: 'donation-processing-agent',
    aiGenerated: true
  },

  // Welcome/follow-up messages
  {
    id: 'sm-8',
    personId: '13',
    personName: 'Jennifer Adams',
    channel: 'email',
    subject: 'Welcome to Grace Community Church!',
    body: 'Dear Jennifer,\n\nIt was wonderful to have you visit us! We hope you felt at home and experienced God\'s presence with us.\n\nWe\'d love to help you get connected. Our newcomers lunch is this Sunday after service - would you like to join us?\n\nIf you have any questions, please don\'t hesitate to reach out.\n\nWarmly,\nPastor John',
    scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'follow_up',
    sourceAgent: 'new-member-agent',
    aiGenerated: true
  },
  {
    id: 'sm-9',
    personId: '14',
    personName: 'Marcus Taylor',
    channel: 'both',
    subject: 'Great to Meet You, Marcus!',
    body: 'Hi Marcus,\n\nIt was great to have you visit yesterday! James mentioned you\'re his coworker - we\'re so glad he invited you.\n\nIf you have any questions about our church or want to grab coffee and chat, I\'d love to connect.\n\nHope to see you again soon!\n\nPastor John',
    scheduledFor: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'follow_up',
    sourceAgent: 'new-member-agent',
    aiGenerated: true
  },
  {
    id: 'sm-10',
    personId: '15',
    personName: 'Ashley Robinson',
    channel: 'email',
    subject: 'Welcome, Ashley! Info About Young Adults',
    body: 'Hi Ashley,\n\nWelcome to Grace Community Church! I heard you\'re interested in our young adults group - great news!\n\nWe meet every Thursday at 7:30 PM at the Coffee House downtown. Kevin Martinez leads the group and would love to meet you.\n\nHere\'s Kevin\'s contact: kevin.m@email.com\n\nSee you soon!\nPastor John',
    scheduledFor: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'follow_up',
    sourceAgent: 'new-member-agent',
    aiGenerated: true
  },

  // Drip campaign messages
  {
    id: 'sm-11',
    personId: '26',
    personName: 'Mark Thompson',
    channel: 'email',
    subject: 'Getting Connected at Grace',
    body: 'Hi Mark,\n\nIt\'s been a week since you joined our church family - welcome again! We want to help you get connected.\n\nHere are some ways to get involved:\n• Join a small group (we have one for men on Tuesdays!)\n• Serve on a team (with your background, tech team might be great)\n• Attend our monthly fellowship dinner\n\nLet us know how we can help!\n\nBlessings,\nGrace Community Church',
    scheduledFor: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    sourceType: 'drip_campaign',
    sourceAgent: 'new-member-agent',
    aiGenerated: false
  }
];

// Sample Inbound Messages for Reply Handling
export interface InboundMessage {
  id: string;
  personId?: string;
  personName?: string;
  channel: 'email' | 'sms';
  fromAddress: string;
  subject?: string;
  body: string;
  receivedAt: string;
  status: 'new' | 'read' | 'replied' | 'archived' | 'flagged';
  aiCategory?: 'question' | 'thanks' | 'concern' | 'prayer_request' | 'event_rsvp' | 'unsubscribe' | 'spam' | 'other';
  aiSentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
  aiSuggestedResponse?: string;
  inReplyTo?: string;
}

export const SAMPLE_INBOUND_MESSAGES: InboundMessage[] = [
  {
    id: 'im-1',
    personId: '13',
    personName: 'Jennifer Adams',
    channel: 'email',
    fromAddress: 'jen.adams@email.com',
    subject: 'Re: Welcome to Grace Community Church!',
    body: 'Thank you so much for the warm welcome! Yes, I would love to attend the newcomers lunch this Sunday. Is there anything I should bring?\n\nAlso, do you have a women\'s Bible study? I\'d love to get connected with other women in the church.\n\nThanks,\nJennifer',
    receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'new',
    aiCategory: 'question',
    aiSentiment: 'positive',
    aiSuggestedResponse: 'Great to hear from you, Jennifer! No need to bring anything to the newcomers lunch - just yourself! And yes, we have a wonderful women\'s Bible study that meets Wednesday mornings at 9:30 AM. Amanda Foster leads it and would love to have you join. I\'ll make sure to introduce you on Sunday!',
    inReplyTo: 'sm-8'
  },
  {
    id: 'im-2',
    personId: '24',
    personName: 'Richard Anderson',
    channel: 'email',
    fromAddress: 'richard.a@email.com',
    subject: 'Re: Thank You for Your Generous Missions Gift',
    body: 'Pastor John,\n\nThank you for the kind note. I feel strongly led to support our missionaries, especially the team in Southeast Asia.\n\nI would love to meet and discuss how the church is supporting missions work. I may have some additional ideas and resources to share.\n\nCould we schedule a lunch next week?\n\nRichard',
    receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: 'new',
    aiCategory: 'other',
    aiSentiment: 'positive',
    aiSuggestedResponse: 'Richard, thank you so much for your heart for missions! I would be honored to meet with you. How about Tuesday or Wednesday of next week? I\'ll bring our missions committee chairman, Thomas Wright, who oversees our Southeast Asia partnerships. Looking forward to our conversation!',
    inReplyTo: 'sm-6'
  },
  {
    id: 'im-3',
    personId: '5',
    personName: 'Emily Johnson',
    channel: 'sms',
    fromAddress: '(555) 567-8901',
    body: 'Hi Pastor, sorry I haven\'t been around. Work has been really hard and I\'m struggling. Could use some prayer.',
    receivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    status: 'flagged',
    aiCategory: 'prayer_request',
    aiSentiment: 'negative',
    aiSuggestedResponse: 'Emily, thank you for reaching out. I\'m so sorry to hear you\'re struggling. You\'re not alone - we\'re here for you. Can I call you this week? I\'d love to pray with you and hear what\'s going on. We miss you and are praying for you.'
  },
  {
    id: 'im-4',
    personId: '14',
    personName: 'Marcus Taylor',
    channel: 'sms',
    fromAddress: '(555) 456-7801',
    body: 'Hey, thanks for the message! Church was different than I expected - in a good way. James said there\'s a men\'s group? When does that meet?',
    receivedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'new',
    aiCategory: 'question',
    aiSentiment: 'positive',
    aiSuggestedResponse: 'So glad you enjoyed your visit, Marcus! Yes, we have a great men\'s group called "Men of Faith" that meets Tuesdays at 7 PM in Room 201. Robert Chen leads it and James is a regular. Would you like me to have James bring you next week?',
    inReplyTo: 'sm-9'
  },
  {
    id: 'im-5',
    personId: '23',
    personName: 'Michelle Young',
    channel: 'email',
    fromAddress: 'michelle.y@email.com',
    subject: 'Prayer Request - Urgent',
    body: 'Dear Pastor,\n\nI need to ask for urgent prayer. My mother was just diagnosed with cancer and we\'re all in shock. The doctors say it\'s stage 3.\n\nI know I haven\'t been to church in a while but I don\'t know where else to turn. Could the prayer team pray for her? Her name is Dorothy Young.\n\nThank you,\nMichelle',
    receivedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: 'flagged',
    aiCategory: 'prayer_request',
    aiSentiment: 'urgent',
    aiSuggestedResponse: 'Dear Michelle, I\'m so sorry to hear about your mother\'s diagnosis. Please know that you and Dorothy are in our prayers right now. I\'m adding her to our prayer chain immediately. Michelle, you are part of our family no matter how long it\'s been - we\'re here for you. Can I call you today? I\'d like to pray with you and see how else we can support your family during this time.'
  },
  {
    id: 'im-6',
    personId: '20',
    personName: 'Christopher Hall',
    channel: 'email',
    fromAddress: 'chris.hall@email.com',
    subject: 'Re: Thank You for Your First Gift!',
    body: 'Thanks for the note! Happy to support the church. Quick question - is there a way to set up automatic monthly giving? I\'d like to be more consistent.',
    receivedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: 'new',
    aiCategory: 'question',
    aiSentiment: 'positive',
    aiSuggestedResponse: 'Great question, Christopher! Yes, you can set up recurring giving through our online portal at give.gracechurch.org. Just select "Make this recurring" when you enter your gift. If you need any help, our finance team can assist. Thank you for your desire to give consistently - it makes such a difference!',
    inReplyTo: 'sm-7'
  },
  {
    id: 'im-7',
    personId: '6',
    personName: 'David Williams',
    channel: 'email',
    fromAddress: 'david.w@email.com',
    subject: 'Re: Happy Birthday, David! 🎂',
    body: 'Thank you so much for the birthday wishes! I feel so blessed to be part of this church family. See you Sunday! 🎸',
    receivedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    status: 'new',
    aiCategory: 'thanks',
    aiSentiment: 'positive',
    aiSuggestedResponse: 'You\'re so welcome, David! We\'re blessed to have you. Looking forward to seeing you Sunday - and hearing that guitar! 🎶',
    inReplyTo: 'sm-1'
  }
];

// Sample Agent Configurations
export const SAMPLE_LIFE_EVENT_CONFIG: LifeEventConfig = {
  id: 'life-event-agent',
  name: 'Life Event Agent',
  description: 'Automatically recognizes and celebrates birthdays, anniversaries, and membership milestones.',
  category: 'engagement',
  status: 'active',
  enabled: true,
  settings: {
    enableBirthdays: true,
    enableAnniversaries: true,
    enableMembershipAnniversaries: true,
    sendEmail: true,
    sendSMS: false,
    daysInAdvance: 1,
    autoSend: false,
    churchName: 'Grace Community Church',
    useAIMessages: true
  },
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: new Date().toISOString()
};

export const SAMPLE_DONATION_CONFIG: DonationProcessingConfig = {
  id: 'donation-processing-agent',
  name: 'Donation Processing Agent',
  description: 'Processes donations, sends receipts, and recognizes first-time and major donors.',
  category: 'finance',
  status: 'active',
  enabled: true,
  settings: {
    autoSendReceipts: true,
    receiptMethod: 'email',
    sendThankYouMessage: true,
    thankYouDelay: 30,
    trackFirstTimeGivers: true,
    alertOnLargeGifts: true,
    largeGiftThreshold: 1000,
    churchName: 'Grace Community Church',
    taxId: '12-3456789',
    useAIMessages: true
  },
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: new Date().toISOString()
};

export const SAMPLE_NEW_MEMBER_CONFIG: NewMemberConfig = {
  id: 'new-member-agent',
  name: 'New Member Agent',
  description: 'Welcomes new visitors and members with personalized onboarding sequences.',
  category: 'engagement',
  status: 'active',
  enabled: true,
  settings: {
    enableWelcomeSequence: true,
    enableDripCampaign: true,
    dripCampaignDays: [1, 3, 7, 14, 30],
    assignFollowUpTask: true,
    inviteToSmallGroup: true,
    sendWelcomePacket: false,
    churchName: 'Grace Community Church',
    pastorName: 'Pastor John',
    useAIMessages: true
  },
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: new Date().toISOString()
};

// Sample Agent Stats
export const SAMPLE_AGENT_STATS: Record<string, AgentStats> = {
  lifeEvent: {
    agentId: 'life-event-agent',
    totalActions: 47,
    successfulActions: 45,
    failedActions: 2,
    lastRunAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    nextRunAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
  },
  donation: {
    agentId: 'donation-processing-agent',
    totalActions: 156,
    successfulActions: 154,
    failedActions: 2,
    lastRunAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    nextRunAt: undefined // Runs on webhook triggers
  },
  newMember: {
    agentId: 'new-member-agent',
    totalActions: 23,
    successfulActions: 22,
    failedActions: 1,
    lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    nextRunAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString()
  }
};

// Sample Agent Logs
export const SAMPLE_AGENT_LOGS: AgentLog[] = [
  {
    id: 'log-1',
    agentId: 'life-event-agent',
    level: 'info',
    message: 'Birthday greeting sent to David Williams',
    metadata: { personId: '6', channel: 'email' },
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString()
  },
  {
    id: 'log-2',
    agentId: 'life-event-agent',
    level: 'info',
    message: 'Scheduled birthday greeting for Amanda Foster (tomorrow)',
    metadata: { personId: '9', channel: 'both' },
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: 'log-3',
    agentId: 'donation-processing-agent',
    level: 'info',
    message: 'Large gift alert: $5,000 from Richard Anderson',
    metadata: { personId: '24', amount: 5000, fund: 'missions' },
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-4',
    agentId: 'donation-processing-agent',
    level: 'info',
    message: 'First-time giver detected: Christopher Hall',
    metadata: { personId: '20', amount: 50 },
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-5',
    agentId: 'new-member-agent',
    level: 'info',
    message: 'Welcome email sent to Jennifer Adams',
    metadata: { personId: '13' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-6',
    agentId: 'new-member-agent',
    level: 'info',
    message: 'Follow-up task created for Marcus Taylor',
    metadata: { personId: '14', taskId: '7' },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-7',
    agentId: 'life-event-agent',
    level: 'warning',
    message: 'No email address for Ethan Thompson, skipping birthday greeting',
    metadata: { personId: '28' },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-8',
    agentId: 'donation-processing-agent',
    level: 'error',
    message: 'Failed to send receipt: Invalid email address',
    metadata: { email: 'bad-email@' },
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'log-9',
    agentId: 'life-event-agent',
    level: 'info',
    message: 'Membership anniversary: Rachel Kim - 1 year',
    metadata: { personId: '11', years: 1 },
    timestamp: new Date().toISOString()
  },
  {
    id: 'log-10',
    agentId: 'new-member-agent',
    level: 'info',
    message: 'Drip campaign message scheduled for Mark Thompson (Day 7)',
    metadata: { personId: '26', day: 7 },
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  }
];

// Sample Upcoming Life Events (for Agent Dashboard)
export const SAMPLE_UPCOMING_LIFE_EVENTS: LifeEvent[] = [
  {
    type: 'birthday',
    personId: '6',
    personName: 'David Williams',
    email: 'david.w@email.com',
    phone: '(555) 678-9012',
    date: new Date().toISOString().split('T')[0]
  },
  {
    type: 'birthday',
    personId: '9',
    personName: 'Amanda Foster',
    email: 'amanda.foster@email.com',
    phone: '(555) 901-2345',
    date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  {
    type: 'birthday',
    personId: '22',
    personName: 'Andrew Clark',
    email: 'andrew.c@email.com',
    phone: '(555) 234-5671',
    date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  {
    type: 'birthday',
    personId: '2',
    personName: 'James Peterson',
    email: 'james.p@email.com',
    phone: '(555) 234-5678',
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  {
    type: 'membership_anniversary',
    personId: '11',
    personName: 'Rachel Kim',
    email: 'rachel.kim@email.com',
    phone: '(555) 123-4560',
    date: new Date().toISOString().split('T')[0],
    yearsCount: 1
  },
  {
    type: 'membership_anniversary',
    personId: '18',
    personName: 'Daniel Lee',
    email: 'daniel.lee@email.com',
    phone: '(555) 890-1235',
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    yearsCount: 2
  },
  {
    type: 'birthday',
    personId: '10',
    personName: 'Kevin Martinez',
    email: 'kevin.m@email.com',
    phone: '(555) 012-3456',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  {
    type: 'birthday',
    personId: '17',
    personName: 'Nicole Davis',
    email: 'nicole.d@email.com',
    phone: '(555) 789-0124',
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  {
    type: 'birthday',
    personId: '4',
    personName: 'Robert Chen',
    email: 'robert.chen@email.com',
    phone: '(555) 456-7890',
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  {
    type: 'membership_anniversary',
    personId: '19',
    personName: 'Stephanie Moore',
    email: 'steph.moore@email.com',
    phone: '(555) 901-2346',
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    yearsCount: 3
  },
  {
    type: 'birthday',
    personId: '11',
    personName: 'Rachel Kim',
    email: 'rachel.kim@email.com',
    phone: '(555) 123-4560',
    date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
];
