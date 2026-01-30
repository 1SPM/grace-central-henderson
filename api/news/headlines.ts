import type { VercelRequest, VercelResponse } from '@vercel/node';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE = 'https://newsapi.org/v2';

// Rate limiting (simple in-memory, resets on cold start)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per minute (conservative for free tier)
const RATE_WINDOW = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check configuration
  if (!NEWS_API_KEY) {
    return res.status(503).json({ error: 'News service not configured. Add NEWS_API_KEY to environment variables.' });
  }

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { category } = req.query;

  try {
    const params = new URLSearchParams({
      apiKey: NEWS_API_KEY,
      country: 'us',
      pageSize: '10',
    });

    if (category && typeof category === 'string') {
      params.set('category', category);
    }

    const response = await fetch(`${NEWS_API_BASE}/top-headlines?${params}`);

    if (!response.ok) {
      const error = await response.json();
      console.error('NewsAPI error:', error);
      return res.status(response.status).json({
        error: error.message || 'Failed to fetch news'
      });
    }

    const data = await response.json();

    // Transform and filter articles
    const articles = data.articles
      .filter((a: { title: string }) => a.title && a.title !== '[Removed]')
      .map((article: {
        title: string;
        description: string;
        source: { name: string };
        url: string;
        publishedAt: string
      }, index: number) => ({
        id: `news-${Date.now()}-${index}`,
        headline: article.title,
        description: article.description || '',
        source: article.source?.name || 'Unknown',
        url: article.url,
        publishedAt: article.publishedAt,
      }));

    return res.status(200).json({ articles });
  } catch (error) {
    console.error('News fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch news' });
  }
}
