// CMS API Interface
class CMSAPI {
    constructor() {
        this.baseURL = 'http://localhost:3000/api'; // Change for production
        this.token = localStorage.getItem('cms_token');
    }

    // Authentication methods
    async login(username, password) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('cms_token', data.token);
                localStorage.setItem('cms_user', JSON.stringify(data.user));
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    async verifyToken() {
        if (!this.token) return false;
        
        try {
            const response = await fetch(`${this.baseURL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });
            
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('cms_token');
        localStorage.removeItem('cms_user');
    }

    // Article methods
    async createArticle(articleData) {
        return this.makeAuthenticatedRequest('/articles', 'POST', articleData);
    }

    async updateArticle(id, articleData) {
        return this.makeAuthenticatedRequest(`/articles/${id}`, 'PUT', articleData);
    }

    async deleteArticle(id) {
        return this.makeAuthenticatedRequest(`/articles/${id}`, 'DELETE');
    }

    async getArticles(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await fetch(`${this.baseURL}/articles?${params}`);
        return response.json();
    }

    async uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        return this.makeAuthenticatedRequest('/upload', 'POST', formData, false);
    }

    async getAnalytics() {
        return this.makeAuthenticatedRequest('/analytics', 'GET');
    }

    async makeAuthenticatedRequest(endpoint, method, data = null, isJson = true) {
        try {
            const headers = {
                'Authorization': `Bearer ${this.token}`,
            };

            if (isJson && data) {
                headers['Content-Type'] = 'application/json';
            }

            const config = {
                method,
                headers,
            };

            if (data) {
                config.body = isJson ? JSON.stringify(data) : data;
            }

            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            const responseData = await response.json();

            if (response.ok) {
                return { success: true, data: responseData };
            } else {
                return { success: false, error: responseData.error };
            }
        } catch (error) {
            return { success: false, error: 'Request failed' };
        }
    }
}

// CMS Application
class CMSApp {
    constructor() {
        this.api = new CMSAPI();
        this.currentUser = JSON.parse(localStorage.getItem('cms_user'));
        this.articles = [];
        this.editingArticle = null;
    }

    async init() {
        await this.checkAuthentication();
        this.setupEventListeners();
        if (this.currentUser) {
            await this.loadArticles();
            this.showDashboard();
        } else {
            this.showLogin();
        }
    }

    async checkAuthentication() {
        if (this.api.token) {
            const isValid = await this.api.verifyToken();
            if (!isValid) {
                this.api.logout();
                this.currentUser = null;
            }
        }
    }

    showLogin() {
        document.body.innerHTML = `
            <div class="login-container">
                <div class="login-form">
                    <h1>Lex Root CMS</h1>
                    <p>Access your content management system</p>
                    <form id="loginForm">
                        <div class="form-group">
                            <input type="text" id="username" placeholder="Username or Email" required>
                        </div>
                        <div class="form-group">
                            <input type="password" id="password" placeholder="Password" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Login</button>
                        <div id="loginError" class="error-message" style="display: none;"></div>
                    </form>
                    <div class="login-help">
                        <p>Default credentials: admin / admin123</p>
                    </div>
                </div>
            </div>
            <style>
                .login-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-dark);
                    padding: 2rem;
                }
                .login-form {
                    background: rgba(255,255,255,0.03);
                    padding: 3rem;
                    border-radius: 20px;
                    border: 1px solid rgba(255,255,255,0.1);
                    max-width: 400px;
                    width: 100%;
                    text-align: center;
                }
                .login-form h1 {
                    background: var(--gradient-3);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 0.5rem;
                }
                .login-form p {
                    color: var(--text-muted);
                    margin-bottom: 2rem;
                }
                .login-help {
                    margin-top: 2rem;
                    padding-top: 2rem;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .login-help p {
                    font-size: 0.9rem;
                    color: var(--text-muted);
                }
                .error-message {
                    color: var(--accent-alt);
                    margin-top: 1rem;
                    font-size: 0.9rem;
                }
            </style>
        `;

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');

        const result = await this.api.login(username, password);
        
        if (result.success) {
            this.currentUser = result.user;
            await this.loadArticles();
            this.showDashboard();
        } else {
            errorDiv.textContent = result.error;
            errorDiv.style.display = 'block';
        }
    }

    showDashboard() {
        document.body.innerHTML = `
            <div class="cms-layout">
                <aside class="sidebar">
                    <div class="sidebar-header">
                        <h2>Lex Root CMS</h2>
                        <p>Welcome, ${this.currentUser.username}</p>
                    </div>
                    <nav class="sidebar-nav">
                        <a href="#" class="nav-item active" data-section="articles">📝 Articles</a>
                        <a href="#" class="nav-item" data-section="create">✏️ Create New</a>
                        <a href="#" class="nav-item" data-section="analytics">📊 Analytics</a>
                        <a href="#" class="nav-item" onclick="cmsApp.logout()">🚪 Logout</a>
                    </nav>
                </aside>
                <main class="main-content">
                    <div id="content-area"></div>
                </main>
            </div>
            <style>
                .cms-layout {
                    display: flex;
                    min-height: 100vh;
                    background: var(--bg-dark);
                }
                .sidebar {
                    width: 250px;
                    background: rgba(255,255,255,0.03);
                    border-right: 1px solid rgba(255,255,255,0.1);
                    padding: 2rem;
                }
                .sidebar-header h2 {
                    background: var(--gradient-3);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 0.5rem;
                }
                .sidebar-nav {
                    margin-top: 2rem;
                }
                .nav-item {
                    display: block;
                    padding: 1rem;
                    color: var(--text-muted);
                    text-decoration: none;
                    border-radius: 8px;
                    margin-bottom: 0.5rem;
                    transition: all 0.3s ease;
                }
                .nav-item:hover, .nav-item.active {
                    background: rgba(0,245,255,0.1);
                    color: var(--accent);
                }
                .main-content {
                    flex: 1;
                    padding: 2rem;
                    overflow-y: auto;
                }
            </style>
        `;

        this.setupNavigation();
        this.showArticlesList();
    }

    setupNavigation() {
        document.querySelectorAll('.nav-item[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                const section = item.dataset.section;
                switch (section) {
                    case 'articles':
                        this.showArticlesList();
                        break;
                    case 'create':
                        this.showCreateForm();
                        break;
                    case 'analytics':
                        this.showAnalytics();
                        break;
                }
            });
        });
    }

    async loadArticles() {
        try {
            this.articles = await this.api.getArticles({ status: 'all' });
        } catch (error) {
            console.error('Failed to load articles:', error);
            this.articles = [];
        }
    }

    showArticlesList() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div class="content-header">
                <h1>Articles Management</h1>
                <button class="btn btn-primary" onclick="cmsApp.showCreateForm()">Create New Article</button>
            </div>
            <div class="articles-table">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Views</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.articles.map(article => `
                            <tr>
                                <td>
                                    <div class="article-title-cell">
                                        <strong>${article.title}</strong>
                                        ${article.featured ? '<span class="featured-badge">Featured</span>' : ''}
                                    </div>
                                </td>
                                <td><span class="category-badge">${article.category}</span></td>
                                <td><span class="status-badge status-${article.status}">${article.status}</span></td>
                                <td>${article.views || 0}</td>
                                <td>${new Date(article.date).toLocaleDateString()}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-small" onclick="cmsApp.editArticle('${article.id}')">Edit</button>
                                        <button class="btn btn-small btn-danger" onclick="cmsApp.deleteArticle('${article.id}')">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <style>
                .content-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .articles-table table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .articles-table th,
                .articles-table td {
                    padding: 1rem;
                    text-align: left;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .articles-table th {
                    color: var(--accent);
                    font-weight: 600;
                }
                .featured-badge {
                    background: var(--gradient-3);
                    color: var(--bg-dark);
                    padding: 0.2rem 0.5rem;
                    border-radius: 10px;
                    font-size: 0.7rem;
                    margin-left: 0.5rem;
                }
                .category-badge {
                    background: rgba(94,96,206,0.2);
                    color: var(--secondary);
                    padding: 0.3rem 0.8rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                }
                .status-badge {
                    padding: 0.3rem 0.8rem;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    text-transform: capitalize;
                }
                .status-published {
                    background: rgba(0,255,0,0.2);
                    color: #00ff00;
                }
                .status-draft {
                    background: rgba(255,255,0,0.2);
                    color: #ffff00;
                }
                .action-buttons {
                    display: flex;
                    gap: 0.5rem;
                }
                .btn-small {
                    padding: 0.5rem 1rem;
                    font-size: 0.8rem;
                }
                .btn-danger {
                    background: var(--accent-alt);
                    color: white;
                }
            </style>
        `;
    }

    showCreateForm(article = null) {
        this.editingArticle = article;
        const isEditing = !!article;
        
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
            <div class="content-header">
                <h1>${isEditing ? 'Edit Article' : 'Create New Article'}</h1>
                <button class="btn btn-secondary" onclick="cmsApp.showArticlesList()">Back to Articles</button>
            </div>
            <div class="article-form-container">
                <form id="articleForm" class="article-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="title">Title</label>
                            <input type="text" id="title" value="${article?.title || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="category">Category</label>
                            <select id="category" required>
                                <option value="">Select category...</option>
                                <option value="compliance" ${article?.category === 'compliance' ? 'selected' : ''}>Compliance</option>
                                <option value="data-privacy" ${article?.category === 'data-privacy' ? 'selected' : ''}>Data Privacy</option>
                                <option value="startup-law" ${article?.category === 'startup-law' ? 'selected' : ''}>Startup Law</option>
                                <option value="legal-tech" ${article?.category === 'legal-tech' ? 'selected' : ''}>Legal Tech</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="author">Author</label>
                            <input type="text" id="author" value="${article?.author || this.currentUser.username}" required>
                        </div>
                        <div class="form-group">
                            <label for="readTime">Read Time</label>
                            <input type="text" id="readTime" value="${article?.readTime || '5 min'}" placeholder="e.g., 5 min">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="excerpt">Excerpt</label>
                        <textarea id="excerpt" rows="3" required>${article?.excerpt || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="content">Content</label>
                        <textarea id="content" rows="10" required>${article?.content || ''}</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="imageUpload">Featured Image</label>
                            <input type="file" id="imageUpload" accept="image/*">
                            ${article?.imageUrl ? `<img src="${article.imageUrl}" alt="Current image" style="max-width: 200px; margin-top: 1rem;">` : ''}
                        </div>
                        <div class="form-group">
                            <label for="status">Status</label>
                            <select id="status">
                                <option value="draft" ${article?.status === 'draft' ? 'selected' : ''}>Draft</option>
                                <option value="published" ${article?.status === 'published' || !article ? 'selected' : ''}>Published</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="featured" ${article?.featured ? 'checked' : ''}> Featured Article
                        </label>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            ${isEditing ? 'Update Article' : 'Create Article'}
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="cmsApp.showArticlesList()">Cancel</button>
                    </div>
                </form>
            </div>
            <style>
                .article-form-container {
                    max-width: 800px;
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                .form-actions {
                    display: flex;
                    gap: 1rem;
                    margin-top: 2rem;
                }
            </style>
        `;

        document.getElementById('articleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleArticleSubmit();
        });
    }

    async handleArticleSubmit() {
        const formData = {
            title: document.getElementById('title').value,
            category: document.getElementById('category').value,
            author: document.getElementById('author').value,
            readTime: document.getElementById('readTime').value,
            excerpt: document.getElementById('excerpt').value,
            content: document.getElementById('content').value,
            status: document.getElementById('status').value,
            featured: document.getElementById('featured').checked,
        };

        // Handle image upload if selected
        const imageFile = document.getElementById('imageUpload').files[0];
        if (imageFile) {
            const uploadResult = await this.api.uploadImage(imageFile);
            if (uploadResult.success) {
                formData.imageUrl = uploadResult.data.imageUrl;
            }
        } else if (this.editingArticle) {
            formData.imageUrl = this.editingArticle.imageUrl;
        }

        let result;
        if (this.editingArticle) {
            result = await this.api.updateArticle(this.editingArticle.id, formData);
        } else {
            result = await this.api.createArticle(formData);
        }

        if (result.success) {
            await this.loadArticles();
            this.showArticlesList();
            alert(`Article ${this.editingArticle ? 'updated' : 'created'} successfully!`);
        } else {
            alert(`Error: ${result.error}`);
        }
    }

    async editArticle(id) {
        const article = this.articles.find(a => a.id === id);
        if (article) {
            this.showCreateForm(article);
        }
    }

    async deleteArticle(id) {
        if (confirm('Are you sure you want to delete this article?')) {
            const result = await this.api.deleteArticle(id);
            if (result.success) {
                await this.loadArticles();
                this.showArticlesList();
                alert('Article deleted successfully!');
            } else {
                alert(`Error: ${result.error}`);
            }
        }
    }

    async showAnalytics() {
        const result = await this.api.getAnalytics();
        if (result.success) {
            const analytics = result.data;
            const contentArea = document.getElementById('content-area');
            contentArea.innerHTML = `
                <div class="content-header">
                    <h1>Analytics Dashboard</h1>
                </div>
                <div class="analytics-grid">
                    <div class="metric-card">
                        <h3>Total Articles</h3>
                        <div class="metric-value">${analytics.totalArticles}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Published</h3>
                        <div class="metric-value">${analytics.publishedArticles}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Drafts</h3>
                        <div class="metric-value">${analytics.draftArticles}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Total Views</h3>
                        <div class="metric-value">${analytics.totalViews}</div>
                    </div>
                </div>
                <style>
                    .analytics-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 1.5rem;
                        margin-top: 2rem;
                    }
                    .metric-card {
                        background: rgba(255,255,255,0.03);
                        padding: 2rem;
                        border-radius: 15px;
                        border: 1px solid rgba(255,255,255,0.1);
                        text-align: center;
                    }
                    .metric-card h3 {
                        color: var(--text-muted);
                        margin-bottom: 1rem;
                        font-size: 0.9rem;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .metric-value {
                        font-size: 2.5rem;
                        font-weight: 900;
                        background: var(--gradient-3);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }
                </style>
            `;
        }
    }

    logout() {
        this.api.logout();
        this.currentUser = null;
        this.showLogin();
    }

    setupEventListeners() {
        // Global styles
        if (!document.getElementById('cms-styles')) {
            const style = document.createElement('style');
            style.id = 'cms-styles';
            style.textContent = `
                .form-group {
                    margin-bottom: 1.5rem;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    color: var(--accent);
                    font-weight: 600;
                }
                .form-group input,
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 0.75rem;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    color: var(--text-light);
                    font-size: 0.9rem;
                    font-family: inherit;
                }
                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--accent);
                    box-shadow: 0 0 0 2px rgba(0,245,255,0.2);
                }
                .btn {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    display: inline-block;
                }
                .btn-primary {
                    background: var(--gradient-3);
                    color: var(--bg-dark);
                }
                .btn-secondary {
                    background: transparent;
                    color: var(--text-light);
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,245,255,0.3);
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Initialize CMS
const cmsApp = new CMSApp();
document.addEventListener('DOMContentLoaded', () => {
    cmsApp.init();
});

// Export for global access
window.cmsApp = cmsApp;