/**
 * Perplexity AI Service
 *
 * Handles AI-powered content analysis using Perplexity API
 *
 * Single Responsibility: Perplexity API communication and AI analysis
 */

import type { Bindings } from '@/types/bindings';
import type { AIAnalysis, FactCheck, PostData } from '@/types/post';
import { Logger } from '@/utils/logger';

export interface PerplexityConfig {
  apiKey: string;
  model?: string;
  timeout?: number;
}

export interface AnalysisOptions {
  enableFactCheck?: boolean;
  enableDeepResearch?: boolean;
  maxTokens?: number;
}

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityRequest {
  model: string;
  messages: PerplexityMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PerplexityService {
  private config: PerplexityConfig;
  private logger: Logger;
  private endpoint = 'https://api.perplexity.ai/chat/completions';

  constructor(env: Bindings, logger: Logger) {
    if (!env.PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is required');
    }

    this.config = {
      apiKey: env.PERPLEXITY_API_KEY,
      model: 'llama-3.1-sonar-large-128k-online',
      timeout: 60000, // 60 seconds
    };
    this.logger = logger;
  }

  /**
   * Analyze post content with AI
   */
  async analyzePost(postData: PostData, options: AnalysisOptions = {}): Promise<AIAnalysis> {
    this.logger.info('Analyzing post with Perplexity AI', {
      platform: postData.platform,
      postId: postData.id,
      enableFactCheck: options.enableFactCheck,
    });

    const startTime = Date.now();

    try {
      // Build analysis prompt
      const prompt = this.buildAnalysisPrompt(postData, options);

      // Call Perplexity API
      const response = await this.callAPI(prompt, options);

      // Parse AI response
      const analysis = this.parseAnalysis(response);

      const processingTime = Date.now() - startTime;
      this.logger.info('Post analysis completed', {
        platform: postData.platform,
        postId: postData.id,
        processingTime,
        sentiment: analysis.sentiment,
        topicsCount: analysis.topics.length,
      });

      return analysis;

    } catch (error) {
      this.logger.error('Failed to analyze post', {
        platform: postData.platform,
        postId: postData.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform deep research on post content
   */
  async deepResearch(postData: PostData): Promise<AIAnalysis> {
    this.logger.info('Performing deep research', {
      platform: postData.platform,
      postId: postData.id,
    });

    try {
      const prompt = this.buildDeepResearchPrompt(postData);
      const response = await this.callAPI(prompt, {
        maxTokens: 2000,
        enableDeepResearch: true,
      });

      const analysis = this.parseAnalysis(response, true);

      this.logger.info('Deep research completed', {
        platform: postData.platform,
        postId: postData.id,
        factChecksCount: analysis.factCheck?.length || 0,
      });

      return analysis;

    } catch (error) {
      this.logger.error('Deep research failed', {
        platform: postData.platform,
        postId: postData.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(postData: PostData, options: AnalysisOptions): PerplexityMessage[] {
    const systemPrompt = `You are an expert social media content analyzer. Analyze the provided post and return a JSON object with the following structure:
{
  "summary": "A concise 2-3 sentence summary of the post",
  "sentiment": "positive|negative|neutral|mixed",
  "topics": ["topic1", "topic2", ...],
  "keyPoints": ["point1", "point2", ...]${options.enableFactCheck ? ',\n  "factCheck": [{"claim": "...", "verdict": "true|false|misleading|unverified", "sources": ["..."], "explanation": "..."}]' : ''}
}

Be objective, factual, and concise. Only include fact-checking if claims that require verification are found.`;

    const userPrompt = `Platform: ${postData.platform}
Author: ${postData.author.name}${postData.author.handle ? ` (@${postData.author.handle})` : ''}
Posted: ${postData.metadata.timestamp}

Content:
${postData.content.text}

${postData.media.length > 0 ? `Media: ${postData.media.length} ${postData.media[0]?.type || 'media'}(s)` : ''}

Engagement:
- Likes: ${postData.metadata.likes || 0}
- Comments: ${postData.metadata.comments || 0}
- Shares: ${postData.metadata.shares || 0}${postData.metadata.views ? `\n- Views: ${postData.metadata.views}` : ''}

Please analyze this post and provide your response in the specified JSON format.`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * Build deep research prompt
   */
  private buildDeepResearchPrompt(postData: PostData): PerplexityMessage[] {
    const systemPrompt = `You are an expert researcher and fact-checker. Perform deep analysis on the provided social media post. Search for credible sources, verify claims, and provide comprehensive fact-checking.

Return a JSON object with this structure:
{
  "summary": "Detailed summary with context",
  "sentiment": "positive|negative|neutral|mixed",
  "topics": ["topic1", "topic2", ...],
  "keyPoints": ["point1", "point2", ...],
  "factCheck": [
    {
      "claim": "The specific claim being checked",
      "verdict": "true|false|misleading|unverified",
      "sources": ["https://credible-source-1.com", "https://credible-source-2.com"],
      "explanation": "Detailed explanation with evidence"
    }
  ]
}

Use your online search capabilities to find recent, credible sources. Be thorough and objective.`;

    const userPrompt = `Platform: ${postData.platform}
Author: ${postData.author.name}
Posted: ${postData.metadata.timestamp}
URL: ${postData.url}

Content:
${postData.content.text}

Please perform deep research and fact-checking on this post. Verify any claims made and provide credible sources.`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * Call Perplexity API
   */
  private async callAPI(
    messages: PerplexityMessage[],
    options: AnalysisOptions
  ): Promise<PerplexityResponse> {
    const request: PerplexityRequest = {
      model: options.enableDeepResearch
        ? 'llama-3.1-sonar-large-128k-online'
        : this.config.model!,
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: 0.2,
      top_p: 0.9,
      stream: false,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Parse AI analysis response
   */
  private parseAnalysis(response: PerplexityResponse, includeFactCheck = false): AIAnalysis {
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Perplexity response');
    }

    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```json\n?(.*?)\n?```/s) || content.match(/\{.*\}/s);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      const analysis: AIAnalysis = {
        summary: parsed.summary || 'No summary available',
        sentiment: this.validateSentiment(parsed.sentiment),
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : undefined,
      };

      // Add fact-checking if available
      if (includeFactCheck && Array.isArray(parsed.factCheck)) {
        analysis.factCheck = parsed.factCheck.map((fc: any) => ({
          claim: fc.claim || '',
          verdict: this.validateVerdict(fc.verdict),
          sources: Array.isArray(fc.sources) ? fc.sources : [],
          explanation: fc.explanation || '',
        }));
      }

      return analysis;

    } catch (error) {
      this.logger.warn('Failed to parse AI response as JSON, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to basic analysis
      return {
        summary: content.substring(0, 300),
        sentiment: 'neutral',
        topics: [],
      };
    }
  }

  /**
   * Validate sentiment value
   */
  private validateSentiment(sentiment: any): AIAnalysis['sentiment'] {
    const valid = ['positive', 'negative', 'neutral', 'mixed'];
    return valid.includes(sentiment) ? sentiment : 'neutral';
  }

  /**
   * Validate fact-check verdict
   */
  private validateVerdict(verdict: any): FactCheck['verdict'] {
    const valid = ['true', 'false', 'misleading', 'unverified'];
    return valid.includes(verdict) ? verdict : 'unverified';
  }
}
