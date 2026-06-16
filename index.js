const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Events,
    REST, 
    Routes, 
    SlashCommandBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const bot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// إعداد مجلد رفع الصور للـ Dashboard
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// قاعدة بيانات مؤقتة لحفظ الإعدادات لكل سيرفر
let serverSettings = {};

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-fallback-secret-key-998877',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.get('/login', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
    const discordUrl = `https://discord.com{clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
    res.redirect(discordUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('فشل تسجيل الدخول!');

    try {
        const tokenResponse = await fetch('https://discord.com', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.REDIRECT_URI
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const tokens = await tokenResponse.json();

        const guildsResponse = await fetch('https://discord.com', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        const guilds = await guildsResponse.json();

        // فلترة السيرفرات التي يمتلك فيها المستخدم صلاحية Administrator (رقم الصلاحية 0x8)
        const adminGuilds = guilds.filter(g => (g.permissions & 0x8) === 0x8);

        req.session.userGuilds = adminGuilds;
        req.session.loggedIn = true;

        res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
        res.send('حدث خطأ أثناء الاتصال بالديسكورد.');
    }
});

// صفحة اختيار السيرفرات
app.get('/dashboard', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/login');
    res.render('dashboard', { guilds: req.session.userGuilds });
});

// صفحة التحكم والـ 6 أزرار لسيرفر معين
app.get('/dashboard/:guildId', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/login');
    const guildId = req.params.guildId;

    const hasAccess = req.session.userGuilds.some(g => g.id === guildId);
    if (!hasAccess) return res.status(403).send('لا تملك صلاحيات إدارة لهذا السيرفر.');

    const settings = serverSettings[guildId] || {
        channelId: '', title: '', description: '',
        buttons: Array(6).fill({ label: '', reply: '', emoji: '' })
    };

    res.render('server', { guildId, settings });
});

app.post('/dashboard/:guildId/save', upload.single('image'), async (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/login');
    const guildId = req.params.guildId;

    let buttonsData = [];
    for (let i = 0; i < 6; i++) {
        if (req.body[`btn_label_${i}`] && req.body[`btn_label_${i}`].trim() !== '') {
            buttonsData.push({
                label: req.body[`btn_label_${i}`],
                emoji: req.body[`btn_emoji_${i}`] || null,
                reply: req.body[`btn_reply_${i}`]
            });
        }
    }

    serverSettings[guildId] = {
        channelId: req.body.channelId,
        title: req.body.title,
        description: req.body.description,
        buttons: buttonsData,
        imagePath: req.file ? req.file.path : (serverSettings[guildId]?.imagePath || null)
    };

    try {
        const channel = await bot.channels.fetch(req.body.channelId);
        if (!channel) return res.send('لم يتم العثور على الروم، يرجى التحقق من الـ ID.');

        const embed = new EmbedBuilder()
            .setTitle(req.body.title)
            .setDescription(req.body.description)
            .setColor('#6366f1');

        let files = [];
        if (serverSettings[guildId].imagePath) {
            const fileName = path.basename(serverSettings[guildId].imagePath);
            embed.setImage(`attachment://${fileName}`);
            files.push({ attachment: serverSettings[guildId].imagePath, name: fileName });
        }

        let components = [];
        if (buttonsData.length > 0) {
            let currentRow = new ActionRowBuilder();

            buttonsData.forEach((btnInfo, index) => {
                if (index > 0 && index % 3 === 0) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }

                const button = new ButtonBuilder()
                    .setCustomId(`custom_btn_${guildId}_${index}`)
                    .setLabel(btnInfo.label)
                    .setStyle(ButtonStyle.Secondary);

                if (btnInfo.emoji && btnInfo.emoji.trim() !== '') {
                    button.setEmoji(btnInfo.emoji.trim());
                }

                currentRow.addComponents(button);
            });

            if (currentRow.components.length > 0) components.push(currentRow);
        }

        await channel.send({ embeds: [embed], components: components, files: files });
        res.send(`<script>alert("تم حفظ الإعدادات وإرسال الماب والمنيو بنجاح!"); window.location.href="/dashboard/${guildId}";</script>`);

    } catch (error) {
        console.error(error);
        res.send('حدث خطأ أثناء إرسال الرسالة إلى ديسكورد: ' + error.message);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});
app.get('/', (req, res) => {
    // سيرد السيرفر بصفحة بسيطة جداً تحتوي على صورة أو نص خفيف
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pasmh Bot Status</title>
            <style>
                body { background-color: #0f111a; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: white; font-family: sans-serif; }
                .status-container { text-align: center; }
                img { max-width: 150px; border-radius: 50%; box-shadow: 0 0 20px rgba(99, 102, 241, 0.5); }
                h1 { margin-top: 15px; font-size: 20px; color: #6366f1; }
            </style>
        </head>
        <body>
            <div class="status-container">
                <img src="https://discordapp.com" alt="Bot Logo">
                <h1>Pasmh Bot is Active 🚀</h1>
            </div>
        </body>
        </html>
    `);
});

// أضف كود الاستماع للمنفذ هنا ليعمل على Render بشكل صحيح
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[WEB] Server is running on port ${PORT}`);
});
app.get('/', (req, res) => {
    res.redirect('/login');
});
// 🔄 حدث موحد لمعالجة جميع أنواع التفاعلات منعاً للتعارض وبأعلى سرعة استجابة
bot.on(Events.InteractionCreate, async interaction => {
    
    // 1️⃣ التعامل مع أمر السلاش لإنشاء الروم وإرسال الإيمباد والمنيو الاحترافي
    // 1️⃣ التعامل مع أمر السلاش لإرسال الإيمباد والمنيو في نفس الروم مع دعم رفع الصور مباشرة
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-menu') {
            
            // رد مبدئي سريع جداً لحجز وقت الاستجابة ومنع ظهور رسالة الخطأ
            await interaction.deferReply({ ephemeral: true });

            try {
                // جلب القيم المدخلة من خيارات أمر السلاش (الوصف، ملف الصورة، الإيموجي)
                const customDescription = interaction.options.getString('description') || 'مرحباً بك في نظام تعديل الهوية الرقمية. يمكنك الآن تغيير اسمك المستعار داخل السيرفر ليظهر بشكل أنيق أمام الأعضاء، اضغط على القائمة المنسدلة أدناه للبدء.';
                const imageAttachment = interaction.options.getAttachment('image_file');
                const customEmoji = interaction.options.getString('emoji_id') || '💬';

                // بناء الإيمباد الناري المتناسق
                const menuEmbed = new EmbedBuilder()
                    .setTitle('تغيير الاسم المستعار')
                    .setDescription(customDescription)
                    .setColor('#6366f1');

                let sendPayload = { embeds: [menuEmbed], components: [] };

                // إذا قام المستخدم برفع ملف صورة، نقوم بإرفاقها مباشرة داخل الإيمباد
                if (imageAttachment) {
                    menuEmbed.setImage(imageAttachment.url);
                }

                // بناء المنيو وتطبيق الإيموجي المخصص الممرر من الأمر
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('identity_select_menu')
                    .setPlaceholder(' اضغط هنا لتغيير اسمك المستعار ...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('𝙲𝚑𝚊𝚗𝚐𝚎 𝙽𝚒𝚌𝚔𝚗𝚊𝚖𝚎')
                            .setDescription('اضغط لفتح نافذة كتابة اسمك الجديد')
                            .setValue('change_nickname_option')
                            .setEmoji(customEmoji.trim())
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);
                sendPayload.components.push(row);

                // إرسال المنشور المتكامل داخل نفس الروم التي نُفذ فيها الأمر حالياً
                await interaction.channel.send(sendPayload);

                // تحديث الرد المخفي للعضو بنجاح العملية
                await interaction.editReply({ content: `🔥 تم إرسال إيمباد المنيو بنجاح داخل هذه الروم!` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ حدث خطأ غير متوقع أثناء محاولة إرسال المنيو. تأكد من امتلاك البوت لكامل صلاحيات القراءة والإرسال في هذه الروم.' });
            }
        }
    }


    // 2️⃣ التعامل مع اختيار العضو من المنيو (فتح الـ Modal لتغيير الاسم)
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'identity_select_menu') {
            const selectedValue = interaction.values[0];

            if (selectedValue === 'change_nickname_option') {
                const modal = new ModalBuilder()
                    .setCustomId('change_name_modal')
                    .setTitle('💬〡𝙲𝚑𝚊𝚝 - 𝙽𝚒𝚌𝚔𝚗𝚊𝚖𝚎');

                const nameInput = new TextInputBuilder()
                    .setCustomId('new_name_input')
                    .setLabel("اكتب اسمك الجديد هنا:")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('مثال: 𝙰𝚑𝚖𝚎𝚍 ..')
                    .setRequired(true)
                    .setMaxLength(32); 

                const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
                modal.addComponents(firstActionRow);

                // إظهار المودال مباشرة للمستخدم
                await interaction.showModal(modal);
            }
        }
    }

    // 3️⃣ استقبال الاسم الجديد المكتوب داخل المودال وتطبيقه على حساب العضو بالسيرفر
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'change_name_modal') {
            const newName = interaction.fields.getTextInputValue('new_name_input');

            try {
                await interaction.member.setNickname(newName);

                const successEmbed = new EmbedBuilder()
                    .setDescription(`✅ تم تغيير اسمك المستعار في السيرفر بنجاح إلى: **${newName}**`)
                    .setColor('#22c55e');

                await interaction.reply({ embeds: [successEmbed], ephemeral: true });

            } catch (error) {
                console.error(error);
                const errorEmbed = new EmbedBuilder()
                    .setDescription('❌ فشل تغيير الاسم. تأكد أن رتبة البوت أعلى من رتبتك في القائمة، وأن لديه صلاحية `Manage Nicknames`.')
                    .setColor('#ef4444');

                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }

    // 4️⃣ معالجة ضغطات الأزرار الستة القادمة من الـ Dashboard الأصلي
    if (interaction.isButton()) {
        const customId = interaction.customId;
        if (customId.startsWith('custom_btn_')) {
            const parts = customId.split('_');
            const guildId = parts[2];
            const btnIndex = parseInt(parts[3]);

            const settings = serverSettings[guildId];
            if (settings && settings.buttons && settings.buttons[btnIndex]) {
                const replyMessage = settings.buttons[btnIndex].reply;
                const btnLabel = settings.buttons[btnIndex].label;

                const replyEmbed = new EmbedBuilder()
                    .setTitle(`📌 | ${btnLabel}`)
                    .setDescription(replyMessage)
                    .setColor('#2f3136');

                await interaction.reply({ embeds: [replyEmbed], ephemeral: true });
            } else {
                const errorEmbed = new EmbedBuilder()
                    .setDescription('❌ حدث خطأ، لم يتم العثور على بيانات هذا الزر.')
                    .setColor('#ef4444');
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
});
// 1️⃣ تشغيل سيرفر الـ Dashboard فوراً ومستقلاً حتى لا يقفل موقع Render نهائياً
app.listen(process.env.PORT || 3000, () => {
    console.log(`🌐 Dashboard online on port ${process.env.PORT || 3000}`);
});

// 2️⃣ حدث اتصال البوت وبناء أمر السلاش الفخم بكامل خياراته المتطورة (دعم رفع ملفات الصور)
bot.once('clientReady', async (readyClient) => {
    console.log(`🤖 Bot connected as ${readyClient.user.tag}`);

    // بناء أمر السلاش مع إضافة خيار الـ Attachment لرفع الملفات مباشرة من الجهاز
    const commands = [
        new SlashCommandBuilder()
            .setName('setup-menu')
            .setDescription('إرسال إيمباد منيو تغيير الاسم والإعدادات في الروم الحالية')
            .addStringOption(option => 
                option.setName('description')
                    .setDescription('اكتب الوصف المخصص الذي سيظهر داخل الإيمباد الفخم')
                    .setRequired(false)
            )
            .addAttachmentOption(option => 
                option.setName('image_file')
                    .setDescription('ارفع ملف الصورة مباشرة من جهازك (PNG, JPG, GIF) لتظهر داخل الإيمباد')
                    .setRequired(false)
            )
            .addStringOption(option => 
                option.setName('emoji_id')
                    .setDescription('ضع أيدي (ID) إيموجي مخصص من سيرفرك أو إيموجي عادي للمنيو')
                    .setRequired(false)
            )
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔄 جاري تحديث أوامر السلاش (/) مع ميزة رفع الملفات المباشرة...');
        await rest.put(
            Routes.applicationCommands(readyClient.user.id),
            { body: commands }
        );
        console.log('✅ تم تسجيل أمر السلاش والمميزات النارية بنجاح تام!');
    } catch (error) {
        console.error('❌ خطأ أثناء تسجيل الأوامر المطورة:', error);
    }
});


// 3️⃣ تسجيل الدخول للبوت بشكل آمن بالخلفية
bot.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ فشل تسجيل دخول البوت! تحقق من الـ DISCORD_TOKEN في الـ Environment Variables الخاص بـ Render:", err);
});
