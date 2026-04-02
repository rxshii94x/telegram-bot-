require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;
const sharp = require("sharp");

const bot = new Telegraf(process.env.BOT_TOKEN);

// =======================
// CLOUDINARY CONFIG
// =======================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =======================
// MEMORY
// =======================
const userData = {};
const processingUsers = {};

// =======================
// WHATSAPP LINK (FINAL)
// =======================
const WHATSAPP_LINK =
  "https://wa.me/919173724293?text=Hii%20bhai,%20main%20earning%20start%20karna%20chahta%20hu%20💸%0AMujhe%20guide%20chahiye";

// =======================
// START
// =======================
bot.start((ctx) => {
  ctx.reply(
    "💸 Earning start karni hai?\n👇 Button dabao",
    Markup.inlineKeyboard([
      [Markup.button.url("Start Earning 🚀", WHATSAPP_LINK)],
    ])
  );
});

// =======================
// TEXT REPLY
// =======================
bot.on("text", (ctx) => {
  ctx.reply(
    "👇 WhatsApp pe aa ja",
    Markup.inlineKeyboard([
      [Markup.button.url("Start Now 💰", WHATSAPP_LINK)],
    ])
  );
});

// =======================
// IMAGE RECEIVE
// =======================
bot.on("photo", async (ctx) => {
  try {
    const file_id = ctx.message.photo.slice(-1)[0].file_id;
    const userId = ctx.from.id;

    await ctx.reply("Caption bana raha hu...");

    const caption = await generateCaption();

    userData[userId] = { file_id, caption };

    await ctx.replyWithPhoto(file_id, {
      caption,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("YES ✅", "yes"),
          Markup.button.callback("NO ❌", "no"),
        ],
      ]),
    });
  } catch (err) {
    console.log(err.message);
    ctx.reply("Error ❌");
  }
});

// =======================
// YES BUTTON
// =======================
bot.action("yes", async (ctx) => {
  const userId = ctx.from.id;

  if (processingUsers[userId]) {
    return ctx.answerCbQuery("Processing...");
  }

  processingUsers[userId] = true;

  try {
    const data = userData[userId];

    await ctx.answerCbQuery();
    await ctx.reply("Post ho raha hai... 🚀");

    await postToInstagram(data.file_id, data.caption, ctx);

    ctx.reply("Instagram pe post ho gaya ✅");
  } catch (err) {
    console.log("INSTAGRAM ERROR:", err.response?.data || err.message);
    ctx.reply("Post failed ❌");
  } finally {
    processingUsers[userId] = false;
  }
});

// =======================
bot.action("no", (ctx) => ctx.reply("Cancelled ❌"));

// =======================
// AI CAPTION
// =======================
async function generateCaption() {
  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content:
              "Write Hinglish caption (1-2 lines) with 5 hashtags.",
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
      }
    );

    return res.data.choices[0].message.content;
  } catch {
    return "Earn online 💸 #money #india #online #viral #growth";
  }
}

// =======================
// CLOUDINARY UPLOAD
// =======================
async function uploadToCloudinary(imageUrl) {
  const res = await axios({
    url: imageUrl,
    responseType: "arraybuffer",
  });

  const buffer = await sharp(res.data)
    .resize(1080, 1080) // FIX aspect ratio
    .jpeg()
    .toBuffer();

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: "image" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    ).end(buffer);
  });
}

// =======================
// INSTAGRAM POST (DEBUG)
// =======================
async function postToInstagram(file_id, caption, ctx) {
  try {
    console.log("STEP 1: Telegram file");

    const file = await ctx.telegram.getFileLink(file_id);
    console.log("Telegram URL:", file.href);

    console.log("STEP 2: Cloudinary upload");

    const publicUrl = await uploadToCloudinary(file.href);
    console.log("Cloudinary URL:", publicUrl);

    if (!publicUrl) throw new Error("Upload failed");

    console.log("STEP 3: Create media");

    const create = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.INSTAGRAM_USER_ID}/media`,
      {
        image_url: publicUrl,
        caption,
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
      }
    );

    console.log("Created:", create.data);

    console.log("STEP 4: Publish");

    const publish = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.INSTAGRAM_USER_ID}/media_publish`,
      {
        creation_id: create.data.id,
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
      }
    );

    console.log("Published:", publish.data);
  } catch (err) {
    console.log("FINAL ERROR:", err.response?.data || err.message);
    throw err;
  }
}

// =======================
bot.launch();
console.log("Bot running...");