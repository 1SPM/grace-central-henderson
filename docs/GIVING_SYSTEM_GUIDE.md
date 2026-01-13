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
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

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

### Year-End Tasks

1. **Early January**: Generate all statements for previous year
2. **Review**: Check for any missing or duplicate entries
3. **Distribute**: Email or mail statements to all donors
4. **Archive**: Export full year data for records

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
| **Campaign** | A fundraising initiative with a goal |
| **Fund** | A category for designating donations |
| **Pledge** | A donor's commitment to give |
| **Recurring** | Automatic repeated donations |
| **Statement** | Tax receipt for donor records |
| **Tithe** | Traditional 10% giving |

---

*Last updated: January 2025*
