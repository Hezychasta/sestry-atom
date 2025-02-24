const { create } = require("xmlbuilder2");
const axios = require("axios");
require("dotenv").config(); // Dodaj to, aby załadować zmienne środowiskowe

// Konfiguracja
const apiToken = process.env.API_TOKEN; // Zmieniono na wartość z .env
const collectionId = "64ddde2653f7418145a8970e"; // Articles
const cmsLocaleId = "658164deee2c1cfd4472cfc4"; // Polski język
const baseUrl = "https://pl.sestry.eu"; // Polska domena

// Pobieranie danych z Webflow API v2
async function fetchWebflowItems() {
  try {
    const response = await axios.get(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        params: {
          cmsLocaleId: cmsLocaleId,
          isDraft: false, // Tylko opublikowane artykuły
        },
      }
    );
    return response.data.items;
  } catch (error) {
    console.error(
      "Błąd podczas pobierania danych:",
      error.response?.data || error.message
    );
    return [];
  }
}

// Generowanie pliku ATOM z jednym najnowszym artykułem
async function generateAtomFeed() {
  const items = await fetchWebflowItems();

  // Sortowanie po dacie aktualizacji (od najnowszego) i wybór pierwszego
  const sortedItems = items
    .filter((item) => {
      // Opcjonalnie: sprawdź, czy treść ma polskie znaki (np. ą, ć, ł)
      const content = item.fieldData["article-content"] || "";
      const hasPolishChars = /[ąćęłńóśźż]/i.test(content);
      return hasPolishChars; // Tylko artykuły z polskimi znakami
    })
    .sort((a, b) => new Date(b.updatedOn) - new Date(a.updatedOn)); // Najnowszy pierwszy

  const latestItem = sortedItems[0]; // Bierzemy tylko jeden artykuł
  if (!latestItem) {
    console.log("Brak opublikowanych artykułów po polsku.");
    return;
  }

  const feed = create({ version: "1.0", encoding: "utf-8" })
    .ele("feed", {
      xmlns: "http://www.w3.org/2005/Atom",
      "xmlns:media": "http://search.yahoo.com/mrss/",
    })
    .ele("id")
    .txt("urn:uuid:2bc17842-15b0-4d97-9d5d-92cecd783ee8")
    .up()
    .ele("link", { rel: "alternate", type: "text/html", href: baseUrl })
    .up()
    .ele("link", {
      rel: "self",
      type: "application/atom+xml",
      href: `${baseUrl}/atom`,
    })
    .up()
    .ele("title")
    .txt("Sestry PL - Najnowszy artykuł")
    .up()
    .ele("updated")
    .txt(new Date().toISOString())
    .up();

  // Dodajemy jeden artykuł
  const fieldData = latestItem.fieldData;
  const entry = feed
    .ele("entry")
    .ele("id")
    .txt(`urn:uuid:${latestItem.id}`)
    .up()
    .ele("link", {
      rel: "alternate",
      type: "text/html",
      href: `${baseUrl}/${fieldData.slug}`,
    })
    .up()
    .ele("title")
    .txt(fieldData.name || "Bez tytułu")
    .up()
    .ele("updated")
    .txt(latestItem.updatedOn)
    .up()
    .ele("published")
    .txt(latestItem.createdOn)
    .up();

  entry
    .ele("content", { type: "html" })
    .txt(`<![CDATA[${fieldData["article-content"] || "<p>Brak treści</p>"}]]>`)
    .up();

  const xml = feed.end({ prettyPrint: true });
  const fs = require("fs");
  fs.writeFileSync("atom.xml", xml);
  console.log("Plik atom.xml z najnowszym artykułem został wygenerowany!");
}

generateAtomFeed();
