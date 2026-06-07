require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cache = require('memory-cache');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'super-secret-key-change-this',
    resave: false,
    saveUninitialized: false
}));

// إعداد Passport لتسجيل الدخول بديسكورد
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID, // ضعه في ملف .env
    clientSecret: process.env.CLIENT_SECRET, // ضعه في ملف .env
    callbackURL: process.env.CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

app.use(passport.initialize());
app.use(passport.session());

const DATA_FILE = path.join(__dirname, 'dashboard-data.json');
let dashboardData = cache.get('dashboardData') || {
    embedTitle: 'Welcome to the Server',
    embedDescription: 'Please read the rules below...',
    imageUrl: '',
    buttons: Array.from({ length: 8 }, (_, i) => ({ text: `الزر ${i + 1}`, emoji: '', response: `رد الزر ${i + 1}` }))
};

// مسارات التحقق وتسجيل الدخول
app.get('/login', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/');
});
app.get('/logout', (req, res) => { req.logout(() => res.redirect('/')); });

// الواجهة الرسومية التفاعلية مع السيرفرات والرومات
app.get('/', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.send(`
            <body style="background:#2f3136; color:#fff; font-family:Arial; text-align:center; padding-top:100px;">
                <h1>لوحة تحكم البوت الاحترافية</h1>
                <p>يرجى تسجيل الدخول بحسابك الديسكورد للتحكم في سيرفراتك</p>
                <a href="/login" style="background:#5865F2; color:#fff; padding:15px 30px; text-decoration:none; border-radius:5px; font-weight:bold;">تسجيل الدخول عبر ديسكورد 🔐</a>
            </body>
        `);
    }

    // تصفية السيرفرات المشتركة بين المستخدم والبوت والتي يمتلك فيها رتبة Administrator
    const userGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    const botGuilds = client.guilds.cache;
    const mutualGuilds = userGuilds.filter(g => botGuilds.has(g.id));

    let guildOptions = mutualGuilds.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8"><title>لوحة التحكم</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; background: #2f3136; color: #fff; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; background: #36393f; padding: 20px; border-radius: 8px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; color: #b9bbbe; }
            input, textarea, select { width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #202225; background: #40444b; color: #fff; box-sizing: border-box; }
            .button-row { border: 1px solid #4f545c; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #2f3136; }
            .submit-btn { width: 100%; padding: 15px; background: #248046; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
        </style>
        <script>
            // كود جافا سكريبت لجلب رومات السيرفر المختار تلقائياً وبدون تحديث الصفحة
            async function loadChannels(guildId) {
                if(!guildId) return;
                const res = await fetch('/api/channels/' + guildId);
                const channels = await res.json();
                const select = document.getElementById('channelSelect');
                select.innerHTML = channels.map(c => \`<option value="\${c.id}"># \${c.name}</option>\`).join('');
            }
        </script>
    </head>
    <body>
        <div class="container">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2>أهلاً بك، ${req.user.username} 👋</h2>
                <a href="/logout" style="color:#ed4245;">تسجيل الخروج</a>
            </div>
            <form method="POST" action="/update">
                <div class="form-group">
                    <label>اختر السيرفر:</label>
                    <select name="guildId" onchange="loadChannels(this.value)" required>
                        <option value="">-- اختر السيرفر --</option>
                        ${guildOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>اختر الروم المراد الإرسال فيها:</label>
                    <select name="channelId" id="channelSelect" required>
                        <option value="">-- اختر السيرفر أولاً --</option>
                    </select>
                </div>
                
                <h2>إعدادات الإيمباد</h2>
                <div class="form-group"><label>العنوان:</label><input type="text" name="embedTitle" value="${dashboardData.embedTitle}"></div>
                <div class="form-group"><label>الوصف:</label><textarea name="embedDescription" rows="3">${dashboardData.embedDescription}</textarea></div>
                <div class="form-group"><label>رابط الصورة:</label><input type="text" name="imageUrl" value="${dashboardData.imageUrl}"></div>

                <h2>الأزرار الثمانية</h2>
                ${dashboardData.buttons.map((btn, i) => `
                <div class="button-row">
                    <h3>الزر رقم ${i + 1}</h3>
                    <div class="form-group"><label>اسم الزر:</label><input type="text" name="btn_text_${i}" value="${btn.text}"></div>
                    <div class="form-group"><label>ID الإيموجي:</label><input type="text" name="btn_emoji_${i}" value="${btn.emoji}"></div>
                    <div class="form-group"><label>الرد المخفي عند الضغط:</label><textarea name="btn_resp_${i}" rows="2">${btn.response}</textarea></div>
                </div>
                `).join('')}
                <button type="submit" class="submit-btn">تحديث وإرسال الإيمباد 🚀</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

// API لجلب الرومات الكتابية فقط للسيرفر المختار
app.get('/api/channels/:guildId', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json([]);
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.json([]);
    
    const textChannels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText)
        .map(c => ({ id: c.id, name: c.name }));
    res.json(textChannels);
});

// استقبال البيانات وإرسالها للسيرفر والروم المحددين
app.post('/update', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    
    const { channelId, embedTitle, embedDescription, imageUrl } = req.body;
    dashboardData = { channelId, embedTitle, embedDescription, imageUrl, buttons: [] };

    for (let i = 0; i < 8; i++) {
        dashboardData.buttons.push({
            text: req.body[`btn_text_${i}`],
            emoji: req.body[`btn_emoji_${i}`],
            response: req.body[`btn_resp_${i}`]
        });
    }
    
    cache.put('dashboardData', dashboardData);
    fs.writeFileSync(DATA_FILE, JSON.stringify(dashboardData, null, 4));

    // إرسال الرسالة
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            const embed = new EmbedBuilder().setTitle(embedTitle || null).setDescription(embedDescription || null).setColor('#2f3136');
            if (imageUrl) embed.setImage(imageUrl);

            const row1 = new ActionRowBuilder(); const row2 = new ActionRowBuilder();
            dashboardData.buttons.forEach((btn, index) => {
                if (!btn.text) return;
                const buttonBuilder = new ButtonBuilder().setLabel(btn.text).setCustomId(`dash_button_${index}`).setStyle(ButtonStyle.Secondary);
                if (btn.emoji && btn.emoji.trim() !== '') buttonBuilder.setEmoji(btn.emoji.trim());
                
                if (index < 5) row1.addComponents(buttonBuilder);
                else row2.addComponents(buttonBuilder);
            });

            const components = [];
            if (row1.components.length > 0) components.push(row1);
            if (row2.components.length > 0) components.push(row2);

            await channel.send({ embeds: [embed], components });
        }
    } catch (e) { console.error(e); }

    res.redirect('/');
});

// معالج ضغطات الأزرار
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('dash_button_')) return;
    const index = parseInt(interaction.customId.replace('dash_button_', ''));
    const savedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const btn = savedData.buttons[index];
    if (btn && btn.response) await interaction.reply({ content: btn.response, ephemeral: true });
});

client.login(process.env.BOT_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log('Dashboard is fully ready!'));
