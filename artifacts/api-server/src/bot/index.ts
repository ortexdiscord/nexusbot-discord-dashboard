import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
  ActivityType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonInteraction,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  AttachmentBuilder,
} from "discord.js";
import { logger } from "../lib/logger";
import { slashCommands, handleInteraction } from "./commands";
import { db } from "@workspace/db";
import {
  welcomeConfigTable, leaveConfigTable, alwaysOnlineTable, remindersTable,
  pollsTable, reactionRolesTable, selfRolesTable, ticketSettingsTable,
  openTicketsTable, applicationsTable, xpSettingsTable, userXpTable,
  levelRolesTable, statsChannelsTable, giveawaysTable, invitesTable,
  messageLogConfigTable, messageLogsTable, verificationConfigTable,
  verificationLogsTable, automodConfigTable, analyticsEventsTable,
} from "@workspace/db";
import { discoButtonResponses } from "./disco-buttons";
import { runAiAutomod } from "./ai-automod";
import { eq, and, lte } from "drizzle-orm";

let client: Client | null = null;
let alwaysOnlineInterval: NodeJS.Timeout | null = null;

// Invite tracking: guildId → Map<inviteCode, uses>
const inviteCache = new Map<string, Map<string, number>>();
let reminderInterval: NodeJS.Timeout | null = null;
let statsChannelsInterval: NodeJS.Timeout | null = null;
let giveawayInterval: NodeJS.Timeout | null = null;
let presenceInterval: NodeJS.Timeout | null = null;
let botStartedAt: Date | null = null;

export function getBotUptime(): number | null {
  return botStartedAt ? Date.now() - botStartedAt.getTime() : null;
}

// XP cooldown map: guildId:userId -> last message timestamp
const xpCooldowns = new Map<string, number>();

// Pending captcha verifications: guildId:userId -> { answer, channelId, expiresAt }
const pendingCaptchas = new Map<string, { answer: number; channelId: string; expiresAt: number }>();

export function getBotClient(): Client | null { return client; }

export async function startBot() {
  const token = process.env["Discordbot"];
  if (!token) { logger.warn("discordbot token not found — bot disabled"); return; }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildInvites,
      // GatewayIntentBits.GuildPresences, // privileged — enable in Discord Dev Portal first
    ],
    partials: [Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.Channel],
  });

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, "Discord bot ready");
    try {
      const rest = new REST().setToken(token);
      const appId = c.application.id;
      await rest.put(Routes.applicationCommands(appId), { body: slashCommands });
      logger.info({ count: slashCommands.length }, "Slash commands registered");
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
    botStartedAt = new Date();

    // Cache invites for invite tracking
    for (const guild of c.guilds.cache.values()) {
      try {
        const invites = await guild.invites.fetch();
        inviteCache.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses ?? 0])));
      } catch { /* ignore — bot may lack Manage Guild permission */ }
    }

    startAlwaysOnlineLoop();
    startReminderLoop();
    startStatsChannelsLoop();
    startGiveawayLoop();
    startPresenceCycling(c);
  });

  // ── Reconnect watchdog ──────────────────────────────────────────────────────
  client.on(Events.ShardDisconnect, (event, shardId) => {
    logger.warn({ code: event.code, shardId }, "Bot shard disconnected — will attempt reconnect");
  });

  client.on(Events.ShardReconnecting, (shardId) => {
    logger.info({ shardId }, "Bot shard reconnecting…");
  });

  client.on(Events.ShardResume, (shardId, replayedEvents) => {
    logger.info({ shardId, replayedEvents }, "Bot shard resumed");
  });

  client.on(Events.ShardError, (error, shardId) => {
    logger.error({ err: error, shardId }, "Bot shard error");
  });

  // ── Slash commands ──────────────────────────────────────────────────────────
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      try {
        await handleInteraction(interaction as ChatInputCommandInteraction);
        // Track command analytics (non-blocking)
        if (interaction.guildId) {
          db.insert(analyticsEventsTable).values({
            guildId: interaction.guildId,
            type: "command_used",
            meta: interaction.commandName,
          }).catch(() => {});
        }
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, "Error handling slash command");
        try {
          const reply = { content: "❌ An error occurred.", ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
          else await interaction.reply(reply);
        } catch {}
      }
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction as ButtonInteraction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction as ModalSubmitInteraction);
      return;
    }
  });

  // ── Welcome ─────────────────────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member) => {
    // ── Track invite ───────────────────────────────────────────────────────────
    try {
      const gId = member.guild.id;
      const cached = inviteCache.get(gId) ?? new Map<string, number>();
      const currentInvites = await member.guild.invites.fetch().catch(() => null);

      let inviterUserId: string | null = null;
      let inviterUsername: string | null = null;
      let inviteCode: string | null = null;

      if (currentInvites) {
        for (const [code, invite] of currentInvites) {
          if ((invite.uses ?? 0) > (cached.get(code) ?? 0)) {
            inviterUserId = invite.inviter?.id ?? null;
            inviterUsername = invite.inviter?.username ?? null;
            inviteCode = code;
            break;
          }
        }
        // Update cache with latest counts
        inviteCache.set(gId, new Map(currentInvites.map(inv => [inv.code, inv.uses ?? 0])));
      }

      await db.insert(invitesTable).values({
        guildId: gId,
        invitedUserId: member.id,
        invitedUsername: member.user.username,
        inviterUserId,
        inviterUsername,
        inviteCode,
        isBot: member.user.bot,
        isOAuth: !inviteCode && !member.user.bot,
      });
    } catch (err) { logger.error({ err }, "Error tracking invite"); }

    try {
      const [config] = await db.select().from(welcomeConfigTable).where(eq(welcomeConfigTable.guildId, member.guild.id));
      if (!config?.enabled || !config.channelId) return;
      const channel = member.guild.channels.cache.get(config.channelId) as any;
      if (!channel?.isTextBased()) return;

      const msg = config.message
        .replace("{user}", `<@${member.id}>`)
        .replace("{server}", member.guild.name)
        .replace("{count}", String(member.guild.memberCount));

      // Image card takes priority over embed
      if (config.imageCardEnabled) {
        try {
          const { generateImageCard } = await import("../lib/image-card.js");
          const buffer = await generateImageCard({
            username: member.user.username,
            avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 } as any),
            serverName: member.guild.name,
            memberCount: member.guild.memberCount,
            mainText: config.imageCardText || "Welcome, {user}!",
            subText: config.imageCardSubtext || "Member #{count}",
            bgImageUrl: config.imageCardBgUrl || undefined,
            type: "welcome",
          });
          const attachment = new AttachmentBuilder(buffer as Buffer, { name: "welcome.png" });
          await channel.send({ content: msg, files: [attachment] });
        } catch (err) {
          logger.error({ err }, "Failed to generate welcome image card — falling back to text");
          await channel.send(msg);
        }
      } else if (config.embedEnabled) {
        const embed = new EmbedBuilder()
          .setColor(parseInt(config.embedColor.replace("#", ""), 16))
          .setThumbnail(member.user.displayAvatarURL());
        if (config.embedTitle) embed.setTitle(config.embedTitle.replace("{user}", member.user.username).replace("{server}", member.guild.name));
        embed.setDescription(config.embedDescription
          ? config.embedDescription.replace("{user}", `<@${member.id}>`).replace("{server}", member.guild.name).replace("{count}", String(member.guild.memberCount))
          : msg);
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(msg);
      }

      if (config.assignRoleId) {
        const role = member.guild.roles.cache.get(config.assignRoleId);
        if (role) await member.roles.add(role).catch(() => {});
      }

      // ── Join DM ───────────────────────────────────────────────────────────
      if (config.dmEnabled && config.dmMessage) {
        try {
          const dmMsg = config.dmMessage
            .replace("{user}", member.user.username)
            .replace("{server}", member.guild.name);
          await member.user.send(dmMsg).catch(() => {});
        } catch { /* user has DMs disabled */ }
      }
    } catch (err) { logger.error({ err }, "Error sending welcome message"); }

    // ── Analytics: member join ────────────────────────────────────────────
    try {
      await db.insert(analyticsEventsTable).values({ guildId: member.guild.id, type: "member_join" });
    } catch { /* ignore */ }

    // ── Verification: assign unverified role + prompt ─────────────────────
    try {
      const [vConfig] = await db.select().from(verificationConfigTable)
        .where(eq(verificationConfigTable.guildId, member.guild.id));
      if (vConfig?.enabled) {
        if (vConfig.unverifiedRoleId) {
          const uRole = member.guild.roles.cache.get(vConfig.unverifiedRoleId);
          if (uRole) await member.roles.add(uRole).catch(() => {});
        }

        if (vConfig.type === "captcha" && vConfig.channelId) {
          const vCh = member.guild.channels.cache.get(vConfig.channelId) as any;
          if (vCh?.isTextBased()) {
            const a = Math.floor(Math.random() * 10) + 1;
            const b = Math.floor(Math.random() * 10) + 1;
            const answer = a + b;
            // Store pending captcha in memory
            pendingCaptchas.set(`${member.guild.id}:${member.id}`, { answer, channelId: vConfig.channelId, expiresAt: Date.now() + 5 * 60_000 });
            const promptEmbed = new EmbedBuilder()
              .setColor(0x7c3aed)
              .setTitle("🔐 Verification Required")
              .setDescription(`${vConfig.welcomeMessage ?? "Please verify to gain access."}\n\n<@${member.id}> — Type the answer to this question:\n\n**What is ${a} + ${b}?**`)
              .setFooter({ text: "You have 5 minutes to answer." });
            await vCh.send({ embeds: [promptEmbed] }).catch(() => {});
          }
        } else if (vConfig.type === "ticket" && vConfig.channelId) {
          const vCh = member.guild.channels.cache.get(vConfig.channelId) as any;
          if (vCh?.isTextBased()) {
            const { ActionRowBuilder: ARB, ButtonBuilder, ButtonStyle } = await import("discord.js");
            const row = new (ARB as any)().addComponents(
              new ButtonBuilder()
                .setCustomId(`verify_ticket_${member.id}`)
                .setLabel("Open Verification Ticket")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("🎫")
            );
            const embed = new EmbedBuilder()
              .setColor(0x7c3aed)
              .setTitle("🔐 Verification Required")
              .setDescription(`${vConfig.welcomeMessage ?? "Please verify to gain access."}\n\n<@${member.id}>, click the button below to open a verification ticket.`);
            await vCh.send({ embeds: [embed], components: [row] }).catch(() => {});
          }
        }
      }
    } catch (err) { logger.error({ err }, "Verification join error"); }
  });

  // ── Leave ───────────────────────────────────────────────────────────────────
  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const [config] = await db.select().from(leaveConfigTable).where(eq(leaveConfigTable.guildId, member.guild.id));
      if (!config?.enabled || !config.channelId) return;
      const channel = member.guild.channels.cache.get(config.channelId) as any;
      if (!channel?.isTextBased()) return;

      const msg = config.message
        .replace("{user}", (member as any).user?.username ?? "Someone")
        .replace("{server}", member.guild.name)
        .replace("{count}", String(member.guild.memberCount));

      if (config.imageCardEnabled) {
        try {
          const { generateImageCard } = await import("../lib/image-card.js");
          const buffer = await generateImageCard({
            username: (member as any).user?.username ?? "Member",
            avatarUrl: (member as any).user?.displayAvatarURL({ extension: "png", size: 256 } as any),
            serverName: member.guild.name,
            memberCount: member.guild.memberCount,
            mainText: config.imageCardText || "Goodbye, {user}!",
            subText: config.imageCardSubtext || "We now have {count} members",
            bgImageUrl: config.imageCardBgUrl || undefined,
            type: "leave",
          });
          const attachment = new AttachmentBuilder(buffer as Buffer, { name: "goodbye.png" });
          await channel.send({ content: msg, files: [attachment] });
        } catch (err) {
          logger.error({ err }, "Failed to generate leave image card — falling back to text");
          await channel.send(msg);
        }
      } else if (config.embedEnabled) {
        const embed = new EmbedBuilder()
          .setColor(parseInt(config.embedColor.replace("#", ""), 16))
          .setThumbnail((member as any).user?.displayAvatarURL() ?? null);
        if (config.embedTitle) embed.setTitle(config.embedTitle.replace("{user}", (member as any).user?.username ?? "Member").replace("{server}", member.guild.name));
        embed.setDescription(config.embedDescription
          ? config.embedDescription.replace("{user}", (member as any).user?.username ?? "Member").replace("{server}", member.guild.name).replace("{count}", String(member.guild.memberCount))
          : msg);
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(msg);
      }
    } catch (err) { logger.error({ err }, "Error sending leave message"); }
  });

  // ── Keep invite cache fresh ─────────────────────────────────────────────────
  client.on(Events.InviteCreate, (invite) => {
    if (!invite.guild) return;
    const guildCache = inviteCache.get(invite.guild.id) ?? new Map<string, number>();
    guildCache.set(invite.code, invite.uses ?? 0);
    inviteCache.set(invite.guild.id, guildCache);
  });

  client.on(Events.InviteDelete, (invite) => {
    if (!invite.guild) return;
    const guildCache = inviteCache.get(invite.guild.id);
    if (guildCache) guildCache.delete(invite.code);
  });

  // ── Reaction roles (standard + self-roles) ──────────────────────────────────
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    try {
      const guild = reaction.message.guild;
      if (!guild) return;
      const emojiStr = reaction.emoji.toString();

      // Standard reaction roles
      const allRR = await db.select().from(reactionRolesTable).where(eq(reactionRolesTable.guildId, guild.id));
      const matchRR = allRR.find(rr => rr.messageId === reaction.message.id && rr.emoji === emojiStr);
      if (matchRR) {
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(matchRR.roleId);
        if (role) await member.roles.add(role).catch(() => {});
        return;
      }

      // Self-roles
      const allSR = await db.select().from(selfRolesTable).where(eq(selfRolesTable.guildId, guild.id));
      const matchSR = allSR.find(sr => sr.emoji === emojiStr);
      if (matchSR) {
        const member = await guild.members.fetch(user.id);
        const sameCategory = allSR.filter(sr => sr.category === matchSR.category && sr.roleId !== matchSR.roleId);
        for (const other of sameCategory) {
          const otherRole = guild.roles.cache.get(other.roleId);
          if (otherRole && member.roles.cache.has(otherRole.id)) {
            await member.roles.remove(otherRole).catch(() => {});
          }
        }
        const role = guild.roles.cache.get(matchSR.roleId);
        if (role) await member.roles.add(role).catch(() => {});
      }
    } catch { /* ignore */ }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;
    try {
      const guild = reaction.message.guild;
      if (!guild) return;
      const emojiStr = reaction.emoji.toString();

      const allRR = await db.select().from(reactionRolesTable).where(eq(reactionRolesTable.guildId, guild.id));
      const matchRR = allRR.find(rr => rr.messageId === reaction.message.id && rr.emoji === emojiStr);
      if (matchRR) {
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(matchRR.roleId);
        if (role) await member.roles.remove(role).catch(() => {});
        return;
      }

      const allSR = await db.select().from(selfRolesTable).where(eq(selfRolesTable.guildId, guild.id));
      const matchSR = allSR.find(sr => sr.emoji === emojiStr);
      if (matchSR) {
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(matchSR.roleId);
        if (role) await member.roles.remove(role).catch(() => {});
      }
    } catch { /* ignore */ }
  });

  // ── XP tracking ─────────────────────────────────────────────────────────────
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    try {
      const guildId = message.guild.id;
      const userId = message.author.id;

      const [settings] = await db.select().from(xpSettingsTable).where(eq(xpSettingsTable.guildId, guildId));
      if (!settings?.enabled) return;

      const noXpChannels = (settings.noXpChannels as string[]) ?? [];
      const noXpRoles = (settings.noXpRoles as string[]) ?? [];
      if (noXpChannels.includes(message.channelId)) return;

      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) return;
      if (member.roles.cache.some(r => noXpRoles.includes(r.id))) return;

      const cooldownKey = `${guildId}:${userId}`;
      const lastXp = xpCooldowns.get(cooldownKey) ?? 0;
      const cooldownMs = (settings.cooldownSeconds ?? 60) * 1000;
      if (Date.now() - lastXp < cooldownMs) return;
      xpCooldowns.set(cooldownKey, Date.now());

      const multipliers = (settings.multipliers as Array<{ type: string; id: string; multiplier: number }>) ?? [];
      let multi = 1;
      for (const m of multipliers) {
        if (m.type === "channel" && m.id === message.channelId) { multi = Math.max(multi, m.multiplier); }
        if (m.type === "role" && member.roles.cache.has(m.id)) { multi = Math.max(multi, m.multiplier); }
      }

      const min = settings.minXpPerMessage ?? 15;
      const max = settings.maxXpPerMessage ?? 40;
      const gained = Math.floor((Math.random() * (max - min + 1) + min) * multi);

      const existing = await db.select().from(userXpTable)
        .where(and(eq(userXpTable.guildId, guildId), eq(userXpTable.userId, userId)));

      let currentXp = (existing[0]?.xp ?? 0) + gained;
      let currentLevel = existing[0]?.level ?? 0;
      let messages = (existing[0]?.messages ?? 0) + 1;

      let leveledUp = false;
      while (true) {
        const needed = 5 * currentLevel * currentLevel + 50 * currentLevel + 100;
        if (currentXp >= needed) { currentXp -= needed; currentLevel++; leveledUp = true; }
        else break;
      }

      await db.insert(userXpTable).values({
        guildId, userId,
        username: message.author.username,
        avatarUrl: message.author.displayAvatarURL(),
        xp: currentXp, level: currentLevel, messages,
        lastMessage: new Date(), updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [userXpTable.guildId, userXpTable.userId],
        set: { xp: currentXp, level: currentLevel, messages, username: message.author.username, avatarUrl: message.author.displayAvatarURL(), lastMessage: new Date(), updatedAt: new Date() },
      } as any);

      if (leveledUp) {
        const msgTemplate = (settings.levelUpMessage ?? "🎉 {user} has reached **level {level}**!")
          .replace("{user}", `<@${userId}>`)
          .replace("{level}", String(currentLevel))
          .replace("{username}", message.author.username);

        let notifChannel: any = null;
        if (settings.levelUpChannelId === "dm") {
          notifChannel = await message.author.createDM().catch(() => null);
        } else if (settings.levelUpChannelId) {
          notifChannel = message.guild.channels.cache.get(settings.levelUpChannelId);
        } else {
          notifChannel = message.channel;
        }
        if (notifChannel) await notifChannel.send(msgTemplate).catch(() => {});

        const levelRoles = await db.select().from(levelRolesTable)
          .where(eq(levelRolesTable.guildId, guildId));
        const earned = levelRoles.filter(lr => lr.level <= currentLevel);

        if (settings.stackRoles) {
          for (const lr of earned) {
            const role = message.guild.roles.cache.get(lr.roleId);
            if (role && !member.roles.cache.has(role.id)) await member.roles.add(role).catch(() => {});
          }
        } else {
          const highest = earned.sort((a, b) => b.level - a.level)[0];
          for (const lr of earned) {
            const role = message.guild.roles.cache.get(lr.roleId);
            if (!role) continue;
            if (lr.id === highest?.id) { if (!member.roles.cache.has(role.id)) await member.roles.add(role).catch(() => {}); }
            else if (member.roles.cache.has(role.id)) await member.roles.remove(role).catch(() => {});
          }
        }
      }
    } catch (err) { logger.error({ err }, "XP tracking error"); }

    // ── Captcha verification check ──────────────────────────────────────────
    try {
      const guildId = message.guild!.id;
      const key = `${guildId}:${message.author.id}`;
      const pending = pendingCaptchas.get(key);
      if (pending && message.channelId === pending.channelId) {
        if (Date.now() > pending.expiresAt) {
          pendingCaptchas.delete(key);
          await message.reply("❌ Verification expired. Please rejoin or ask a staff member for help.").catch(() => {});
          return;
        }
        const guess = parseInt(message.content.trim(), 10);
        if (guess === pending.answer) {
          pendingCaptchas.delete(key);
          const [vConfig] = await db.select().from(verificationConfigTable).where(eq(verificationConfigTable.guildId, guildId));
          const member = await message.guild!.members.fetch(message.author.id).catch(() => null);
          if (member && vConfig) {
            // Assign verified role
            if (vConfig.verifiedRoleId) {
              const verRole = message.guild!.roles.cache.get(vConfig.verifiedRoleId);
              if (verRole) await member.roles.add(verRole).catch(() => {});
            }
            // Remove unverified role (always, not gated on verifiedRoleId)
            if (vConfig.unverifiedRoleId) {
              const unverRole = message.guild!.roles.cache.get(vConfig.unverifiedRoleId);
              if (unverRole) await member.roles.remove(unverRole).catch(() => {});
            }
            // Hide verification category for this member (always)
            if (vConfig.categoryId) {
              const cat = message.guild!.channels.cache.get(vConfig.categoryId) as any;
              if (cat) await cat.permissionOverwrites.edit(member, { ViewChannel: false }).catch(() => {});
            }
          }
          await db.insert(verificationLogsTable).values({ guildId, userId: message.author.id, username: message.author.username, type: "captcha", status: "verified" });
          await db.insert(analyticsEventsTable).values({ guildId, type: "verification_pass" });
          await message.reply("✅ Verified! Welcome to the server.").catch(() => {});
        } else {
          await db.insert(verificationLogsTable).values({ guildId, userId: message.author.id, username: message.author.username, type: "captcha", status: "failed" });
          await db.insert(analyticsEventsTable).values({ guildId, type: "verification_fail" });
          await message.reply("❌ Wrong answer. Try again!").catch(() => {});
        }
        return;
      }
    } catch (err) { logger.error({ err }, "Captcha check error"); }

    // ── AI Automod ──────────────────────────────────────────────────────────
    try {
      const guildId = message.guild!.id;
      const [aConfig] = await db.select().from(automodConfigTable).where(eq(automodConfigTable.guildId, guildId));
      if (aConfig?.enabled && aConfig?.aiAutomodEnabled) {
        await runAiAutomod(message, aConfig.aiAutomodSensitivity, aConfig.aiAutomodAction, aConfig.logChannelId);
      }
    } catch (err) { logger.error({ err }, "AI automod error"); }
  });

  // ── Message logs ────────────────────────────────────────────────────────────
  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (newMsg.author?.bot || !newMsg.guild) return;
    if (oldMsg.content === newMsg.content) return; // embed-only update
    try {
      const guildId = newMsg.guild.id;
      const [logConfig] = await db.select().from(messageLogConfigTable).where(eq(messageLogConfigTable.guildId, guildId));
      if (!logConfig?.enabled || !logConfig.logEdits) return;

      await db.insert(messageLogsTable).values({
        guildId,
        channelId: newMsg.channelId,
        channelName: (newMsg.channel as any)?.name ?? "unknown",
        userId: newMsg.author?.id ?? "unknown",
        username: newMsg.author?.username ?? "Unknown",
        messageId: newMsg.id,
        type: "edit",
        oldContent: oldMsg.content?.slice(0, 2000) ?? null,
        newContent: newMsg.content?.slice(0, 2000) ?? null,
      });

      if (logConfig.logChannelId) {
        const logCh = newMsg.guild.channels.cache.get(logConfig.logChannelId) as any;
        if (logCh?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle("✏️ Message Edited")
            .addFields(
              { name: "User", value: `<@${newMsg.author?.id}> (${newMsg.author?.tag})`, inline: true },
              { name: "Channel", value: `<#${newMsg.channelId}>`, inline: true },
              { name: "Before", value: (oldMsg.content ?? "*(empty)*").slice(0, 1000) },
              { name: "After", value: (newMsg.content ?? "*(empty)*").slice(0, 1000) },
            )
            .setTimestamp();
          await logCh.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) { logger.error({ err }, "Message update log error"); }
  });

  client.on(Events.MessageDelete, async (msg) => {
    if (msg.author?.bot || !msg.guild) return;
    try {
      const guildId = msg.guild.id;
      const [logConfig] = await db.select().from(messageLogConfigTable).where(eq(messageLogConfigTable.guildId, guildId));
      if (!logConfig?.enabled || !logConfig.logDeletes) return;

      await db.insert(messageLogsTable).values({
        guildId,
        channelId: msg.channelId,
        channelName: (msg.channel as any)?.name ?? "unknown",
        userId: msg.author?.id ?? "unknown",
        username: msg.author?.username ?? "Unknown",
        messageId: msg.id,
        type: "delete",
        oldContent: msg.content?.slice(0, 2000) ?? null,
        newContent: null,
      });

      if (logConfig.logChannelId) {
        const logCh = msg.guild.channels.cache.get(logConfig.logChannelId) as any;
        if (logCh?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle("🗑️ Message Deleted")
            .addFields(
              { name: "User", value: `<@${msg.author?.id}> (${msg.author?.tag ?? "Unknown"})`, inline: true },
              { name: "Channel", value: `<#${msg.channelId}>`, inline: true },
              { name: "Content", value: (msg.content ?? "*(no content)*").slice(0, 1024) },
            )
            .setTimestamp();
          await logCh.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) { logger.error({ err }, "Message delete log error"); }
  });

  await client.login(token);
}

// ── Button handler ───────────────────────────────────────────────────────────
async function handleButton(interaction: ButtonInteraction) {
  const { customId, guild, user } = interaction;

  // ── Disco Hook ephemeral button ────────────────────────────────────────────
  if (customId.startsWith("disco_btn_")) {
    const response = discoButtonResponses.get(customId) ?? "✅";
    await interaction.reply({ content: response, ephemeral: true });
    return;
  }

  // ── Verification ticket ────────────────────────────────────────────────────
  if (customId.startsWith("verify_ticket_")) {
    const targetUserId = customId.replace("verify_ticket_", "");
    const guildId = guild?.id;
    if (!guildId) return;
    try {
      const [vConfig] = await db.select().from(verificationConfigTable).where(eq(verificationConfigTable.guildId, guildId));
      if (!vConfig?.enabled) {
        await interaction.reply({ content: "❌ Verification system is disabled.", ephemeral: true });
        return;
      }
      const { ChannelType: CT, PermissionFlagsBits: PFB } = await import("discord.js");
      const staffOverwrites: any[] = [
        { id: guild!.id, deny: [PFB.ViewChannel] },
        { id: targetUserId, allow: [PFB.ViewChannel, PFB.SendMessages], deny: [PFB.ManageMessages] },
        { id: guild!.members.me!.id, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ManageChannels, PFB.ManageMessages] },
      ];
      // Grant any role with ManageRoles permission access to the ticket
      const staffRoles = guild!.roles.cache.filter(r =>
        r.permissions.has(PFB.ManageRoles) && !r.managed && r.id !== guild!.id
      );
      for (const [, role] of staffRoles) {
        staffOverwrites.push({ id: role.id, allow: [PFB.ViewChannel, PFB.SendMessages] });
      }
      const ticketCh = await guild!.channels.create({
        name: `verify-${user.username}`,
        type: CT.GuildText,
        parent: vConfig.categoryId ?? undefined,
        permissionOverwrites: staffOverwrites,
      });

      const { ActionRowBuilder: ARB2, ButtonBuilder: BB2, ButtonStyle: BS2 } = await import("discord.js");
      const verifyRow = new (ARB2 as any)().addComponents(
        new BB2().setCustomId(`verify_approve_${targetUserId}`).setLabel("Verify Member").setStyle(BS2.Success).setEmoji("✅"),
        new BB2().setCustomId(`verify_deny_${targetUserId}`).setLabel("Deny").setStyle(BS2.Danger).setEmoji("❌"),
      );
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("🎫 Verification Ticket")
        .setDescription(`<@${targetUserId}> is requesting access. Staff: click Verify or Deny.`);
      await ticketCh.send({ embeds: [embed], components: [verifyRow] });
      await interaction.reply({ content: `✅ Your verification ticket has been opened: ${ticketCh}`, ephemeral: true });
    } catch (err) {
      logger.error({ err }, "Verification ticket create error");
      await interaction.reply({ content: "❌ Failed to open verification ticket.", ephemeral: true }).catch(() => {});
    }
    return;
  }

  // ── Staff verify approve/deny ──────────────────────────────────────────────
  if (customId.startsWith("verify_approve_") || customId.startsWith("verify_deny_")) {
    const isApprove = customId.startsWith("verify_approve_");
    const targetUserId = customId.replace(isApprove ? "verify_approve_" : "verify_deny_", "");
    const guildId = guild?.id;
    if (!guildId) return;

    // ── Permission gate: only staff (ManageRoles) can approve/deny ─────────
    const clicker = await guild!.members.fetch(user.id).catch(() => null);
    if (!clicker?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: "❌ You need **Manage Roles** permission to verify members.", ephemeral: true });
      return;
    }
    // Prevent the target user from self-verifying
    if (user.id === targetUserId) {
      await interaction.reply({ content: "❌ You cannot verify yourself.", ephemeral: true });
      return;
    }

    try {
      const [vConfig] = await db.select().from(verificationConfigTable).where(eq(verificationConfigTable.guildId, guildId));
      const member = await guild!.members.fetch(targetUserId).catch(() => null);
      if (member && isApprove) {
        if (vConfig?.verifiedRoleId) {
          const verRole = guild!.roles.cache.get(vConfig.verifiedRoleId);
          if (verRole) await member.roles.add(verRole).catch(() => {});
        }
        if (vConfig?.unverifiedRoleId) {
          const unverRole = guild!.roles.cache.get(vConfig.unverifiedRoleId);
          if (unverRole) await member.roles.remove(unverRole).catch(() => {});
        }
        if (vConfig?.categoryId) {
          const cat = guild!.channels.cache.get(vConfig.categoryId) as any;
          if (cat) await cat.permissionOverwrites.edit(member, { ViewChannel: false }).catch(() => {});
        }
        await db.insert(verificationLogsTable).values({ guildId, userId: targetUserId, username: member.user.username, type: "ticket", status: "verified" });
        await db.insert(analyticsEventsTable).values({ guildId, type: "verification_pass" });
        await interaction.reply({ content: `✅ <@${targetUserId}> has been verified!`, ephemeral: false });
        // Close ticket channel after 5s
        setTimeout(() => { (interaction.channel as any)?.delete().catch(() => {}); }, 5000);
      } else if (!isApprove) {
        await db.insert(verificationLogsTable).values({ guildId, userId: targetUserId, username: member?.user.username ?? "Unknown", type: "ticket", status: "failed" });
        await db.insert(analyticsEventsTable).values({ guildId, type: "verification_fail" });
        await interaction.reply({ content: `❌ <@${targetUserId}> was denied verification.`, ephemeral: false });
        setTimeout(() => { (interaction.channel as any)?.delete().catch(() => {}); }, 5000);
      }
    } catch (err) {
      logger.error({ err }, "Verify approve/deny error");
      await interaction.reply({ content: "❌ Error processing verification.", ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (customId.startsWith("ticket_open_")) {
    const guildId = guild?.id;
    if (!guildId) return;
    try {
      const [settings] = await db.select().from(ticketSettingsTable).where(eq(ticketSettingsTable.guildId, guildId));
      if (!settings?.enabled) {
        await interaction.reply({ content: "❌ Ticket system is disabled.", ephemeral: true });
        return;
      }

      const userTickets = await db.select().from(openTicketsTable)
        .where(and(eq(openTicketsTable.guildId, guildId), eq(openTicketsTable.userId, user.id), eq(openTicketsTable.status, "open")));
      if (userTickets.length >= (settings.maxOpenTickets ?? 1)) {
        await interaction.reply({ content: `❌ You already have ${userTickets.length} open ticket(s). Please close it first.`, ephemeral: true });
        return;
      }

      const member = await guild!.members.fetch(user.id);
      const categoryChannel = settings.categoryId ? guild!.channels.cache.get(settings.categoryId) : null;
      const ticketChannel = await guild!.channels.create({
        name: `ticket-${user.username}`,
        type: ChannelType.GuildText,
        parent: categoryChannel?.id,
        permissionOverwrites: [
          { id: guild!.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          ...(settings.supportRoleId ? [{ id: settings.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
          { id: guild!.members.me!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ],
      });

      await db.insert(openTicketsTable).values({ guildId, channelId: ticketChannel.id, userId: user.id });

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("🎫 Ticket Opened")
        .setDescription(settings.ticketMessage || "A staff member will be with you shortly.");

      await ticketChannel.send({
        content: `<@${user.id}>${settings.supportRoleId ? ` <@&${settings.supportRoleId}>` : ""}`,
        embeds: [embed],
      });

      await interaction.reply({ content: `✅ Your ticket has been opened: ${ticketChannel}`, ephemeral: true });

      if (settings.logChannelId) {
        const logCh = guild!.channels.cache.get(settings.logChannelId) as any;
        if (logCh?.isTextBased()) {
          await logCh.send(`📋 Ticket opened by **${user.tag}** → ${ticketChannel}`).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err }, "Ticket open error");
      await interaction.reply({ content: "❌ Failed to open ticket.", ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (customId.startsWith("app_apply_")) {
    const parts = customId.split("_");
    const appId = parseInt(parts[parts.length - 1] ?? "0");
    try {
      const [app] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, appId));
      if (!app) { await interaction.reply({ content: "❌ Application not found.", ephemeral: true }); return; }

      const questions = (app.questions as Array<{ id: string; question: string; required?: boolean }>) ?? [];
      if (!questions.length) { await interaction.reply({ content: "❌ No questions configured.", ephemeral: true }); return; }

      const modal = new ModalBuilder()
        .setCustomId(`app_submit_${appId}`)
        .setTitle(app.title.slice(0, 45));

      const rows = questions.slice(0, 5).map(q =>
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(`q_${q.id}`)
            .setLabel(q.question.slice(0, 45))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(q.required ?? true)
            .setMaxLength(1000)
        )
      );
      modal.addComponents(...rows);
      await interaction.showModal(modal);
    } catch (err) {
      logger.error({ err }, "Application modal error");
      await interaction.reply({ content: "❌ Failed to open application.", ephemeral: true }).catch(() => {});
    }
    return;
  }
}

// ── Modal submit handler ─────────────────────────────────────────────────────
async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  const { customId, guild, user } = interaction;

  if (customId.startsWith("app_submit_")) {
    const appId = parseInt(customId.split("_")[2] ?? "0");
    try {
      const [app] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, appId));
      if (!app || !app.responseChannelId) {
        await interaction.reply({ content: "❌ Application not properly configured.", ephemeral: true });
        return;
      }

      const responseChannel = guild?.channels.cache.get(app.responseChannelId) as any;
      if (!responseChannel?.isTextBased()) {
        await interaction.reply({ content: "❌ Response channel not found.", ephemeral: true });
        return;
      }

      const questions = (app.questions as Array<{ id: string; question: string }>) ?? [];
      const answers = questions.slice(0, 5).map(q => {
        const answer = interaction.fields.getTextInputValue(`q_${q.id}`).trim();
        return { question: q.question, answer };
      });

      const embed = new EmbedBuilder()
        .setColor(parseInt((app.color || "#7C3AED").replace("#", ""), 16))
        .setTitle(`📋 New Application — ${app.title}`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(`**Applicant:** ${user.tag} (<@${user.id}>)`)
        .addFields(answers.map(a => ({ name: a.question.slice(0, 256), value: a.answer.slice(0, 1024) || "*(no answer)*" })))
        .setTimestamp();

      await responseChannel.send({ embeds: [embed] });
      await interaction.reply({ content: "✅ Your application has been submitted!", ephemeral: true });
    } catch (err) {
      logger.error({ err }, "Application submit error");
      await interaction.reply({ content: "❌ Failed to submit application.", ephemeral: true }).catch(() => {});
    }
  }
}

// ── Loops ────────────────────────────────────────────────────────────────────
function startAlwaysOnlineLoop() {
  if (alwaysOnlineInterval) clearInterval(alwaysOnlineInterval);
  alwaysOnlineInterval = setInterval(async () => {
    try {
      const configs = await db.select().from(alwaysOnlineTable).where(eq(alwaysOnlineTable.enabled, true));
      for (const config of configs) {
        if (!config.channelId || !client) continue;
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.get(config.channelId) as any;
        if (!channel?.isTextBased()) continue;
        const now = new Date();
        const last = config.lastSentAt;
        const intervalMs = (config.intervalMinutes || 60) * 60000;
        if (last && now.getTime() - new Date(last).getTime() < intervalMs) continue;

        if (config.embedEnabled) {
          const embed = new EmbedBuilder()
            .setColor(parseInt(config.embedColor.replace("#", ""), 16))
            .setDescription(config.message);
          if (config.embedTitle) embed.setTitle(config.embedTitle);
          if (config.embedDescription) embed.setDescription(config.embedDescription);
          await channel.send({ embeds: [embed] });
        } else {
          await channel.send(config.message);
        }
        await db.update(alwaysOnlineTable).set({ lastSentAt: now }).where(eq(alwaysOnlineTable.guildId, config.guildId));
      }
    } catch (err) { logger.error({ err }, "Always online loop error"); }
  }, 60_000);
}

function startReminderLoop() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(async () => {
    try {
      const all = await db.select().from(remindersTable).where(eq(remindersTable.sent, false));
      const now = new Date();
      for (const r of all) {
        if (new Date(r.scheduledAt) > now) continue;
        if (!client) continue;
        const guild = client.guilds.cache.get(r.guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.get(r.channelId) as any;
        if (!channel?.isTextBased()) continue;
        await channel.send({ content: `<@${r.userId}> 🚨 **Reminder:** ${r.message}` });
        await db.update(remindersTable).set({ sent: true }).where(eq(remindersTable.id, r.id));
      }
    } catch (err) { logger.error({ err }, "Reminder loop error"); }
  }, 30_000);
}

// ── Stats Channels Loop ──────────────────────────────────────────────────────
function startStatsChannelsLoop() {
  if (statsChannelsInterval) clearInterval(statsChannelsInterval);

  const updateStats = async () => {
    if (!client) return;
    try {
      const configs = await db.select().from(statsChannelsTable).where(eq(statsChannelsTable.enabled, true));
      for (const config of configs) {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) continue;
        try {
          await guild.members.fetch();
          const totalMembers = guild.memberCount;
          const bots = guild.members.cache.filter(m => m.user.bot).size;
          const boosts = guild.premiumSubscriptionCount ?? 0;
          const onlineCount = guild.members.cache.filter(m => m.presence?.status !== undefined && m.presence.status !== "offline").size;

          const updates: Array<[string | null, string]> = [
            [config.membersChannelId, `👥 Members: ${totalMembers.toLocaleString()}`],
            [config.onlineChannelId, `🟢 Online: ${onlineCount > 0 ? onlineCount.toLocaleString() : "N/A"}`],
            [config.botsChannelId, `🤖 Bots: ${bots.toLocaleString()}`],
            [config.boostsChannelId, `✨ Boosts: ${boosts.toLocaleString()}`],
          ];

          for (const [channelId, name] of updates) {
            if (!channelId) continue;
            const ch = guild.channels.cache.get(channelId) as any;
            if (ch && ch.type === ChannelType.GuildVoice) {
              await ch.setName(name).catch(() => {});
            }
          }
        } catch (err) {
          logger.error({ err, guildId: config.guildId }, "Stats channels update error for guild");
        }
      }
    } catch (err) { logger.error({ err }, "Stats channels loop error"); }
  };

  // Run immediately on start, then every 10 minutes
  updateStats();
  statsChannelsInterval = setInterval(updateStats, 10 * 60 * 1000);
}

// ── Giveaway Loop ────────────────────────────────────────────────────────────
function startGiveawayLoop() {
  if (giveawayInterval) clearInterval(giveawayInterval);
  giveawayInterval = setInterval(async () => {
    if (!client) return;
    try {
      const now = new Date();
      const expired = await db.select().from(giveawaysTable)
        .where(and(eq(giveawaysTable.ended, false), lte(giveawaysTable.endsAt, now)));

      for (const giveaway of expired) {
        // Atomically claim the giveaway: only proceed if we actually flip ended to true.
        // This prevents duplicate winner announcements if the 30s interval fires while
        // a previous iteration is still running (optimistic lock via conditional update).
        let claimed;
        try {
          const rows = await db.update(giveawaysTable)
            .set({ ended: true })
            .where(and(eq(giveawaysTable.id, giveaway.id), eq(giveawaysTable.ended, false)))
            .returning();
          claimed = rows.length > 0;
        } catch (err) {
          logger.error({ err, giveawayId: giveaway.id }, "Failed to claim giveaway atomically");
          continue;
        }
        if (!claimed) continue; // another concurrent process already handled it

        try {
          const { pickWinners } = await import("../routes/giveaways.js");
          const winners = await pickWinners(giveaway);
          // Store winners (ended is already true from the atomic claim above)
          await db.update(giveawaysTable)
            .set({ winners })
            .where(eq(giveawaysTable.id, giveaway.id));
        } catch (err) {
          logger.error({ err, giveawayId: giveaway.id }, "Failed to pick giveaway winners");
        }
      }
    } catch (err) { logger.error({ err }, "Giveaway loop error"); }
  }, 30_000);
}

// ── Presence cycling ─────────────────────────────────────────────────────────
const PRESENCES = [
  { type: ActivityType.Watching,  name: "over your server 👁️" },
  { type: ActivityType.Playing,   name: "with slash commands ⚡" },
  { type: ActivityType.Listening, name: "to your commands 🎧" },
  { type: ActivityType.Watching,  name: "for rule breakers 🛡️" },
  { type: ActivityType.Playing,   name: "Umbra Utilities v2 🚀" },
  { type: ActivityType.Watching,  name: `${new Date().toLocaleDateString()} 📅` },
] as const;

let presenceIndex = 0;

function startPresenceCycling(c: Client) {
  if (presenceInterval) clearInterval(presenceInterval);

  const setPresence = () => {
    const p = PRESENCES[presenceIndex % PRESENCES.length];
    try {
      c.user?.setPresence({
        activities: [{ type: p.type, name: p.name }],
        status: "online",
      });
    } catch {}
    presenceIndex++;
  };

  setPresence(); // set immediately on ready
  presenceInterval = setInterval(setPresence, 20 * 60 * 1000); // rotate every 20 min
}

export function getBotGuilds() {
  if (!client) return [];
  return client.guilds.cache.map(g => ({ id: g.id, name: g.name, icon: g.icon, memberCount: g.memberCount, botPresent: true }));
}

export async function getBotGuildDetail(guildId: string) {
  if (!client) return null;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  const full = await guild.fetch();
  const channels = full.channels.cache
    .filter(c => c.isTextBased() || (c.type as number) === ChannelType.GuildVoice)
    .map(c => ({
      id: c.id,
      name: c.name,
      type: c.type === ChannelType.GuildVoice ? "voice" : "text",
    }));
  const roles = full.roles.cache.filter(r => r.id !== full.id).map(r => ({ id: r.id, name: r.name, color: r.color }));
  return { id: full.id, name: full.name, icon: full.icon, memberCount: full.memberCount, botPresent: true, channels, roles };
}
