# AFK Bot for Aternos

## Overview
A Minecraft AFK bot built with [mineflayer](https://github.com/PrismarineJS/mineflayer). It connects to a Minecraft server (designed for Aternos but works elsewhere) and periodically moves around so the bot is not kicked for inactivity. A small Express keep-alive web server runs alongside the bot.

The bot only supports Minecraft 1.16.5 servers out of the box. For other versions, install the ViaVersion / ViaRewind plugins on the server.

## Project Structure
- `index.js` — Main entry point. Boots the Express keep-alive server (via `keep_alive.js`) and starts the mineflayer bot.
- `keep_alive.js` — Tiny Express server that returns "Afk bot!" so the workflow keeps a port open.
- `config.json` — Holds the Minecraft server `ip`, `port` and the bot `name`. **You must update `ip` to point to your real server before the bot can connect.**
- `package.json` — Node project manifest. Dependencies: `mineflayer`, `express`, `config`, `fs`.

## Replit Setup
- Runtime: Node.js 20 (configured in `.replit` modules).
- Workflow `Start application` runs `node index.js` and serves the keep-alive page on port `5000` (host `0.0.0.0`).
- Deployment target: `vm` (always-on) with run command `node index.js`. This is required because the bot must stay connected continuously.

## Notes
- `config.json` ships with placeholder `yourip.aternos.me` — until that is updated, the bot will fail to connect (an error like `ECONNRESET` is logged) but the keep-alive server still serves correctly. Update the IP, then restart the workflow.
- The keep-alive HTTP port is read from `process.env.PORT` if set, otherwise defaults to `5000`.
