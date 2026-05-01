const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, PermissionFlagsBits, ModalBuilder, TextInputBuilder, 
    TextInputStyle, StringSelectMenuBuilder, InteractionType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// مخازن مؤقتة للبيانات
let autoLineBanner = null;
let lastTicketImage = null, lastTicketEmoji = null;
let lastRenameImage = null, lastRenameEmoji = null;

client.on('ready', async () => {
    console.log(`✅ ${client.user.tag} متصل وجاهز!`);
    
    const commands = [
        { 
            name: 'set-line', 
            description: 'تحديد بنر الخط التلقائي (ارفع صورة)', 
            options: [{ name: 'image', description: 'ارفع صورة الخط', type: 11, required: true }] 
        },
        { 
            name: 'setup-ticket', 
            description: 'إعداد بانل التذاكر (منيو)', 
            options: [
                { name: 'image', description: 'ارفع صورة للبانل', type: 11, required: true }, 
                { name: 'emoji_id', description: 'ضع ID الإيموجي للمنيو', type: 3, required: true }
            ] 
        },
        { 
            name: 'setup-rename', 
            description: 'إعداد قائمة تغيير الأسماء (منيو)', 
            options: [
                { name: 'image', description: 'ارفع صورة للإيمباد', type: 11, required: true }, 
                { name: 'emoji', description: 'ضع الإيموجي للمنيو', type: 3, required: true }
            ] 
        },
        { 
            name: 'ban', 
            description: 'طرد نهائي (باند)', 
            options: [
                { name: 'user', description: 'العضو المراد حظره', type: 6, required: true }, 
                { name: 'reason', description: 'سبب الحظر', type: 3, required: false }
            ] 
        },
        { 
            name: 'timeout', 
            description: 'تايم آوت', 
            options: [
                { name: 'user', description: 'العضو المراد إعطاؤه وقت', type: 6, required: true }, 
                { name: 'duration', description: 'المدة بالدقائق', type: 4, required: true }
            ] 
        }
    ];
    await client.application.commands.set(commands);
});

// منع الكراش
process.on('unhandledRejection', error => { console.error('Error:', error); });

// نظام الخط التلقائي
client.on('messageCreate', async (message) => {
    if (message.content === '-خط' && autoLineBanner) {
        try {
            await message.delete();
            await message.channel.send({ files: [autoLineBanner] });
        } catch (e) {}
    }
        if (message.author.bot || !message.guild) return;
    
    // التأكد أن الشخص اللي كتب الأمر عنده صلاحية إدارة القنوات
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;

    // --- قفل وفتح (ق / ف) مع حذف رسالة البوت ---
    if (message.content === 'ق') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        await message.delete().catch(() => {});
        message.channel.send("🔒 **تم قفل القناة.**").then(msg => setTimeout(() => msg.delete(), 100));
    }

    if (message.content === 'ف') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
        await message.delete().catch(() => {});
        message.channel.send("🔓 **تم فتح القناة.**").then(msg => setTimeout(() => msg.delete(), 100));
    }

    // --- إخفاء وإظهار (hi / ih) مع حذف رسالة البوت ---
    if (message.content === 'hi') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
        await message.channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false });
        await message.delete().catch(() => {});
        message.channel.send("👻 **تم إخفاء القناة.**").then(msg => setTimeout(() => msg.delete(), 100));
    }

    if (message.content === 'ih') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
        await message.channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: true });
        await message.delete().catch(() => {});
        message.channel.send("👁️ **تم إظهار القناة.**").then(msg => setTimeout(() => msg.delete(), 100));
    }

    // --- أمر مسح الرسائل السريع (م + عدد) ---
    if (message.content.startsWith('م')) {
        // التأكد من أن الشخص لديه صلاحية إدارة الرسائل
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        const amount = parseInt(message.content.slice(1)); // استخراج الرقم من بعد حرف "م"

        // إذا لم يتم وضع رقم صحيح
        if (isNaN(amount) || amount <= 0) return;

        // الحد الأقصى للمسح دفعة واحدة هو 100
        if (amount > 100) {
            return message.reply("⚠️ لا يمكنك مسح أكثر من 100 رسالة.").then(msg => {
                setTimeout(() => msg.delete(), 100);
                setTimeout(() => message.delete(), 100);
            });
        }

        try {
            // نمسح عدد الرسائل المطلوبة + رسالة الأمر (م)
            await message.channel.bulkDelete(amount + 1, true);
            
            // إرسال رسالة تأكيد وحذفها بعد 3 ثوانٍ
            const successMsg = await message.channel.send(`✅ تم تطهير الشات ومسح **${amount}** رسالة.`);
            setTimeout(() => successMsg.delete().catch(() => {}), 3000);
        } catch (e) {
            console.error("خطأ في المسح:", e);
            message.reply("❌ لا يمكن مسح رسائل قديمة جداً (أكثر من 14 يوم).")
                .then(msg => setTimeout(() => { msg.delete(); message.delete(); }, 100));
        }
    }

});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'set-line') {
            autoLineBanner = interaction.options.getAttachment('image').url;
            await interaction.reply({ content: "✅ تم حفظ البنر بنجاح!", ephemeral: true });
        }

        if (interaction.commandName === 'setup-ticket') {
            lastTicketImage = interaction.options.getAttachment('image').url;
            lastTicketEmoji = interaction.options.getString('emoji_id');
            const modal = new ModalBuilder().setCustomId('t_setup').setTitle('إعداد التذكرة');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('t_msg').setLabel("محتوى الإيمباد").setStyle(TextInputStyle.Paragraph)
            ));
            await interaction.showModal(modal);
        }

        if (interaction.commandName === 'setup-rename') {
            lastRenameImage = interaction.options.getAttachment('image').url;
            lastRenameEmoji = interaction.options.getString('emoji');
            const modal = new ModalBuilder().setCustomId('r_setup').setTitle('إعداد قائمة الأسماء');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('r_msg').setLabel("وصف القائمة").setStyle(TextInputStyle.Paragraph)
            ));
            await interaction.showModal(modal);
        }

        if (interaction.commandName === 'ban' || interaction.commandName === 'timeout') {
            const user = interaction.options.getMember('user');
            try {
                if (interaction.commandName === 'ban') { await user.ban(); await interaction.reply(`✅ طردنا ${user.user.tag}`); }
                else { await user.timeout(interaction.options.getInteger('duration') * 60000); await interaction.reply("✅ تم التايم آوت"); }
            } catch (e) { await interaction.reply({ content: "❌ رتبته أعلى مني!", ephemeral: true }); }
        }
    }
    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 't_setup') {
            const embed = new EmbedBuilder().setDescription(interaction.fields.getTextInputValue('t_msg')).setColor("Blue");
            if (lastTicketImage) embed.setImage(lastTicketImage);
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('open_t_menu')
                    .setPlaceholder('اضغط هنا لفتح تذكرة')
                    .addOptions([{ label: 'فتح تذكرة جديدة', value: 'create_ticket', emoji: lastTicketEmoji }])
            );
            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: "✅ تم النشر", ephemeral: true });
        }

        if (interaction.customId === 'r_setup') {
            const embed = new EmbedBuilder().setDescription(interaction.fields.getTextInputValue('r_msg')).setImage(lastRenameImage).setColor("Purple");
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rename_select')
                    .setPlaceholder('اختر لتغيير اسمك')
                    .addOptions([{ label: 'تغيير الاسم المستعار', value: 'go', emoji: lastRenameEmoji }])
            );
            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: "✅ تم النشر", ephemeral: true });
        }

        if (interaction.customId === 'actual_name_change') {
            const name = interaction.fields.getTextInputValue('new_name');
            try {
                await interaction.member.setNickname(name);
                await interaction.reply({ content: `✅ صار اسمك: ${name}`, ephemeral: true });
            } catch (e) { await interaction.reply({ content: "❌ لا أستطيع تغيير اسمك!", ephemeral: true }); }
        }

        if (interaction.customId === 'modal_rename_ch') {
            await interaction.channel.setName(interaction.fields.getTextInputValue('new_ch_name'));
            await interaction.reply({ content: `✅ تم تغيير اسم التذكرة`, ephemeral: true });
        }
        if (interaction.customId === 'modal_add_user') {
            const id = interaction.fields.getTextInputValue('user_id');
            await interaction.channel.permissionOverwrites.create(id, { ViewChannel: true, SendMessages: true });
            await interaction.reply({ content: `✅ تم إضافة <@${id}> للتذكرة.` });
        }
        if (interaction.customId === 'modal_remove_user') {
            const id = interaction.fields.getTextInputValue('user_id');
            await interaction.channel.permissionOverwrites.delete(id);
            await interaction.reply({ content: `✅ تم إزالة <@${id}> من التذكرة.` });
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'open_t_menu') {
            const ch = await interaction.guild.channels.create({ 
                name: `ticket-${interaction.user.username}`,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ],
            });
            await interaction.reply({ content: `تذكرتك: ${ch}`, ephemeral: true });

            const eb = new EmbedBuilder().setTitle("🎫 تذكرة جديدة").setDescription(`مرحباً ${interaction.user}`).setColor("Green");
            if (lastTicketImage) eb.setImage(lastTicketImage);

            const r1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_t').setLabel('استلام').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_t').setLabel('إغلاق').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('call_owner').setLabel('منشن صاحبها').setStyle(ButtonStyle.Secondary)
            );

            const r2 = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_actions').setPlaceholder('خيارات التذكرة').addOptions([
                    { label: 'إضافة شخص', value: 'add_user', emoji: '➕' },
                    { label: 'إزالة شخص', value: 'remove_user', emoji: '➖' },
                    { label: 'تغيير اسم', value: 'rename_t', emoji: '📝' }
                ])
            );
            await ch.send({ embeds: [eb], components: [r1, r2] });
        }

        if (interaction.customId === 'rename_select') {
            const modal = new ModalBuilder().setCustomId('actual_name_change').setTitle('تغيير الاسم');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('new_name').setLabel("اكتب اسمك الجديد").setStyle(TextInputStyle.Short)
            ));
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'ticket_actions') {
            const act = interaction.values[0];
            const modal = new ModalBuilder().setCustomId(`modal_${act}`).setTitle('إجراء التذكرة');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId(act === 'rename_t' ? 'new_ch_name' : 'user_id').setLabel(act === 'rename_t' ? "الاسم الجديد" : "ID العضو").setStyle(TextInputStyle.Short)
            ));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'claim_t') await interaction.reply(`✅ تم الاستلام بواسطة: ${interaction.user}`);
        if (interaction.customId === 'close_t') { await interaction.reply("جاري الحذف..."); setTimeout(() => interaction.channel.delete().catch(() => {}), 3000); }
        if (interaction.customId === 'call_owner') await interaction.reply(`🔔 ننتظر حضور صاحب التذكرة!`);
    }
});

client.login(process.env.TOKEN);
const http = require('http');
http.createServer((req, res) => {
  res.write("I'm alive");
  res.end();
}).listen(8080);
