const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Enhanced CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5501', 'http://localhost:5501', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        try {
            await fs.access(uploadDir);
        } catch {
            await fs.mkdir(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Initialize data directory and files
async function initializeData() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }

    // Initialize articles file
    try {
        await fs.access(ARTICLES_FILE);
    } catch {
        const initialArticles = { articles: [] };
        await fs.writeFile(ARTICLES_FILE, JSON.stringify(initialArticles, null, 2));
    }

    // Initialize users file
    try {
        await fs.access(USERS_FILE);
    } catch {
        const initialUsers = {
            users: [
                {
                    id: 1,
                    username: 'admin',
                    password: 'admin123',
                    role: 'admin'
                }
            ]
        };
        await fs.writeFile(USERS_FILE, JSON.stringify(initialUsers, null, 2));
    }
}

// Utility functions
async function readJSON(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        return parsed;
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return null;
    }
}

async function writeJSON(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        return false;
    }
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Auth routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const usersData = await readJSON(USERS_FILE);
        if (!usersData || !usersData.users) {
            console.log('Users data not found, creating default admin...');
            // Create default user data if not exists
            const defaultUsers = {
                users: [
                    {
                        id: 1,
                        username: 'admin',
                        password: 'admin123',
                        role: 'admin'
                    }
                ]
            };
            await writeJSON(USERS_FILE, defaultUsers);
            const user = defaultUsers.users.find(u => u.username === username && u.password === password);
            
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        }

        const user = usersData.users.find(u => u.username === username && u.password === password);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add the missing auth verify endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// File upload endpoint
app.post('/api/upload', authenticateToken, (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            url: `http://localhost:${PORT}${fileUrl}`,
            filename: req.file.filename
        });
    });
});

// Articles endpoints
app.get('/api/articles', async (req, res) => {
    try {
        const { status } = req.query;
        const articlesData = await readJSON(ARTICLES_FILE);
        
        if (!articlesData) {
            return res.status(500).json({ error: 'Failed to read articles' });
        }

        let articles = articlesData.articles || [];
        
        // Filter by status if specified
        if (status && status !== 'all') {
            if (status === 'published') {
                articles = articles.filter(article => article.published === true);
            } else if (status === 'draft') {
                articles = articles.filter(article => article.published === false);
            }
        }

        // Convert relative image URLs to full URLs for cross-port access
        articles = articles.map(article => ({
            ...article,
            imageUrl: article.imageUrl && article.imageUrl.startsWith('/uploads/') 
                ? `http://localhost:${PORT}${article.imageUrl}`
                : article.imageUrl
        }));

        // Sort by date (newest first) - handle both 'publishDate' and 'date' fields
        articles.sort((a, b) => {
            const dateA = new Date(a.publishDate || a.date);
            const dateB = new Date(b.publishDate || b.date);
            return dateB - dateA;
        });

        res.json({ articles });
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const articlesData = await readJSON(ARTICLES_FILE);
        
        if (!articlesData) {
            return res.status(500).json({ error: 'Failed to read articles' });
        }

        let article = articlesData.articles.find(a => a.id === id);
        
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }

        // Convert relative image URL to full URL for cross-port access
        if (article.imageUrl && article.imageUrl.startsWith('/uploads/')) {
            article = {
                ...article,
                imageUrl: `http://localhost:${PORT}${article.imageUrl}`
            };
        }

        res.json({ article });
    } catch (error) {
        console.error('Error fetching article:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/articles', authenticateToken, async (req, res) => {
    try {
        const articleData = req.body;
        
        // Validation
        if (!articleData.title || !articleData.content || !articleData.author) {
            return res.status(400).json({ error: 'Title, content, and author are required' });
        }

        const articlesData = await readJSON(ARTICLES_FILE);
        if (!articlesData) {
            return res.status(500).json({ error: 'Failed to read articles' });
        }

        // Create new article with CORRECT FORMAT for frontend
        const newArticle = {
            id: articleData.id || `article-${Date.now()}`,
            title: articleData.title,
            excerpt: articleData.excerpt || '',
            content: articleData.content,
            category: articleData.category || 'general',
            author: articleData.author,
            publishDate: articleData.date || articleData.publishDate || new Date().toISOString(), // Handle both 'date' and 'publishDate'
            readTime: articleData.readTime || '5 min read',
            imageUrl: articleData.imageUrl || '',
            featured: articleData.featured || false,
            published: articleData.status === 'published' || articleData.published || false, // Handle both 'status' and 'published'
            tags: articleData.tags || [],
            views: articleData.views || 0,
            likes: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        articlesData.articles.push(newArticle);
        
        const success = await writeJSON(ARTICLES_FILE, articlesData);
        if (!success) {
            return res.status(500).json({ error: 'Failed to save article' });
        }

        console.log(`✅ New article created: "${newArticle.title}" by ${newArticle.author}`);
        res.status(201).json({ 
            success: true, 
            article: newArticle,
            message: 'Article created successfully' 
        });
    } catch (error) {
        console.error('Error creating article:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/articles/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const articlesData = await readJSON(ARTICLES_FILE);
        if (!articlesData) {
            return res.status(500).json({ error: 'Failed to read articles' });
        }

        const articleIndex = articlesData.articles.findIndex(a => a.id === id);
        if (articleIndex === -1) {
            return res.status(404).json({ error: 'Article not found' });
        }

        // Update article
        const updatedArticle = {
            ...articlesData.articles[articleIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        articlesData.articles[articleIndex] = updatedArticle;
        
        const success = await writeJSON(ARTICLES_FILE, articlesData);
        if (!success) {
            return res.status(500).json({ error: 'Failed to update article' });
        }

        console.log(`✅ Article updated: "${updatedArticle.title}"`);
        res.json({ 
            success: true, 
            article: updatedArticle,
            message: 'Article updated successfully' 
        });
    } catch (error) {
        console.error('Error updating article:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/articles/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const articlesData = await readJSON(ARTICLES_FILE);
        if (!articlesData) {
            return res.status(500).json({ error: 'Failed to read articles' });
        }

        const articleIndex = articlesData.articles.findIndex(a => a.id === id);
        if (articleIndex === -1) {
            return res.status(404).json({ error: 'Article not found' });
        }

        const deletedArticle = articlesData.articles.splice(articleIndex, 1)[0];
        
        const success = await writeJSON(ARTICLES_FILE, articlesData);
        if (!success) {
            return res.status(500).json({ error: 'Failed to delete article' });
        }

        console.log(`🗑️ Article deleted: "${deletedArticle.title}"`);
        res.json({ 
            success: true, 
            message: 'Article deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting article:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Handle 404s
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize and start server
async function startServer() {
    try {
        await initializeData();
        
        app.listen(PORT, () => {
            console.log(`🚀 Lex Root CMS Backend running on port ${PORT}`);
            console.log(`📁 API available at http://localhost:${PORT}/api`);
            console.log(`🔐 Default admin: username=admin, password=admin123`);
            console.log(`🌐 CMS Interface: http://localhost:${PORT}/cms.html`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();