async function fetchSlugs() {
  const apiToken =
    "62a0d11599b45d7dc8eca10af7a97e87a1059cf8ec900a497c2e4c28fddd2fe5";
  const collectionId = "64ddde2653f7418145a8970e"; // Articles
  const cmsLocaleId = "658164deee2c1cfd4472cfc4"; // Polski język

  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items?cmsLocaleId=${cmsLocaleId}&isDraft=false`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );
  const items = (await response.json()).items;

  // Filter and sort articles
  const filteredItems = items.filter((item) => {
    const fieldData = item.fieldData;
    const content = fieldData["article-content"] || "";
    const isNotDraft = !item.isDraft;
    return isNotDraft;
  });

  const sortedItems = filteredItems
    .sort((a, b) => {
      const dateA = new Date(a.createdOn || 0).getTime();
      const dateB = new Date(b.createdOn || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 10);

  // Extract slugs
  const slugs = sortedItems.map((item) => item.fieldData.slug);
  console.log(slugs);
  return slugs;
}

// Call the function
fetchSlugs();
