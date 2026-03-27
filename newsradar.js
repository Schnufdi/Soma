export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const feeds = [
    { name: 'Reuters',  url: 'https://feeds.reuters.com/reuters/businessNews' },
    { name: 'BBC',      url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: 'Guardian', url: 'https://www.theguardian.com/uk/business/rss' },
    { name: 'Sky',      url: 'https://feeds.skynews.com/feeds/rss/business.xml' },
    { name: 'Economist', url: 'https://www.economist.com/finance-and-economics/rss.xml' },
  ];

  const headlines = [];
  const fetchedAt = new Date().toISOString();

  await Promise.allSettled(feeds.map(async (feed) => {
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'MacroLens/1.0 RSS Reader' },
        signal: AbortSignal.timeout(3000),
      });
      const xml = await r.text();
      const itemMatches = [...xml.matchAll(/<item[\s\S]*?<\/item>/gm)];
      for (const item of itemMatches.slice(0, 12)) {
        const raw = item[0];
        const titleM = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        const title = (titleM?.[1] || '').trim()
          .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/<!\[CDATA\[|\]\]>/g,'')
          .replace(/<[^>]+>/g,'').trim();
        const linkM = raw.match(/<link[^>]*>(?:<!\[CDATA\[)?(https?:\/\/[^\s<\]]+)/);
        const guidM = raw.match(/<guid[^>]*isPermaLink="true"[^>]*>(https?:\/\/[^\s<]+)<\/guid>/);
        const link = (linkM?.[1] || guidM?.[1] || '').replace(/\]\]>.*/,'').trim();
        const dateM = raw.match(/<pubDate[^>]*>(.*?)<\/pubDate>/);
        const pubDate = dateM?.[1]?.trim() || '';
        const descM = raw.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
        const description = (descM?.[1] || '').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&')
          .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").trim().substring(0, 300);
        if (title && title.length > 10) {
          headlines.push({ source: feed.name, title, link, pubDate, description });
        }
      }
    } catch(e) { console.error(`Feed error ${feed.name}:`, e.message); }
  }));

  if (!headlines.length) {
    return res.status(200).json({ error: 'Could not fetch any RSS feeds', themes: [], intelligence: null, fetchedAt });
  }

  // Fetch article content for top stories (non-paywalled)
  const fetchable = headlines
    .filter(h => h.link && !h.link.includes('economist.com') && !h.link.includes('ft.com'))
    .slice(0, 12);

  await Promise.allSettled(fetchable.map(async (h) => {
    try {
      const r = await fetch(h.link, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MacroLens/1.0)', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(3500),
      });
      if (!r.ok) return;
      const html = await r.text();
      let clean = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '')
        .replace(/<figure[\s\S]*?<\/figure>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ').trim();
      const sentences = clean.match(/[A-Z][^.!?]*[.!?]/g) || [];
      const articleText = sentences.filter(s => s.length > 40 && s.length < 400).slice(0, 15).join(' ');
      if (articleText.length > 200) {
        h.articleText = articleText.substring(0, 1000);
        h.fetchedFull = true;
      }
    } catch(e) {}
  }));

  const enrichedText = headlines.map((h, i) => {
    let entry = `${i}. [${h.source}] ${h.title}`;
    if (h.articleText) entry += `\n   ARTICLE: ${h.articleText}`;
    else if (h.description && h.description.length > 50) entry += `\n   SUMMARY: ${h.description}`;
    return entry;
  }).join('\n\n');

  // Parallel: Haiku clusters + Sonnet synthesises
  const [clusterRes, intelRes] = await Promise.allSettled([

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: `Cluster these news stories into 4-6 dominant themes. Use article text where available for accuracy.
Return ONLY valid JSON:
{"themes":[{"name":"2-4 words","emoji":"emoji","dominance":"Dominant|Major|Emerging|Background","storyCount":5,"signal":"one sentence macro signal using specific data from articles","color":"red|orange|amber|blue|teal|green","headlineIndices":[0,3,7]}]}
Rules: order by storyCount desc, signal must be analytical not descriptive, color: red=crisis, orange=energy/commodity, amber=fiscal/policy, blue=markets/rates, teal=corporate, green=opportunity`,
        messages: [{ role: 'user', content: `Stories:\n${enrichedText}\n\nReturn JSON:` }],
      }),
      signal: AbortSignal.timeout(25000),
    }).then(r => r.json()),

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: `You are a senior macro strategist. You have news stories with article text where available. Use specific data points, quotes, and figures in your analysis.

DO NOT summarise. SYNTHESISE. PROJECT consequences. Work at system level.

Return ONLY valid JSON:
{
  "direction": ["bullet 1 — structural shift with specific data","bullet 2","bullet 3","bullet 4"],
  "dynamics": [
    {"trigger":"X with specific figure","mechanism":"Y","outcome":"Z"},
    {"trigger":"X","mechanism":"Y","outcome":"Z"}
  ],
  "becoming": [
    {"state":"A [state] is locking in","why":"explanation with data"},
    {"state":"...","why":"..."}
  ],
  "watchNext": ["specific indicator with timeframe","..."],
  "dislocation": ["where markets/consensus are wrong — with evidence"],
  "systemMood":"Tightening|Fracturing|Pivoting|Accelerating|Deteriorating",
  "systemMoodLabel":"one decisive sentence with specific data points"
}`,
        messages: [{ role: 'user', content: `Stories with article content:\n${enrichedText}\n\nSynthesize into forward intelligence JSON:` }],
      }),
      signal: AbortSignal.timeout(35000),
    }).then(r => r.json()),
  ]);

  let themes = [], intelligence = null;

  if (clusterRes.status === 'fulfilled') {
    const d = clusterRes.value;
    console.log('Cluster raw:', JSON.stringify(d).substring(0, 200));
    if (!d.error) {
      try {
        const text = d.content?.[0]?.text || '{}';
        const parsed = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
        themes = (parsed.themes || []).map(theme => ({
          ...theme,
          headlines: (theme.headlineIndices || [])
            .filter(i => i >= 0 && i < headlines.length)
            .map(i => ({
              source: headlines[i].source,
              title: headlines[i].title,
              link: headlines[i].link,
              pubDate: headlines[i].pubDate,
            })),
        }));
      } catch(e) { console.error('Cluster parse:', e.message); }
    } else { console.error('Cluster AI error:', d.error); }
  }

  if (intelRes.status === 'fulfilled') {
    const d = intelRes.value;
    if (!d.error) {
      try {
        const text = d.content?.[0]?.text || '{}';
        intelligence = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
      } catch(e) { console.error('Intel parse:', e.message); }
    } else { console.error('Intel AI error:', d.error); }
  }

  return res.status(200).json({
    themes,
    intelligence,
    totalHeadlines: headlines.length,
    fetchedAt,
    sources: [...new Set(headlines.map(h => h.source))],
    rawHeadlines: headlines.map(h => ({
      source: h.source,
      title: h.title,
      link: h.link,
      url: h.link,
      pubDate: h.pubDate,
      description: h.description,
    })),
  });
}
