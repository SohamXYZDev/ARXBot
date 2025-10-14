const { SlashCommandBuilder, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('event-create')
		.setDescription('Create an event with reaction-based attendance')
		// Required options first
		.addStringOption(option =>
			option.setName('title')
				.setDescription('The title of the event')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('start-time')
				.setDescription('Start time (HH:MM format, e.g., 20:00)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('end-time')
				.setDescription('End time (HH:MM format, e.g., 22:00)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('start-date')
				.setDescription('Start date (DD/MM/YYYY format, e.g., 13/10/2025)')
				.setRequired(true))
		// Optional options after required ones
		.addStringOption(option =>
			option.setName('description')
				.setDescription('Event description')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('end-date')
				.setDescription('End date (DD/MM/YYYY format, e.g., 13/10/2025)')
				.setRequired(false))
		.addIntegerOption(option =>
			option.setName('notification-time')
				.setDescription('Pre-event notification time in minutes')
				.setRequired(false)
				.setMinValue(1)
				.setMaxValue(10080)) // Max 1 week
		.addChannelOption(option =>
			option.setName('channel')
				.setDescription('Channel to send the event to')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(false))
		.addStringOption(option =>
			option.setName('color')
				.setDescription('Embed color (hex code, e.g., #ff0000)')
				.setRequired(false)),
	async execute(interaction) {
		// Defer the reply immediately
		await interaction.deferReply({ ephemeral: true });

		const title = interaction.options.getString('title');
		const description = interaction.options.getString('description') || '';
		const startTime = interaction.options.getString('start-time');
		const endTime = interaction.options.getString('end-time');
		const startDate = interaction.options.getString('start-date');
		const endDate = interaction.options.getString('end-date') || startDate;
		const notificationTime = interaction.options.getInteger('notification-time');
		const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
		const color = interaction.options.getString('color') || '#0099ff';

		// Validate time format (HH:MM)
		const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
		if (!timeRegex.test(startTime)) {
			return await interaction.editReply({ content: 'Invalid start time format! Use HH:MM (e.g., 20:00)' });
		}
		if (!timeRegex.test(endTime)) {
			return await interaction.editReply({ content: 'Invalid end time format! Use HH:MM (e.g., 22:00)' });
		}

		// Validate date format (DD/MM/YYYY)
		const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
		if (!dateRegex.test(startDate)) {
			return await interaction.editReply({ content: 'Invalid start date format! Use DD/MM/YYYY (e.g., 13/10/2025)' });
		}
		if (!dateRegex.test(endDate)) {
			return await interaction.editReply({ content: 'Invalid end date format! Use DD/MM/YYYY (e.g., 13/10/2025)' });
		}

		// Validate color format
		const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		if (!colorRegex.test(color)) {
			return await interaction.editReply({ content: 'Invalid color format! Please use hex format (e.g., #ff0000)' });
		}

		// Parse dates for validation
		const [startDay, startMonth, startYear] = startDate.split('/').map(Number);
		const [endDay, endMonth, endYear] = endDate.split('/').map(Number);
		const startDateTime = new Date(startYear, startMonth - 1, startDay);
		const endDateTime = new Date(endYear, endMonth - 1, endDay);

		if (startDateTime > endDateTime) {
			return await interaction.editReply({ content: 'Start date cannot be after end date!' });
		}

		// Create the embed
		const eventEmbed = new EmbedBuilder()
			.setTitle(title)
			.setColor(color)
			.setTimestamp();

		// Build description with event details
		let embedDescription = '';
		if (description) {
			embedDescription += `${description}\n\n`;
		}

		embedDescription += `**Time**\n`;
		if (startDate === endDate) {
			embedDescription += `${startDate} at ${startTime} - ${endTime}\n\n`;
		} else {
			embedDescription += `${startDate} at ${startTime} - ${endDate} at ${endTime}\n\n`;
		}

		if (notificationTime) {
			const hours = Math.floor(notificationTime / 60);
			const minutes = notificationTime % 60;
			let timeString = '';
			if (hours > 0) timeString += `${hours} hour${hours !== 1 ? 's' : ''}`;
			if (minutes > 0) {
				if (timeString) timeString += ' ';
				timeString += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
			}
			embedDescription += `⏰ Notification: ${timeString} before event\n\n`;
		}

		embedDescription += `✅ **Accepted (0)**\n`;
		embedDescription += `❌ **Declined (0)**\n`;
		embedDescription += `❕ **Tentative (0)**\n`;

		eventEmbed.setDescription(embedDescription);

		// Create admin buttons
		const adminRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId(`event_edit_${Date.now()}`)
					.setLabel('Edit')
					.setStyle(ButtonStyle.Secondary)
					.setEmoji('✏️'),
				new ButtonBuilder()
					.setCustomId(`event_delete_${Date.now()}`)
					.setLabel('Delete')
					.setStyle(ButtonStyle.Danger)
					.setEmoji('🗑️')
			);

		try {
			// Send the event embed
			const message = await targetChannel.send({ 
				embeds: [eventEmbed], 
				components: [adminRow] 
			});

			// Add reactions
			await message.react('✅');
			await message.react('❌');
			await message.react('❕');

			// Store event data for future updates
			const eventKey = `event_${interaction.guild.id}_${message.id}`;
			if (!interaction.client.eventData) {
				interaction.client.eventData = new Map();
			}
			
			interaction.client.eventData.set(eventKey, {
				guildId: interaction.guild.id,
				channelId: targetChannel.id,
				messageId: message.id,
				title: title,
				description: description,
				startTime: startTime,
				endTime: endTime,
				startDate: startDate,
				endDate: endDate,
				notificationTime: notificationTime,
				color: color,
				accepted: [],
				declined: [],
				tentative: []
			});

			await interaction.editReply({ 
				content: `Event "${title}" created successfully in ${targetChannel}!` 
			});

		} catch (error) {
			console.error('Error creating event:', error);
			try {
				await interaction.editReply({ 
					content: 'There was an error creating the event. Please make sure I have permission to send messages and add reactions in the target channel.' 
				});
			} catch (editError) {
				console.error('Failed to edit reply:', editError);
			}
		}
	},
};