const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'udaanx_db';
let db, configCollection, queriesCollection, portfolioCollection, subscribersCollection;

async function initDB() {
    try {
        console.log("Connecting to MongoDB...");
        const client = await MongoClient.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
        db = client.db(DB_NAME);
        configCollection = db.collection('configuration');
        queriesCollection = db.collection('queries');
        portfolioCollection = db.collection('portfolio');
        subscribersCollection = db.collection('subscribers');
        console.log('✅ Database connected successfully!');
        return true;
    } catch (error) {
        console.error('❌ DATABASE CONNECTION ERROR:', error.message);
        return false;
    }
}

// API Routes
app.get('/api/health', (req, res) => res.json({ status: "ok" }));

app.get('/api/config', async (req, res) => {
    try { 
        const config = await configCollection.findOne({ type: 'site_config' }); 
        res.json(config); 
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === process.env.ADMIN_TOKEN) {
        res.json({ token: process.env.ADMIN_TOKEN });
    } else { 
        res.status(401).json({ error: 'Invalid' }); 
    }
});

app.get('/api/portfolio', async (req, res) => {
    try { const data = await portfolioCollection.find({}).toArray(); res.json(data); } 
    catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.get('/api/admin/queries', async (req, res) => {
    try { const data = await queriesCollection.find({}).toArray(); res.json(data); } 
    catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.get('/api/admin/slider', async (req, res) => {
    try { const data = await db.collection('slider').find({}).toArray(); res.json(data); } 
    catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// Yahan maine PUT route add kiya hai jo aapke index.html ke sath match karega
app.put('/api/admin/contact', async (req, res) => {
    try { 
        await configCollection.updateOne({ type: 'site_config' }, { $set: req.body }, { upsert: true }); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: "Save Failed" }); }
});

app.use(express.static(path.join(__dirname, '.')));

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

initDB().then((connected) => {
    if (connected) {
        app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
    } else {
        process.exit(1);
    }
});