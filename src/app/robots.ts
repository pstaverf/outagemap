import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/profile', '/login'] }, sitemap: `${process.env.AUTH_URL ?? 'http://localhost:3000'}/sitemap.xml` }; }
