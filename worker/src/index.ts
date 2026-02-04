// Definicje typów dla TypeScript (żeby VS Code nie krzyczał)
interface Env {
	// Tu możesz zdefiniować zmienne środowiskowe jeśli będziesz ich używać
}

interface WebflowItem {
	id: string;
	fieldData: {
		name?: string;
		slug?: string;
		author?: string;
		category?: string;
		'article-content'?: string;
		'article-excerpt'?: string;
		'main-image'?: { url: string };
		'main-image-credits1'?: string;
		[key: string]: any;
	};
	isDraft?: boolean;
	status?: string;
	createdOn?: string;
}

interface WebflowResponse {
	items: WebflowItem[];
	pagination?: any;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return handleRequest(request);
	},
};

// --- HELPER DO TWORZENIA LINKÓW PROXY ---
function createProxyUrl(originalUrl: string): string {
	if (!originalUrl) return '';
	// Jeśli to już jest proxy link, nie zmieniaj
	if (originalUrl.includes('/sestry-cdn/')) return originalUrl;

	// Domeny Webflow
	const webflowCdns = ['cdn.prod.website-files.com', 'assets.website-files.com', 'uploads-ssl.webflow.com'];
	if (!webflowCdns.some((domain) => originalUrl.includes(domain))) {
		return originalUrl;
	}

	// Pełny link do Twojego Proxy (Głównego Workera)
	const proxyPrefix = 'https://www.sestry.eu/sestry-cdn/w_auto,q_80';

	try {
		const encodedUrl = encodeURI(decodeURIComponent(originalUrl).trim());
		return `${proxyPrefix}/${encodedUrl}`;
	} catch (e) {
		return originalUrl;
	}
}

// Funkcje pomocnicze do API Webflow
async function fetchCategories(apiToken: string, collectionId: string): Promise<Record<string, string>> {
	const response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	const data = (await response.json()) as WebflowResponse;
	return data.items.reduce(
		(map, item) => {
			map[item.id] = item.fieldData.name || item.id;
			return map;
		},
		{} as Record<string, string>,
	);
}

async function fetchAuthors(apiToken: string, collectionId: string, cmsLocaleId: string): Promise<Record<string, string>> {
	let allItems: WebflowItem[] = [];
	let offset = 0;
	const limit = 100;

	while (true) {
		const response = await fetch(
			`https://api.webflow.com/v2/collections/${collectionId}/items?offset=${offset}&limit=${limit}&cmsLocaleId=${cmsLocaleId}`,
			{ headers: { Authorization: `Bearer ${apiToken}` } },
		);
		const data = (await response.json()) as WebflowResponse;
		allItems = allItems.concat(data.items);
		if (data.items.length < limit) break;
		offset += limit;
	}

	return allItems.reduce(
		(map, item) => {
			map[item.id] = item.fieldData.name || `Autor ID: ${item.id}`;
			return map;
		},
		{} as Record<string, string>,
	);
}

function getSupportBannerHTML(): string {
	return `
  <p>[REKLAMA]</p><p>Ten tekst pochodzi z serwisu <a href="https://www.sestry.eu/" style="font-weight:bold; color:#e20000;">Sestry.eu</a></p>
  <p><em> Dzięki Twojemu wsparciu możemy tworzyć więcej wartościowych treści i rozwijać naszą społeczność. <a href="https://patronite.pl/sestry.eu">Dołącz do nas na Patronite!</a> ❤️</em></p>`;
}

// Główna logika
async function handleRequest(request: Request): Promise<Response> {
	const apiToken = '62a0d11599b45d7dc8eca10af7a97e87a1059cf8ec900a497c2e4c28fddd2fe5';
	const collectionId = '64ddde2653f7418145a8970e'; // Articles
	const cmsLocaleId = '658164deee2c1cfd4472cfc4'; // Polski język
	const baseUrl = 'https://www.sestry.eu/pl';

	// Pobieranie danych (Poprawiona literówka poniżej!)
	const categoriesMap = await fetchCategories(apiToken, '64ddde2653f7418145a896f5');
	const authorsMap = await fetchAuthors(apiToken, '64ddde2653f7418145a8970f', cmsLocaleId);

	let allItems: WebflowItem[] = [];
	let offset = 0;
	const limit = 10;
	const validItems: WebflowItem[] = [];

	while (validItems.length < limit) {
		const response = await fetch(
			`https://api.webflow.com/v2/collections/${collectionId}/items?cmsLocaleId=${cmsLocaleId}&isDraft=false&offset=${offset}&limit=${limit}`,
			{ headers: { Authorization: `Bearer ${apiToken}` } },
		);
		const data = (await response.json()) as WebflowResponse;
		allItems = data.items;

		// Jeśli brak itemów, przerywamy pętlę
		if (!allItems || allItems.length === 0) break;

		const filteredItems = allItems.filter((item) => {
			const fieldData = item.fieldData;
			const content = fieldData['article-content'] || '';
			const hasPolishContent = /[ąćęłńóśźż]/i.test(content);
			const hasUkrainianContent = /[ґєіїґЄІЇ]/i.test(content);
			return hasPolishContent && !hasUkrainianContent && !item.isDraft && item.status !== 'scheduled' && item.createdOn;
		});

		validItems.push(...filteredItems);
		if (allItems.length < limit) break;
		offset += limit;
	}

	const finalItems = validItems.slice(0, limit);

	if (!finalItems.length) {
		return new Response('Brak artykułów', { status: 404 });
	}

	// Generowanie XML
	let xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="pl">
  <id>urn:uuid:2bc17842-15b0-4d97-9d5d-92cecd783ee8</id>
  <link rel="alternate" type="text/html" href="${baseUrl}"/>
  <link rel="self" type="application/atom+xml" href="https://sestry.eu/atom"/>
  <title>Sestry PL - Najnowsze artykuły</title>
  <updated>${new Date().toISOString()}</updated>
  <source>
    <id>urn:uuid:98eb1ad5-d7fe-4f04-88ee-dd9f03a69f77</id>
    <title>Sestry PL</title>
    <updated>${new Date().toISOString()}</updated>
  </source>
  <rights>© 2025 Sestry. Wszystkie prawa zastrzeżone.</rights>`;

	finalItems.forEach((item) => {
		const fieldData = item.fieldData;
		xml += `
  <entry>
    <id>urn:uuid:${item.id}</id>
    <link rel="alternate" type="text/html" href="${baseUrl}/${fieldData.slug}"/>
    <title>${fieldData.name || 'Bez tytułu'}</title>
    <updated>${item.createdOn || new Date().toISOString()}</updated>
    <published>${item.createdOn || new Date().toISOString()}</published>`;

		const authorIds = fieldData.author ? fieldData.author.split(',').map((a: string) => a.trim()) : ['Redakcja Sestry'];
		authorIds.forEach((authorId: string) => {
			xml += `
    <author><name>${authorsMap[authorId] || `Autor ID: ${authorId}`}</name></author>`;
		});

		xml += `
    <rights>© 2025 Sestry. Wszystkie prawa zastrzeżone.</rights>`;

		const categoryIds = fieldData.category ? fieldData.category.split(',').map((c: string) => c.trim()) : ['Aktualności'];
		categoryIds.forEach((categoryId: string) => {
			xml += `
    <category term="${categoriesMap[categoryId] || categoryId}" scheme="${baseUrl}/categories"/>`;
		});

		// --- PROXY FIX 1: Lead Image ---
		let leadImage = '';
		if (fieldData['main-image'] && fieldData['main-image'].url) {
			leadImage = createProxyUrl(fieldData['main-image'].url);
		}

		const imageCreditsRaw = fieldData['main-image-credits1'] || '';
		const imageCredits = imageCreditsRaw.replace(/<[^>]+>/g, '').trim() || '';

		if (leadImage) {
			xml += `
    <media:content url="${leadImage}">
      <media:title>${imageCredits}</media:title>
    </media:content>`;
		}

		// Summary
		const summaryRaw = fieldData['article-excerpt'] || '<p>Brak wstępu</p>';
		xml += `
    <summary type="html"><![CDATA[${summaryRaw}]]></summary>`;

		// Content
		const contentRaw = fieldData['article-content'] || '<p>Brak treści</p>';
		const contentWithBanner = contentRaw.replace(/(<\/p>)/i, `$1${getSupportBannerHTML()}`);

		// --- PROXY FIX 2: Content Images ---
		const contentCleaned = contentWithBanner
			.replace(
				/<figure[^>]*>\s*<div[^>]*>\s*<img([^>]*src=["'](.*?)["'][^>]*)>\s*<\/div>\s*(<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?\s*<\/figure>/gi,
				(match: string, imgAttributes: string, srcUrl: string, figcaptionTag: string, figcaptionContent: string) => {
					const proxySrc = createProxyUrl(srcUrl);
					const newFigcaption = figcaptionTag ? `<figcaption>${figcaptionContent}</figcaption>` : '';
					return `<figure><img src="${proxySrc}" alt="">${newFigcaption}</figure>`;
				},
			)
			.replace(/\s+id=["'][^"']*["']/gi, '')
			.replace(/<blockquote>(?!<p>)([\s\S]*?)(?<!<\/p>)<\/blockquote>/gi, '<blockquote><p>$1</p></blockquote>');

		// Dodatkowy replace dla luźnych obrazków
		const contentFinal = contentCleaned.replace(/src="(https:\/\/cdn\.prod\.website-files\.com[^"]+)"/g, (match: string, url: string) => {
			return `src="${createProxyUrl(url)}"`;
		});

		xml += `
    <content type="html"><![CDATA[${contentFinal}]]></content>
  </entry>`;
	});

	xml += `
</feed>`;

	return new Response(xml, {
		headers: { 'Content-Type': 'application/atom+xml; charset=UTF-8' },
	});
}
