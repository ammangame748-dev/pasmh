require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const app = express();

const DATA_FILE = path.join(__dirname, 'dashboard-data.json');

// البيانات الافتراضية مقسمة حسب السيرفر
let dashboardData = {};

if (fs.existsSync(DATA_FILE)) {
    try {
        dashboardData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log("تم تحميل قاعدة البيانات بنجاح.");
    } catch (e) {
        console.error("خطأ في تحميل ملف البيانات:", e);
    }
}

// إعداد الجلسات وتسجيل الدخول
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key-dashboard',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,         // معرف البوت من موقع المطورين
    clientSecret: process.env.CLIENT_SECRET, // السر الخاص بالبوت من موقع المطورين
    callbackURL: process.env.CALLBACK_URL,   // رابط العودة مثل http://localhost:10000/auth/discord/callback
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

// حماية المسارات
function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// مسارات تسجيل الدخول
app.get('/login', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    req.logout(() => { res.redirect('/'); });
});

// الصفحة الرئيسية (تسجيل الدخول)
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>تسجيل الدخول - لوحة التحكم</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #2f3136; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .login-box { background: #36393f; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
            h1 { color: #5865F2; margin-bottom: 20px; }
            .btn { background: #5865F2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; transition: 0.2s; }
            .btn:hover { background: #4752C4; }
        </style>
    </head>
    <body>
        <div class="login-box">
            <h1>لوحة تحكم البوت الاحترافية</h1>
            <p>يرجى تسجيل الدخول بحساب الديسكورد الخاص بك للمتابعة</p><br><br>
            <a class="btn" href="/login">تسجيل الدخول عبر ديسكورد 🚀</a>
        </div>
    </body>
    </html>
    `);
});

// صفحة لوحة التحكم وتحديد السيرفر
app.get('/dashboard', checkAuth, (req, res) => {
    // تصفية السيرفرات التي يمتلك فيها المستخدم صلاحية Administrator (0x8)
    const adminGuilds = req.user.guilds.filter(guild => (guild.permissions & 0x8) === 0x8);
    const selectedGuildId = req.query.guildId || (adminGuilds[0] ? adminGuilds[0].id : null);

    if (!selectedGuildId) {
        return res.send('<h2 style="color:white; text-align:center; margin-top:50px;">عذراً، يجب أن تكون مسؤولاً (Admin) في سيرفر واحد على الأقل للتحكم بالبوت.</h2>');
    }

    // جلب بيانات السيرفر المحدد أو وضع بيانات افتراضية
    if (!dashboardData[selectedGuildId]) {
        dashboardData[selectedGuildId] = {
            channelId: '',
            embedTitle: 'أهلاً بكم في السيرفر',
            embedDescription: 'الرجاء قراءة القوانين بعناية الموضحة أدناه...',
            imageUrl: '',
            buttons: Array.from({ length: 8 }, (_, i) => ({
                text: `زر رقم ${i + 1}`,
                emoji: '',
                response: `هذا هو الرد المخفي الخاص بالزر رقم ${i + 1}`
            }))
        };
    }

    const data = dashboardData[selectedGuildId];

    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>لوحة التحكم</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #2f3136; color: #fff; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; background: #36393f; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
            h1, h2 { text-align: center; color: #5865F2; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; color: #b9bbbe; }
            input[type="text"], textarea, select { width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #202225; background: #40444b; color: #fff; box-sizing: border-box; font-size: 14px; }
            input:focus, textarea:focus, select:focus { border-color: #5865F2; outline: none; }
            .button-row { border: 1px solid #4f545c; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #2f3136; }
            .submit-btn { width: 100%; padding: 15px; background: #248046; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; font-weight: bold; transition: background 0.2s; }
            .submit-btn:hover { background: #1a6535; }
            h3 { margin-top: 0; color: #5865F2; border-bottom: 1px solid #4f545c; padding-bottom: 5px;}
            .user-bar { display: flex; justify-content: space-between; align-items: center; background: #202225; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
            .logout-btn { color: #f04747; text-decoration: none; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="user-bar">
                <span>مرحباً، <b>${req.user.username}</b></span>
                <a href="/logout" class="logout-btn">تسجيل الخروج</a>
            </div>
            
            <h1>شاشة التحكم بالإمبد والردود تفاعلية</h1>
            
            <div class="form-group">
                <label>اختر السيرفر المراد التحكم به:</label>
                <select onchange="window.location.href='/dashboard?guildId=' + this.value">
                    ${adminGuilds.map(g => `<option value="${g.id}" ${g.id === selectedGuildId ? 'selected' : ''}>${g.name}</option>`).join('')}
                </select>
            </div>

            <form method="POST" action="/update?guildId=${selectedGuildId}">
                <h2>إعدادات رسالة الإمبد الرئيسية</h2>
                <div class="form-group">
                    <label>معرف روم النصية المستهدفة (Channel ID):</label>
                    <input type="text" name="channelId" value="${data.channelId || ''}" required placeholder="مثال: 123456789012345678">
                </div>
                <div class="form-group">
                    <label>عنوان الرسالة (Title):</label>
                    <input type="text" name="embedTitle" value="${data.embedTitle || ''}">
                </div>
                <div class="form-group">
                    <label>وصف الرسالة الرئيسي (Description):</label>
                    <textarea name="embedDescription" rows="4">${data.embedDescription || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>رابط الصورة الكبيرة بالإمبد (Image URL):</label>
                    <input type="text" name="imageUrl" value="${data.imageUrl || ''}" placeholder="ضع رابط الصورة المباشر هنا">
                </div>

                <h2>تخصيص الأزرار التفاعلية (8 أزرار متوفرة)</h2>
                ${data.buttons.map((btn, i) => `
                <div class="button-row">
                    <h3>إعدادات الزر رقم #${i + 1}</h3>
                    <div class="form-group">
                        <label>النص الظاهر على الزر:</label>
                        <input type="text" name="btn_text_${i}" value="${btn.text || ''}">
                    </div>
                    <div class="form-group">
                        <label>معرف الإيموجي الخاص بالسيرفر (اتركه فارغاً إذا لم ترغب بإيموجي):</label>
                        <input type="text" name="btn_emoji_${i}" value="${btn.emoji || ''}" placeholder="مثال: 123456789012345678">
                    </div>
                    <div class="form-group">
                        <label>الرد المخفي (سيظهر داخل إمبد منفصل ومخفي للشخص الذي ضغط عليه):</label>
                        <textarea name="btn_resp_${i}" rows="3" placeholder="اكتب هنا القوانين أو الرد المخصص...">${btn.response || ''}</textarea>
                    </div>
                </div>
                `).join('')}
                
                <button type="submit" class="submit-btn">حفظ التعديلات وإرسال الإمبد فوراً للسيرفر 🚀</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

// استقبال التحديثات من الفورم وحفظها بناءً على السيرفر المحدد
app.post('/update', checkAuth, async (req, res) => {
    const guildId = req.query.guildId;
    if (!guildId) return res.redirect('/dashboard');

    if (!dashboardData[guildId]) {
        dashboardData[guildId] = { buttons: Array.from({ length: 8 }, () => ({})) };
    }

    dashboardData[guildId].channelId = req.body.channelId;
    dashboardData[guildId].embedTitle = req.body.embedTitle;
    dashboardData[guildId].embedDescription = req.body.embedDescription;
    dashboardData[guildId].imageUrl = req.body.imageUrl;

    for (let i = 0; i < 8; i++) {
        if (!dashboardData[guildId].buttons[i]) dashboardData[guildId].buttons[i] = {};
        dashboardData[guildId].buttons[i].text = req.body[`btn_text_${i}`];
        dashboardData[guildId].buttons[i].emoji = req.body[`btn_emoji_${i}`];
        dashboardData[guildId].buttons[i].response = req.body[`btn_resp_${i}`];
    }

    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dashboardData, null, 4), 'utf8');
        console.log(`تم حفظ التعديلات الخاصة بالسيرفر ${guildId} بنجاح.`);
    } catch (e) {
        console.error("فشل في كتابة ملف الحفظ المحلي:", e);
    }

    await sendEmbedToDiscord(guildId);
    res.redirect('/dashboard?guildId=' + guildId);
});

// دالة إرسال الإمبد والأزرار بشكل متناسق مع الصورة المرفقة
async function sendEmbedToDiscord(guildId) {
    try {
        const data = dashboardData[guildId];
        if (!data || !data.channelId) return;

        const channel = await client.channels.fetch(data.channelId);
        if (!channel) return console.log("الروم المطلوبة غير موجودة أو البوت يفتقر للصلاحيات.");

        const embed = new EmbedBuilder()
            .setTitle(data.embedTitle || null)
            .setDescription(data.embedDescription || null)
            .setColor('#2f3136');

        if (data.imageUrl) {
            embed.setImage(data.imageUrl);
        }

        // إنشاء صفوف للأزرار (الحد الأقصى لديسكورد هو 5 أزرار بالسطر الواحد)
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();

        data.buttons.forEach((btn, index) => {
            if (!btn.text || btn.text.trim() === '') return;

            const buttonBuilder = new ButtonBuilder()
                .setLabel(btn.text)
                .setCustomId(`dash_button_${guildId}_${index}`) // ربط السيرفر بالزر تفادياً للتداخل
                .setStyle(ButtonStyle.Secondary);

            if (btn.emoji && btn.emoji.trim() !== '') {
                buttonBuilder.setEmoji(btn.emoji.trim());
            }

            // توزيع متناسق للأزرار (مثال: 4 في السطر الأول و4 في السطر الثاني ليتطابق مع صورتك)
            if (index < 4) {
                row1.addComponents(buttonBuilder);
            } else {
                row2.addComponents(buttonBuilder);
            }
        });

        const components = [];
        if (row1.components.length > 0) components.push(row1);
        if (row2.components.length > 0) components.push(row2);

        await channel.send({ embeds: [embed], components: components });
        console.log("تم إرسال لوحة الإمبد بنجاح للسيرفر.");

    } catch (error) {
        console.error("حدث خطأ أثناء محاولة إرسال رسالة الإمبد المحدثة:", error);
    }
}

// معالجة التفاعل والرد الخفي في إمبد حصري
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('dash_button_')) {
        // استخراج معرف السيرفر وفهرس الزر من الـ Custom ID للزر المكبوس
        const parts = interaction.customId.replace('dash_button_', '').split('_');
        const guildId = parts[0];
        const index = parseInt(parts[1], 10);

        try {
            if (fs.existsSync(DATA_FILE)) {
                const savedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                const serverData = savedData[guildId];

                if (serverData && serverData.buttons && serverData.buttons[index]) {
                    const buttonConfig = serverData.buttons[index];

                    if (buttonConfig && buttonConfig.response) {
                        // بناء الإمبد الخاص بالرد المخفي كما طلبت تماماً وبألوان منسقة
                        const responseEmbed = new EmbedBuilder()
                            .setDescription(buttonConfig.response)
                            .setColor('#5865F2');

                        // إرسال الرد بشكل مخفي بالكامل (Ephemeral)
                        await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'لا يوجد رد مبرمج لهذا الزر حالياً.', ephemeral: true });
                    }
                }
            }
        } catch (err) {
            console.error("فشل في معالجة تفاعل الزر:", err);
        }
    }
});

client.once('ready', () => {
    console.log(`تم تسجيل الدخول بنجاح باسم البوت: ${client.user.tag}!`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`لوحة التحكم تعمل وتستمع حالياً على البورت: ${PORT}`);
});

const TOKEN = process.env.BOT_TOKEN;
client.login(TOKEN);
