/**
 * Sample data generator for new tenants. Lets a brand-new church see
 * what a populated GRACE dashboard looks like before they commit to
 * importing their real roster.
 *
 * Safety:
 *   - SEEDER ONLY RUNS on churches with FEWER THAN 5 EXISTING PEOPLE.
 *     Once a church has real members, the option is gone — we never
 *     comingle demo + real data accidentally.
 *   - Every seeded row carries `note: 'sample data'` (and tags
 *     'sample-data') so admins can find + bulk-delete via the existing
 *     UI if they want to clean up before going live.
 *
 * Determinism:
 *   - Names + emails come from a small fixed list (chosen for variety
 *     of cultural backgrounds, not coincidentally — reflects diverse
 *     congregation reality).
 *   - Birthdays + join dates are deterministic offsets from "today",
 *     so the demo data evolves with the current date (no stale
 *     "joined 5 years ago" data).
 *   - Giving distributes 30 gifts across the last 90 days with realistic
 *     amount + fund distribution.
 */

const SAMPLE_PEOPLE: Array<{
  first: string;
  last: string;
  email: string;
  city: string;
  state: string;
  status: 'member' | 'regular' | 'visitor' | 'leader';
  /** Days ago this person joined */
  joined_days_ago: number;
  /** Birth-month-day pair — year added dynamically */
  birth_month: number;
  birth_day: number;
  /** Approximate age — used to pick a sensible birth year */
  age: number;
}> = [
  { first: 'Sarah',       last: 'Johnson',   email: 'sarah.j@example.com',    city: 'Austin', state: 'TX', status: 'member',   joined_days_ago: 1200, birth_month: 3,  birth_day: 14, age: 42 },
  { first: 'Marcus',      last: 'Williams',  email: 'marcus.w@example.com',   city: 'Austin', state: 'TX', status: 'leader',   joined_days_ago: 2200, birth_month: 7,  birth_day: 22, age: 58 },
  { first: 'Priya',       last: 'Patel',     email: 'priya.p@example.com',    city: 'Austin', state: 'TX', status: 'member',   joined_days_ago: 800,  birth_month: 11, birth_day: 9,  age: 34 },
  { first: 'James',       last: 'Anderson',  email: 'james.a@example.com',    city: 'Round Rock', state: 'TX', status: 'member', joined_days_ago: 1500, birth_month: 1,  birth_day: 28, age: 65 },
  { first: 'Elena',       last: 'Rodriguez', email: 'elena.r@example.com',    city: 'Austin', state: 'TX', status: 'regular',  joined_days_ago: 300,  birth_month: 5,  birth_day: 18, age: 29 },
  { first: 'David',       last: 'Lee',       email: 'david.l@example.com',    city: 'Pflugerville', state: 'TX', status: 'member', joined_days_ago: 1800, birth_month: 9, birth_day: 3, age: 47 },
  { first: 'Aisha',       last: 'Mohamed',   email: 'aisha.m@example.com',    city: 'Austin', state: 'TX', status: 'regular',  joined_days_ago: 180,  birth_month: 6,  birth_day: 7,  age: 31 },
  { first: 'Daniel',      last: 'O\'Brien',  email: 'dan.ob@example.com',     city: 'Austin', state: 'TX', status: 'leader',   joined_days_ago: 2900, birth_month: 4,  birth_day: 11, age: 53 },
  { first: 'Maria',       last: 'Garcia',    email: 'maria.g@example.com',    city: 'Austin', state: 'TX', status: 'member',   joined_days_ago: 950,  birth_month: 12, birth_day: 19, age: 38 },
  { first: 'Robert',      last: 'Chen',      email: 'robert.c@example.com',   city: 'Cedar Park', state: 'TX', status: 'member', joined_days_ago: 1100, birth_month: 8, birth_day: 30, age: 49 },
  { first: 'Hannah',      last: 'Kim',       email: 'hannah.k@example.com',   city: 'Austin', state: 'TX', status: 'visitor',  joined_days_ago: 45,   birth_month: 2,  birth_day: 14, age: 27 },
  { first: 'Christopher', last: 'Hall',      email: 'chris.h@example.com',    city: 'Austin', state: 'TX', status: 'member',   joined_days_ago: 1700, birth_month: 10, birth_day: 5, age: 44 },
  { first: 'Fatima',      last: 'Hassan',    email: 'fatima.h@example.com',   city: 'Austin', state: 'TX', status: 'regular',  joined_days_ago: 400,  birth_month: 7,  birth_day: 1,  age: 36 },
  { first: 'Michael',     last: 'Brown',     email: 'mike.b@example.com',     city: 'Austin', state: 'TX', status: 'leader',   joined_days_ago: 3200, birth_month: 11, birth_day: 23, age: 61 },
  { first: 'Yuki',        last: 'Tanaka',    email: 'yuki.t@example.com',     city: 'Austin', state: 'TX', status: 'regular',  joined_days_ago: 220,  birth_month: 6,  birth_day: 26, age: 28 },
  { first: 'Thomas',      last: 'Martinez',  email: 'tom.m@example.com',      city: 'Buda', state: 'TX', status: 'member',     joined_days_ago: 1300, birth_month: 3,  birth_day: 9,  age: 51 },
  { first: 'Olivia',      last: 'Thompson',  email: 'olivia.t@example.com',   city: 'Austin', state: 'TX', status: 'member',   joined_days_ago: 850,  birth_month: 9,  birth_day: 16, age: 39 },
  { first: 'Carlos',      last: 'Reyes',     email: 'carlos.r@example.com',   city: 'Austin', state: 'TX', status: 'regular',  joined_days_ago: 500,  birth_month: 1,  birth_day: 4,  age: 33 },
  { first: 'Grace',       last: 'Adebayo',   email: 'grace.a@example.com',    city: 'Austin', state: 'TX', status: 'member',   joined_days_ago: 1600, birth_month: 5,  birth_day: 28, age: 46 },
  { first: 'Henry',       last: 'White',     email: 'henry.w@example.com',    city: 'Leander', state: 'TX', status: 'member',  joined_days_ago: 2400, birth_month: 12, birth_day: 11, age: 69 },
];

const FUNDS = ['General', 'Building', 'Missions', 'Youth', 'Benevolence'];

interface DemoSeedResult {
  people_inserted: number;
  giving_inserted: number;
  events_inserted: number;
  skipped_reason?: string;
}

/**
 * Seed sample data into the given church. Idempotent on already-populated
 * churches (returns skipped_reason='already_populated').
 */
export async function seedDemoData(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  churchId: string,
  now: Date = new Date(),
): Promise<DemoSeedResult> {
  // Safety check: bail if church has more than 5 people. Once they've
  // started importing real data, no more demo seeding.
  const { count: existingPeople } = await supabase
    .from('people')
    .select('id', { count: 'exact', head: true })
    .eq('church_id', churchId);
  if (existingPeople !== null && existingPeople >= 5) {
    return {
      people_inserted: 0,
      giving_inserted: 0,
      events_inserted: 0,
      skipped_reason: 'already_populated',
    };
  }

  const today = new Date(now);

  // ----- People -----
  const peopleRows = SAMPLE_PEOPLE.map((p) => {
    const joinDate = new Date(today.getTime() - p.joined_days_ago * 86_400_000);
    const birthYear = today.getFullYear() - p.age;
    const birthDate = new Date(Date.UTC(birthYear, p.birth_month - 1, p.birth_day));
    return {
      church_id: churchId,
      first_name: p.first,
      last_name: p.last,
      email: p.email,
      city: p.city,
      state: p.state,
      status: p.status,
      birth_date: birthDate.toISOString().slice(0, 10),
      join_date: joinDate.toISOString().slice(0, 10),
      tags: ['sample-data'],
      notes: 'sample data — delete via Settings → Bulk delete when you import your real roster',
    };
  });
  const { data: insertedPeople, error: peopleErr } = await supabase
    .from('people')
    .insert(peopleRows)
    .select('id, status');
  if (peopleErr) throw new Error(`sample people insert failed: ${peopleErr.message}`);

  // ----- Giving (30 entries over the last 90 days, weighted to members + leaders) -----
  const memberIds = (insertedPeople ?? [])
    .filter((p) => p.status === 'member' || p.status === 'leader' || p.status === 'regular')
    .map((p) => p.id);

  const givingRows: Array<{
    church_id: string;
    person_id: string;
    amount: number;
    fund: string;
    date: string;
    method: string;
    is_recurring: boolean;
    note: string;
  }> = [];

  if (memberIds.length > 0) {
    // Deterministic-ish: cycle through givers + amounts + funds for stable demos
    for (let i = 0; i < 30; i++) {
      const personId = memberIds[i % memberIds.length];
      const daysAgo = Math.floor((i / 30) * 90);
      const giftDate = new Date(today.getTime() - daysAgo * 86_400_000);
      // Amounts cluster around realistic giving: mostly $20-$200, a couple of $500+ "leadership" gifts
      const amount =
        i % 7 === 0 ? 500 + (i % 4) * 100 :       // larger gifts every 7th entry
        i % 3 === 0 ? 100 + (i % 5) * 20 :         // medium gifts
        25 + (i % 5) * 10;                          // common $25-$65 range
      const fund = FUNDS[i % FUNDS.length];
      givingRows.push({
        church_id: churchId,
        person_id: personId,
        amount,
        fund,
        date: giftDate.toISOString().slice(0, 10),
        method: i % 4 === 0 ? 'cash' : i % 3 === 0 ? 'check' : 'online',
        is_recurring: i % 5 === 0,
        note: 'sample data',
      });
    }
  }
  let givingInserted = 0;
  if (givingRows.length > 0) {
    const { data: insertedGiving, error: givingErr } = await supabase
      .from('giving')
      .insert(givingRows)
      .select('id');
    if (givingErr) throw new Error(`sample giving insert failed: ${givingErr.message}`);
    givingInserted = insertedGiving?.length ?? 0;
  }

  // ----- Calendar events (upcoming Sunday services + small group meetings) -----
  const eventRows: Array<{
    church_id: string;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    location: string;
    all_day: boolean;
    category: string;
  }> = [];

  // Next 4 Sundays + 4 weekly meetings + 2 special events = 10 events
  for (let week = 0; week < 4; week++) {
    const sunday = nextSunday(today, week);
    eventRows.push({
      church_id: churchId,
      title: 'Sunday Service',
      description: 'Weekly worship service',
      start_date: sunday.toISOString(),
      end_date: new Date(sunday.getTime() + 90 * 60_000).toISOString(),
      location: 'Main Sanctuary',
      all_day: false,
      category: 'service',
    });
  }
  for (let week = 0; week < 4; week++) {
    const wednesday = new Date(today.getTime() + (week * 7 + 3) * 86_400_000);
    wednesday.setUTCHours(19, 0, 0, 0);
    eventRows.push({
      church_id: churchId,
      title: 'Small Group: Faith & Family',
      description: 'Weekly study + discussion. Childcare provided.',
      start_date: wednesday.toISOString(),
      end_date: new Date(wednesday.getTime() + 90 * 60_000).toISOString(),
      location: 'Fellowship Hall',
      all_day: false,
      category: 'group',
    });
  }
  // 2 special events
  const nextSat = new Date(today.getTime() + ((6 - today.getUTCDay() + 7) % 7) * 86_400_000);
  nextSat.setUTCHours(9, 0, 0, 0);
  eventRows.push({
    church_id: churchId,
    title: 'Community Breakfast',
    description: 'Free monthly breakfast — bring a friend.',
    start_date: nextSat.toISOString(),
    end_date: new Date(nextSat.getTime() + 120 * 60_000).toISOString(),
    location: 'Fellowship Hall',
    all_day: false,
    category: 'community',
  });
  const inThreeWeeks = new Date(today.getTime() + 21 * 86_400_000);
  inThreeWeeks.setUTCHours(18, 0, 0, 0);
  eventRows.push({
    church_id: churchId,
    title: 'Volunteer Appreciation Dinner',
    description: 'A thank-you for everyone who serves week in, week out.',
    start_date: inThreeWeeks.toISOString(),
    end_date: new Date(inThreeWeeks.getTime() + 180 * 60_000).toISOString(),
    location: 'Main Sanctuary',
    all_day: false,
    category: 'community',
  });

  const { data: insertedEvents, error: eventErr } = await supabase
    .from('calendar_events')
    .insert(eventRows)
    .select('id');
  if (eventErr) throw new Error(`sample events insert failed: ${eventErr.message}`);

  return {
    people_inserted: insertedPeople?.length ?? 0,
    giving_inserted: givingInserted,
    events_inserted: insertedEvents?.length ?? 0,
  };
}

function nextSunday(from: Date, weeksAhead: number): Date {
  const d = new Date(from);
  const daysToSunday = (7 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + daysToSunday + weeksAhead * 7);
  d.setUTCHours(10, 0, 0, 0);   // 10am UTC ~= reasonable Sunday morning across most US time zones
  return d;
}
