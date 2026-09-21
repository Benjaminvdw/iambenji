# IamBenji

My personal website and blog — a React + Vite frontend with a Cloudflare Pages Functions backend.

## Features

- Diary / blog with Markdown and an admin editor
- Interactive globe with visitor pins (three.js)
- Post-it board, chalkboard with sketch-to-place drawing
- Spotify "now playing", visitor counter, mood and links widgets
- Contact form (Resend)

## Stack

React 19, Vite, React Router, three.js, Cloudflare Pages Functions, Cloudflare KV.

## Running locally

```sh
npm install
cp .env.example .dev.vars   # fill in your own values
npm run dev:pages
```
