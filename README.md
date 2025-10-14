# EmbedRoleBot

A Discord bot that manages role embeds with automatic updates when users are given or removed from roles.

## Features

- Create role list embeds with customizable titles and colors
- Automatically update embeds when roles are added or removed from users
- Support for up to 5 roles per embed
- Guild-specific command deployment
- Ephemeral responses for privacy

## Setup Instructions

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure Environment Variables**

   - Copy the `.env` file and fill in your bot credentials:

   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   GUILD_ID=your_guild_id_here
   ```

3. **Deploy Commands**

   ```bash
   npm run deploy
   ```

4. **Start the Bot**
   ```bash
   npm start
   ```

## Bot Permissions Required

Make sure your bot has the following permissions:

- `Send Messages`
- `Use Slash Commands`
- `Manage Roles`
- `Read Message History`
- `Embed Links`

## Commands

### `/role-list-create`

Creates a new role list embed.

**Parameters:**

- `title` (required): The title of the embed
- `role1` (required): First role to track
- `role2-5` (optional): Additional roles to track
- `channel` (optional): Channel to send the embed to (defaults to current channel)
- `color` (optional): Embed color in hex format (e.g., #ff0000)

**Example:**

```
/role-list-create title:"Football Team" role1:@Goalkeeper role2:@Defender channel:#team-roles color:#00ff00
```

### `/updaterole`

Toggles a role for a user and updates all relevant embeds.

**Parameters:**

- `user` (required): The user to toggle the role for
- `role` (required): The role to toggle

**Example:**

```
/updaterole user:@JohnDoe role:@Goalkeeper
```

## How It Works

1. Use `/role-list-create` to create an embed that tracks specific roles
2. The embed will show all users who currently have each role
3. Use `/updaterole` to add or remove roles from users
4. All embeds tracking that role will automatically update to reflect the changes
5. The bot stores embed data in memory to track which embeds need updates

## File Structure

```
EmbedRoleBot/
├── commands/
│   └── roles/
│       ├── role-list-create.js
│       └── updaterole.js
├── deploy-commands.js
├── index.js
├── package.json
└── .env
```

## Notes

- The bot uses guild-specific command deployment for faster command updates
- All responses are ephemeral to keep channels clean
- The bot requires "Manage Roles" permission to function properly
- Embed data is stored in memory and will be lost when the bot restarts
