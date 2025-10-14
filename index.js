const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Create a new client instance
const client = new Client({ 
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions
	] 
});

client.commands = new Collection();

// Load commands
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Store embed data globally for persistence
client.roleEmbeds = new Map();
client.eventData = new Map();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
});

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Command interaction handler
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error('Command execution error:', error);
		
		try {
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
			} else {
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
			}
		} catch (replyError) {
			console.error('Failed to send error message to user:', replyError);
		}
	}
});

// Handle button interactions
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isButton()) return;

	const customId = interaction.customId;
	
	if (customId.startsWith('event_edit_') || customId.startsWith('event_delete_')) {
		// Check if user has admin permissions
		if (!interaction.member.permissions.has('ManageEvents') && !interaction.member.permissions.has('Administrator')) {
			return await interaction.reply({ content: 'You do not have permission to manage events!', ephemeral: true });
		}

		if (customId.startsWith('event_delete_')) {
			try {
				await interaction.message.delete();
				
				// Remove from stored data
				const eventKey = `event_${interaction.guild.id}_${interaction.message.id}`;
				if (client.eventData && client.eventData.has(eventKey)) {
					client.eventData.delete(eventKey);
				}
				
				await interaction.reply({ content: 'Event deleted successfully!', ephemeral: true });
			} catch (error) {
				console.error('Error deleting event:', error);
				await interaction.reply({ content: 'Error deleting event!', ephemeral: true });
			}
		} else if (customId.startsWith('event_edit_')) {
			await interaction.reply({ content: 'Event editing is not yet implemented. Please create a new event.', ephemeral: true });
		}
	}
});

// Handle reaction events for attendance tracking
client.on(Events.MessageReactionAdd, async (reaction, user) => {
	if (user.bot) return;
	
	await handleReactionChange(reaction, user, true);
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
	if (user.bot) return;
	
	await handleReactionChange(reaction, user, false);
});

// Function to handle reaction changes
async function handleReactionChange(reaction, user, added) {
	// If the reaction is partial, fetch it
	if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch (error) {
			console.error('Error fetching reaction:', error);
			return;
		}
	}

	const eventKey = `event_${reaction.message.guild.id}_${reaction.message.id}`;
	
	if (!client.eventData || !client.eventData.has(eventKey)) {
		return; // Not an event message
	}

	const eventData = client.eventData.get(eventKey);
	const userId = user.id;

	// Remove user from all arrays first
	eventData.accepted = eventData.accepted.filter(id => id !== userId);
	eventData.declined = eventData.declined.filter(id => id !== userId);
	eventData.tentative = eventData.tentative.filter(id => id !== userId);

	// Add to appropriate array if reaction was added
	if (added) {
		switch (reaction.emoji.name) {
			case '✅':
				eventData.accepted.push(userId);
				break;
			case '❌':
				eventData.declined.push(userId);
				break;
			case '❕':
				eventData.tentative.push(userId);
				break;
			default:
				return; // Not a relevant reaction
		}
	}

	// Update the embed
	try {
		await updateEventEmbed(reaction.message, eventData);
	} catch (error) {
		console.error('Error updating event embed:', error);
	}
}

// Function to update event embed with current attendance
async function updateEventEmbed(message, eventData) {
	const { EmbedBuilder } = require('discord.js');
	
	const embed = new EmbedBuilder()
		.setTitle(eventData.title)
		.setColor(eventData.color)
		.setTimestamp();

	// Build description
	let embedDescription = '';
	if (eventData.description) {
		embedDescription += `${eventData.description}\n\n`;
	}

	embedDescription += `**Time**\n`;
	if (eventData.startDate === eventData.endDate) {
		embedDescription += `${eventData.startDate} at ${eventData.startTime} - ${eventData.endTime}\n\n`;
	} else {
		embedDescription += `${eventData.startDate} at ${eventData.startTime} - ${eventData.endDate} at ${eventData.endTime}\n\n`;
	}

	if (eventData.notificationTime) {
		const hours = Math.floor(eventData.notificationTime / 60);
		const minutes = eventData.notificationTime % 60;
		let timeString = '';
		if (hours > 0) timeString += `${hours} hour${hours !== 1 ? 's' : ''}`;
		if (minutes > 0) {
			if (timeString) timeString += ' ';
			timeString += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
		}
		embedDescription += `⏰ Notification: ${timeString} before event\n\n`;
	}

	// Add attendance lists
	embedDescription += `✅ **Accepted (${eventData.accepted.length})**\n`;
	if (eventData.accepted.length > 0) {
		for (const userId of eventData.accepted) {
			try {
				const member = await message.guild.members.fetch(userId);
				embedDescription += `${member.displayName}\n`;
			} catch (error) {
				embedDescription += `<@${userId}>\n`;
			}
		}
	}
	embedDescription += '\n';

	embedDescription += `❌ **Declined (${eventData.declined.length})**\n`;
	if (eventData.declined.length > 0) {
		for (const userId of eventData.declined) {
			try {
				const member = await message.guild.members.fetch(userId);
				embedDescription += `${member.displayName}\n`;
			} catch (error) {
				embedDescription += `<@${userId}>\n`;
			}
		}
	}
	embedDescription += '\n';

	embedDescription += `❕ **Tentative (${eventData.tentative.length})**\n`;
	if (eventData.tentative.length > 0) {
		for (const userId of eventData.tentative) {
			try {
				const member = await message.guild.members.fetch(userId);
				embedDescription += `${member.displayName}\n`;
			} catch (error) {
				embedDescription += `<@${userId}>\n`;
			}
		}
	}

	embed.setDescription(embedDescription);
	
	await message.edit({ embeds: [embed] });
}

// Function to update all relevant embeds when a role is added/removed
async function updateRoleEmbeds(member, role, added) {
	const guild = member.guild;
	
	// Check all stored embeds for this guild
	for (const [embedKey, embedData] of client.roleEmbeds.entries()) {
		if (embedData.guildId !== guild.id) continue;
		
		// Check if this role is tracked in this embed
		if (embedData.roles.includes(role.id)) {
			try {
				const channel = await guild.channels.fetch(embedData.channelId);
				const message = await channel.messages.fetch(embedData.messageId);
				
				// Update the embed
				const updatedEmbed = await generateRoleEmbed(guild, embedData.title, embedData.roles, embedData.color);
				await message.edit({ embeds: [updatedEmbed] });
			} catch (error) {
				console.error(`Error updating embed ${embedKey}:`, error);
			}
		}
	}
}

// Function to generate role embed
async function generateRoleEmbed(guild, title, roleIds, color) {
	const { EmbedBuilder } = require('discord.js');
	
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor(color || '#0099ff')
		.setTimestamp();

	let description = '';
	
	for (const roleId of roleIds) {
		try {
			const role = await guild.roles.fetch(roleId);
			if (!role) continue;
			
			const membersWithRole = role.members;
			
			description += `**${role.name}**\n`;
			if (membersWithRole.size > 0) {
				membersWithRole.forEach(member => {
					description += `${member}\n`;
				});
			} else {
				description += '*No members*\n';
			}
			description += '\n';
		} catch (error) {
			console.error(`Error fetching role ${roleId}:`, error);
		}
	}
	
	embed.setDescription(description || 'No roles configured.');
	return embed;
}

// Make functions available globally
client.updateRoleEmbeds = updateRoleEmbeds;
client.generateRoleEmbed = generateRoleEmbed;

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);