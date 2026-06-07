require('dotenv').config(); // قراءة توكن البوت من ملف .env الخاص بك
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// إعداد البوت مع الصلاحيات الأساسية
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// مسار ملف حفظ البيانات لحمايتها من الضياع عند عمل ريستارت للبوت
const DATA_FILE = path.join(__dirname, 'dashboard-data.json');

// البيانات الافتراضية للداش بورد (8 أزرار)
let dashboardData = {
    channelId: '',
    embedTitle: 'Welcome to the Server',
    embedDescription: 'Please read the rules below...',
    imageUrl: '',
    buttons: Array.from({ length: 8 }, (_, i) => ({
        text: `الزر ${i + 1}`,
        emoji: '',
        response: `نص الرد الخاص بالزر ${i + 1}`
    }))
};

// دالة لجلب البيانات المخزنة من الملف إن وجدت
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const fileData = fs.readFileSync(DATA_FILE, 'utf8');
            dashboardData = JSON.parse(fileData);
            console.log("تم تحميل بيانات الداش بورد السابقة بنجاح.");
        } catch (e) {
            console.error("خطأ في قراءة ملف البيانات، سيتم اعتماد القيم الافتراضية:", e);
        }
    }
}

// دالة لحفظ البيانات الجديدة في الملف
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dashboardData, null, 4), 'utf8');
        console.log("تم حفظ التعديلات الجديدة في ملفdashboard-data.json");
    } catch (e) {
        console.error("فشل حفظ البيانات في الملف:", e);
    }
}

// تحميل البيانات فور تشغيل السكريبت
loadData();

// تصميم واجهة الـ Dashboard (HTML)
const getHtmlTemplate = (data) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>لوحة تحكم البوت</title>
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
        <h1>لوحة تحكم الأزرار والإيمباد</h1>
        <form method="POST" action="/update">
            <h2>إعدادات رسالة الإيمباد (Embed)</h2>
            <div class="form-group">
                <label>معرف الروم (Channel ID) التي سيرسل البوت فيها:</label>
                <input type="text" name="channelId" value="${data.channelId || ''}" required placeholder="مثال: 123456789012345678">
            </div>
            <div class="form-group">
                <label>عنوان الإيمباد (Embed Title):</label>
                <input type="text" name="embedTitle" value="${data.embedTitle || ''}">
            </div>
            <div class="form-group">
                <label>وصف الإيمباد الأساسي (Embed Description):</label>
                <textarea name="embedDescription" rows="4">${data.embedDescription || ''}</textarea>
            </div>
            <div class="form-group">
                <label>رابط الصورة الكبيرة (Image URL):</label>
                <input type="text" name="imageUrl" value="${data.imageUrl || ''}" placeholder="ضع رابط الصورة هنا">
            </div>

            <h2>إعدادات الأزرار (8 أزرار متاحين)</h2>
            ${data.buttons.map((btn, i) => `
            <div class="button-row">
                <h3>إعدادات الزر رقم ${i + 1}</h3>
                <div class="form-group">
                    <label>اسم أو نص الزر:</label>
                    <input type="text" name="btn_text_${i}" value="${btn.text || ''}">
                </div>
                <div class="form-group">
                    <label>ID الإيموجي الخاص بالسيرفر (اتركه فارغاً إن لم ترغب بإيموجي):</label>
                    <input type="text" name="btn_emoji_${i}" value="${btn.emoji || ''}" placeholder="مثال: 123456789012345678">
                </div>
                <div class="form-group">
                    <label>الرسالة المخفية التي ستظهر للعضو عند الضغط على هذا الزر:</label>
                    <textarea name="btn_resp_${i}" rows="3" placeholder="اكتب هنا القوانين أو المعلومات التي ستظهر عند الضغط...">${btn.response || ''}</textarea>
                </div>
            </div>
            `).join('')}
            
            <button type="submit" class="submit-btn">تحديث البيانات وإرسال الإيمباد فوراً 🚀</button>
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
    // تحديث البيانات من الفورم للذاكرة
    dashboardData.channelId = req.body.channelId;
    dashboardData.embedTitle = req.body.embedTitle;
    dashboardData.embedDescription = req.body.embedDescription;
    dashboardData.imageUrl = req.body.imageUrl;

    for (let i = 0; i < 8; i++) {
        dashboardData.buttons[i].text = req.body[`btn_text_${i}`];
        dashboardData.buttons[i].emoji = req.body[`btn_emoji_${i}`];
        dashboardData.buttons[i].response = req.body[`btn_resp_${i}`];
    }

    // حفظ التغييرات في ملف JSON لضمان عدم ضياعها
    saveData();

    // إرسال الإيمباد إلى ديسكورد فوراً
    await sendEmbedToDiscord();
    
    // إعادة التوجيه للرئيسية بعد الحفظ والارسال
    res.redirect('/');
});

// دالة إرسال وصنع الإيمباد والأزرار
async function sendEmbedToDiscord() {
    try {
        const channel = await client.channels.fetch(dashboardData.channelId);
        if (!channel) return console.log("الروم غير موجودة أو البوت لا يملك صلاحية رؤيتها.");

        // 1. بناء الـ Embed
        const embed = new EmbedBuilder()
            .setTitle(dashboardData.embedTitle || null)
            .setDescription(dashboardData.embedDescription || null)
            .setColor('#2f3136');

        if (dashboardData.imageUrl) {
            embed.setImage(dashboardData.imageUrl);
        }

        // 2. بناء الأزرار (تقسيم الـ 8 أزرار على سطرين: 5 في الأول و 3 في الثاني لالتزام بحدود ديسكورد)
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();

        dashboardData.buttons.forEach((btn, index) => {
            if (!btn.text) return; // تخطي الزر إذا كان اسمه فارغاً

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

        // إرسال الرسالة للروم المحددة بالداش بورد
        await channel.send({ embeds: [embed], components: components });
        console.log("تم إرسال الإيمباد والأزرار التفاعلية بنجاح!");

    } catch (error) {
        console.error("حدث خطأ أثناء إرسال الرسالة إلى ديسكورد:", error);
    }
}

// التعامل مع ضغطات الأزرار (Interaction Create)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // التحقق من أن الزر تابع للداش بورد الخاص بنا
    if (interaction.customId.startsWith('dash_button_')) {
        const index = parseInt(interaction.customId.replace('dash_button_', ''));
        const buttonConfig = dashboardData.buttons[index];

        if (buttonConfig && buttonConfig.response) {
            // إرسال الرد المخصص للزر بشكل مخفي (Ephemeral) ليراه العضو الذي ضغط فقط بنفس الروم لمنع التخريب
            await interaction.reply({ content: buttonConfig.response, ephemeral: true });
        } else {
            await interaction.reply({ content: 'لا يوجد رد مبرمج لهذا الزر حالياً.', ephemeral: true });
        }
    }
});

// تشغيل الويب سيرفر للبورت المتغير لـ Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`الداش بورد يعمل الآن على البورت المفتوح: ${PORT}`);
});

// التأكد من جلب التوكن من ملف .env المسمى بـ BOT_TOKEN
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
    console.error("خطأ: لم يتم العثور على BOT_TOKEN في ملف .env!");
} else {
    client.login(TOKEN);
}
