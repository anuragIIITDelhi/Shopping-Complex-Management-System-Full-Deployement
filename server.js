const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Database Connection
const mysql = require('mysql2');
const db = mysql.createPool({
    host: 'localhost',
    user: 'shopping_user',
    password: '1234',
    database: 'shopping_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Helper: Call C++ Backend
const CPP_BACKEND = './shopping_backend';

function callCpp(args) {
    return new Promise((resolve, reject) => {
        const command = CPP_BACKEND + ' ' + args.join(' ');
        console.log('Executing:', command);
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('C++ Error:', error);
                reject(error);
                return;
            }
            if (stderr) {
                console.error('Stderr:', stderr);
            }
            
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
                resolve(stdout);
            }
        });
    });
}

// Create Users Table
db.query(`
    CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(15),
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'buyer') DEFAULT 'buyer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) console.error('Table creation error:', err);
    else console.log('Users table ready');
});

// Create OTP Table
db.query(`
    CREATE TABLE IF NOT EXISTS otp_verification (
        id INT PRIMARY KEY AUTO_INCREMENT,
        phone VARCHAR(15) NOT NULL,
        otp_code VARCHAR(6) NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
    )
`, (err) => {
    if (err) console.error('OTP table creation error:', err);
    else console.log('OTP table ready');
});

// AUTHENTICATION ROUTES

// Register (Sign Up) with phone & OTP verification
app.post('/api/auth/register', (req, res) => {
    const { name, email, phone, password, otp } = req.body;
    
    if (!name || !email || !phone || !password || !otp) {
        return res.status(400).json({ 
            success: false, 
            message: 'All fields including OTP are required' 
        });
    }
    
    const otpSql = `SELECT * FROM otp_verification 
                    WHERE phone = ? AND otp_code = ? 
                    AND is_verified = TRUE 
                    AND expires_at > NOW()
                    ORDER BY created_at DESC LIMIT 1`;
    
    db.query(otpSql, [phone, otp], (err, otpResults) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'Database error' 
            });
        }
        
        if (otpResults.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Invalid or expired OTP. Please try again.' 
            });
        }
        
        db.query('SELECT * FROM users WHERE email = ? OR phone = ?', [email, phone], (err, results) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Database error' 
                });
            }
            
            if (results.length > 0) {
                return res.json({ 
                    success: false, 
                    message: 'Email or phone already registered' 
                });
            }
            
            db.query(
                'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
                [name, email, phone, password, 'buyer'],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({ 
                            success: false, 
                            message: 'Registration failed' 
                        });
                    }
                    
                    db.query(
                        'DELETE FROM otp_verification WHERE id = ?',
                        [otpResults[0].id]
                    );
                    
                    res.json({
                        success: true,
                        message: 'Registration successful!',
                        user: { 
                            id: result.insertId, 
                            name, 
                            email, 
                            phone, 
                            role: 'buyer' 
                        }
                    });
                }
            );
        });
    });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.json({ success: false, message: 'Invalid email or password' });
        }
        
        const user = results[0];
        res.json({
            success: true,
            message: 'Login successful',
            user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }
        });
    });
});

// PRODUCT ROUTES

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const result = await callCpp(['list']);
        let products = result;
        if (typeof result === 'string') {
            products = JSON.parse(result);
        }
        res.json(products);
    } catch (error) {
        console.error('Error:', error);
        db.query('SELECT * FROM products ORDER BY code', (err, results) => {
            if (err) {
                res.json([]);
                return;
            }
            res.json(results);
        });
    }
});

// Get single product
app.get('/api/products/:code', async (req, res) => {
    try {
        const result = await callCpp(['get', req.params.code]);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEARCH ROUTES

app.get('/api/products/search/:keyword', async (req, res) => {
    try {
        const result = await callCpp(['search', req.params.keyword]);
        let products = result;
        if (typeof result === 'string') {
            products = JSON.parse(result);
        }
        res.json(products);
    } catch (error) {
        console.error('Search error:', error);
        const keyword = req.params.keyword;
        db.query(
            'SELECT * FROM products WHERE name LIKE ? OR CAST(code AS CHAR) LIKE ? ORDER BY code',
            [`%${keyword}%`, `%${keyword}%`],
            (err, results) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(results);
            }
        );
    }
});

app.get('/api/products/search-name/:name', async (req, res) => {
    try {
        const result = await callCpp(['search-name', req.params.name]);
        let products = result;
        if (typeof result === 'string') {
            products = JSON.parse(result);
        }
        res.json(products);
    } catch (error) {
        console.error('Search error:', error);
        const name = req.params.name;
        db.query(
            'SELECT * FROM products WHERE name LIKE ? ORDER BY code',
            [`%${name}%`],
            (err, results) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(results);
            }
        );
    }
});

app.get('/api/products/search-price/:min/:max', async (req, res) => {
    try {
        const result = await callCpp(['search-price', req.params.min, req.params.max]);
        let products = result;
        if (typeof result === 'string') {
            products = JSON.parse(result);
        }
        res.json(products);
    } catch (error) {
        console.error('Search error:', error);
        const min = parseFloat(req.params.min);
        const max = parseFloat(req.params.max);
        db.query(
            'SELECT * FROM products WHERE price BETWEEN ? AND ? ORDER BY price',
            [min, max],
            (err, results) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(results);
            }
        );
    }
});

// CRUD ROUTES

// Add product - now accepts image_url
app.post('/api/products', async (req, res) => {
    const { code, name, price, discount, image_url } = req.body;
    
    if (!code || !name || price === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const imgUrl = image_url || 'https://via.placeholder.com/150';
    
    try {
        const result = await callCpp(['add', code.toString(), name, price.toString(), discount.toString(), imgUrl]);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        const sql = 'INSERT INTO products VALUES(?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=?, price=?, discount=?, image_url=?';
        db.query(sql, [code, name, price, discount, imgUrl, name, price, discount, imgUrl], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, message: 'Product added successfully' });
        });
    }
});

// Update product - now accepts image_url
app.put('/api/products/:code', async (req, res) => {
    const { code } = req.params;
    const { name, price, discount, image_url } = req.body;
    
    const imgUrl = image_url || 'https://via.placeholder.com/150';
    
    try {
        const result = await callCpp(['edit', code, name, price.toString(), discount.toString(), imgUrl]);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        const sql = 'UPDATE products SET name=?, price=?, discount=?, image_url=? WHERE code=?';
        db.query(sql, [name, price, discount, imgUrl, code], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, message: 'Product updated successfully' });
        });
    }
});

// Delete product
app.delete('/api/products/:code', async (req, res) => {
    try {
        const result = await callCpp(['delete', req.params.code]);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        db.query('DELETE FROM products WHERE code=?', [req.params.code], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, message: 'Product deleted successfully' });
        });
    }
});

// Get product count
app.get('/api/products/count', async (req, res) => {
    try {
        const result = await callCpp(['count']);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ORDER ROUTES

// Place order
app.post('/api/orders', (req, res) => {
    const { items, total, user } = req.body;
    
    let userId = user ? user.id : null;
    let userName = user ? user.name : 'Guest';
    let userEmail = user ? user.email : 'guest@example.com';
    let itemsJson = JSON.stringify(items);
    
    const sql = 'INSERT INTO orders (user_id, user_name, user_email, items, total) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [userId, userName, userEmail, itemsJson, total], (err, result) => {
        if (err) {
            console.error('Order save error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to save order. Please try again.'
            });
            return;
        }
        
        res.json({ 
            success: true, 
            message: 'Order placed successfully', 
            orderId: result.insertId
        });
    });
});

// Get order history for a user
app.get('/api/orders/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.query('SELECT * FROM orders WHERE user_id = ? OR user_email = ? ORDER BY order_date DESC', 
        [userId, userId], 
        (err, results) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(results);
        }
    );
});

// Get all orders (Admin)
app.get('/api/orders/all', (req, res) => {
    db.query('SELECT * FROM orders ORDER BY order_date DESC', (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// OTP ROUTES

// Generate OTP
app.post('/api/otp/generate', (req, res) => {
    const { phone } = req.body;
    
    if (!phone || phone.length < 10) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please enter a valid phone number' 
        });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const sql = `INSERT INTO otp_verification (phone, otp_code, expires_at) 
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`;
    
    db.query(sql, [phone, otp], (err, result) => {
        if (err) {
            console.error('OTP save error:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to generate OTP' 
            });
        }
        
        console.log(`OTP for ${phone}: ${otp}`);
        
        res.json({
            success: true,
            message: 'OTP sent successfully!',
            otp: otp,
            phone: phone,
            expiresIn: '5 minutes'
        });
    });
});

// Verify OTP
app.post('/api/otp/verify', (req, res) => {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
        return res.status(400).json({
            success: false,
            message: 'Phone and OTP are required'
        });
    }
    
    const sql = `SELECT * FROM otp_verification 
                 WHERE phone = ? AND otp_code = ? 
                 AND is_verified = FALSE 
                 AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`;
    
    db.query(sql, [phone, otp], (err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Database error'
            });
        }
        
        if (results.length === 0) {
            return res.json({
                success: false,
                message: 'Invalid or expired OTP. Please generate a new one.'
            });
        }
        
        const markVerifiedSql = `UPDATE otp_verification SET is_verified = TRUE WHERE id = ?`;
        
        db.query(markVerifiedSql, [results[0].id], (err) => {
            if (err) {
                console.error('OTP mark-verified error:', err);
            }
        });
        
        res.json({
            success: true,
            message: 'OTP verified successfully!',
            phone: phone
        });
    });
});

// Resend OTP
app.post('/api/otp/resend', (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({
            success: false,
            message: 'Phone number required'
        });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const sql = `INSERT INTO otp_verification (phone, otp_code, expires_at) 
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`;
    
    db.query(sql, [phone, otp], (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Failed to resend OTP'
            });
        }
        
        console.log(`New OTP for ${phone}: ${otp}`);
        
        res.json({
            success: true,
            message: 'OTP resent successfully!',
            otp: otp,
            expiresIn: '5 minutes'
        });
    });
});

// START SERVER

app.listen(port, '0.0.0.0', () => {
    console.log('\n============================================');
    console.log('  ANURAG SHOPPING COMPLEX');
    console.log('============================================');
    console.log(`  Server: http://localhost:${port}`);
    console.log(`  C++ Backend: ./shopping_backend`);
    console.log('  Features:');
    console.log('   - Admin Login');
    console.log('   - Buyer Login/Signup');
    console.log('   - Product CRUD');
    console.log('   - Search Products');
    console.log('   - Shopping Cart');
    console.log('   - Checkout');
    console.log('============================================\n');
});