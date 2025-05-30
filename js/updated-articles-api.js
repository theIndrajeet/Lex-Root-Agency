// Updated Articles API Integration for Lex Root CMS
// This file handles fetching articles from the CMS backend

// Configuration
const API_BASE_URL = 'http://localhost:3000'; // Change this to your production URL when deploying

// Article management class
class ArticlesManager {
    constructor() {
        this.allArticles = [];
        this.filteredArticles = [];
        this.currentPage = 1;
        this.articlesPerPage = 6;
        this.isLoading = false;
        this.searchTerm = '';
        this.activeCategory = 'all';
        
        this.init();
    }

    async init() {
        await this.loadArticles();
        this.setupEventListeners();
        this.displayFeaturedArticle();
        this.displayArticles();
        this.initializeLucideIcons();
    }

    async loadArticles() {
        try {
            this.showLoadingState();
            console.log('Fetching articles from CMS...');
            
            const response = await fetch(`${API_BASE_URL}/api/articles`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.allArticles = data.articles || [];
            this.filteredArticles = [...this.allArticles];
            
            console.log(`Loaded ${this.allArticles.length} articles from CMS`);
            this.hideLoadingState();
            
        } catch (error) {
            console.error('Error fetching articles:', error);
            this.handleFallbackData();
        }
    }

    handleFallbackData() {
        console.log('Using fallback sample data...');
        // Fallback sample data in case backend is not available
        this.allArticles = [
            {
                id: 'sample-article',
                title: 'Sample Article - CMS Integration Guide',
                excerpt: 'This is a sample article showing how the CMS integration works for your Lex Root website.',
                content: 'Full article content goes here...',
                category: 'legal-tech',
                author: 'Lex Root Team',
                publishDate: new Date().toISOString(),
                readTime: '5 min read',
                imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                featured: true,
                published: true,
                tags: ['CMS', 'Integration', 'Legal Tech'],
                views: 0,
                likes: 0
            }
        ];
        this.filteredArticles = [...this.allArticles];
        this.hideLoadingState();
    }

    showLoadingState() {
        const articlesGrid = document.getElementById('articlesGrid');
        const featuredArticle = document.getElementById('featuredArticle');
        
        if (articlesGrid) {
            articlesGrid.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading articles from CMS...</div>';
        }
        
        if (featuredArticle) {
            featuredArticle.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading featured article...</div>';
        }
    }

    hideLoadingState() {
        // Loading states will be replaced by actual content
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterAndDisplayArticles();
            });
        }

        // Category filters
        const categoryButtons = document.querySelectorAll('.category-btn');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                categoryButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.activeCategory = e.target.dataset.category;
                this.filterAndDisplayArticles();
            });
        });

        // Load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreArticles();
            });
        }
    }

    filterAndDisplayArticles() {
        this.currentPage = 1;
        
        this.filteredArticles = this.allArticles.filter(article => {
            // Filter by published status
            if (!article.published) return false;
            
            // Filter by category
            if (this.activeCategory !== 'all' && article.category !== this.activeCategory) {
                return false;
            }
            
            // Filter by search term
            if (this.searchTerm) {
                const searchFields = [
                    article.title,
                    article.excerpt,
                    article.content,
                    article.author,
                    ...(article.tags || [])
                ].join(' ').toLowerCase();
                
                if (!searchFields.includes(this.searchTerm)) {
                    return false;
                }
            }
            
            return true;
        });

        this.displayArticles();
        this.updateLoadMoreButton();
    }

    displayFeaturedArticle() {
        const featuredContainer = document.getElementById('featuredArticle');
        if (!featuredContainer) return;

        // Find featured article
        const featuredArticle = this.allArticles.find(article => 
            article.featured && article.published
        );

        if (!featuredArticle) {
            featuredContainer.style.display = 'none';
            return;
        }

        featuredContainer.innerHTML = `
            <div class="featured-content">
                <h2><a href="article.html?id=${featuredArticle.id}">${featuredArticle.title}</a></h2>
                <div class="featured-meta">
                    <span><i data-lucide="user"></i> ${featuredArticle.author}</span>
                    <span><i data-lucide="calendar"></i> ${this.formatDate(featuredArticle.publishDate)}</span>
                    <span><i data-lucide="clock"></i> ${featuredArticle.readTime}</span>
                    <span><i data-lucide="tag"></i> ${featuredArticle.category.replace('-', ' ')}</span>
                </div>
                <p class="featured-excerpt">${featuredArticle.excerpt}</p>
                <a href="article.html?id=${featuredArticle.id}" class="read-more-btn">
                    Read Full Article <i data-lucide="arrow-right"></i>
                </a>
            </div>
            <div class="featured-image">
                <img src="${featuredArticle.imageUrl}" alt="${featuredArticle.title}" loading="lazy">
            </div>
        `;

        // Re-initialize icons for the featured article
        this.initializeLucideIcons();
    }

    displayArticles() {
        const articlesGrid = document.getElementById('articlesGrid');
        if (!articlesGrid) return;

        const startIndex = 0;
        const endIndex = this.currentPage * this.articlesPerPage;
        const articlesToShow = this.filteredArticles
            .filter(article => !article.featured) // Exclude featured articles from grid
            .slice(startIndex, endIndex);

        if (articlesToShow.length === 0) {
            articlesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i data-lucide="search" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3 style="margin-bottom: 1rem;">No articles found</h3>
                    <p>Try adjusting your search terms or category filters.</p>
                </div>
            `;
            this.initializeLucideIcons();
            return;
        }

        articlesGrid.innerHTML = articlesToShow.map(article => `
            <article class="article-card reveal">
                <div class="article-image">
                    <img src="${article.imageUrl}" alt="${article.title}" loading="lazy">
                    <div class="article-category">${article.category.replace('-', ' ')}</div>
                </div>
                <div class="article-content">
                    <h3 class="article-title">
                        <a href="article.html?id=${article.id}">${article.title}</a>
                    </h3>
                    <p class="article-excerpt">${article.excerpt}</p>
                    <div class="article-meta">
                        <div class="article-author">
                            <div class="author-avatar"></div>
                            <span>${article.author}</span>
                        </div>
                        <div class="article-stats">
                            <span><i data-lucide="calendar"></i> ${this.formatDate(article.publishDate)}</span>
                            <span><i data-lucide="clock"></i> ${article.readTime}</span>
                        </div>
                    </div>
                </div>
            </article>
        `).join('');

        // Re-initialize icons and reveal animations
        this.initializeLucideIcons();
        this.initializeRevealAnimations();
    }

    loadMoreArticles() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const btnText = loadMoreBtn?.querySelector('.btn-text');
        const spinIcon = loadMoreBtn?.querySelector('.spin-icon');

        if (this.isLoading) return;

        this.isLoading = true;
        
        // Show loading state
        if (btnText) btnText.textContent = 'Loading...';
        if (spinIcon) spinIcon.style.display = 'inline-block';

        setTimeout(() => {
            this.currentPage++;
            this.displayArticles();
            this.updateLoadMoreButton();
            this.isLoading = false;

            // Reset button state
            if (btnText) btnText.textContent = 'Load More Articles';
            if (spinIcon) spinIcon.style.display = 'none';
        }, 1000);
    }

    updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const noMoreText = document.getElementById('noMoreArticles');
        
        const nonFeaturedArticles = this.filteredArticles.filter(article => !article.featured);
        const totalPages = Math.ceil(nonFeaturedArticles.length / this.articlesPerPage);
        const hasMoreArticles = this.currentPage < totalPages;

        if (loadMoreBtn) {
            loadMoreBtn.style.display = hasMoreArticles ? 'inline-flex' : 'none';
        }
        
        if (noMoreText) {
            noMoreText.style.display = (!hasMoreArticles && nonFeaturedArticles.length > 0) ? 'block' : 'none';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    initializeLucideIcons() {
        // Re-initialize Lucide icons after dynamic content is added
        if (typeof lucide !== 'undefined') {
            setTimeout(() => {
                lucide.createIcons();
            }, 100);
        }
    }

    initializeRevealAnimations() {
        // Re-initialize reveal animations for new articles
        const newRevealElements = document.querySelectorAll('.article-card.reveal:not(.active)');
        
        setTimeout(() => {
            newRevealElements.forEach((el, index) => {
                setTimeout(() => {
                    el.classList.add('active');
                }, index * 100);
            });
        }, 100);
    }

    // Public method to refresh articles (useful for CMS updates)
    async refreshArticles() {
        await this.loadArticles();
        this.filterAndDisplayArticles();
        this.displayFeaturedArticle();
    }
}

// Initialize the articles manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.articlesManager = new ArticlesManager();
});

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArticlesManager;
}