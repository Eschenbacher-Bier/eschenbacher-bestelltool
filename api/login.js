
import {
  createHmac,
  pbkdf2Sync,
  timingSafeEqual
} from "node:crypto";

const SESSION_DURATION = 7 * 24 * 60 * 60;

function pruefePasswort(passwort) {
  const gespeichert = process.env.BESTELLTOOL_PASSWORD_HASH;

  if (!gespeichert) {
    throw new Error("Passwort-Hash nicht konfiguriert.");
  }

  const [verfahren, rundenText, salt64, hash64] =
    gespeichert.split(":");

  if (
    verfahren !== "pbkdf2_sha256" ||
    !/^\d+$/.test(rundenText) ||
    Number(rundenText) !== 600000 ||
    !salt64 ||
    !hash64
  ) {
    throw new Error("Ungültiges Passwort-Hash-Format.");
  }

  const salt = Buffer.from(salt64, "base64");
  const erwartet = Buffer.from(hash64, "base64");

  if (salt.length !== 16 || erwartet.length !== 32) {
    throw new Error("Ungültige Passwort-Hash-Länge.");
  }

  const berechnet = pbkdf2Sync(
    passwort,
    salt,
    600000,
    32,
    "sha256"
  );

  return timingSafeEqual(berechnet, erwartet);
}

function erstelleSitzung() {
  const geheimnis = process.env.BESTELLTOOL_SESSION_SECRET;

  if (!geheimnis || geheimnis.length < 32) {
    throw new Error("Sitzungsschlüssel fehlt.");
  }

  const ablauf = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const inhalt = `v1.${ablauf}`;

  const signatur = createHmac("sha256", geheimnis)
    .update(inhalt)
    .digest("base64url");

  return `${inhalt}.${signatur}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Methode nicht erlaubt."
    });
  }

  try {
    const passwort = req.body?.password;

    if (
      typeof passwort !== "string" ||
      passwort.length === 0 ||
      passwort.length > 256
    ) {
      return res.status(400).json({
        success: false,
        error: "Bitte ein gültiges Passwort eingeben."
      });
    }

    if (!pruefePasswort(passwort)) {
      return res.status(401).json({
        success: false,
        error: "Passwort nicht korrekt."
      });
    }

    const sitzung = erstelleSitzung();

    res.setHeader(
      "Set-Cookie",
      `esb_session=${sitzung}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION}`
    );

    return res.status(200).json({
      success: true,
      message: "Anmeldung erfolgreich."
    });
  } catch (error) {
    console.error("Anmeldefehler:", error.message);

    return res.status(500).json({
      success: false,
      error: "Anmeldung derzeit nicht möglich."
    });
  }
}
