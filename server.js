/**
 * UdaanX - Node.js Backend Server with MongoDB Integration
 */

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config(); // Ye line .env se variables load karti hai

const app = express();
const PORT = process.env.PORT || 5000;

// SAFE: Connection string ab sirf environment variable se aayegi
const MONGO_URI = process.env.MONGO_URI; 
const DB_NAME = 'udaanx_db';

let db, configCollection, queriesCollection, portfolioCollection, subscribersCollection;

// Database connection initialize karein
async function initDB() {
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI is not defined in environment variables');
        process.exit(1);
    }
    try {
        const client = await MongoClient.connect(MONGO_URI);
        db = client.db(DB_NAME);
        
        configCollection = db.collection('configuration');
        queriesCollection = db.collection('queries');
        portfolioCollection = db.collection('portfolio');
        subscribersCollection = db.collection('subscribers');

        console.log('✅ UdaanX Connected successfully to MongoDB Cloud Database (Atlas)');
        
        // ... (Baaki seeding logic wahi rahega)
    } catch (error) {
        console.error('❌ MongoDB initialization failed:', error);
        process.exit(1);
    }
}

// ... (Middlewares waise hi rahenge)

// FIXED: Admin Auth ab process.env se password check karega
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    // .env mein ADMIN_TOKEN naam ka variable banayein
    if (authHeader && authHeader === `Bearer ${process.env.ADMIN_TOKEN}`) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized Access' });
    }
};

// ... (Public Endpoints)

// FIXED: 'box' typo ko 'res' se badal diya gaya hai
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
            res.status(404).json({ error: 'Image index out of bounds' }); // Fixed typo here
        }
    } catch (error) {
        res.status(500).json({ error: 'Could not access documents' });
    }
});

// ... (Server start logic)