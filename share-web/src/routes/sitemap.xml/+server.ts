import { env } from '$env/dynamic/private';

const SITE_URL = 'https://social-archive.junlim.org';

export async function GET() {
	const headers = {
		'Content-Type': 'application/xml',
		'Cache-Control': 'max-age=3600' // Cache for 1 hour
	};

	// In a real implementation, you would fetch user list from API
	// For now, we'll create a basic sitemap with static pages
	const staticPages = [
		{ url: '/', changefreq: 'weekly', priority: 1.0 },
		{ url: '/share', changefreq: 'daily', priority: 0.8 }
	];

	// You could also fetch dynamic user pages here
	// const apiUrl = env.VITE_API_URL || 'https://social-archiver-api.junlim.org';
	// const users = await fetchPublicUsers(apiUrl);

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