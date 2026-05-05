export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { text, cc } = req.body;

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ message: "API Key fehlt!" });
    }

    // 👉 CC aktuell deaktiviert (Resend Testmodus erlaubt nur eigene Mail)
    const toEmail = "o.mahr@eschenbacher.de";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Bestelltool <onboarding@resend.dev>", // MUSS so bleiben im Testmodus!
        to: [toEmail],
        subject: "Neue Bestellung Außendienst",
        text: text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ message: data.message || "Fehler beim Senden" });
    }

    return res.status(200).json({ message: "Mail erfolgreich gesendet!" });

  } catch (error) {
    return res.status(500).json({ message: "Serverfehler", error: error.message });
  }
}
