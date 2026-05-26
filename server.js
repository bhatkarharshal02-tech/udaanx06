/**
 * UdaanX - Node.js Backend Server with MongoDB Integration
 * Prerequisites:
 * 1. Run: npm install express cors mongodb dotenv
 * 2. Ensure your MongoDB instance is running (locally or MongoDB Atlas)
 * 3. Run: node server.js
 */

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB Connection Configuration
// ✅ UPDATED: Added your new MongoDB Atlas cloud database connection string
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://campusbandhu_db_user:Vr0QxC3StE3zYJGG@cluster0.vzfihiy.mongodb.net/udaanx_db?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'udaanx_db';

let db, configCollection, queriesCollection, portfolioCollection, subscribersCollection;

// Database connection initialize karein
async function initDB() {
    try {
        const client = await MongoClient.connect(MONGO_URI);
        db = client.db(DB_NAME);
        
        configCollection = db.collection('configuration');
        queriesCollection = db.collection('queries');
        portfolioCollection = db.collection('portfolio');
        subscribersCollection = db.collection('subscribers');

        console.log('✅ UdaanX Connected successfully to MongoDB Cloud Database (Atlas)');

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
                { title: 'Digital Visiting Card for Consultant', category: 'branding', image: 'https://images.unsplash.com/photo-1589561084283-930aa7b1ce50?auto=format&fit=crop&w=800&q=80', desc: 'An interactive mobile-friendly profile with a downloadable contact file and links for a financial advisor.' },
                { title: 'UI Design for Local Business', category: 'design', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80', desc: 'A friendly, accessible interface layout and wireframe set created in Figma for a local delivery service.' },
                { title: 'Academic Project Dashboard', category: 'academic', image: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80', desc: 'A responsive web dashboard tracking sensor data and analytics built as part of an IoT capstone model.' },
                { title: 'SaaS Landing Page Setup', category: 'web', image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80', desc: 'A clean single-page site with transparent pricing options and email subscription integration.' },
                { title: 'Resume Website for Job Seeker', category: 'branding', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80', desc: 'A simple one-page resume site with direct download buttons, skill bars, and a fast contact form.' }
            ];
            await portfolioCollection.insertMany(defaultPortfolio);
            console.log('🌱 Seeded default portfolio entries to MongoDB.');
        }

    } catch (error) {
        console.error('❌ MongoDB initialization failed:', error);
        process.exit(1);
    }
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth Middleware (Admin APIs ki security ke liye)
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader === 'Bearer admin123') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized Access' });
    }
};

// ---------------------------------------------------------
// PUBLIC API ENDPOINTS
// ---------------------------------------------------------

// 1. Contact Info & Slider Images load karne ke liye
app.get('/api/config', async (req, res) => {
    try {
        const config = await configCollection.findOne({ type: 'site_config' });
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        res.json({
            contactInfo: config.contactInfo,
            heroImages: config.heroImages
        });
    } catch (error) {
        res.status(500).json({ error: 'Database access failure' });
    }
});

// 2. Portfolio Items fetch karne ke liye
app.get('/api/portfolio', async (req, res) => {
    try {
        const projects = await portfolioCollection.find({}).toArray();
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve portfolio entries' });
    }
});

// 3. Contact Form Submission (MongoDB me queries save karega)
app.post('/api/contact', async (req, res) => {
    const { name, email, phone, service, msg } = req.body;
    
    if (!name || !email || !msg) {
        return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

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
        res.status(201).json({ message: 'Query saved to MongoDB successfully', query: newQuery });
    } catch (error) {
        res.status(500).json({ error: 'Database write error' });
    }
});

// 4. Newsletter subscription save karne ke liye
app.post('/api/newsletter', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        await subscribersCollection.updateOne(
            { email },
            { $set: { email, subscribedAt: new Date() } },
            { upsert: true }
        );
        res.status(201).json({ message: 'Subscribed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Database operations error' });
    }
});

// ---------------------------------------------------------
// ADMIN API ENDPOINTS (Auth Token Ke Sath Protected)
// ---------------------------------------------------------

// Admin Login Route
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        res.json({ message: 'Login successful', token: 'admin123' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Get all Customer Queries from Database
app.get('/api/admin/queries', adminAuth, async (req, res) => {
    try {
        const queries = await queriesCollection.find({}).sort({ _id: -1 }).toArray();
        res.json(queries);
    } catch (error) {
        res.status(500).json({ error: 'Query pull failed' });
    }
});

// Update Public Contact Details
app.put('/api/admin/contact', adminAuth, async (req, res) => {
    const { email, phone, location } = req.body;
    try {
        await configCollection.updateOne(
            { type: 'site_config' },
            { $set: { "contactInfo.email": email, "contactInfo.phone": phone, "contactInfo.location": location } }
        );
        res.json({ message: 'Contact details updated in MongoDB' });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// Add New Hero Image
app.post('/api/admin/slider', adminAuth, async (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Image missing' });

    try {
        await configCollection.updateOne(
            { type: 'site_config' },
            { $push: { heroImages: imageBase64 } }
        );
        const updated = await configCollection.findOne({ type: 'site_config' });
        res.status(201).json({ heroImages: updated.heroImages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to append slider data' });
    }
});

// Delete Image from Hero Array by index placement
app.delete('/api/admin/slider/:index', adminAuth, async (req, res) => {
    const index = parseInt(req.params.index, 10);
    try {
        const config = await configCollection.findOne({ type: 'site_config' });
        if (config && index >= 0 && index < config.heroImages.length) {
            config.heroImages.splice(index, 1);
            await configCollection.updateOne(
                { type: 'site_config' },
                { $set: { heroImages: config.heroImages } }
            );
            res.json({ message: 'Removed slider element successfully', heroImages: config.heroImages });
        } else {
            box.status(404).json({ error: 'Image index out of bounds' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Could not access documents' });
    }
});

// Run server initialization on port 5000
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 UdaanX Server online at http://localhost:${PORT}`);
    });
});