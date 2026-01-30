/**
 * News Service - Fetches news from NewsAPI and uses AI to find Biblical connections
 */

import { generateAIText } from './ai';

export interface NewsArticle {
  id: string;
  headline: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface CuratedNewsItem {
  id: string;
  headline: string;
  connection: string;
  category: string;
  scripture?: string;
  source: string;
  url: string;
}

const NEWS_API_BASE = 'https://newsapi.org/v2';

/**
 * Get the NewsAPI key from localStorage
 */
export function getNewsApiKey(): string | null {
  return localStorage.getItem('newsapi-key');
}

/**
 * Save the NewsAPI key to localStorage
 */
export function setNewsApiKey(key: string): void {
  localStorage.setItem('newsapi-key', key);
}

/**
 * Check if NewsAPI key is configured
 */
export function hasNewsApiKey(): boolean {
  const key = getNewsApiKey();
  return !!key && key.length > 10;
}

/**
 * Fetch top headlines from NewsAPI
 */
export async function fetchNewsHeadlines(category?: string): Promise<NewsArticle[]> {
  const apiKey = getNewsApiKey();

  if (!apiKey) {
    throw new Error('NewsAPI key not configured');
  }

  const params = new URLSearchParams({
    apiKey,
    country: 'us',
    pageSize: '10',
  });

  if (category) {
    params.set('category', category);
  }

  try {
    const response = await fetch(`${NEWS_API_BASE}/top-headlines?${params}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch news');
    }

    const data = await response.json();

    return data.articles
      .filter((a: { title: string; description: string }) => a.title && a.title !== '[Removed]')
      .map((article: { title: string; description: string; source: { name: string }; url: string; publishedAt: string }, index: number) => ({
        id: `news-${Date.now()}-${index}`,
        headline: article.title,
        description: article.description || '',
        source: article.source?.name || 'Unknown',
        url: article.url,
        publishedAt: article.publishedAt,
      }));
  } catch (error) {
    console.error('NewsAPI error:', error);
    throw error;
  }
}

/**
 * Use AI to find Biblical connections for a news headline
 */
export async function findBiblicalConnection(headline: string, description: string): Promise<{
  connection: string;
  scripture: string;
  category: string;
}> {
  const prompt = `Analyze this news headline and find a meaningful Biblical connection for a church sermon:

Headline: "${headline}"
${description ? `Summary: "${description}"` : ''}

Respond in this exact JSON format (no markdown):
{
  "connection": "A brief 1-2 sentence explanation of how this connects to Biblical themes or teachings",
  "scripture": "One relevant Bible verse reference (e.g., 'Romans 12:15' or 'Philippians 4:6-7')",
  "category": "One word category: Community, Faith, Hope, Love, Justice, Peace, Family, or Wisdom"
}

Be thoughtful and find genuine connections that would resonate with a congregation. Focus on themes of hope, compassion, faith, community, and God's love.`;

  try {
    const result = await generateAIText({ prompt, maxTokens: 300 });

    if (result.success && result.text) {
      // Parse JSON from response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          connection: parsed.connection || 'Consider how this relates to our faith journey.',
          scripture: parsed.scripture || 'Proverbs 3:5-6',
          category: parsed.category || 'Faith',
        };
      }
    }
  } catch (error) {
    console.error('AI curation error:', error);
  }

  // Fallback
  return {
    connection: 'Consider how this story connects to themes of community and faith.',
    scripture: 'Romans 8:28',
    category: 'Faith',
  };
}

/**
 * Fetch news and curate with Biblical connections
 */
export async function fetchCuratedNews(maxItems: number = 5): Promise<CuratedNewsItem[]> {
  const articles = await fetchNewsHeadlines();
  const curatedItems: CuratedNewsItem[] = [];

  // Process articles in parallel (limit to maxItems)
  const articlesToProcess = articles.slice(0, maxItems);

  const results = await Promise.all(
    articlesToProcess.map(async (article) => {
      const { connection, scripture, category } = await findBiblicalConnection(
        article.headline,
        article.description
      );

      return {
        id: article.id,
        headline: article.headline,
        connection: `${connection} (${scripture})`,
        category,
        scripture,
        source: article.source,
        url: article.url,
      };
    })
  );

  curatedItems.push(...results);
  return curatedItems;
}

/**
 * Default fallback news items when API is not available
 */
export const fallbackNewsItems: CuratedNewsItem[] = [
  {
    id: 'fallback-1',
    headline: 'Community Rallies Together After Local Tragedy',
    connection: 'Connect to bearing one another\'s burdens (Galatians 6:2) and the power of community in grief',
    category: 'Community',
    scripture: 'Galatians 6:2',
    source: 'Sample',
    url: '#',
  },
  {
    id: 'fallback-2',
    headline: 'Mental Health Awareness Highlights Growing Needs',
    connection: 'Link to casting anxieties on God (1 Peter 5:7) and finding peace that surpasses understanding',
    category: 'Hope',
    scripture: '1 Peter 5:7',
    source: 'Sample',
    url: '#',
  },
  {
    id: 'fallback-3',
    headline: 'Economic Uncertainty Causes Widespread Anxiety',
    connection: 'Tie to Matthew 6:25-34 - do not worry about tomorrow, God provides',
    category: 'Faith',
    scripture: 'Matthew 6:25-34',
    source: 'Sample',
    url: '#',
  },
  {
    id: 'fallback-4',
    headline: 'Acts of Kindness Going Viral on Social Media',
    connection: 'Encourage congregation with examples of light in darkness (Matthew 5:14-16)',
    category: 'Love',
    scripture: 'Matthew 5:14-16',
    source: 'Sample',
    url: '#',
  },
];
