
import { istAngemeldet } from "./_auth.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Methode nicht erlaubt."
    });
  }

  return res.status(200).json({
    authenticated: istAngemeldet(req)
  });
}
