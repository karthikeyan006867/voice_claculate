// Database Configuration and Connection
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('✅ Database connected successfully at:', res.rows[0].now);
    }
});

// Initialize database tables
const initDatabase = async () => {
    const client = await pool.connect();
    
    try {
        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                display_name VARCHAR(100),
                avatar_url TEXT,
                preferences JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);
        
        // Calculation history table
        await client.query(`
            CREATE TABLE IF NOT EXISTS calculation_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                expression TEXT NOT NULL,
                result TEXT NOT NULL,
                mode VARCHAR(20) DEFAULT 'basic',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Saved calculations (favorites)
        await client.query(`
            CREATE TABLE IF NOT EXISTS saved_calculations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                expression TEXT NOT NULL,
                result TEXT NOT NULL,
                description TEXT,
                category VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Custom formulas
        await client.query(`
            CREATE TABLE IF NOT EXISTS custom_formulas (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                formula TEXT NOT NULL,
                variables JSONB DEFAULT '[]',
                description TEXT,
                category VARCHAR(50),
                is_public BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Unit conversion history
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversion_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                conversion_type VARCHAR(50) NOT NULL,
                from_value DECIMAL NOT NULL,
                from_unit VARCHAR(50) NOT NULL,
                to_value DECIMAL NOT NULL,
                to_unit VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // User statistics
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_statistics (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                total_calculations INTEGER DEFAULT 0,
                total_conversions INTEGER DEFAULT 0,
                favorite_mode VARCHAR(20) DEFAULT 'basic',
                total_voice_commands INTEGER DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                last_active_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Voice command logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS voice_commands (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                command_text TEXT NOT NULL,
                interpreted_as TEXT,
                success BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Shared calculations
        await client.query(`
            CREATE TABLE IF NOT EXISTS shared_calculations (
                id SERIAL PRIMARY KEY,
                share_id VARCHAR(50) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                expression TEXT NOT NULL,
                result TEXT NOT NULL,
                mode VARCHAR(20) DEFAULT 'basic',
                views INTEGER DEFAULT 0,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_calc_history_user ON calculation_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_calc_history_date ON calculation_history(created_at);
            CREATE INDEX IF NOT EXISTS idx_saved_calc_user ON saved_calculations(user_id);
            CREATE INDEX IF NOT EXISTS idx_custom_formulas_user ON custom_formulas(user_id);
            CREATE INDEX IF NOT EXISTS idx_custom_formulas_public ON custom_formulas(is_public);
            CREATE INDEX IF NOT EXISTS idx_shared_calc_share_id ON shared_calculations(share_id);
        `);
        
        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { pool, initDatabase };
