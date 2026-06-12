require('dotenv').config();

console.log('================================');
console.log('BOT STARTING...');
console.log('NODE VERSION:', process.version);
console.log('GROQ API ADA:', !!process.env.GROQ_API_KEY);
console.log('================================');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const Groq = require('groq-sdk');
const pino = require('pino');
const fs = require('fs');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const DB_FILE = './chats.json';

let chatHistory = {};

if (fs.existsSync(DB_FILE)) {
  chatHistory = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(chatHistory, null, 2));
}

const cooldown = {};

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['AI-Bot', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({
    connection,
    lastDisconnect,
    qr
  }) => {

    if (qr) {
      console.clear();
      console.log('=== SCAN QR WHATSAPP ===');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Bot Connected');
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        startBot();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg.message) return;
      if (msg.key.fromMe) return;

      const jid = msg.key.remoteJid;

      await sock.readMessages([msg.key]);

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption;

      if (!text) return;

      console.log(`[${jid}] ${text}`);

      if (
        cooldown[jid] &&
        Date.now() - cooldown[jid] < 2000
      ) {
        return;
      }

      cooldown[jid] = Date.now();

      if (!chatHistory[jid]) {
        chatHistory[jid] = [];
      }

      if (text === '!menu') {
        return sock.sendMessage(jid, {
          text: `
🤖 MENU BOT AI

!menu
!ping
!reset
!ai pertanyaan

Contoh:
!ai siapa presiden indonesia
`
        });
      }

      if (text === '!ping') {
        return sock.sendMessage(jid, {
          text: '🏓 Pong!'
        });
      }

      if (text === '!reset') {
        chatHistory[jid] = [];
        saveDB();

        return sock.sendMessage(jid, {
          text: '✅ Riwayat percakapan dihapus.'
        });
      }

      if (!text.startsWith('!ai ')) {
        return;
      }

      const prompt = text.slice(4);

      chatHistory[jid].push({
        role: 'user',
        content: prompt
      });

      if (chatHistory[jid].length > 20) {
        chatHistory[jid] =
          chatHistory[jid].slice(-20);
      }

      const completion =
        await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content:
                'Kamu adalah asisten WhatsApp yang ramah dan membantu.'
            },
            ...chatHistory[jid]
          ]
        });

      const reply =
        completion.choices[0]?.message?.content ||
        'Maaf terjadi kesalahan.';

      chatHistory[jid].push({
        role: 'assistant',
        content: reply
      });

      saveDB();

      await sock.sendMessage(jid, {
        text: reply
      });

    } catch (err) {
      console.error(err);
    }
  });
}

startBot();
process.stdin.resume();
