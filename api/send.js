export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const {
      subject,
      html,
      text,
      cc,
      orderData
    } = req.body || {};

    if (!subject || !html) {
      return res.status(400).json({
        success: false,
        error: "Subject und HTML-Inhalt fehlen."
      });
    }

    // =========================================
    // EMPFÄNGER
    // =========================================

    const INTERNAL_TO = [
      "info@eschenbacher.de"
    ];

    // Feste interne Kopien
    const INTERNAL_CC = [];

    // =========================================
    // CC AUS FORMULAR
    // =========================================

    const userCcList = Array.isArray(cc)
      ? cc
          .map(mail => String(mail).trim())
          .filter(Boolean)
      : [];

    const finalCcList = [
      ...new Set([
        ...INTERNAL_CC,
        ...userCcList
      ])
    ];

    // =========================================
    // MAIL PAYLOAD
    // =========================================

    const payload = {
      from:
        "Eschenbacher Bestelltool <noreply@mail.eschenbacherbier.de>",

      to: INTERNAL_TO,

      subject,

      html,

      text:
        text ||
        "Neue Bestellung über das Eschenbacher Bestelltool."
    };

    if (finalCcList.length > 0) {
      payload.cc = finalCcList;
    }

    // =========================================
    // MAIL SENDEN
    // =========================================

    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${process.env.RESEND_API_KEY}`,

          "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,

        error:
          data?.message ||
          data?.error ||
          "Resend konnte die E-Mail nicht senden.",

        details: data
      });
    }

    // =========================================
    // BESTELLUNG IN GOOGLE SHEETS SPEICHERN
    // =========================================

    if (process.env.SCRIPT_API_URL && orderData) {

      try {

        await fetch(process.env.SCRIPT_API_URL, {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            type: "saveOrder",
            orderData
          })
        });

      } catch (sheetError) {

        console.error(
          "Mail gesendet, aber Speicherung in Google Sheets fehlgeschlagen:",
          sheetError
        );

      }
    }

    // =========================================
    // ERFOLG
    // =========================================

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,

      error:
        error?.message ||
        "Serverfehler beim Senden."
    });

  }
}
