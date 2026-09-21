function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  })
}

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY) {
    return json({ error: 'Missing RESEND_API_KEY' }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, email, message } = body

  if (!name || !email || !message) {
    return json({ error: 'Missing required fields' }, { status: 400 })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Contact Form <onboarding@resend.dev>',
      to: 'benjaminvanderwesten@gmail.com',
      reply_to: email,
      subject: `message from ${name}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap">${message}</p>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Resend error:', error)
    return json({ error: 'Failed to send email' }, { status: 500 })
  }

  return json({ ok: true })
}
