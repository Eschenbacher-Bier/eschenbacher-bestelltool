
const ALLOWED_SHEETS = ["Kunden", "Artikel"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Methode nicht erlaubt"
    });
  }

  const sheet = String(req.query.sheet || "").trim();

  if (!ALLOWED_SHEETS.includes(sheet)) {
    return res.status(400).json({
      success: false,
      error: "Ungültiger Tabellenname"
    });
  }

  const url = process.env.STAMMDATEN_API_URL;
  const token = process.env.STAMMDATEN_API_SECRET;

  if (!url || !token) {
    return res.status(500).json({
      success: false,
      error: "Stammdaten-Schnittstelle nicht konfiguriert"
    });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ sheet, token }),
      redirect: "follow",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Stammdaten-API nicht erreichbar");
    }

    const result = await response.json();

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error("Stammdaten-API hat keine gültigen Daten geliefert");
    }

    const data = sheet === "Artikel"
      ? result.data.map(artikel => ({
          ArtNr: artikel.ArtNr,
          Name: artikel.Name,
          Kategorie: artikel.Bestellgruppe,
          Bestellgruppe: artikel.Bestellgruppe
        }))
      : result.data;

    return res.status(200).json(data);

  } catch (error) {
    console.error("Stammdatenfehler:", error.message);

    return res.status(502).json({
      success: false,
      error: "Stammdaten konnten nicht geladen werden"
    });
  }
}
