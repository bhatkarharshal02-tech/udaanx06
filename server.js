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

// Database Initialize
async function initDB() {
    try {
        console.log("Connecting to MongoDB...");
        // serverSelectionTimeoutMS badha rahe hain taaki connection timeout na ho
        const client = await MongoClient.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000 
        });
        
        db = client.db(DB_NAME);
        configCollection = db.collection('configuration');
        queriesCollection = db.collection('queries');
        portfolioCollection = db.collection('portfolio');
        subscribersCollection = db.collection('subscribers');
        
        dbConnected = true;
        console.log('✅ Database connected successfully!');
    } catch (error) {
        console.error('❌ DATABASE CONNECTION ERROR:', error.message);
        dbConnected = false;
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

// Admin Login
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
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Server Start
initDB().then((connected) => {
    if (connected) {
        app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
    }
});