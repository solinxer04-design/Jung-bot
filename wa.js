const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const OpenAI = require('openai');
const P = require('pino');

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  // TAMPILIN QR CODE DI LOG
  sock.ev.on('qr', qr => {
    console.log('\n=== SCAN QR INI DI WHATSAPP ===');
    console.log(qr);
    console.log('===============================\n');
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    try {
      const response = await openai.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: text }]
      });

      const reply = response.choices[0].message.content;
      await sock.sendMessage(msg.key.remoteJid, { text: reply });
    } catch (err) {
      console.error(err);
    }
  });

  console.log('Bot WhatsApp jalan!');
}

startBot();
process.stdin.resume(); // biar nggak auto mati
