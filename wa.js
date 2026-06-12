const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(express.json());

const db = new sqlite3.Database('./jung.db');
db.run(`CREATE TABLE IF NOT EXISTS data (id INTEGER PRIMARY KEY, income INTEGER DEFAULT 0, expense INTEGER DEFAULT 0)`);

// Endpoint buat website baca data
app.get('/data', (req,res)=>{
  db.get('SELECT * FROM data WHERE id=1', (err,row)=> res.json(row || {income:0, expense:0}));
});

// Terima pesan WA dari Meta
app.post('/webhook', (req,res)=>{
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if(!msg) return res.sendStatus(200);

  const text = msg.text.body.toLowerCase();
  const angka = parseInt(text.match(/\d+/)?.[0] || 0);

  if(text.includes('masuk') && angka){
    db.run('UPDATE data SET income = income +? WHERE id=1', [angka]);
  }
  if(text.includes('keluar') && angka){
    db.run('UPDATE data SET expense = expense +? WHERE id=1', [angka]);
  }
  res.sendStatus(200);
});

// Verifikasi webhook Meta
app.get('/webhook', (req,res)=>{
  if(req.query['hub.verify_token'] === 'jung2026'){
    res.send(req.query['hub.challenge']);
  } else res.sendStatus(403);
});

app.listen(3000, ()=>console.log('Bot jalan'));