const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, printQRInTerminal } = require('@whiskeysockets/baileys');
const Groq = require('groq-sdk');
const pino = require('pino');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Jung-bot', 'Chrome', '1.0.0']
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n=== SCAN QR INI DI WHATSAPP ===\n');
      printQRInTerminal(qr);
      console.log('\n===============================\n');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode!== DisconnectReason.loggedOut;
      console.log('Koneksi terputus, Reconnect:', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('Bot berhasil terhubung ke WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    console.log('Pesan masuk:', text);

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'Kamu adalah asisten WhatsApp yang ramah.' },
          { role: 'user', content: text }
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 500,
      });

      const reply = chatCompletion.choices[0]?.message?.content || 'Maaf, error.';
      await sock.sendMessage(msg.key.remoteJid, { text: reply });
    } catch (err) {
      console.error('Error Groq:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: 'Maaf, ada error.' });
    }
  });
}

startBot();
process.stdin.resume();
