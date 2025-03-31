addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function fetchCategories(apiToken, collectionId) {
  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );
  const data = await response.json();
  return data.items.reduce((map, item) => {
    map[item.id] = item.fieldData.name || item.id;
    return map;
  }, {});
}

async function fetchAuthors(apiToken, collectionId, cmsLocaleId) {
  let allItems = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items?offset=${offset}&limit=${limit}&cmsLocaleId=${cmsLocaleId}`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    );
    const data = await response.json();
    console.log(
      `Fetched authors, offset: ${offset}, items: ${data.items.length}, IDs:`,
      data.items.map((item) => item.id)
    );
    allItems = allItems.concat(data.items);
    if (data.items.length < limit) break;
    offset += limit;
  }

  return allItems.reduce((map, item) => {
    map[item.id] = item.fieldData.name || `Autor ID: ${item.id}`;
    return map;
  }, {});
}

async function handleRequest(request) {
  const apiToken =
    "62a0d11599b45d7dc8eca10af7a97e87a1059cf8ec900a497c2e4c28fddd2fe5";
  const collectionId = "64ddde2653f7418145a8970e"; // Articles
  const cmsLocaleId = "658164deee2c1cfd4472cfc4"; // Polski język
  const baseUrl = "https://pl.sestry.eu"; // Polska subdomena

  // Pobieranie map autorów i kategorii
  const categoriesMap = await fetchCategories(
    apiToken,
    "64ddde2653f7418145a896f5"
  ); // Categories
  const authorsMap = await fetchAuthors(
    apiToken,
    "64ddde2653f7418145a8970f",
    cmsLocaleId
  ); // Authors

  // Pobieranie danych z Webflow API v2
  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items?cmsLocaleId=${cmsLocaleId}&isDraft=false`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );
  const items = (await response.json()).items;

  // Filtrowanie tylko artykułów przetłumaczonych na polski i opublikowanych
  const filteredItems = items.filter((item) => {
    const fieldData = item.fieldData;
    const content = fieldData["article-content"] || "";
    const hasPolishContent =
      /[ąćęłńóśźż]/i.test(content) && !/[іїєґ]/i.test(content);
    return hasPolishContent && !item.isDraft;
  });

  // Sortowanie po updatedOn (od najnowszego) i wybór 10 pierwszych
  const sortedItems = filteredItems
    .sort((a, b) => new Date(b.updatedOn) - new Date(a.updatedOn))
    .slice(0, 10);

  if (!sortedItems.length) {
    return new Response(
      "Brak opublikowanych i przetłumaczonych artykułów po polsku",
      { status: 404 }
    );
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

  // Dodawanie 10 entries
  sortedItems.forEach((item) => {
    const fieldData = item.fieldData;
    xml += `
  <entry>
    <id>urn:uuid:${item.id}</id>
    <link rel="alternate" type="text/html" href="${baseUrl}/${fieldData.slug}"/>
    <title>${fieldData.name || "Bez tytułu"}</title>
    <updated>${item.updatedOn || new Date().toISOString()}</updated>
    <published>${item.createdOn || new Date().toISOString()}</published>`;

    // Autorzy
    const authorIds = fieldData.author
      ? fieldData.author.split(",").map((author) => author.trim())
      : ["Redakcja Sestry"];
    authorIds.forEach((authorId) => {
      const authorName = authorsMap[authorId] || `Autor ID: ${authorId}`;
      console.log(`Mapping author ${authorId} to ${authorName}`);
      xml += `
    <author>
      <name>${authorName}</name>
    </author>`;
    });

    // Rights
    xml += `
    <rights>© 2025 Sestry. Wszystkie prawa zastrzeżone.</rights>`;

    // Category
    const categoryIds = fieldData.category
      ? fieldData.category.split(",").map((cat) => cat.trim())
      : ["Aktualności"];
    categoryIds.forEach((categoryId) => {
      const categoryName = categoriesMap[categoryId] || categoryId;
      xml += `
    <category term="${categoryName}" scheme="${baseUrl}/categories"/>`;
    });

    // Media:content (główne zdjęcie artykułu – bez zmian)
    const leadImageObj = fieldData["main-image"] || null;
    const leadImage =
      leadImageObj && typeof leadImageObj === "object" && leadImageObj.url
        ? leadImageObj.url
        : "";
    const imageCreditsRaw = fieldData["main-image-credits1"] || "";
    const imageCredits = imageCreditsRaw.replace(/<[^>]+>/g, "").trim() || "";
    if (leadImage) {
      xml += `
    <media:content url="${leadImage}">
      <media:title>${imageCredits}</media:title>
    </media:content>`;
    }

    // Summary (lead artykułu)
    const summaryRaw = fieldData["article-lead"] || "<p>Brak wstępu</p>";
    xml += `
    <summary type="html"><![CDATA[${summaryRaw}]]></summary>`;

    // Content (modyfikacja zdjęć w treści artykułu)
    const contentRaw = fieldData["article-content"] || "<p>Brak treści</p>";
    // Upraszczamy strukturę <figure> w treści
    const contentCleaned = contentRaw.replace(
      /<figure[^>]*>\s*<div[^>]*>\s*<img([^>]*src=["'][^"']+["'][^>]*)>\s*<\/div>\s*(<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?\s*<\/figure>/gi,
      (match, imgAttributes, figcaptionTag, figcaptionContent) => {
        // Wyciągamy atrybut src z img
        const srcMatch = imgAttributes.match(/src=["'](.*?)["']/i);
        const src = srcMatch ? srcMatch[1] : "";
        // Składamy nowy znacznik <figure> z uproszczonym <img> i <figcaption>
        const newFigcaption = figcaptionTag
          ? `<figcaption>${figcaptionContent}</figcaption>`
          : "";
        return `<figure><img src="${src}" alt="">${newFigcaption}</figure>`;
      }
    );
    xml += `
    <content type="html"><![CDATA[${contentCleaned}]]></content>
  </entry>`;
  });

  xml += `
</feed>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/atom+xml; charset=UTF-8" },
  });
}
