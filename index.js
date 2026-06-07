require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

// مسار ملف حفظ البيانات لحمايتها من الضياع عند الخروج أو عمل ريستارت للبوت
const DATA_FILE = path.join(__dirname, 'dashboard-data.json');

// البيانات الافتراضية للداش بورد (8 أزرار)
let dashboardData = {
    channelId: '',
    embedTitle: 'Welcome to the Server',
    embedDescription: 'Please read the rules below carefully...',
    imageUrl: '',
    buttons: Array.from({ length: 8 }, (_, i) => ({
        text: `Button ${i + 1}`,
        emoji: '',
        response: `This is the hidden response for button ${i + 1}`
    }))
};

// دالة جلب البيانات المخزنة من الملف عند تشغيل البوت
if (fs.existsSync(DATA_FILE)) {
    try {
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        dashboardData = JSON.parse(fileData);
        console.log("Database values loaded successfully.");
    } catch (e) {
        console.error("Error loading database file:", e);
    }
}

// تصميم واجهة الـ Dashboard (HTML مضبوط بالكامل بدون تداخل لغوي)
const getHtmlTemplate = (data) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bot Dashboard Panel</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #2f3136; color: #fff; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: #36393f; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        h1, h2 { text-align: center; color: #5865F2; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #b9bbbe; }
        input[type="text"], textarea { width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #202225; background: #40444b; color: #fff; box-sizing: border-box; font-size: 14px; }
        input:focus, textarea:focus { border-color: #5865F2; outline: none; }
        .button-row { border: 1px solid #4f545c; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #2f3136; }
        .submit-btn { width: 100%; padding: 15px; background: #248046; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; font-weight: bold; transition: background 0.2s; }
        .submit-btn:hover { background: #1a6535; }
        h3 { margin-top: 0; color: #5865F2; border-bottom: 1px solid #4f545c; padding-bottom: 5px;}
    </style>
</head>
<body>
    <div class="container">
        <h1>Control Dashboard Panel</h1>
        <form method="POST" action="/update">
            <h2>Main Embed Settings</h2>
            <div class="form-group">
                <label>Target Text Channel ID:</label>
                <input type="text" name="channelId" value="${data.channelId || ''}" required placeholder="Example: 123456789012345678">
            </div>
            <div class="form-group">
                <label>Embed Title:</label>
                <input type="text" name="embedTitle" value="${data.embedTitle || ''}">
            </div>
            <div class="form-group">
                <label>Embed Description:</label>
                <textarea name="embedDescription" rows="4">${data.embedDescription || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Large Image URL:</label>
                <input type="text" name="imageUrl" value="${data.imageUrl || ''}" placeholder="Paste direct image link here">
            </div>

            <h2>Interactive Buttons (8 Slots Available)</h2>
            ${data.buttons.map((btn, i) => `
            <div class="button-row">
                <h3>Button Configuration Slot #${i + 1}</h3>
                <div class="form-group">
                    <label>Button Label Text:</label>
                    <input type="text" name="btn_text_${i}" value="${btn.text || ''}">
                </div>
                <div class="form-group">
                    <label>Server Custom Emoji ID (Leave empty if none):</label>
                    <input type="text" name="btn_emoji_${i}" value="${btn.emoji || ''}" placeholder="Example: 123456789012345678">
                </div>
                <div class="form-group">
                    <label>Hidden Response (Will show inside an Embed upon clicking):</label>
                    <textarea name="btn_resp_${i}" rows="3" placeholder="Write the rule or response text here...">${btn.response || ''}</textarea>
                </div>
            </div>
            `).join('')}
            
            <button type="submit" class="submit-btn">Save Configurations & Dispatch Embed system 🚀</button>
        </form>
    </div>
</body>
</html>
`;

// مسارات واجهة الويب (Express Routes)
app.get('/', (req, res) => {
    res.send(getHtmlTemplate(dashboardData));
});

app.post('/update', async (req, res) => {
    // تحديث الذاكرة بالبيانات الجديدة من الفورم
    dashboardData.channelId = req.body.channelId;
    dashboardData.embedTitle = req.body.embedTitle;
    dashboardData.embedDescription = req.body.embedDescription;
    dashboardData.imageUrl = req.body.imageUrl;

    for (let i = 0; i < 8; i++) {
        dashboardData.buttons[i].text = req.body[`btn_text_${i}`];
        dashboardData.buttons[i].emoji = req.body[`btn_emoji_${i}`];
        dashboardData.buttons[i].response = req.body[`btn_resp_${i}`];
    }

    // حفظ البيانات فوراً في ملف الحفظ الخارجي لحمايتها من الضياع عند إعادة الدخول
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dashboardData, null, 4), 'utf8');
        console.log("Changes written to dashboard-data.json successfully.");
    } catch (e) {
        console.error("Failed to write data file:", e);
    }

    // إرسال الإيمباد والأزرار لـ ديسكورد
    await sendEmbedToDiscord();
    
    res.redirect('/');
});

// دالة معالجة وإرسال الإيمباد بالأزرار المتناسقة
async function sendEmbedToDiscord() {
    try {
        const channel = await client.channels.fetch(dashboardData.channelId);
        if (!channel) return console.log("Target channel not found or bot lacks permission.");

        // بناء الإيمباد العريض المتناسق مع حجم الصورة الكاملة
        const embed = new EmbedBuilder()
            .setTitle(dashboardData.embedTitle || null)
            .setDescription(dashboardData.embedDescription || null)
            .setColor('#2f3136');

        if (dashboardData.imageUrl) {
            embed.setImage(dashboardData.imageUrl);
        }

        // بناء صفوف الأزرار (أقصى حد لديسكورد هو 5 أزرار بالسطر الواحد، لذا الـ 8 تتقسم تلقائياً على سطرين)
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();

        dashboardData.buttons.forEach((btn, index) => {
            if (!btn.text || btn.text.trim() === '') return; // تخطي الزر إذا تم مسح النص الخاص به

            const buttonBuilder = new ButtonBuilder()
                .setLabel(btn.text)
                .setCustomId(`dash_button_${index}`)
                .setStyle(ButtonStyle.Secondary);

            if (btn.emoji && btn.emoji.trim() !== '') {
                buttonBuilder.setEmoji(btn.emoji.trim());
            }

            if (index < 5) {
                row1.addComponents(buttonBuilder);
            } else {
                row2.addComponents(buttonBuilder);
            }
        });

        const components = [];
        if (row1.components.length > 0) components.push(row1);
        if (row2.components.length > 0) components.push(row2);

        // إرسال الرسالة الكاملة للروم المحددة
        await channel.send({ embeds: [embed], components: components });
        console.log("Embed panel deployed successfully.");

    } catch (error) {
        console.error("Error executing discord embed dispatch:", error);
    }
}

// التفاعل عند قيام العضو بالضغط على أي زر بالسيرفر
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('dash_button_')) {
        const index = parseInt(interaction.customId.replace('dash_button_', ''));
        
        try {
            // قراءة أحدث الردود المبرمجة من ملف الحفظ
            if (fs.existsSync(DATA_FILE)) {
                const savedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                const buttonConfig = savedData.buttons[index];

                if (buttonConfig && buttonConfig.response) {
                    // بناء إيمباد الرد المخفي الأنيق لتنسيق الكتابة
                    const responseEmbed = new EmbedBuilder()
                        .setDescription(buttonConfig.response)
                        .setColor('#5865F2');

                    // إرسال الرد المطور بشكل مخفي (Ephemeral) ليراه من ضغط على الزر فقط
                    await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
                } else {
                    await interaction.reply({ content: 'No mapped system configuration for this button slot.', ephemeral: true });
                }
            }
        } catch (err) {
            console.error("Interaction runtime failure:", err);
        }
    }
});

// تشغيل الويب سيرفر للبورت المتغير لـ Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Dashboard is perfectly alive on port: ${PORT}`);
});

// تشغيل البوت عبر متغير البيئة الآمن بـ راندر
const TOKEN = process.env.BOT_TOKEN;
client.login(TOKEN);
