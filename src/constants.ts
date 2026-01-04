import { Person, Task, SmallGroup, PrayerRequest, Interaction, Attendance, CalendarEvent, Giving } from './types';

export const SAMPLE_PEOPLE: Person[] = [
  {
    id: '1',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    email: 'sarah.mitchell@email.com',
    phone: '(555) 123-4567',
    status: 'visitor',
    firstVisit: '2024-12-29',
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
    tags: [],
    smallGroups: [],
    notes: 'Hasn\'t attended in 6 weeks. Last contact was about job stress.'
  },
  {
    id: '6',
    firstName: 'David',
    lastName: 'Williams',
    email: 'david.w@email.com',
    phone: '(555) 678-9012',
    status: 'member',
    joinDate: '2021-09-20',
    tags: ['worship-team', 'musician'],
    smallGroups: ['2'],
    notes: 'Plays guitar on worship team.'
  },
  {
    id: '7',
    firstName: 'Lisa',
    lastName: 'Thompson',
    email: 'lisa.t@email.com',
    phone: '(555) 789-0123',
    status: 'visitor',
    firstVisit: '2025-01-01',
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
    tags: ['deacon', 'finance-team'],
    smallGroups: ['1'],
    notes: 'Serves on finance committee.'
  }
];

export const SAMPLE_TASKS: Task[] = [
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
    members: ['2', '4', '8'],
    isActive: true
  },
  {
    id: '2',
    name: 'Young Adults',
    description: 'Community for 20s and 30s. Life, faith, and fellowship.',
    leaderId: '6',
    meetingDay: 'Thursday',
    meetingTime: '7:30 PM',
    location: 'Coffee House',
    members: ['3', '6'],
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
  { id: '1', personId: '2', amount: 250, fund: 'tithe', date: '2025-01-05', method: 'online', isRecurring: true },
  { id: '2', personId: '4', amount: 500, fund: 'tithe', date: '2025-01-05', method: 'check', isRecurring: false },
  { id: '3', personId: '8', amount: 150, fund: 'tithe', date: '2025-01-05', method: 'online', isRecurring: true },
  { id: '4', personId: '8', amount: 100, fund: 'missions', date: '2025-01-05', method: 'online', isRecurring: false },
  { id: '5', personId: '6', amount: 75, fund: 'offering', date: '2025-01-05', method: 'cash', isRecurring: false },
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
  visitor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  regular: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  member: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  leader: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
};

export const PRIORITY_COLORS_DARK: Record<string, string> = {
  low: 'bg-gray-700 text-gray-300',
  medium: 'bg-amber-900/50 text-amber-300',
  high: 'bg-red-900/50 text-red-300'
};
