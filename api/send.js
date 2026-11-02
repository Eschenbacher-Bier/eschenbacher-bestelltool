
import { istAngemeldet } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!istAngemeldet(req)) {
    return res.status(401).json({
      success: false,
      error: "Nicht angemeldet."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      orderId,
      subject,
      html,
      text,
      cc,
      orderData
    } = req.body || {};

    if (
      !subject ||
      !html ||
      !orderData ||
      !Array.isArray(orderData.items) ||
      !orderData.items.length ||
      !/^[0-9a-f-]{36}$/i.test(String(orderId || ""))
    ) {
      return res.status(400).json({
        success: false,
        error: "Unvollständige Bestelldaten oder ungültige Bestell-ID."
      });
    }

    const apiUrl = process.env.BESTELL_API_URL;
    const apiSecret = process.env.BESTELL_API_SECRET;

    if (!apiUrl || !apiSecret) {
      return res.status(503).json({
        success: false,
        error: "Neue Bestell-API ist nicht vollständig konfiguriert."
      });
    }

    // Bestellung zuerst in Google Sheets speichern.
    let storageResponse;
    let storageData;

    try {
      storageResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          type: "saveOrder",
          token: apiSecret,
          orderId,
          orderData
        }),
        redirect: "follow",
        signal: AbortSignal.timeout(20000)
      });

      const responseText = await storageResponse.text();

      try {
        storageData = JSON.parse(responseText);
      } catch {
        throw new Error(
          "Google Sheets hat keine gültige JSON-Antwort geliefert."
        );
      }

    } catch (error) {
      console.error("Bestellspeicherung nicht bestätigt:", error);

      return res.status(502).json({
        success: false,
        error:
          "Bestellspeicherung konnte nicht bestätigt werden. " +
          "Bitte vor erneutem Senden die Bestell-ID in Google Sheets prüfen.",
        orderId
      });
    }

    if (
      !storageResponse.ok ||
      storageData?.success !== true ||
      storageData?.orderId !== orderId
    ) {
      console.error(
        "Bestellspeicherung abgelehnt:",
        storageResponse.status,
        storageData
      );

      return res.status(502).json({
        success: false,
        error: "Google Sheets hat die Bestellspeicherung nicht bestätigt.",
        orderId
      });
    }

    // Bereits gespeicherte Bestellungen nicht erneut mailen.
   

    // =========================================
    // EMPFÄNGER
    // =========================================

    const INTERNAL_TO = [
      "info@eschenbacher.de"
    ];

    const INTERNAL_CC = [
      "o.mahr@eschenbacher.de"
    ];

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
    // E-MAIL
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

    let mailResponse;
    let mailData;

    try {
      mailResponse = await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `order-${orderId}`
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000)
        }
      );

      mailData = await mailResponse.json();

    } catch (error) {
      console.error(
        "Bestellung gespeichert, Mailstatus unklar:",
        error
      );

      return res.status(502).json({
        success: false,
        stored: true,
        orderId,
        error:
          "Bestellung gespeichert, aber E-Mail-Versand " +
          "nicht bestätigt. Bitte Bestellung manuell prüfen, " +
          "nicht erneut absenden."
      });
    }

    if (!mailResponse.ok) {
      console.error(
        "Bestellung gespeichert, E-Mail abgelehnt:",
        mailData
      );

      return res.status(502).json({
        success: false,
        stored: true,
        orderId,
        error:
          "Bestellung gespeichert, aber E-Mail konnte " +
          "nicht versendet werden. Bitte manuell prüfen, " +
          "nicht erneut absenden."
      });
    }

    return res.status(200).json({
      success: true,
      orderId,
      data: mailData
    });

  } catch (error) {
    console.error("Fehler in send.js:", error);

    return res.status(500).json({
      success: false,
      error: "Serverfehler bei der Bestellübertragung."
    });
  }
}
