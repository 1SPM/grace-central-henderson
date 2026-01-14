# Grace CRM - Giving & Collection Management Guide

A complete guide to managing church donations, pledges, campaigns, and financial reporting.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Giving Dashboard Overview](#giving-dashboard-overview)
3. [Accepting Online Donations](#accepting-online-donations)
4. [Entering Sunday Collections](#entering-sunday-collections)
5. [Managing Campaigns & Pledges](#managing-campaigns--pledges)
6. [Generating Tax Statements](#generating-tax-statements)
7. [Understanding Analytics](#understanding-analytics)
8. [Charity Baskets](#charity-baskets)
9. [Donation Tracker](#donation-tracker)
10. [Member Donation Statistics](#member-donation-statistics)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Accessing the Giving Module

1. Log into Grace CRM
2. Click **"Giving"** in the left sidebar (dollar sign icon)
3. You'll see the Giving Dashboard with four quick action cards

### User Permissions

| Role | Can View | Can Enter | Can Manage | Can Export |
|------|----------|-----------|------------|------------|
| Admin | ✓ | ✓ | ✓ | ✓ |
| Pastor | ✓ | ✓ | ✓ | ✓ |
| Staff | ✓ | ✓ | Limited | ✓ |
| Volunteer | ✓ | ✗ | ✗ | ✗ |

---

## Giving Dashboard Overview

The dashboard provides a bird's-eye view of your church's generosity:

### Quick Action Cards

| Card | Purpose | When to Use |
|------|---------|-------------|
| **Online Giving** | Donor-facing donation form | Share link with congregation |
| **Batch Entry** | Enter cash/check donations | After each service |
| **Pledges** | Track commitments & campaigns | Capital campaigns, pledges |
| **Statements** | Generate tax receipts | Year-end, on request |

### Key Metrics

- **Total This Period** - Sum of all donations in selected timeframe
- **Monthly Average** - Average giving per month (with year-over-year trend)
- **Recurring Gifts** - Count and total of recurring donations
- **New Donors** - First-time givers in the period

### Period Filter

Use the dropdown to view data for:
- Last 7 Days
- Last 30 Days
- Last Quarter
- Last Year

---

## Accepting Online Donations

### For Church Staff: Sharing the Giving Link

The online giving form can be accessed directly or embedded on your website.

### For Donors: Making a Gift

#### Step 1: Select Amount & Fund

1. Choose a **fund** (where the money goes):
   - **Tithe** - General operating fund
   - **Offering** - General giving
   - **Missions** - Missionary support
   - **Building** - Construction/facilities
   - **Benevolence** - Helping those in need
   - **Youth** - Youth ministry programs
   - **Other** - Designated giving

2. Select a **preset amount** ($25, $50, $100, $250, $500, $1000) or enter a **custom amount**

3. **Optional:** Toggle "Make this recurring" and select frequency:
   - Weekly
   - Monthly
   - Quarterly
   - Annually

4. Click **Continue**

#### Step 2: Enter Your Information

1. Enter your **first name** and **last name**
2. Enter your **email address** (for receipt)
3. **Optional:** Check "Cover processing fees" to ensure 100% goes to the church
4. Click **Continue to Payment**

#### Step 3: Complete Payment

1. Review your donation summary
2. Click **Pay with Card** or **Pay with Bank Account**
3. Enter payment details
4. Submit

#### Step 4: Confirmation

You'll see a confirmation screen and receive an email receipt.

---

## Entering Sunday Collections

Use Batch Entry to record cash and check donations collected during services.

### Creating a New Batch

1. Go to **Giving** → Click **Batch Entry**
2. Click **"New Batch"** (green button, top right)
3. Fill in:
   - **Batch Date** - The date of the service
   - **Batch Name** - e.g., "Sunday AM - January 12"
4. Click **Create Batch**

### Adding Donations to a Batch

1. Select your batch from the left panel (it will highlight green)
2. Click **"Add Item"**
3. Fill in the donation details:

| Field | Required | Description |
|-------|----------|-------------|
| Donor | No | Search by name (leave blank for anonymous) |
| Amount | Yes | Dollar amount |
| Method | Yes | Cash or Check |
| Check # | If check | Check number for tracking |
| Fund | Yes | Which fund to credit |
| Memo | No | Additional notes |

4. Click **Add Donation**
5. Repeat for each envelope/donation

### Batch Summary

As you add items, the batch header updates automatically:
- **Cash Total** - Sum of all cash donations
- **Checks Total** - Sum of all check donations (with count)
- **Grand Total** - Combined total

### Closing a Batch

When all donations are entered and verified:

1. Review the totals against your physical count
2. Click **"Close Batch"**
3. The batch moves to "Recent Closed" and cannot be edited

> **Tip:** Close batches after bank deposit to maintain accurate records.

### Editing Donations

While a batch is open:
- Click the **trash icon** next to any item to remove it
- To modify, remove and re-add with correct information

---

## Managing Campaigns & Pledges

### Understanding the Difference

| Concept | What It Is | Example |
|---------|------------|---------|
| **Campaign** | A fundraising goal with a target amount | "Building Fund 2025 - $500,000" |
| **Pledge** | A donor's commitment to give | "John Smith - $100/month for 12 months" |

### Creating a Campaign

1. Go to **Giving** → Click **Pledges** → **Campaigns tab**
2. Click **"New Campaign"**
3. Fill in:
   - **Campaign Name** - Clear, descriptive name
   - **Description** - Purpose and details
   - **Goal Amount** - Target fundraising amount
   - **Start Date** - When campaign begins
   - **End Date** - When campaign ends (optional)
   - **Fund** - Which fund receives donations
4. Click **Create Campaign**

### Tracking Campaign Progress

Each campaign shows:
- **Progress bar** - Visual representation of goal
- **Amount raised** vs **Goal amount**
- **Percentage complete**
- **Number of pledges**
- **Days remaining** (if end date set)

### Creating a Pledge

1. Go to **Giving** → Click **Pledges** → **Pledges tab**
2. Click **"New Pledge"**
3. Fill in:

| Field | Description |
|-------|-------------|
| **Donor** | Select the person making the pledge |
| **Campaign** | Link to a campaign (optional) |
| **Amount** | Amount per period |
| **Frequency** | One-time, weekly, monthly, quarterly, annually |
| **Start Date** | When pledge begins |
| **End Date** | When pledge ends (optional) |
| **Fund** | Which fund to credit |
| **Notes** | Any additional details |

4. Click **Create Pledge**

### Pledge Fulfillment

The system automatically tracks pledge progress:
- **Total Pledged** - Expected total based on amount × frequency
- **Total Given** - Actual donations linked to this pledge
- **Percentage Complete** - Progress toward commitment
- **Status** - Active, Completed, or Cancelled

### Managing Pledges

| Action | How | When |
|--------|-----|------|
| View progress | Check the progress bar | Anytime |
| Mark complete | Click checkmark icon | When fully paid |
| Cancel | Click trash icon | If donor cancels |
| Filter by campaign | Use dropdown at top | To see specific campaign pledges |

---

## Generating Tax Statements

### When to Generate Statements

- **Year-end** - January, for previous tax year
- **On request** - When donors ask for their records
- **Quarterly** - Some donors prefer regular updates

### Generating a Single Statement

1. Go to **Giving** → Click **Statements**
2. Select the **year** from the dropdown
3. Find the donor in the list
4. Click the **eye icon** to preview
5. Review the statement:
   - Donor information
   - Contribution summary by fund
   - Detailed transaction list
   - Tax disclaimer
6. Click **Download PDF** or use email/print buttons

### Bulk Statement Generation

1. Use the **checkboxes** to select multiple donors
2. Or click **"Select All"** in the header
3. Click **"Generate"** to create all statements
4. Click **"Send"** to distribute:
   - **Email** - Sends PDF as attachment
   - **Print** - Downloads combined PDF for printing

### Statement Contents

Each statement includes:
- Church name, address, and contact info
- Donor name and address
- Tax year
- Summary table by fund
- Detailed transaction list with dates
- Total contributions
- Tax-deductible disclaimer
- Generation date

### Statement Status

| Status | Meaning |
|--------|---------|
| **Pending** | Not yet generated |
| **Generated** | Created but not sent |
| **Sent** | Delivered via email or print |

---

## Understanding Analytics

### Fund Breakdown

Shows how donations are distributed across funds:
- **Visual progress bars** for each fund
- **Dollar amounts** and **percentages**
- Helps identify giving patterns

### Monthly Trend

Bar chart showing giving over time:
- **Height** = donation amount
- **Pattern** reveals seasonal trends
- Useful for budget planning

### Key Metrics Explained

| Metric | Calculation | What It Tells You |
|--------|-------------|-------------------|
| **Monthly Average** | Total ÷ Months | Typical monthly giving |
| **Year-over-Year** | (This Year - Last Year) ÷ Last Year | Growth or decline |
| **Donor Retention** | Returning ÷ Previous Period | Loyalty rate |
| **Avg Gift Size** | Total ÷ Number of Gifts | Typical donation |
| **New Donors** | First-time givers | Outreach effectiveness |

### Exporting Data

Click **"Export"** to download:
- All giving records as CSV
- Opens in Excel/Google Sheets
- Includes: Date, Donor, Amount, Fund, Method

---

## Charity Baskets

Charity Baskets help your church organize and distribute care packages to those in need. Track donations of physical items, manage inventory, and coordinate distribution.

### Accessing Charity Baskets

1. Go to **Giving** → Click **Charity Baskets** in the Additional Tools row
2. You'll see the basket management dashboard with filters and basket list

### Basket Types

| Type | Purpose | Examples |
|------|---------|----------|
| **Food** | Food pantry assistance | Canned goods, non-perishables |
| **Holiday** | Seasonal care packages | Thanksgiving meals, Christmas gifts |
| **Emergency** | Urgent need assistance | Disaster relief, crisis support |
| **School** | Back-to-school supplies | Backpacks, notebooks, supplies |
| **Baby** | New parent support | Diapers, formula, clothing |
| **Household** | Home essentials | Cleaning supplies, bedding |
| **Other** | Miscellaneous baskets | Custom care packages |

### Creating a New Basket

1. Click **"New Basket"** (green button, top right)
2. Fill in the basket details:

| Field | Required | Description |
|-------|----------|-------------|
| **Basket Name** | Yes | Descriptive name (e.g., "Holiday Food Drive - Smith Family") |
| **Basket Type** | Yes | Select from dropdown |
| **Target Date** | No | When the basket should be ready |
| **Recipient Name** | No | Who will receive the basket |
| **Description** | No | Additional details or special needs |

3. Click **Create Basket**

### Basket Workflow

Each basket progresses through four statuses:

```
Collecting → Ready → Distributed → (or Cancelled)
```

| Status | Meaning | Actions Available |
|--------|---------|-------------------|
| **Collecting** | Actively accepting donations | Add items, edit basket |
| **Ready** | Complete and ready to deliver | Mark as distributed |
| **Distributed** | Delivered to recipient | View only |
| **Cancelled** | No longer needed | View only |

### Adding Items to a Basket

1. Click on a basket to expand it (or click the **+** button)
2. Click **"Add Item"**
3. Fill in item details:

| Field | Required | Description |
|-------|----------|-------------|
| **Item Name** | Yes | What was donated (e.g., "Canned Vegetables") |
| **Category** | Yes | Food, Clothing, Hygiene, Household, School, Baby, Gift, Other |
| **Quantity** | Yes | Number of items |
| **Unit** | No | Measurement (cans, boxes, items, pairs) |
| **Donor Name** | No | Who donated this item |
| **Estimated Value** | No | Dollar value for tracking |
| **Notes** | No | Additional details |

4. Click **Add Item**

### Tracking Item Donations

Each basket displays:
- **Total Items** - Count of all items in the basket
- **Total Value** - Sum of estimated item values
- **Donors** - List of people who contributed

### Item Categories

| Category | Examples |
|----------|----------|
| **Food** | Canned goods, pasta, rice, cereal |
| **Clothing** | Shirts, pants, jackets, shoes |
| **Hygiene** | Soap, shampoo, toothpaste, deodorant |
| **Household** | Towels, sheets, cleaning supplies |
| **School** | Notebooks, pencils, backpacks |
| **Baby** | Diapers, formula, bottles, onesies |
| **Gift** | Toys, games, gift cards |
| **Other** | Miscellaneous items |

### Distributing a Basket

When a basket is ready for delivery:

1. Ensure basket status is **"Ready"**
2. Click the **truck icon** (Distribute button)
3. The basket moves to **"Distributed"** status
4. Distribution date and time are recorded automatically

### Filtering Baskets

Use the filter options at the top:
- **By Type** - Show only specific basket types
- **By Status** - Show only collecting, ready, distributed, or all

### Best Practices for Charity Baskets

- **Name baskets descriptively** - Include recipient name and purpose
- **Set target dates** - Helps with planning and prioritization
- **Track donors** - Enables thank-you notes and recognition
- **Estimate values** - Useful for reporting and tax purposes
- **Add notes** - Record special dietary needs or preferences

---

## Donation Tracker

The Donation Tracker provides a powerful search and filter interface for all monetary donations, helping you analyze giving patterns and find specific transactions.

### Accessing the Donation Tracker

1. Go to **Giving** → Click **Donation Tracker** in the Additional Tools row
2. You'll see the search interface with filters and transaction list

### Quick Date Filters

Use the preset date buttons for quick filtering:

| Button | Range | Use Case |
|--------|-------|----------|
| **7D** | Last 7 days | Recent activity review |
| **30D** | Last 30 days | Monthly summary |
| **90D** | Last 90 days | Quarterly review |
| **1Y** | Last year | Annual trends |
| **All** | All time | Complete history |

### Search Functionality

The search bar searches across:
- Donor names (first and last)
- Fund names
- Payment methods
- Transaction notes

Type any keyword and results filter instantly.

### Advanced Filters

Click the **filter icon** to access advanced filtering:

| Filter | Options | Description |
|--------|---------|-------------|
| **Date Range** | Custom start/end dates | Specific time period |
| **Fund** | Tithe, Offering, Missions, etc. | By designation |
| **Method** | Cash, Check, Card, Online | By payment type |
| **Min Amount** | Dollar value | Minimum donation |
| **Max Amount** | Dollar value | Maximum donation |
| **Recurring Only** | Toggle | Show only recurring gifts |

### Transaction List

Each donation shows:
- **Donor Name** - Who gave (or "Anonymous")
- **Amount** - Dollar value
- **Fund** - Where it was designated
- **Method** - How it was paid
- **Date** - When it was given
- **Recurring Icon** - If it's a recurring donation

### Daily Trend Chart

The chart at the top shows:
- **Bar height** = Total donations per day
- **X-axis** = Dates in selected range
- **Hover** = See exact amount for each day

Use this to identify:
- Peak giving days (usually Sundays)
- Seasonal patterns
- Special event giving spikes

### Summary Statistics

The tracker displays:
- **Total Donations** - Sum of filtered transactions
- **Transaction Count** - Number of donations
- **Average Gift** - Mean donation amount
- **Unique Donors** - Number of distinct givers

### Exporting Filtered Results

After applying filters:
1. Click **"Export"** button
2. Download CSV with filtered transactions
3. Includes all visible fields

### Use Cases

| Scenario | How to Filter |
|----------|--------------|
| Find all checks over $500 | Method: Check, Min Amount: 500 |
| December giving for year-end | Date: Dec 1 - Dec 31 |
| All missions fund donations | Fund: Missions |
| First-time donors this month | 30D filter, sort by date |
| Recurring donor analysis | Toggle: Recurring Only |

---

## Member Donation Statistics

Member Donation Statistics provides per-member analytics, helping you understand individual giving patterns and identify opportunities for stewardship.

### Accessing Member Stats

1. Go to **Giving** → Click **Member Stats** in the Additional Tools row
2. You'll see a searchable, sortable list of all donors

### Understanding the Member List

Each member row displays:

| Column | Description |
|--------|-------------|
| **Name** | Member's full name |
| **Lifetime Total** | All-time giving |
| **This Year** | Current year donations |
| **Last Year** | Previous year total |
| **YoY Change** | Year-over-year trend (↑ or ↓ %) |
| **Giving Streak** | Consecutive months with gifts |
| **Primary Fund** | Their most common designation |

### Sorting Options

Click column headers to sort by:
- **Lifetime** - Find top all-time donors
- **This Year** - Current year leaders
- **YoY Change** - Biggest growth or decline
- **Streak** - Most consistent givers

### Member Detail View

Click any member row to see their full profile:

#### Giving Summary Card
- **Lifetime Total** with gift count
- **This Year** vs **Last Year** comparison
- **Year-over-Year Change** percentage
- **Average Gift** size
- **Largest Gift** ever
- **Giving Streak** (consecutive months)

#### Monthly Giving Chart
- Bar chart of last 12 months
- Shows giving patterns and consistency
- Identify seasonal trends

#### Fund Breakdown
- Pie chart of fund distribution
- Dollar amounts and percentages
- Shows primary giving interests

#### Additional Information
- **First Gift Date** - When they started giving
- **Last Gift Date** - Most recent donation
- **Preferred Method** - How they usually give
- **Preferred Fund** - Where they usually designate

### Key Metrics Explained

| Metric | What It Means | Why It Matters |
|--------|---------------|----------------|
| **Giving Streak** | Months in a row with at least one gift | Indicates commitment and consistency |
| **YoY Change** | Percentage change from last year | Shows engagement trajectory |
| **Avg Gift** | Mean donation amount | Helps set ask amounts |
| **Preferred Fund** | Most frequently chosen designation | Reveals ministry interests |

### Use Cases for Member Stats

#### Stewardship Follow-up
- Filter by **negative YoY change** to identify donors who may be struggling or disengaging
- Reach out with pastoral care, not asking for money

#### Major Donor Cultivation
- Sort by **Lifetime Total** to identify top givers
- Review their fund preferences for personalized asks

#### New Donor Welcome
- Filter by **First Gift Date** in recent months
- Send personal thank-you and connection opportunities

#### Consistency Recognition
- Sort by **Giving Streak** to find most faithful givers
- Consider recognizing long streaks privately

#### Year-End Planning
- Compare **This Year** vs **Last Year** trends
- Identify growth areas and concerns for budget planning

### Privacy Considerations

- Member giving data is confidential
- Only authorized staff should access these reports
- Never share individual giving details publicly
- Use aggregated data for board reports

---

## Best Practices

### Weekly Workflow

| Day | Task |
|-----|------|
| **Sunday** | Create batch, enter donations after each service |
| **Monday** | Verify batch totals, close batches, make deposit |
| **Ongoing** | Record online donations (automatic if Stripe connected) |

### Monthly Tasks

- Review giving dashboard trends
- Follow up on behind-schedule pledges
- Send thank-you notes to first-time donors
- Check campaign progress
- Review member stats for declining YoY donors
- Update charity basket inventory
- Use donation tracker to verify all entries

### Charity Basket Workflow

| Phase | Tasks |
|-------|-------|
| **Planning** | Create basket, set target date, identify recipient needs |
| **Collection** | Share donation requests, add items as received, track donors |
| **Assembly** | Review items, mark basket as Ready when complete |
| **Distribution** | Deliver basket, click Distribute to record completion |

### Year-End Tasks

1. **Early January**: Generate all statements for previous year
2. **Review**: Check for any missing or duplicate entries
3. **Distribute**: Email or mail statements to all donors
4. **Archive**: Export full year data for records
5. **Baskets**: Review distributed baskets, close any open baskets from prior year

### Data Quality Tips

- **Always search for existing donors** before creating new records
- **Use consistent fund designations** for accurate reporting
- **Enter check numbers** to help with reconciliation
- **Add memos** for unusual or designated gifts
- **Close batches promptly** after bank deposit

---

## Troubleshooting

### Common Issues

**Q: I can't find a donor in the search**
- Try searching by first OR last name only
- Check for spelling variations
- The donor may need to be added in People first

**Q: My batch totals don't match the physical count**
- Review each entry for typos
- Check that all envelopes were entered
- Verify cash vs check designation

**Q: A pledge shows wrong progress**
- Donations must be linked to the pledge
- Check if donations went to the correct fund
- Verify donation dates are within pledge period

**Q: Statement shows wrong year**
- Verify the year dropdown selection
- Check that donation dates are correct
- Donations are assigned by transaction date, not entry date

**Q: Export file won't open**
- Try opening with Google Sheets
- Check that the download completed
- The file is CSV format, not Excel native

**Q: Can't add items to a charity basket**
- Make sure the basket status is "Collecting"
- Baskets in "Ready" or "Distributed" status cannot accept new items
- Create a new basket if needed

**Q: Charity basket shows $0 total value**
- Estimated values are optional for each item
- Add values when entering items to see totals
- You can edit items to add missing values

**Q: Member stats show wrong year-over-year change**
- YoY compares current calendar year to previous
- Make sure donation dates are recorded correctly
- Allow a few moments for calculations to update

**Q: Donation tracker not showing all donations**
- Check your date range filter
- Clear the search box if you've been searching
- Reset advanced filters by clicking "Clear Filters"

**Q: Giving streak seems incorrect**
- Streak counts consecutive months with at least one gift
- A zero-giving month breaks the streak
- Streak restarts from the next donation

### Getting Help

- Check this guide first
- Contact your church administrator
- Report bugs at the Grace CRM GitHub repository

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` | Go to Giving |
| `/` | Open search |
| `Esc` | Close modal |
| `N` | New person |

---

## Glossary

| Term | Definition |
|------|------------|
| **Batch** | A group of donations entered together |
| **Basket** | A care package of physical items for those in need |
| **Basket Item** | An individual donated item within a charity basket |
| **Campaign** | A fundraising initiative with a goal |
| **Distribution** | The act of delivering a charity basket to a recipient |
| **Fund** | A category for designating donations |
| **Giving Streak** | Consecutive months with at least one donation |
| **In-Kind Donation** | Non-monetary gifts like food, clothing, or supplies |
| **Pledge** | A donor's commitment to give |
| **Recurring** | Automatic repeated donations |
| **Statement** | Tax receipt for donor records |
| **Tithe** | Traditional 10% giving |
| **YoY Change** | Year-over-year percentage change in giving |

---

*Last updated: January 2026*
