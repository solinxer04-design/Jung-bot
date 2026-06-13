require('dotenv').config();

const {
default: makeWASocket,
useMultiFileAuthState,
DisconnectReason
} = require('@whiskeysockets/baileys');

const Groq = require('groq-sdk');
const pino = require('pino');
const fs = require('fs');

const groq = new Groq({
apiKey: process.env.GROQ_API_KEY
});

const DB_FILE = './chats.json';

let chatHistory = {};

if (fs.existsSync(DB_FILE)) {
try {
chatHistory = JSON.parse(fs.readFileSync(DB_FILE));
} catch {
chatHistory = {};
}
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
browser: ['Jung-Bot', 'Chrome', '1.0']
});

sock.ev.on('creds.update', saveCreds);

// PAIRING CODE
if (!state.creds.registered) {
const phoneNumber = '6289664449690'; // GANTI DENGAN NOMOR ANDA

setTimeout(async () => {  
  try {  
    const code = await sock.requestPairingCode(phoneNumber);  
    console.log('');  
    console.log('========================');  
    console.log('PAIRING CODE :', code);  
    console.log('========================');  
    console.log('');  
  } catch (err) {  
    console.error('Gagal membuat pairing code:', err);  
  }  
}, 5000);

}

sock.ev.on('connection.update', async ({
connection,
lastDisconnect
}) => {

if (connection === 'open') {  
  console.log('✅ Bot Connected');  
}  

if (connection === 'close') {  
  const shouldReconnect =  
    lastDisconnect?.error?.output?.statusCode !==  
    DisconnectReason.loggedOut;  

  console.log('Reconnect:', shouldReconnect);  

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

  // MENU  
  if (text === '!menu') {  
    return sock.sendMessage(jid, {  
      text: `🤖 JUNG BOT AI

!menu
!ping
!reset
!ai pertanyaan

Contoh:
!ai siapa presiden indonesia`
});
}

// PING  
  if (text === '!ping') {  
    return sock.sendMessage(jid, {  
      text: '🏓 Pong!'  
    });  
  }  

  // RESET  
  if (text === '!reset') {  
    chatHistory[jid] = [];  
    saveDB();  

    return sock.sendMessage(jid, {  
      text: '✅ Riwayat percakapan dihapus.'  
    });  
  }  

  // Hanya respon !ai  
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
