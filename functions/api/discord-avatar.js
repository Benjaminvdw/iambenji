const DISCORD_API = 'https://discord.com/api/v10'

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  })
}

export async function onRequestGet({ env }) {
  if (!env.DISCORD_BOT_TOKEN) return json({ error: 'Missing DISCORD_BOT_TOKEN' }, { status: 500 })
  if (!env.DISCORD_USER_ID) return json({ error: 'Missing DISCORD_USER_ID' }, { status: 500 })

  const response = await fetch(`${DISCORD_API}/users/${env.DISCORD_USER_ID}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  })

  if (!response.ok) return json({ error: 'Discord API error' }, { status: 502 })

  const user = await response.json()

  if (!user.avatar) {
    const defaultIndex = Number(BigInt(env.DISCORD_USER_ID) >> 22n) % 6
    return json({ url: `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png` })
  }

  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png'
  return json({ url: `https://cdn.discordapp.com/avatars/${env.DISCORD_USER_ID}/${user.avatar}.${ext}?size=256` })
}
