const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('updaterole')
		.setDescription('Toggle a role for a user and update all relevant embeds')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user to toggle the role for')
				.setRequired(true))
		.addRoleOption(option =>
			option.setName('role')
				.setDescription('The role to toggle')
				.setRequired(true)),
	async execute(interaction) {
		// Defer the reply immediately to prevent timeout
		await interaction.deferReply({ ephemeral: true });

		const targetUser = interaction.options.getUser('user');
		const role = interaction.options.getRole('role');

		// Check if the user has permission to manage roles
		if (!interaction.member.permissions.has('ManageRoles')) {
			return await interaction.editReply({ 
				content: 'You do not have permission to manage roles!'
			});
		}

		// Check if the bot has permission to manage roles
		if (!interaction.guild.members.me.permissions.has('ManageRoles')) {
			return await interaction.editReply({ 
				content: 'I do not have permission to manage roles!'
			});
		}

		// Get the member object
		let member;
		try {
			member = await interaction.guild.members.fetch(targetUser.id);
		} catch (error) {
			return await interaction.editReply({ 
				content: 'Could not find that user in this server!'
			});
		}

		// Check if the role can be managed by the bot
		if (role.position >= interaction.guild.members.me.roles.highest.position) {
			return await interaction.editReply({ 
				content: 'I cannot manage this role as it is higher than or equal to my highest role!'
			});
		}

		// Check if the user can manage this role
		if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
			return await interaction.editReply({ 
				content: 'You cannot manage this role as it is higher than or equal to your highest role!'
			});
		}

		try {
			const hadRole = member.roles.cache.has(role.id);
			
			if (hadRole) {
				// Remove the role
				await member.roles.remove(role);
				
				// Update all relevant embeds
				await interaction.client.updateRoleEmbeds(member, role, false);
				
				await interaction.editReply({ 
					content: `Successfully removed the **${role.name}** role from ${targetUser}!`
				});
			} else {
				// Add the role
				await member.roles.add(role);
				
				// Update all relevant embeds
				await interaction.client.updateRoleEmbeds(member, role, true);
				
				await interaction.editReply({ 
					content: `Successfully added the **${role.name}** role to ${targetUser}!`
				});
			}

		} catch (error) {
			console.error('Error managing role:', error);
			try {
				await interaction.editReply({ 
					content: 'There was an error managing the role. Please check my permissions and try again.'
				});
			} catch (editError) {
				console.error('Failed to edit reply:', editError);
			}
		}
	},
};