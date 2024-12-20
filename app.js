const express = require('express');
const mysql = require('mysql2');
const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.APP_PORT || 5000;

// MySQL database configuration
const dbConfig = {
  host: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
};

// Create a MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Redis client
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Middleware to handle Redis caching
const cacheMiddleware = async (req, res, next) => {
  const cacheKey = 'items';
  redisClient.get(cacheKey, (err, cachedData) => {
    if (err) {
      console.error('Redis error:', err);
      return next();
    }

    if (cachedData) {
      return res.render('index', {
        version: process.env.APP_VERSION,
        hostname: process.env.APP_HOSTNAME,
        items: JSON.parse(cachedData),
        cacheStatus: 'yes'
      });
    } else {
      next();
    }
  });
};

// Setup EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', './templates'); // Set the folder where EJS templates are stored

// Route to fetch items from the database
app.get('/', cacheMiddleware, (req, res) => {
  pool.query('SELECT * FROM items;', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Cache the result for future requests
    redisClient.setex('items', 3600, JSON.stringify(results)); // Cache for 1 hour

    // Render the EJS template
    res.render('index', {
      version: process.env.APP_VERSION,
      hostname: process.env.APP_HOSTNAME,
      items: results,
      cacheStatus: 'no'
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
