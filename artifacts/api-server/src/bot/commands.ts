import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "@workspace/db";
import { moderationLogsTable, warningsTable, pollsTable, remindersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const POLL_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export const slashCommands = [
  // BAN
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for ban").setRequired(false)),

  // KICK
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for kick").setRequired(false)),

  // MUTE (timeout)
  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute (timeout) a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("user").setDescription("User to mute").setRequired(true))
    .addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Reason for mute").setRequired(false)),

  // WARN
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a warning to a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for warning").setRequired(true)),

  // WARNINGS LIST
  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(true)),

  // POLL
  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName("question").setDescription("Poll question").setRequired(true))
    .addStringOption(o => o.setName("options").setDescription("Options separated by | (e.g. Yes|No|Maybe)").setRequired(true))
    .addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes (optional)").setRequired(false).setMinValue(1)),

  // REMINDER
  new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Set a reminder")
    .addStringOption(o => o.setName("message").setDescription("Reminder message").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Remind after how many minutes").setRequired(true).setMinValue(1)),

  // CLEAR
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Clear messages in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages to clear (1-100)").setRequired(false).setMinValue(1).setMaxValue(100)),

  // PING
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  // SERVERINFO
  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View server information"),

  // USERINFO
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View information about a user")
    .addUserOption(o => o.setName("user").setDescription("User to look up").setRequired(false)),
].map(cmd => cmd.toJSON());

export async function handleInteraction(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const user = interaction.user;
  const member = interaction.member as any;

  if (interaction.commandName === "clear") {
    const amount = interaction.options.getInteger("amount") ?? 10;
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased() || !("bulkDelete" in channel)) {
      await interaction.reply({ content: "❌ This command can only be used in a server text channel.", ephemeral: true });
      return;
    }
    try {
      const messages = await channel.messages.fetch({ limit: amount });
      const deleted = await channel.bulkDelete(messages, true).catch(async () => {
        // Some messages may be older than 14 days; try deleting individually as fallback
        let count = 0;
        for (const [_, msg] of messages) {
          try { await msg.delete(); count++; } catch {}
        }
        return count;
      });
      const deletedCount = typeof deleted === "number" ? deleted : messages.size;
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x7C3AED).setDescription(`🧹 Cleared **${deletedCount}** message${deletedCount === 1 ? "" : "s"}.`)],
        ephemeral: true,
      });
    } catch {
      await interaction.reply({ content: "❌ Failed to clear messages. Check my permissions.", ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === "ping") {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x7C3AED).setDescription(`🏓 Pong! Latency: **${interaction.client.ws.ping}ms**`)]
    });
    return;
  }

  if (interaction.commandName === "serverinfo") {
    const guild = interaction.guild!;
    await guild.fetch();
    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: "Members", value: `${guild.memberCount}`, inline: true },
        { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
        { name: "Channels", value: `${guild.channels.cache.size}`, inline: true },
      )
      .setFooter({ text: `ID: ${guild.id}` });
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === "userinfo") {
    const target = interaction.options.getUser("user") ?? user;
    const guildMember = interaction.guild?.members.cache.get(target.id);
    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle(target.username)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "ID", value: target.id, inline: true },
        { name: "Account Created", value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "Joined Server", value: guildMember?.joinedAt ? `<t:${Math.floor(guildMember.joinedTimestamp! / 1000)}:D>` : "N/A", inline: true },
      );
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === "ban") {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    try {
      await interaction.guild?.members.ban(target.id, { reason });
      await db.insert(moderationLogsTable).values({
        guildId, type: "ban", targetUserId: target.id, targetUsername: target.username,
        moderatorId: user.id, moderatorUsername: user.username, reason,
      });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`🔨 Banned **${target.username}** — ${reason}`)] });
    } catch {
      await interaction.reply({ content: "❌ Failed to ban user. Check my permissions.", ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === "kick") {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    try {
      await interaction.guild?.members.kick(target.id, reason);
      await db.insert(moderationLogsTable).values({
        guildId, type: "kick", targetUserId: target.id, targetUsername: target.username,
        moderatorId: user.id, moderatorUsername: user.username, reason,
      });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription(`👢 Kicked **${target.username}** — ${reason}`)] });
    } catch {
      await interaction.reply({ content: "❌ Failed to kick user. Check my permissions.", ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === "mute") {
    const target = interaction.options.getUser("user", true);
    const duration = interaction.options.getInteger("duration", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    try {
      const guildMember = await interaction.guild?.members.fetch(target.id);
      await guildMember?.timeout(duration * 60 * 1000, reason);
      await db.insert(moderationLogsTable).values({
        guildId, type: "mute", targetUserId: target.id, targetUsername: target.username,
        moderatorId: user.id, moderatorUsername: user.username, reason, duration,
      });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`🔇 Muted **${target.username}** for ${duration}m — ${reason}`)] });
    } catch {
      await interaction.reply({ content: "❌ Failed to mute user. Check my permissions.", ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === "warn") {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    await db.insert(warningsTable).values({
      guildId, userId: target.id, username: target.username,
      moderatorId: user.id, moderatorUsername: user.username, reason,
    });
    const count = await db.select().from(warningsTable).where(eq(warningsTable.userId, target.id));
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x3498db).setDescription(`⚠️ Warned **${target.username}** (${count.length} total warnings) — ${reason}`)] });
    return;
  }

  if (interaction.commandName === "warnings") {
    const target = interaction.options.getUser("user", true);
    const warns = await db.select().from(warningsTable).where(eq(warningsTable.userId, target.id));
    if (!warns.length) {
      await interaction.reply({ content: `✅ **${target.username}** has no warnings.` });
    } else {
      const list = warns.slice(-10).map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`).join("\n");
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7C3AED).setTitle(`Warnings for ${target.username} (${warns.length} total)`).setDescription(list)] });
    }
    return;
  }

  if (interaction.commandName === "poll") {
    const question = interaction.options.getString("question", true);
    const rawOptions = interaction.options.getString("options", true).split("|").map(o => o.trim()).filter(Boolean).slice(0, 10);
    if (rawOptions.length < 2) {
      await interaction.reply({ content: "❌ Need at least 2 options separated by |", ephemeral: true });
      return;
    }
    const durationMin = interaction.options.getInteger("duration");
    const options = rawOptions.map((text, i) => ({ emoji: POLL_EMOJIS[i] || String(i + 1), text, votes: 0 }));
    const endsAt = durationMin ? new Date(Date.now() + durationMin * 60000) : null;

    const [poll] = await db.insert(pollsTable).values({
      guildId, channelId: interaction.channelId,
      question, options, endsAt,
    }).returning();

    const desc = options.map(o => `${o.emoji} **${o.text}**`).join("\n");
    const embed = new EmbedBuilder().setColor(0x7C3AED).setTitle(`📊 ${question}`).setDescription(desc)
      .setFooter({ text: `Poll #${poll.id}${endsAt ? ` • Ends ${endsAt.toLocaleString()}` : ""}` });
    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });

    // Add numbered emoji reactions so users can vote by clicking
    for (let i = 0; i < rawOptions.length && i < POLL_EMOJIS.length; i++) {
      await reply.react(POLL_EMOJIS[i]).catch(() => {});
    }

    // Store the message ID for later vote tracking
    await db.update(pollsTable)
      .set({ messageId: reply.id })
      .where(eq(pollsTable.id, poll.id));

    return;
  }

  if (interaction.commandName === "remind") {
    const message = interaction.options.getString("message", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const scheduledAt = new Date(Date.now() + minutes * 60000);
    await db.insert(remindersTable).values({
      guildId, channelId: interaction.channelId,
      userId: user.id, message, scheduledAt,
    });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7C3AED).setDescription(`⏰ Reminder set! I'll remind you in **${minutes} minute${minutes === 1 ? "" : "s"}**: ${message}`)] });
    return;
  }
}
