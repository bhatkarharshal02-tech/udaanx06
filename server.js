const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
// ObjectId इम्पोर्ट करणे आवश्यक आहे जेणेकरून MongoDB चे _id योग्यरित्या डिलीट करता येतील
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'udaanx_db';

let db;
let configCollection;
let queriesCollection;
let portfolioCollection;
let subscribersCollection;

// फक्त या ६ मेंबर्सना लॉगिन करता येईल (तुम्ही हे पासवर्ड नंतर बदलू शकता)
const VALID_MEMBERS = {
    'user1': 'pass1',
    'user2': 'pass2',
    'user3': 'pass3',
    'user4': 'pass4',
    'user5': 'pass5',
    'user6': 'pass6'
};

async function initDB() {
    try {
        console.log('Connecting to MongoDB...');

        const client = new MongoClient(MONGO_URI, {
            serverSelectionTimeoutMS: 30000
        });

        await client.connect();
        console.log('✅ Database connected successfully!');

        db = client.db(DB_NAME);
        configCollection = db.collection('configuration');
        queriesCollection = db.collection('queries');
        portfolioCollection = db.collection('portfolio');
        subscribersCollection = db.collection('subscribers');

        const existingConfig = await configCollection.findOne({ type: 'site_config' });

        if (!existingConfig) {
            await configCollection.insertOne({
                type: 'site_config',
                contactInfo: {
                    email: 'contact@udaanx.com',
                    phone: '+91 98765 43210',
                    location: 'Noida, NCR Delhi, India'
                },
                heroImages: [
                    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
                    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
                    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80'
                ]
            });
        }

        return true;

    } catch (error) {
        console.error('❌ DATABASE CONNECTION ERROR:', error.message);
        return false;
    }
}

// Admin Authentication Middleware
function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.split(' ')[1] === process.env.ADMIN_TOKEN) {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized access' });
    }
}

// --- PUBLIC API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: db ? 'connected' : 'disconnected' });
});

app.get('/api/config', async (req, res) => {
    try {
        const config = await configCollection.findOne({ type: 'site_config' });
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.get('/api/portfolio', async (req, res) => {
    try { 
        // मेन पेजवर प्रोजेक्ट्स दाखवण्यासाठी
        const data = await portfolioCollection.find({}).sort({ id: -1, _id: -1 }).toArray(); 
        res.json(data); 
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/contact', async (req, res) => {
    try {
        const newQuery = { ...req.body, date: new Date().toLocaleString('en-IN') };
        await queriesCollection.insertOne(newQuery);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Could not save query" }); }
});

app.post('/api/newsletter', async (req, res) => {
    try {
        await subscribersCollection.insertOne({ email: req.body.email, date: new Date() });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Could not subscribe" }); }
});

// --- ADMIN SECURE API ROUTES ---

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // फक्त 6 मेम्बर्स पैकी कोणीतरी आहे का हे तपासतो
    if (VALID_MEMBERS[username] && VALID_MEMBERS[username] === password) {
        res.json({ token: process.env.ADMIN_TOKEN });
    } else if ( password === process.env.ADMIN_TOKEN) {
        // जुना मास्टर पासवर्ड सुद्धा चालेल
        res.json({ token: process.env.ADMIN_TOKEN });
    } else {
        res.status(401).json({ error: 'Invalid' });
    }
});

app.get('/api/admin/queries', verifyAdmin, async (req, res) => {
    try { 
        const data = await queriesCollection.find({}).sort({ _id: -1 }).toArray(); 
        res.json(data); 
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// नवीन: क्वेरी (Inquiry) डिलीट करण्यासाठी राऊट
app.delete('/api/admin/queries/:id', verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        let filter;
        
        // MongoDB चा _id आहे की कस्टम id हे तपासण्यासाठी
        if (ObjectId.isValid(id)) {
            filter = { _id: new ObjectId(id) };
        } else {
            filter = { id: id };
        }

        const result = await queriesCollection.deleteOne(filter);
        if (result.deletedCount === 1) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Inquiry not found in database." });
        }
    } catch (e) { 
        res.status(500).json({ error: "Failed to delete inquiry" }); 
    }
});

app.put('/api/admin/contact', verifyAdmin, async (req, res) => {
    try { 
        await configCollection.updateOne(
            { type: 'site_config' }, 
            { $set: { contactInfo: req.body } }, 
            { upsert: true }
        ); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: "Save Failed" }); 
    }
});

app.post('/api/admin/slider', verifyAdmin, async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        await configCollection.updateOne(
            { type: 'site_config' },
            { $push: { heroImages: imageBase64 } }
        );
        const updatedConfig = await configCollection.findOne({ type: 'site_config' });
        res.json({ heroImages: updatedConfig.heroImages });
    } catch (e) { res.status(500).json({ error: "Failed to upload image" }); }
});

app.delete('/api/admin/slider/:index', verifyAdmin, async (req, res) => {
    try {
        const indexToRemove = parseInt(req.params.index, 10);
        const config = await configCollection.findOne({ type: 'site_config' });
        if (config && config.heroImages) {
            const newImages = config.heroImages.filter((_, idx) => idx !== indexToRemove);
            await configCollection.updateOne({ type: 'site_config' }, { $set: { heroImages: newImages } });
            res.json({ heroImages: newImages });
        } else {
            res.status(404).json({ error: "Config not found" });
        }
    } catch (e) { res.status(500).json({ error: "Failed to delete slide" }); }
});

// ॲडमिन कडून प्रोजेक्ट ऍड करण्यासाठी
app.post('/api/admin/portfolio', verifyAdmin, async (req, res) => {
    try {
        const newProject = {
            id: Date.now(), // युनिक आयडी
            title: req.body.title,
            category: req.body.category,
            desc: req.body.desc,
            image: req.body.image
        };
        await portfolioCollection.insertOne(newProject);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Failed to add project" }); }
});

// नवीन: ॲडमिन कडून प्रोजेक्ट अपडेट/एडिट (Edit) करण्यासाठी
app.put('/api/admin/portfolio/:id', verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        let filter;

        if (ObjectId.isValid(id)) {
            filter = { _id: new ObjectId(id) };
        } else {
            filter = { id: parseInt(id) };
        }

        const updateData = {
            title: req.body.title,
            category: req.body.category,
            desc: req.body.desc,
            image: req.body.image
        };

        const result = await portfolioCollection.updateOne(filter, { $set: updateData });
        
        if (result.matchedCount === 1) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Project not found to edit." });
        }
    } catch (e) {
        res.status(500).json({ error: "Failed to update project" });
    }
});

// ॲडमिन कडून प्रोजेक्ट डिलीट करण्यासाठी (आता ObjectId व Timestamp दोन्ही सपोर्ट करेल)
app.delete('/api/admin/portfolio/:id', verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        let filter;

        // MongoDB चा अंगभूत _id सपोर्ट
        if (ObjectId.isValid(id) && id.length === 24) {
            filter = { _id: new ObjectId(id) };
        } else {
            // जर जुने Timestamp वाले IDs असतील तर
            filter = { id: parseInt(id) }; 
        }

        const result = await portfolioCollection.deleteOne(filter);
        if (result.deletedCount === 1) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Project not found to delete." });
        }
    } catch (e) { 
        res.status(500).json({ error: "Failed to delete project" }); 
    }
});

// Serve Frontend Files
app.use(express.static(path.join(__dirname, '.')));

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
initDB().then((connected) => {
    if (!connected) {
        console.log('⚠️ Starting server without DB connection for debugging...');
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
});