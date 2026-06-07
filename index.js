const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const bot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// إعداد مجلد رفع الصور
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

// استبدل قسم الـ session القديم بهذا القسم المحدث تماماً:
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-fallback-secret-key-998877',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // اتركه false ليعمل على نطاق ريندر الافتراضي بدون مشاكل
        maxAge: 24 * 60 * 60 * 1000 // مدة الجلسة يوم كامل
    }
}));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/login', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);

    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;

    res.redirect(discordUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('فشل تسجيل الدخول!');

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.REDIRECT_URI
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const tokens = await tokenResponse.json();

        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`
            }
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
        // فحص إذا كان حقل الاسم معبأ وليس فارغاً
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

        // 1. بناء إيمباد الماب الفخم الملون باللون البنفسجي النيون الاحترافي
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

        // 🔲 بناء الأزرار وتوزيعها تلقائياً (كل 3 أزرار في سطر ليطابق التصميم)
        let components = [];
        if (buttonsData.length > 0) {
            let currentRow = new ActionRowBuilder();

            buttonsData.forEach((btnInfo, index) => {
                // إذا امتلأ الصف بـ 3 أزرار، نقوم بإنشاء صف جديد لترتيبها بشكل متناسق
                if (index > 0 && index % 3 === 0) {
                    components.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }

                // إنشاء زر حقيقي بلون رمادي أنيق مطابق للصورة
                const button = new ButtonBuilder()
                    .setCustomId(`custom_btn_${guildId}_${index}`)
                    .setLabel(btnInfo.label)
                    .setStyle(ButtonStyle.Secondary);

                if (btnInfo.emoji && btnInfo.emoji.trim() !== '') {
                    button.setEmoji(btnInfo.emoji.trim());
                }

                currentRow.addComponents(button);
            });

            // إضافة الصف المتبقي إن وُجد
            if (currentRow.components.length > 0) {
                components.push(currentRow);
            }
        }


        // 3. الإرسال المباشر والآمن عن طريق البوت لحل المشاكل نهائياً
        await channel.send({
            embeds: [embed],
            components: components,
            files: files
        });

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
// إضافة مسار الصفحة الرئيسية لتحويل المستخدم تلقائياً لصفحة تسجيل الدخول
app.get('/', (req, res) => {
    res.redirect('/login');
});

// 🔄 التفاعل السليم مع ضغطات الأزرار والرد بإيمباد مخفي وخاص للعضو
bot.on(Events.InteractionCreate, async interaction => {
    // التحقق أن التفاعل القادم هو ضغطة زر وليس منيو أو أمر
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    if (customId.startsWith('custom_btn_')) {
        const parts = customId.split('_');
        const guildId = parts[2];
        const btnIndex = parseInt(parts[3]);

        const settings = serverSettings[guildId];
        if (settings && settings.buttons && settings.buttons[btnIndex]) {
            const replyMessage = settings.buttons[btnIndex].reply;
            const btnLabel = settings.buttons[btnIndex].label;

            // بناء الإيمباد المخفي الخاص بالرد
            const replyEmbed = new EmbedBuilder()
                .setTitle(`📌 | ${btnLabel}`)
                .setDescription(replyMessage)
                .setColor('#2f3136'); // لون داكن فخم ومتناسق

            await interaction.reply({ embeds: [replyEmbed], ephemeral: true });
        } else {
            const errorEmbed = new EmbedBuilder()
                .setDescription('❌ حدث خطأ، لم يتم العثور على بيانات هذا الزر.')
                .setColor('#ef4444');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
});




bot.login(process.env.DISCORD_TOKEN);
// استبدل السطر الأخير بهذا التعديل ليتوافق مع الإصدار الجديد:
bot.once('clientReady', (readyClient) => {
    console.log(`🤖 Bot connected as ${readyClient.user.tag}`);
    app.listen(process.env.PORT || 3000, () => {
        console.log(`🌐 Dashboard online on port ${process.env.PORT || 3000}`);
    });
});
