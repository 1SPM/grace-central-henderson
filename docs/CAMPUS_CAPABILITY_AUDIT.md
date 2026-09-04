# GRACE Virtual Campus capability audit

**Scope:** factual reconciliation of the existing Virtual Campus branch. This
is a Faithful Church demo model, not evidence of a client deployment,
adoption, activity, or staff commitment.

## Mapping rule

The campus is a spatial lens over existing GRACE. It does not create another
system of record or require a module for every room. Operational rooms link
only to evidence-backed GRACE surfaces; environmental rooms remain contextual
unless a real workflow applies. Agent status continues to come from the WorkOS
registry and recorded run lifecycle: ran, built but never run, or not built.
AI Clergy remains its separate leadership and pastoral-care layer; it is not a
WorkOS agent hierarchy.

| Church function / area | Existing GRACE surface | Accountable human context | Existing agent or workflow | Campus location |
| --- | --- | --- | --- | --- |
| Arrival and first visit | QR check-in, Connect Card, people and Action Center | Welcome / front-desk team | Welcome is registered, not implemented | Canopy, Lobby |
| Records and privacy | Congregation, families, consent/forms/tags | Administrative assistant / records owner | Verity and Sentinel are implemented | Front Office |
| Worship and service | Sunday Service Tools, attendance, live service, skills | Worship leader and service team | Gather is registered, not implemented | Sanctuary, Music Room, Sound Booth |
| Communications | Mail, announcements, email templates | Communications lead; human sends outbound mail | Herald is registered, not implemented | Communications Office |
| Children and families | Child Check-In, family records | Children's ministry lead | No children-specific agent evidenced | Nurseries |
| Volunteers and groups | Volunteers, skills, groups | Volunteer coordinator | Serve is registered, not implemented | Volunteer Hub |
| Leadership and AI Clergy | Leadership, AI Clergy, Work Orders and Task Board | Senior pastor / leadership team | Compass and Clarence are registered, not implemented | Conference Room |
| Pastoral care | Care dispatch, requests, life services, prayer | Pastoral care leader; live escalation remains human | Shepherd is implemented | Care Wing (confidential) |
| Giving and Impact Card | Impact Campaigns, statements, Impact Card accounts | Finance / stewardship owner | Steward is implemented; Impact is registered, not implemented | Finance & Impact Card |
| Analytics and impact | Analytics, reports, Executive Overview | Data / leadership owner | Marci is registered, not implemented | Data Room |
| Approvals and decisions | Decision Queue, approvals, calendar | Pastor decides | Grace is implemented | Pastor's Study |
| Facilities | No facilities workflow evidenced | Facilities staff if assigned by a church | None | Washrooms |

## Evidence-backed gaps and boundaries

- **Bidirectional context gap, resolved in this slice:** room panels already
  reach existing GRACE surfaces. The Agent Command Centre can now locate the
  same agent through the shared seating map at `#/workos?tab=campus&room=…`.
- **No forced-module gap:** washrooms remain contextual. Nurseries are linked
  because child check-in and family records already exist; no safeguarding
  capability is claimed beyond what those existing surfaces provide.
- **Role boundary:** current Faithful Church configuration establishes demo
  pastoral identities (including Pastor James Wilson), while WorkOS registry
  entries are system agents. The campus does not represent either as verified
  real-client staffing.
- **Coverage mismatch retained intentionally:** the Platform Annex houses VWS
  platform agents and says so; it is not presented as church staff.

## Implemented thin slice

The sole new connective behavior is a room-addressable campus route plus a
"Locate in …" action on each WorkOS Agent Command Centre card. It reuses the
existing agent seating map, leaves full control-panel detail intact, and adds
no schema, workflow, personnel, or activity claims.

## Human-accountability slice

`campusResponsibilities.ts` is the one configuration registry for the campus
human-accountability layer. It keys each operational department to an
accountable human and optional existing supporting WorkOS agent; rooms and
GRACE routes remain derived from the existing campus maps and bindings.
Assignments without a matching current leadership roster entry are explicitly
marked **Faithful Church demo assignment**. Environmental facilities and the
VWS Platform Annex are deliberately excluded. A later Settings editor should
read and write this registry-backed model rather than create another mapping.
