async function findArticleById(articleId) {
  const apiToken =
    "62a0d11599b45d7dc8eca10af7a97e87a1059cf8ec900a497c2e4c28fddd2fe5";
  const collectionId = "64ddde2653f7418145a8970e"; // Articles
  const cmsLocaleId = "658164deee2c1cfd4472cfc4"; // Polski język

  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items/${articleId}?cmsLocaleId=${cmsLocaleId}`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );

  if (!response.ok) {
    console.error("Failed to fetch article:", response.statusText);
    return null;
  }

  const article = await response.json();

  // Normalize the `published` field
  if (article.fieldData && article.fieldData.published) {
    article.published = article.fieldData.published;
    delete article.fieldData.published;
  }

  console.log("Article data (Polish):", article);
  return article;
}

// Call the function with the specific article ID
findArticleById("6807f5b3874424b7c25b337e");
