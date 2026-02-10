import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Text-to-Give Webhook Handler
 *
 * Handles incoming SMS messages for text-to-give donations.
 * Integrates with Twilio for SMS and processes giving keywords.
 *
 * Usage:
 * - Configure this URL as your Twilio SMS webhook
 * - Members text a keyword (e.g., "GIVE 50") to your Twilio number
 * - System responds with a giving link or processes saved payment method
 *
 * Supported formats:
 * - GIVE          - Returns giving link
 * - GIVE 50       - Returns giving link with amount pre-filled
 * - GIVE 50 MISSIONS - Returns giving link with amount and fund
 * - HELP          - Returns help message
 */

interface TwilioSmsRequest {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  AccountSid: string;
}

interface TextToGiveConfig {
  churchName: string;
  givingPageUrl: string;
  funds: { keyword: string; name: string; id: string }[];
  defaultFund?: string;
  welcomeMessage?: string;
  helpMessage?: string;
}

// TwiML response helper
function twimlResponse(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Parse amount from message (handles $50, 50, 50.00, etc.)
function parseAmount(str: string): number | null {
  const cleaned = str.replace(/[$,]/g, '').trim();
  const amount = parseFloat(cleaned);
  return isNaN(amount) || amount <= 0 ? null : amount;
}

// Default configuration (in production, load from database)
function getConfig(churchId: string): TextToGiveConfig {
  return {
    churchName: 'Grace Church',
    givingPageUrl: process.env.GIVING_PAGE_URL || 'https://give.example.com',
    funds: [
      { keyword: 'tithe', name: 'General Fund', id: 'general' },
      { keyword: 'missions', name: 'Missions Fund', id: 'missions' },
      { keyword: 'building', name: 'Building Fund', id: 'building' },
      { keyword: 'youth', name: 'Youth Ministry', id: 'youth' },
    ],
    defaultFund: 'general',
    welcomeMessage: "Thank you for giving! Here's your personalized giving link:",
    helpMessage: `Text-to-Give Commands:
• GIVE - Get giving link
• GIVE 50 - Give $50 to General Fund
• GIVE 50 MISSIONS - Give $50 to Missions
• FUNDS - List available funds
• HELP - Show this message`,
  };
}

// Build giving URL with parameters
function buildGivingUrl(
  baseUrl: string,
  amount?: number,
  fundId?: string,
  phone?: string
): string {
  const url = new URL(baseUrl);
  if (amount) url.searchParams.set('amount', amount.toString());
  if (fundId) url.searchParams.set('fund', fundId);
  if (phone) url.searchParams.set('phone', phone);
  return url.toString();
}

// Process the text message and generate response
function processMessage(
  body: string,
  fromPhone: string,
  config: TextToGiveConfig
): string {
  const parts = body.trim().toUpperCase().split(/\s+/);
  const command = parts[0];

  // HELP command
  if (command === 'HELP' || command === '?') {
    return config.helpMessage || 'Text GIVE to get started.';
  }

  // FUNDS command - list available funds
  if (command === 'FUNDS' || command === 'FUND') {
    const fundList = config.funds.map((f) => `• ${f.keyword.toUpperCase()} - ${f.name}`).join('\n');
    return `Available funds:\n${fundList}\n\nExample: GIVE 50 MISSIONS`;
  }

  // GIVE command
  if (command === 'GIVE' || command === 'G') {
    let amount: number | undefined;
    let fundId = config.defaultFund;
    let fundName = 'General Fund';

    // Check for amount (second part)
    if (parts[1]) {
      const parsedAmount = parseAmount(parts[1]);
      if (parsedAmount) {
        amount = parsedAmount;
      } else {
        // Maybe it's a fund keyword instead
        const fund = config.funds.find((f) => f.keyword.toUpperCase() === parts[1]);
        if (fund) {
          fundId = fund.id;
          fundName = fund.name;
        }
      }
    }

    // Check for fund keyword (second or third part)
    if (parts[2]) {
      const fund = config.funds.find((f) => f.keyword.toUpperCase() === parts[2]);
      if (fund) {
        fundId = fund.id;
        fundName = fund.name;
      }
    } else if (parts[1] && !amount) {
      // If second part wasn't an amount, check if it's a fund
      const fund = config.funds.find((f) => f.keyword.toUpperCase() === parts[1]);
      if (fund) {
        fundId = fund.id;
        fundName = fund.name;
      }
    }

    // Build response
    const givingUrl = buildGivingUrl(config.givingPageUrl, amount, fundId, fromPhone);

    let response = config.welcomeMessage || 'Thank you for giving!';
    response += '\n\n';

    if (amount) {
      response += `Amount: $${amount.toFixed(2)}\n`;
    }
    response += `Fund: ${fundName}\n\n`;
    response += givingUrl;

    return response;
  }

  // Unknown command - provide help
  return `Hi! To give, text:\n• GIVE - Get giving link\n• GIVE 50 - Give $50\n• HELP - More options\n\n${config.churchName}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Twilio sends POST for incoming messages
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const twilioData = req.body as TwilioSmsRequest;
    const { From: fromPhone, Body: messageBody, To: toPhone } = twilioData;

    if (!fromPhone || !messageBody) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get configuration (in production, lookup by toPhone to get church-specific config)
    const config = getConfig('default');

    // Process the message
    const responseMessage = processMessage(messageBody, fromPhone, config);

    // Log the interaction (in production, save to database)
    console.log('Text-to-Give:', {
      from: fromPhone,
      to: toPhone,
      message: messageBody,
      response: responseMessage.substring(0, 100) + '...',
    });

    // Return TwiML response
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twimlResponse(responseMessage));
  } catch (error) {
    console.error('Text-to-Give error:', error);

    // Return error as TwiML so user gets feedback
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(
      twimlResponse('Sorry, there was an error processing your request. Please try again.')
    );
  }
}
