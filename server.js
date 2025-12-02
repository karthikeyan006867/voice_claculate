// Express Server for Voice Calculator
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const { pool, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Optional authentication - doesn't fail if no token
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    next();
};

// ==================== AUTH ROUTES ====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, displayName } = req.body;
    
    try {
        // Check if user exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Create user
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, display_name) 
             VALUES ($1, $2, $3, $4) RETURNING id, username, email, display_name`,
            [username, email, passwordHash, displayName || username]
        );
        
        const user = result.rows[0];
        
        // Create user statistics entry
        await pool.query(
            'INSERT INTO user_statistics (user_id) VALUES ($1)',
            [user.id]
        );
        
        // Generate token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            user: { id: user.id, username: user.username, email: user.email, displayName: user.display_name },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        // Generate token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.display_name,
                preferences: user.preferences
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.*, us.total_calculations, us.total_conversions, 
                    us.favorite_mode, us.total_voice_commands, us.streak_days
             FROM users u
             LEFT JOIN user_statistics us ON u.id = us.user_id
             WHERE u.id = $1`,
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        delete user.password_hash;
        
        res.json({ user });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update user preferences
app.put('/api/auth/preferences', authenticateToken, async (req, res) => {
    const { preferences } = req.body;
    
    try {
        await pool.query(
            'UPDATE users SET preferences = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(preferences), req.user.id]
        );
        
        res.json({ message: 'Preferences updated successfully' });
    } catch (error) {
        console.error('Preferences update error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// ==================== CALCULATION HISTORY ROUTES ====================

// Save calculation to history
app.post('/api/calculations', optionalAuth, async (req, res) => {
    const { expression, result, mode } = req.body;
    
    try {
        const userId = req.user ? req.user.id : null;
        
        const insertResult = await pool.query(
            `INSERT INTO calculation_history (user_id, expression, result, mode)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, expression, result, mode || 'basic']
        );
        
        // Update user statistics if logged in
        if (userId) {
            await pool.query(
                `UPDATE user_statistics 
                 SET total_calculations = total_calculations + 1,
                     last_active_date = CURRENT_DATE,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [userId]
            );
        }
        
        res.status(201).json({ calculation: insertResult.rows[0] });
    } catch (error) {
        console.error('Save calculation error:', error);
        res.status(500).json({ error: 'Failed to save calculation' });
    }
});

// Get calculation history
app.get('/api/calculations', authenticateToken, async (req, res) => {
    const { limit = 50, offset = 0, mode } = req.query;
    
    try {
        let query = `
            SELECT * FROM calculation_history 
            WHERE user_id = $1
        `;
        const params = [req.user.id];
        
        if (mode) {
            query += ` AND mode = $${params.length + 1}`;
            params.push(mode);
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        
        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM calculation_history WHERE user_id = $1',
            [req.user.id]
        );
        
        res.json({
            calculations: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Fetch calculations error:', error);
        res.status(500).json({ error: 'Failed to fetch calculations' });
    }
});

// Clear calculation history
app.delete('/api/calculations', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM calculation_history WHERE user_id = $1',
            [req.user.id]
        );
        
        res.json({ message: 'History cleared successfully' });
    } catch (error) {
        console.error('Clear history error:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// ==================== SAVED CALCULATIONS ROUTES ====================

// Save a calculation as favorite
app.post('/api/saved', authenticateToken, async (req, res) => {
    const { name, expression, result, description, category } = req.body;
    
    try {
        const insertResult = await pool.query(
            `INSERT INTO saved_calculations (user_id, name, expression, result, description, category)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.id, name, expression, result, description, category]
        );
        
        res.status(201).json({ saved: insertResult.rows[0] });
    } catch (error) {
        console.error('Save favorite error:', error);
        res.status(500).json({ error: 'Failed to save calculation' });
    }
});

// Get saved calculations
app.get('/api/saved', authenticateToken, async (req, res) => {
    const { category } = req.query;
    
    try {
        let query = 'SELECT * FROM saved_calculations WHERE user_id = $1';
        const params = [req.user.id];
        
        if (category) {
            query += ' AND category = $2';
            params.push(category);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        
        res.json({ saved: result.rows });
    } catch (error) {
        console.error('Fetch saved error:', error);
        res.status(500).json({ error: 'Failed to fetch saved calculations' });
    }
});

// Delete saved calculation
app.delete('/api/saved/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM saved_calculations WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Delete saved error:', error);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// ==================== CUSTOM FORMULAS ROUTES ====================

// Create custom formula
app.post('/api/formulas', authenticateToken, async (req, res) => {
    const { name, formula, variables, description, category, isPublic } = req.body;
    
    try {
        const insertResult = await pool.query(
            `INSERT INTO custom_formulas (user_id, name, formula, variables, description, category, is_public)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [req.user.id, name, formula, JSON.stringify(variables || []), description, category, isPublic || false]
        );
        
        res.status(201).json({ formula: insertResult.rows[0] });
    } catch (error) {
        console.error('Create formula error:', error);
        res.status(500).json({ error: 'Failed to create formula' });
    }
});

// Get user's formulas
app.get('/api/formulas', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM custom_formulas WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        
        res.json({ formulas: result.rows });
    } catch (error) {
        console.error('Fetch formulas error:', error);
        res.status(500).json({ error: 'Failed to fetch formulas' });
    }
});

// Get public formulas
app.get('/api/formulas/public', async (req, res) => {
    const { category, search, limit = 20 } = req.query;
    
    try {
        let query = `
            SELECT f.*, u.username, u.display_name 
            FROM custom_formulas f
            JOIN users u ON f.user_id = u.id
            WHERE f.is_public = true
        `;
        const params = [];
        
        if (category) {
            params.push(category);
            query += ` AND f.category = $${params.length}`;
        }
        
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (f.name ILIKE $${params.length} OR f.description ILIKE $${params.length})`;
        }
        
        params.push(limit);
        query += ` ORDER BY f.created_at DESC LIMIT $${params.length}`;
        
        const result = await pool.query(query, params);
        
        res.json({ formulas: result.rows });
    } catch (error) {
        console.error('Fetch public formulas error:', error);
        res.status(500).json({ error: 'Failed to fetch formulas' });
    }
});

// Update formula
app.put('/api/formulas/:id', authenticateToken, async (req, res) => {
    const { name, formula, variables, description, category, isPublic } = req.body;
    
    try {
        const result = await pool.query(
            `UPDATE custom_formulas 
             SET name = $1, formula = $2, variables = $3, description = $4, 
                 category = $5, is_public = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 AND user_id = $8
             RETURNING *`,
            [name, formula, JSON.stringify(variables || []), description, category, isPublic, req.params.id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Formula not found' });
        }
        
        res.json({ formula: result.rows[0] });
    } catch (error) {
        console.error('Update formula error:', error);
        res.status(500).json({ error: 'Failed to update formula' });
    }
});

// Delete formula
app.delete('/api/formulas/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM custom_formulas WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        
        res.json({ message: 'Formula deleted successfully' });
    } catch (error) {
        console.error('Delete formula error:', error);
        res.status(500).json({ error: 'Failed to delete formula' });
    }
});

// ==================== CONVERSION HISTORY ROUTES ====================

// Save conversion
app.post('/api/conversions', optionalAuth, async (req, res) => {
    const { conversionType, fromValue, fromUnit, toValue, toUnit } = req.body;
    
    try {
        const userId = req.user ? req.user.id : null;
        
        const result = await pool.query(
            `INSERT INTO conversion_history (user_id, conversion_type, from_value, from_unit, to_value, to_unit)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [userId, conversionType, fromValue, fromUnit, toValue, toUnit]
        );
        
        if (userId) {
            await pool.query(
                `UPDATE user_statistics 
                 SET total_conversions = total_conversions + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [userId]
            );
        }
        
        res.status(201).json({ conversion: result.rows[0] });
    } catch (error) {
        console.error('Save conversion error:', error);
        res.status(500).json({ error: 'Failed to save conversion' });
    }
});

// Get conversion history
app.get('/api/conversions', authenticateToken, async (req, res) => {
    const { type, limit = 50 } = req.query;
    
    try {
        let query = 'SELECT * FROM conversion_history WHERE user_id = $1';
        const params = [req.user.id];
        
        if (type) {
            query += ' AND conversion_type = $2';
            params.push(type);
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        
        const result = await pool.query(query, params);
        
        res.json({ conversions: result.rows });
    } catch (error) {
        console.error('Fetch conversions error:', error);
        res.status(500).json({ error: 'Failed to fetch conversions' });
    }
});

// ==================== VOICE COMMAND ROUTES ====================

// Log voice command
app.post('/api/voice-commands', optionalAuth, async (req, res) => {
    const { commandText, interpretedAs, success } = req.body;
    
    try {
        const userId = req.user ? req.user.id : null;
        
        const result = await pool.query(
            `INSERT INTO voice_commands (user_id, command_text, interpreted_as, success)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, commandText, interpretedAs, success]
        );
        
        if (userId) {
            await pool.query(
                `UPDATE user_statistics 
                 SET total_voice_commands = total_voice_commands + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [userId]
            );
        }
        
        res.status(201).json({ voiceCommand: result.rows[0] });
    } catch (error) {
        console.error('Log voice command error:', error);
        res.status(500).json({ error: 'Failed to log voice command' });
    }
});

// Get voice command analytics
app.get('/api/voice-commands/analytics', authenticateToken, async (req, res) => {
    try {
        const totalResult = await pool.query(
            'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE success = true) as successful FROM voice_commands WHERE user_id = $1',
            [req.user.id]
        );
        
        const topCommandsResult = await pool.query(
            `SELECT interpreted_as, COUNT(*) as count 
             FROM voice_commands 
             WHERE user_id = $1 AND interpreted_as IS NOT NULL
             GROUP BY interpreted_as 
             ORDER BY count DESC 
             LIMIT 10`,
            [req.user.id]
        );
        
        res.json({
            total: parseInt(totalResult.rows[0].total),
            successful: parseInt(totalResult.rows[0].successful),
            successRate: totalResult.rows[0].total > 0 
                ? (totalResult.rows[0].successful / totalResult.rows[0].total * 100).toFixed(1) 
                : 0,
            topCommands: topCommandsResult.rows
        });
    } catch (error) {
        console.error('Voice analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// ==================== SHARE ROUTES ====================

// Share a calculation
app.post('/api/share', optionalAuth, async (req, res) => {
    const { expression, result, mode, expiresIn } = req.body;
    
    try {
        const shareId = generateShareId();
        const userId = req.user ? req.user.id : null;
        
        let expiresAt = null;
        if (expiresIn) {
            expiresAt = new Date(Date.now() + expiresIn * 1000);
        }
        
        const insertResult = await pool.query(
            `INSERT INTO shared_calculations (share_id, user_id, expression, result, mode, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [shareId, userId, expression, result, mode || 'basic', expiresAt]
        );
        
        res.status(201).json({
            shareId,
            shareUrl: `/share/${shareId}`,
            calculation: insertResult.rows[0]
        });
    } catch (error) {
        console.error('Share error:', error);
        res.status(500).json({ error: 'Failed to share calculation' });
    }
});

// Get shared calculation
app.get('/api/share/:shareId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT sc.*, u.username, u.display_name
             FROM shared_calculations sc
             LEFT JOIN users u ON sc.user_id = u.id
             WHERE sc.share_id = $1 AND (sc.expires_at IS NULL OR sc.expires_at > CURRENT_TIMESTAMP)`,
            [req.params.shareId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shared calculation not found or expired' });
        }
        
        // Increment view count
        await pool.query(
            'UPDATE shared_calculations SET views = views + 1 WHERE share_id = $1',
            [req.params.shareId]
        );
        
        res.json({ calculation: result.rows[0] });
    } catch (error) {
        console.error('Get shared error:', error);
        res.status(500).json({ error: 'Failed to fetch shared calculation' });
    }
});

// ==================== STATISTICS ROUTES ====================

// Get user statistics
app.get('/api/statistics', authenticateToken, async (req, res) => {
    try {
        const statsResult = await pool.query(
            'SELECT * FROM user_statistics WHERE user_id = $1',
            [req.user.id]
        );
        
        // Get recent activity
        const recentCalcResult = await pool.query(
            `SELECT mode, COUNT(*) as count 
             FROM calculation_history 
             WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
             GROUP BY mode`,
            [req.user.id]
        );
        
        // Get daily calculations for the past week
        const dailyCalcResult = await pool.query(
            `SELECT DATE(created_at) as date, COUNT(*) as count
             FROM calculation_history
             WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
             GROUP BY DATE(created_at)
             ORDER BY date`,
            [req.user.id]
        );
        
        res.json({
            statistics: statsResult.rows[0] || {},
            recentActivity: recentCalcResult.rows,
            dailyCalculations: dailyCalcResult.rows
        });
    } catch (error) {
        console.error('Statistics error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ==================== UTILITY FUNCTIONS ====================

function generateShareId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ==================== START SERVER ====================

// Initialize database and start server
initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Voice Calculator Server running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

module.exports = app;
