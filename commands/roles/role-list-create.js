const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('role-list-create')
		.setDescription('Create a role list embed')
		.addStringOption(option =>
			option.setName('title')
				.setDescription('The title of the embed')
				.setRequired(true))
		.addRoleOption(option =>
			option.setName('role1')
				.setDescription('First role to add')
				.setRequired(true))
		.addRoleOption(option =>
			option.setName('role2')
				.setDescription('Second role to add')
				.setRequired(false))
		.addRoleOption(option =>
			option.setName('role3')
				.setDescription('Third role to add')
				.setRequired(false))
		.addRoleOption(option =>
			option.setName('role4')
				.setDescription('Fourth role to add')
				.setRequired(false))
		.addRoleOption(option =>
			option.setName('role5')
				.setDescription('Fifth role to add')
				.setRequired(false))
		.addChannelOption(option =>
			option.setName('channel')
				.setDescription('Channel to send the embed to')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(false))
		.addStringOption(option =>
			option.setName('color')
				.setDescription('Embed color (hex code, e.g., #ff0000)')
				.setRequired(false)),
	async execute(interaction) {
		// Defer the reply immediately to prevent timeout
		await interaction.deferReply({ ephemeral: true });

		const title = interaction.options.getString('title');
		const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
		const color = interaction.options.getString('color') || '#0099ff';

		// Collect all roles
		const roles = [];
		for (let i = 1; i <= 5; i++) {
			const role = interaction.options.getRole(`role${i}`);
			if (role) {
				roles.push(role.id);
			}
		}

		if (roles.length === 0) {
			return await interaction.editReply({ content: 'You must specify at least one role!' });
		}

		// Validate color format
		const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		if (!colorRegex.test(color)) {
			return await interaction.editReply({ content: 'Invalid color format! Please use hex format (e.g., #ff0000)' });
		}

		try {
			// Generate the embed
			const embed = await interaction.client.generateRoleEmbed(interaction.guild, title, roles, color);

			// Send the embed
			const message = await targetChannel.send({ embeds: [embed] });

			// Store embed data for future updates
			const embedKey = `${interaction.guild.id}-${message.id}`;
			interaction.client.roleEmbeds.set(embedKey, {
				guildId: interaction.guild.id,
				channelId: targetChannel.id,
				messageId: message.id,
				title: title,
				roles: roles,
				color: color
			});

			await interaction.editReply({ 
				content: `Role list embed created successfully in ${targetChannel}!`
			});

		} catch (error) {
			console.error('Error creating role list embed:', error);
			try {
				await interaction.editReply({ 
					content: 'There was an error creating the embed. Please make sure I have permission to send messages in the target channel.'
				});
			} catch (editError) {
				console.error('Failed to edit reply:', editError);
			}
		}
	},
};