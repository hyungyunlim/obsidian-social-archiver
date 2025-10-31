const SITE_URL = 'https://social-archive.junlim.org';

export async function GET() {
	const headers = {
		'Content-Type': 'application/xml',
		'Cache-Control': 'max-age=3600' // Cache for 1 hour
	};

	// Static pages for sitemap
	const staticPages = [
		{ url: '/', changefreq: 'weekly', priority: 1.0 }
	];

	// In a real implementation, you could fetch user list from API
	// and add dynamic user pages here

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
	.map(
		(page) => `	<url>
		<loc>${SITE_URL}${page.url}</loc>
		<changefreq>${page.changefreq}</changefreq>
		<priority>${page.priority}</priority>
		<lastmod>${new Date().toISOString()}</lastmod>
	</url>`
	)
	.join('\n')}
</urlset>`.trim();

	return new Response(sitemap, { headers });
}