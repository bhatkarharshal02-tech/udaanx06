const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'udaanx_db';
let db, configCollection, queriesCollection, portfolioCollection, subscribersCollection;

// Database Initialize - FIX: Return true/false
async function initDB() {
    try {
        console.log("Connecting to MongoDB...");
        const client = await MongoClient.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000 
        });
        
        db = client.db(DB_NAME);
        configCollection = db.collection('configuration');
        queriesCollection = db.collection('queries');
        portfolioCollection = db.collection('portfolio');
        subscribersCollection = db.collection('subscribers');
        
        console.log('✅ Database connected successfully!');
        return true; // Yahan true return karna zaruri hai
    } catch (error) {
        console.error('❌ DATABASE CONNECTION ERROR:', error.message);
        return false; // Yahan false return karna zaruri hai
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

// Static files and SPA setup
app.use(express.static(path.join(__dirname, '.')));

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Server Start - Ab ye code sahi se chalega
initDB().then((connected) => {
    if (connected) {
        app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
    } else {
        console.log("❌ Server start failed due to DB connection issue.");
    }
});