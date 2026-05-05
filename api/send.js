export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { kunde, bestellung, bemerkung } = req.body;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Bestelltool <onboarding@resend.dev>',
      to: ['info@eschenbacher.de'],
      subject: `Neue Bestellung von ${kunde}`,
      html: `
        <h2>Neue Bestellung</h2>
        <p><strong>Kunde:</strong> ${kunde}</p>
        <p><strong>Bestellung:</strong></p>
        <pre>${bestellung}</pre>
        <p><strong>Bemerkung:</strong> ${bemerkung}</p>
      `
    })
  });

  const data = await response.json();

  return res.status(200).json(data);
}
