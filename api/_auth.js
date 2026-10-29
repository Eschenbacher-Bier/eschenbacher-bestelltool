
import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

export function istAngemeldet(req) {
  const geheimnis = process.env.BESTELLTOOL_SESSION_SECRET;

  if (!geheimnis || geheimnis.length < 32) {
    return false;
  }

  const cookies = String(req.headers.cookie || "")
    .split(";")
    .map(eintrag => eintrag.trim());

  const cookie = cookies.find(eintrag =>
    eintrag.startsWith("esb_session=")
  );

  if (!cookie) return false;

  const token = cookie.slice("esb_session=".length);
  const teile = token.split(".");

  if (teile.length !== 3 || teile[0] !== "v1") {
    return false;
  }

  const [version, ablaufText, signatur] = teile;

  if (!/^\d+$/.test(ablaufText)) {
    return false;
  }

  const ablauf = Number(ablaufText);
  const jetzt = Math.floor(Date.now() / 1000);

  if (
    !Number.isSafeInteger(ablauf) ||
    ablauf <= jetzt ||
    ablauf > jetzt + 7 * 24 * 60 * 60
  ) {
    return false;
  }

  const inhalt = `${version}.${ablaufText}`;

  const erwartet = createHmac("sha256", geheimnis)
    .update(inhalt)
    .digest("base64url");

  const erhaltenBuffer = Buffer.from(signatur);
  const erwartetBuffer = Buffer.from(erwartet);

  if (erhaltenBuffer.length !== erwartetBuffer.length) {
    return false;
  }

  return timingSafeEqual(
    erhaltenBuffer,
    erwartetBuffer
  );
}
