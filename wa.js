const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, printQRInTerminal } = require('@whiskeysockets/baileys');
const Groq = require('groq-sdk');
const pino = require('pino');

// Setup Groq
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
      console.log('Buka WhatsApp > Titik 3 > Perangkat Tertaut > Tautkan Perangkat > Scan QR');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode!== DisconnectReason.loggedOut;
      console.log('Koneksi terputus:', lastDisconnect.error, 'Reconnect:', shouldReconnect);
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

    const text = msg.message.conversation ||
