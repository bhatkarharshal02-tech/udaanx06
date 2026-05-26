/**
 * UdaanX - Node.js Backend Server with MongoDB Integration
 */

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// SAFE: Connection string aur password ab .env ya Render Dashboard se aayega
const MONGO_URI = process.env.MONGO_URI; 
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123'; // Fallback for local testing
const DB_NAME = 'udaanx_db';

let db, configCollection, queriesCollection, portfolioCollection, subscribersCollection;
let dbConnected = false;
let dbErrorMsg = "";

// Database connection initialize karein (with auto-reconnect and error handling)
async function initDB() {
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI is not defined in environment variables');
        dbErrorMsg = "MONGO_URI environment variable is missing on Render.";
        return;
    }
    try {
        const client = await MongoClient.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        db = client.db(DB_NAME);
        
        configCollection = db.collection('configuration');
        queriesCollection = db.collection('queries');
        portfolioCollection = db.collection('portfolio');
        subscribersCollection = db.collection('subscribers');

        console.log('✅ UdaanX Connected successfully to MongoDB Cloud Database (Atlas)');
        dbConnected = true;

        // Seed Default Global Site Configuration agar pehle se empty hai
        const configCount = await configCollection.countDocuments();
        if (configCount === 0) {
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
            console.log('🌱 Seeded default site configuration to MongoDB.');
        }

        // Seed Portfolio Project Details agar portfolio collection empty hai
        const portfolioCount = await portfolioCollection.countDocuments();
        if (portfolioCount === 0) {
            const defaultPortfolio = [
                { title: 'Student Portfolio Website', category: 'web', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80', desc: 'A personal showcase website for a computer science graduate to display projects and get recruiter inquiries.' },
                { title: 'Digital Visiting Card for Consultant', category: 'branding', image: 'https://images.unsplash.com/photo-1589561084283-930aa7b1ce50?auto=format&fit=crop&w=800&q=80', desc: 'An interactive mobile-friendly profile with a downloadable contact file and links for a financial advisor.' }
            ];
            await portfolioCollection.insertMany(defaultPortfolio);
            console.log('🌱 Seeded default portfolio entries to MongoDB.');
        }

    } catch (error) {
        console.error('❌ MongoDB Connection Failed:', error.message);
        dbConnected = false;
        dbErrorMsg = error.message;
    }
}

// Middlewares
app.use(cors()); // Global CORS enabled for safe communication
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check API with Diagnostics for troubleshooting
app.get('/api/health', (req, res) => {
    res.json({
        status: "online",
        database: dbConnected ? "connected" : "disconnected",
        error: dbErrorMsg || null
    });
});

// Guard Middleware - Database connectivity validation
const checkDbConnection = (req, res, next) => {
    if (!dbConnected) {
        return res.status(503).json({ 
            error: "Database Connection Offline", 
            details: "Server is up but MongoDB connection failed. Please check IP Whitelist (0.0.0.0/0) on Atlas.",
            raw: dbErrorMsg 
        });
    }
    next();
};

// Auth Middleware (Admin APIs ki security ke liye)
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader === `Bearer ${ADMIN_TOKEN}`) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized Access. Invalid token.' });
    }
};

// ---------------------------------------------------------
// PUBLIC API ENDPOINTS
// ---------------------------------------------------------

app.get('/api/config', checkDbConnection, async (req, res) => {
    try {
        const config = await configCollection.findOne({ type: 'site_config' });
        if (!config) return res.status(404).json({ error: 'Configuration not found' });
        res.json({ contactInfo: config.contactInfo, heroImages: config.heroImages });
    } catch (error) {
        res.status(500).json({ error: 'Database access failure' });
    }
});

app.get('/api/portfolio', checkDbConnection, async (req, res) => {
    try {
        const projects = await portfolioCollection.find({}).toArray();
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve portfolio entries' });
    }
});

app.post('/api/contact', checkDbConnection, async (req, res) => {
    const { name, email, phone, service, msg } = req.body;
    if (!name || !email || !msg) return res.status(400).json({ error: 'Name, email, and message are required.' });

    try {
        const newQuery = { 
            name, 
            email, 
            phone: phone || 'Not provided', 
            service: service || 'General Inquiry', 
            msg, 
            date: new Date().toLocaleDateString() 
        };
        await queriesCollection.insertOne(newQuery);
        res.status(201).json({ message: 'Query saved successfully', query: newQuery });
    } catch (error) {
        res.status(500).json({ error: 'Database write error' });
    }
});

app.post('/api/newsletter', checkDbConnection, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        await subscribersCollection.updateOne({ email }, { $set: { email, subscribedAt: new Date() } }, { upsert: true });
        res.status(201).json({ message: 'Subscribed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Database operations error' });
    }
});

// ---------------------------------------------------------
// ADMIN API ENDPOINTS
// ---------------------------------------------------------

// Admin Login Route
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === ADMIN_TOKEN) {
        res.json({ message: 'Login successful', token: ADMIN_TOKEN });
    } else {
        res.status(401).json({ error: 'Invalid credentials. Please check your username or password.' });
    }
});

app.get('/api/admin/queries', adminAuth, checkDbConnection, async (req, res) => {
    try {
        const queries = await queriesCollection.find({}).sort({ _id: -1 }).toArray();
        res.json(queries);
    } catch (error) {
        res.status(500).json({ error: 'Query pull failed' });
    }
});

app.put('/api/admin/contact', adminAuth, checkDbConnection, async (req, res) => {
    const { email, phone, location } = req.body;
    try {
        await configCollection.updateOne(
            { type: 'site_config' },
            { $set: { "contactInfo.email": email, "contactInfo.phone": phone, "contactInfo.location": location } }
        );
        res.json({ message: 'Contact details updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

app.post('/api/admin/slider', adminAuth, checkDbConnection, async (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Image missing' });

    try {
        await configCollection.updateOne({ type: 'site_config' }, { $push: { heroImages: imageBase64 } });
        const updated = await configCollection.findOne({ type: 'site_config' });
        res.status(201).json({ heroImages: updated.heroImages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to append slider data' });
    }
});

app.delete('/api/admin/slider/:index', adminAuth, checkDbConnection, async (req, res) => {
    const index = parseInt(req.params.index, 10);
    try {
        const config = await configCollection.findOne({ type: 'site_config' });
        if (config && index >= 0 && index < config.heroImages.length) {
            config.heroImages.splice(index, 1);
            await configCollection.updateOne({ type: 'site_config' }, { $set: { heroImages: config.heroImages } });
            res.json({ message: 'Removed slider successfully', heroImages: config.heroImages });
        } else {
            res.status(404).json({ error: 'Image index out of bounds' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Could not access documents' });
    }
});

// Run server initialization and start listening immediately (avoids Render cold-start port crash)
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 UdaanX Server online at http://localhost:${PORT}`);
    });
});