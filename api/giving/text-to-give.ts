import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

interface TextToGiveLogEntry {
  from: string;
  to: string | undefined;
  churchId: string;
  messageSid: string | undefined;
  messagePreview: string;
  messageLength: number;
  responsePreview: string;
}

interface TextToGiveConfig {
  churchName: string;
  givingPageUrl: string;
  funds: { keyword: string; name: string; id: string }[];
  defaultFund?: string;
  welcomeMessage?: string;
  helpMessage?: string;
  optOutMessage?: string;
  restartMessage?: string;
}

interface ChurchPhoneMap {
  [phoneNumber: string]: string;
}

const DEFAULT_CHURCH_ID = process.env.TEXT_TO_GIVE_DEFAULT_CHURCH_ID || 'default';
const OPT_OUT_COMMANDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const RESTART_COMMANDS = new Set(['START', 'UNSTOP']);

let cachedChurchPhoneMapRaw: string | undefined;
let cachedChurchPhoneMap: ChurchPhoneMap = {};

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

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function getScopedEnvVar(churchId: string, key: string): string | undefined {
  const envVarSuffix = churchId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return process.env[`${key}_${envVarSuffix}`];
}

function getChurchPhoneMap(): ChurchPhoneMap {
  const rawMap = process.env.TEXT_TO_GIVE_CHURCH_PHONE_MAP;

  if (!rawMap) {
    cachedChurchPhoneMapRaw = undefined;
    cachedChurchPhoneMap = {};
    return cachedChurchPhoneMap;
  }

  if (cachedChurchPhoneMapRaw === rawMap) {
    return cachedChurchPhoneMap;
  }

  try {
    const parsed = JSON.parse(rawMap) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('TEXT_TO_GIVE_CHURCH_PHONE_MAP must be a JSON object');
    }

    const normalizedEntries = Object.entries(parsed as Record<string, unknown>)
      .map(([phone, churchId]) => {
        if (typeof churchId !== 'string' || !churchId.trim()) {
          return null;
        }

        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
          return null;
        }

        return [normalizedPhone, churchId.trim()] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry));

    cachedChurchPhoneMapRaw = rawMap;
    cachedChurchPhoneMap = Object.fromEntries(normalizedEntries);
    return cachedChurchPhoneMap;
  } catch (error) {
    console.error('Invalid TEXT_TO_GIVE_CHURCH_PHONE_MAP:', error);
    cachedChurchPhoneMapRaw = rawMap;
    cachedChurchPhoneMap = {};
    return cachedChurchPhoneMap;
  }
}

function getChurchIdFromRecipientPhone(toPhone?: string): string {
  if (!toPhone) {
    return DEFAULT_CHURCH_ID;
  }

  const churchPhoneMap = getChurchPhoneMap();
  const normalizedToPhone = normalizePhone(toPhone);

  return churchPhoneMap[normalizedToPhone] || DEFAULT_CHURCH_ID;
}

function createMessagePreview(message: string, maxLength = 100): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}...`;
}

function createLogEntry(
  fromPhone: string,
  toPhone: string | undefined,
  churchId: string,
  messageSid: string | undefined,
  messageBody: string,
  responseMessage: string
): TextToGiveLogEntry {
  return {
    from: fromPhone,
    to: toPhone,
    churchId,
    messageSid,
    messagePreview: createMessagePreview(messageBody),
    messageLength: messageBody.length,
    responsePreview: createMessagePreview(responseMessage),
  };
}

// Default configuration (in production, load from database)
function getConfig(churchId: string): TextToGiveConfig {
  const scopedGivingPageUrl = getScopedEnvVar(churchId, 'GIVING_PAGE_URL');

  return {
    churchName: getScopedEnvVar(churchId, 'CHURCH_NAME') || 'Grace Church',
    givingPageUrl: scopedGivingPageUrl || process.env.GIVING_PAGE_URL || 'https://give.example.com',
    funds: [
      { keyword: 'tithe', name: 'General Fund', id: 'general' },
      { keyword: 'missions', name: 'Missions Fund', id: 'missions' },
      { keyword: 'building', name: 'Building Fund', id: 'building' },
      { keyword: 'youth', name: 'Youth Ministry', id: 'youth' },
    ],
    defaultFund:
      getScopedEnvVar(churchId, 'TEXT_TO_GIVE_DEFAULT_FUND') ||
      process.env.TEXT_TO_GIVE_DEFAULT_FUND ||
      'general',
    welcomeMessage:
      getScopedEnvVar(churchId, 'TEXT_TO_GIVE_WELCOME_MESSAGE') ||
      process.env.TEXT_TO_GIVE_WELCOME_MESSAGE ||
      "Thank you for giving! Here's your personalized giving link:",
    helpMessage:
      getScopedEnvVar(churchId, 'TEXT_TO_GIVE_HELP_MESSAGE') ||
      process.env.TEXT_TO_GIVE_HELP_MESSAGE ||
      `Text-to-Give Commands:
• GIVE - Get giving link
• GIVE 50 - Give $50 to General Fund
• GIVE 50 MISSIONS - Give $50 to Missions
• FUNDS - List available funds
• HELP - Show this message`,
    optOutMessage:
      getScopedEnvVar(churchId, 'TEXT_TO_GIVE_OPT_OUT_MESSAGE') ||
      process.env.TEXT_TO_GIVE_OPT_OUT_MESSAGE ||
      'You have been unsubscribed from text-to-give messages. Reply START to re-subscribe.',
    restartMessage:
      getScopedEnvVar(churchId, 'TEXT_TO_GIVE_RESTART_MESSAGE') ||
      process.env.TEXT_TO_GIVE_RESTART_MESSAGE ||
      'Welcome back! You are subscribed to text-to-give messages again. Reply GIVE to get started.',
  };
}

// Build giving URL with parameters
function buildGivingUrl(
  baseUrl: string,
  amount?: number,
  fundId?: string,
  phone?: string
): string {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    url = new URL('https://give.example.com');
  }

  if (amount) url.searchParams.set('amount', amount.toString());
  if (fundId) url.searchParams.set('fund', fundId);
  if (phone) url.searchParams.set('phone', phone);
  return url.toString();
}

function resolveDefaultFund(config: TextToGiveConfig): { id?: string; name: string } {
  if (!config.defaultFund) {
    return { id: undefined, name: 'General Fund' };
  }

  const matchedDefaultFund = config.funds.find((fund) => fund.id === config.defaultFund);
  if (matchedDefaultFund) {
    return { id: matchedDefaultFund.id, name: matchedDefaultFund.name };
  }

  return { id: config.defaultFund, name: config.defaultFund };
}

function normalizeCommand(rawCommand: string): string {
  return rawCommand.replace(/[^A-Z0-9?]/g, '');
}

function normalizeToken(rawToken: string): string {
  return rawToken.replace(/[^A-Z0-9]/g, '');
}

// Process the text message and generate response
function processMessage(
  body: string,
  fromPhone: string,
  config: TextToGiveConfig
): string {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return config.helpMessage || 'Text GIVE to get started.';
  }

  const parts = trimmedBody.toUpperCase().split(/\s+/);
  const command = normalizeCommand(parts[0]);
  const secondToken = parts[1] ? normalizeToken(parts[1]) : undefined;
  const thirdToken = parts[2] ? normalizeToken(parts[2]) : undefined;

  // Twilio compliance and subscription commands
  if (OPT_OUT_COMMANDS.has(command)) {
    return config.optOutMessage || 'You have been unsubscribed. Reply START to re-subscribe.';
  }

  if (RESTART_COMMANDS.has(command)) {
    return config.restartMessage || 'Welcome back! Reply GIVE to get started.';
  }

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
    const defaultFund = resolveDefaultFund(config);
    let fundId = defaultFund.id;
    let fundName = defaultFund.name;

    // Check for amount (second part)
    if (parts[1]) {
      const parsedAmount = parseAmount(parts[1]);
      if (parsedAmount) {
        amount = parsedAmount;
      } else {
        // Maybe it's a fund keyword instead
        const fund = config.funds.find((f) => f.keyword.toUpperCase() === secondToken);
        if (fund) {
          fundId = fund.id;
          fundName = fund.name;
        }
      }
    }

    // Check for fund keyword (second or third part)
    if (parts[2]) {
      const fund = config.funds.find((f) => f.keyword.toUpperCase() === thirdToken);
      if (fund) {
        fundId = fund.id;
        fundName = fund.name;
      }
    } else if (parts[1] && !amount) {
      // If second part wasn't an amount, check if it's a fund
      const fund = config.funds.find((f) => f.keyword.toUpperCase() === secondToken);
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
    const { From: fromPhone, Body: messageBody, To: toPhone, MessageSid: messageSid } = twilioData;

    if (!fromPhone || messageBody === undefined || messageBody === null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get configuration by recipient number (supports multi-church text-to-give setup)
    const churchId = getChurchIdFromRecipientPhone(toPhone);
    const config = getConfig(churchId);

    // Process the message
    const responseMessage = processMessage(messageBody, fromPhone, config);

    // Log the interaction
    const logEntry = createLogEntry(fromPhone, toPhone, churchId, messageSid, messageBody, responseMessage);
    console.log('Text-to-Give:', logEntry);

    // Persist to Supabase (non-blocking — don't delay TwiML response)
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const defaultChurchUuid = process.env.TEXT_TO_GIVE_DEFAULT_CHURCH_UUID;

    if (supabaseUrl && supabaseKey && defaultChurchUuid) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Determine command category for ai_category
      const trimmedBody = messageBody.trim().toUpperCase();
      const firstWord = trimmedBody.split(/\s+/)[0] || '';
      let category = 'unknown';
      if (firstWord === 'GIVE' || firstWord === 'G') category = 'give';
      else if (firstWord === 'HELP' || firstWord === '?') category = 'help';
      else if (firstWord === 'FUNDS' || firstWord === 'FUND') category = 'funds';
      else if (OPT_OUT_COMMANDS.has(firstWord)) category = 'opt-out';
      else if (RESTART_COMMANDS.has(firstWord)) category = 'restart';

      supabase
        .from('inbound_messages')
        .insert({
          church_id: defaultChurchUuid,
          channel: 'sms',
          from_address: fromPhone,
          body: messageBody,
          ai_category: `text-to-give:${category}`,
          ai_suggested_response: responseMessage,
          status: 'processed',
          received_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) {
            console.error('Text-to-Give DB insert failed:', error.message);
          }
        });
    }

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
