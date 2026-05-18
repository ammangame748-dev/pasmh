require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    InteractionType
} = require('discord.js');

const express = require('express');
const path = require('path');

const app = express();

// ================= EXPRESS =================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.use((req, res) => res.status(404).send("Not Found"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on ${PORT}`));

// ================= DISCORD CLIENT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ================= DATA =================
let autoLineBanner = null;
let lastTicketImage = null;
let lastTicketEmoji = null;
let lastRenameImage = null;
let lastRenameEmoji = null;

// ================= COMMANDS =================
const commands = [
    {
        name: 'set-line',
        description: 'تحديد صورة الخط',
        options: [{
            name: 'image',
            description: 'الصورة',
            type: 11,
            required: true
        }]
    },
    {
        name: 'setup-ticket',
        description: 'إعداد التذاكر',
        options: [
            { name: 'image', type: 11, description: 'صورة', required: true },
            { name: 'emoji', type: 3, description: 'ايموجي ID', required: true }
        ]
    },
    {
        name: 'setup-rename',
        description: 'إعداد تغيير الاسم',
        options: [
            { name: 'image', type: 11, required: true },
            { name: 'emoji', type: 3, required: true }
        ]
    }
];

// ================= READY =================
client.on('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);

    await client.application.commands.set(commands);
});

// ================= MESSAGE COMMANDS =================
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    // خط
    if (message.content === '-خط' && autoLineBanner) {
        await message.delete().catch(() => { });
        return message.channel.send({ files: [autoLineBanner] });
    }

    // صلاحية
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;

    // قفل
    if (message.content === 'ق') {
        await message.channel.permissionOverwrites.edit(message.guild.id, {
            SendMessages: false
        });

        await message.delete().catch(() => { });
        message.channel.send("🔒 تم القفل").then(m => setTimeout(() => m.delete(), 3000));
    }

    // فتح
    if (message.content === 'ف') {
        await message.channel.permissionOverwrites.edit(message.guild.id, {
            SendMessages: true
        });

        await message.delete().catch(() => { });
        message.channel.send("🔓 تم الفتح").then(m => setTimeout(() => m.delete(), 3000));
    }

    // مسح
    if (message.content.startsWith('م')) {
        const amount = parseInt(message.content.slice(1));
        if (!amount || amount <= 0) return;

        if (amount > 100) return message.reply("max 100");

        await message.channel.bulkDelete(amount + 1, true).catch(() => { });
    }
});

// ================= INTERACTIONS =================
client.on('interactionCreate', async (interaction) => {

    // ================= SLASH =================
    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === 'set-line') {
            autoLineBanner = interaction.options.getAttachment('image').url;
            return interaction.reply({ content: "✅ تم حفظ الخط", ephemeral: true });
        }

        if (interaction.commandName === 'setup-ticket') {
            lastTicketImage = interaction.options.getAttachment('image').url;
            lastTicketEmoji = interaction.options.getString('emoji');

            const modal = new ModalBuilder()
                .setCustomId('ticket_modal')
                .setTitle('Setup Ticket');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('msg')
                        .setLabel('الوصف')
                        .setStyle(TextInputStyle.Paragraph)
                )
            );

            return interaction.showModal(modal);
        }

        if (interaction.commandName === 'setup-rename') {
            lastRenameImage = interaction.options.getAttachment('image').url;
            lastRenameEmoji = interaction.options.getString('emoji');

            const modal = new ModalBuilder()
                .setCustomId('rename_modal')
                .setTitle('Rename Setup');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('msg')
                        .setLabel('الوصف')
                        .setStyle(TextInputStyle.Paragraph)
                )
            );

            return interaction.showModal(modal);
        }
    }

    // ================= MODALS =================
    if (interaction.isModalSubmit()) {

        // ticket panel
        if (interaction.customId === 'ticket_modal') {

            const embed = new EmbedBuilder()
                .setDescription(interaction.fields.getTextInputValue('msg'))
                .setColor('Blue');

            if (lastTicketImage) embed.setImage(lastTicketImage);

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('open_ticket')
                    .setPlaceholder('فتح تذكرة')
                    .addOptions([
                        {
                            label: 'فتح',
                            value: 'create',
                            emoji: lastTicketEmoji
                        }
                    ])
            );

            await interaction.channel.send({
                embeds: [embed],
                components: [menu]
            });

            return interaction.reply({ content: "تم النشر", ephemeral: true });
        }

        // rename panel
        if (interaction.customId === 'rename_modal') {

            const embed = new EmbedBuilder()
                .setDescription(interaction.fields.getTextInputValue('msg'))
                .setColor('Purple');

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rename_menu')
                    .setPlaceholder('تغيير الاسم')
                    .addOptions([
                        {
                            label: 'تغيير',
                            value: 'go',
                            emoji: lastRenameEmoji
                        }
                    ])
            );

            await interaction.channel.send({
                embeds: [embed],
                components: [menu]
            });

            return interaction.reply({ content: "تم النشر", ephemeral: true });
        }

        // rename channel
        if (interaction.customId === 'modal_rename_t') {
            const name = interaction.fields.getTextInputValue('name');

            await interaction.channel.setName(name);

            return interaction.reply({ content: "تم التغيير", ephemeral: true });
        }
    }

    // ================= SELECT MENU =================
    if (interaction.isStringSelectMenu()) {

        // open ticket
        if (interaction.customId === 'open_ticket') {

            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ]
            });

            return interaction.reply({
                content: `تم إنشاء التذكرة: ${channel}`,
                ephemeral: true
            });
        }

        // rename modal trigger
        if (interaction.customId === 'rename_menu') {

            const modal = new ModalBuilder()
                .setCustomId('modal_rename_t')
                .setTitle('Rename');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel('الاسم الجديد')
                        .setStyle(TextInputStyle.Short)
                )
            );

            return interaction.showModal(modal);
        }
    }
});

// ================= ERROR HANDLING =================
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// ================= LOGIN =================
client.login(process.env.TOKEN);