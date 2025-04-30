// --- Firebase Configuration ---
// IMPORTANT: REPLACE THIS WITH YOUR ACTUAL FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// --- Initialize Firebase ---
// Use compat libraries for easier integration with existing code structure
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // Get the Auth service
// const db = firebase.firestore(); // Uncomment if using Firestore

// --- Global State ---
let allProducts = []; // This will be populated from Firebase
let featuredProduct = null; // This will hold the featured product data from Firebase
let cartItems = [];
let currentSlideIndex = 0;
let slideInterval;
const BANNER_INTERVAL_MS = 5000;
let currentUser = null; // To store the current logged-in user info

// --- DOM Elements ---
const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');
const searchBarContainer = document.getElementById('search-bar-container');
const searchInput = document.getElementById('search-input');
const cartContainer = document.getElementById('cart-container');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalPriceElement = document.getElementById('cart-total-price');
const bannerSlidesContainer = document.querySelector('.banner-slides');
const bannerIndicatorsContainer = document.querySelector('.banner-indicators');
const breadcrumbs = document.getElementById('breadcrumbs');
const bestSellersSection = document.getElementById('best-sellers-section');
const allProductsView = document.getElementById('all-products-view');
const categorizedProductsView = document.getElementById('categorized-products-view');
const allProductsContainer = document.getElementById('all-products-container');
const streamingPlatformsContainer = document.getElementById('streaming-platforms-container');
const educationalServicesContainer = document.getElementById('educational-services-container');
const appleServicesContainer = document.getElementById('apple-services-container');
const bestSellingProductsContainer = document.getElementById('best-selling-products-container');
const loginModalOverlay = document.getElementById('login-modal-overlay');
const loginModal = document.querySelector('.login-modal');
const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const headerAuthContainer = document.getElementById('header-auth-container');
const menuAuthContainer = document.getElementById('menu-auth-container');
const featuredProductSection = document.getElementById('featured-product-section'); // Get the new section
const featuredProductImage = document.getElementById('featured-product-image');
const featuredProductTitle = document.getElementById('featured-product-title');
const featuredProductDescription = document.getElementById('featured-product-description');


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchAndRenderData(); // This will now fetch from Firebase
    renderCartItems();
    setupFirebaseAuthObserver(); // Start listening for auth changes
});

// --- Event Listener Setup ---
function setupEventListeners() {
    // Menu Toggle
    document.getElementById('menu-icon')?.addEventListener('click', openMenu);
    sideMenu?.querySelector('.menu-close-icon i')?.addEventListener('click', closeMenu);
    menuOverlay?.addEventListener('click', closeMenu);

    // Menu Links for View Switching
    sideMenu?.querySelectorAll('.menu-links a[data-view]').forEach(link => {
        link.addEventListener('click', handleViewChange);
    });

    // Logo Click (Header and Footer)
    document.querySelectorAll('a[data-view="home"]').forEach(link => {
         link.addEventListener('click', handleViewChange);
    });

    // Search Toggle
    document.getElementById('search-icon')?.addEventListener('click', showSearchBar);
    document.getElementById('search-close-icon')?.addEventListener('click', hideSearchBar);
    searchInput?.addEventListener('input', handleSearchInput);

    // Cart Toggle
    document.getElementById('cart-icon')?.addEventListener('click', showCart);
    document.getElementById('cart-close-icon')?.addEventListener('click', hideCart);

    // Login Modal Toggle
    document.getElementById('modal-close-icon')?.addEventListener('click', hideLoginModal);
    loginModalOverlay?.addEventListener('click', (event) => {
        // Close modal if clicking on the overlay itself, not the modal content
        if (event.target === loginModalOverlay) {
            hideLoginModal();
        }
    });

    // Login/Signup Form Submission
    loginForm?.addEventListener('submit', handleLoginAttempt); // Handle login on form submit
    document.getElementById('signup-button')?.addEventListener('click', handleSignupAttempt); // Handle signup on button click


    // Banner Navigation
    document.querySelector('.prev-button')?.addEventListener('click', showPrevSlide);
    document.querySelector('.next-button')?.addEventListener('click', showNextSlide);
    const bannerContainerElement = document.querySelector('.banner-container');
     if (bannerContainerElement) {
         bannerContainerElement.addEventListener('mouseenter', () => clearInterval(slideInterval));
         bannerContainerElement.addEventListener('mouseleave', startSlideShow);
     }

    // Breadcrumb Navigation (delegated)
    breadcrumbs?.addEventListener('click', (event) => {
        if (event.target.tagName === 'A' && event.target.dataset.view) {
            event.preventDefault();
            showView(event.target.dataset.view);
        }
    });

    // Product Card Interactions (delegated)
    const productContainers = [
        allProductsContainer, streamingPlatformsContainer, educationalServicesContainer,
        appleServicesContainer, bestSellingProductsContainer, featuredProductSection // Add featured section
    ];
    productContainers.forEach(container => {
        container?.addEventListener('click', handleProductCardInteraction);
    });

    // Cart Item Removal (delegated)
     cartItemsContainer?.addEventListener('click', (event) => {
         const removeButton = event.target.closest('.remove-item-button');
         if (removeButton) {
             const itemId = removeButton.dataset.itemId;
             removeItemFromCart(itemId);
         }
     });

     // Dynamic Auth Elements (Header/Menu) - Event delegation needed
     document.addEventListener('click', (event) => {
         if (event.target.matches('#login-icon') || event.target.matches('#menu-login-link')) {
             event.preventDefault();
             showLoginModal();
         } else if (event.target.matches('#logout-button') || event.target.matches('#menu-logout-link')) {
             event.preventDefault();
             handleLogout();
         }
     });

     // Event Listener for Featured Product Buy Now Button - REMOVED, handled by delegated product card handler
        // document.getElementById('featured-buy-now')?.addEventListener('click', handleFeaturedBuyNow); // No longer needed with delegated handler
}

// --- Firebase Authentication ---

function setupFirebaseAuthObserver() {
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            console.log("User signed in:", user.email);
            currentUser = user;
            updateUIForLoggedInUser(user);
        } else {
            // User is signed out.
            console.log("User signed out.");
            currentUser = null;
            updateUIForLoggedOutUser();
        }
        // Hide modal regardless of state change after initial check
        hideLoginModal();
    });
}

function handleLoginAttempt(event) {
    event.preventDefault(); // Prevent default form submission
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    clearLoginError();

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in
            console.log("Login successful:", userCredential.user.email);
            // Observer will handle UI update and modal closing
        })
        .catch((error) => {
            console.error("Login error:", error.code, error.message);
            displayLoginError(error.message);
        });
}

function handleSignupAttempt() {
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    clearLoginError();

     // Basic validation (optional, add more robust validation)
     if (password.length < 6) {
         displayLoginError("Password should be at least 6 characters.");
         return;
     }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed up and signed in
            console.log("Signup successful:", userCredential.user.email);
            // Observer will handle UI update and modal closing
        })
        .catch((error) => {
            console.error("Signup error:", error.code, error.message);
            displayLoginError(error.message);
        });
}

function handleLogout() {
    auth.signOut().then(() => {
        console.log("Logout successful.");
        // Observer will handle UI update
    }).catch((error) => {
        console.error("Logout error:", error);
        alert("Error logging out. Please try again."); // Simple feedback
    });
}

function updateUIForLoggedInUser(user) {
    // Update header icon/button
    if (headerAuthContainer) {
        headerAuthContainer.innerHTML = `
            <button id="logout-button" class="header-icon flex items-center" aria-label="Logout">
                <i class="fas fa-sign-out-alt"></i>
                </button>
        `;
    }
    // Update side menu link
    if (menuAuthContainer) {
         menuAuthContainer.innerHTML = `
            <a href="#" id="menu-logout-link" class="auth-link"><i class="fas fa-sign-out-alt"></i> Logout</a>
         `;
    }
    // Close menu if open after login/logout action triggered from menu
    closeMenu();
}

function updateUIForLoggedOutUser() {
     // Update header icon/button
    if (headerAuthContainer) {
        headerAuthContainer.innerHTML = `
            <i id="login-icon" class="fas fa-user header-icon" aria-label="Open login"></i>
        `;
    }
     // Update side menu link
    if (menuAuthContainer) {
         menuAuthContainer.innerHTML = `
            <a href="#" id="menu-login-link" class="auth-link"><i class="fas fa-sign-in-alt"></i> Log in</a>
         `;
    }
}

function displayLoginError(message) {
    if (loginError) {
        // Map common Firebase error codes to user-friendly messages
        switch (message) {
            case "Firebase: Error (auth/invalid-email).":
                message = "Please enter a valid email address.";
                break;
            case "Firebase: Error (auth/user-not-found).":
            case "Firebase: Error (auth/wrong-password).":
                 message = "Incorrect email or password.";
                 break;
            case "Firebase: Error (auth/email-already-in-use).":
                 message = "This email address is already registered.";
                 break;
            case "Firebase: Password should be at least 6 characters long (auth/weak-password).":
                 message = "Password should be at least 6 characters.";
                 break;
             // Add more mappings as needed
            default:
                message = "An error occurred. Please try again."; // Generic fallback
        }
        loginError.textContent = message;
    }
}

function clearLoginError() {
    if (loginError) {
        loginError.textContent = '';
    }
}


// --- Data Fetching and Rendering ---
async function fetchAndRenderData() {
    console.log("Fetching data from Firebase...");
    try {
        // --- Implement Firebase data fetching here ---
        // Example using Firestore (requires Firestore compat library):
        /*
        // Fetch all products
        const productsSnapshot = await db.collection('products').get();
        allProducts = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Fetch featured product (assuming you have a specific document or query for it)
        const featuredDoc = await db.collection('featured').doc('chatgpt-plus').get(); // Example path
        if (featuredDoc.exists) {
            featuredProduct = {
                id: featuredDoc.id,
                ...featuredDoc.data()
            };
            renderFeaturedProduct(featuredProduct);
        } else {
            console.warn("Featured product data not found in Firebase.");
            // Optionally hide the featured section or show a placeholder
            if (featuredProductSection) featuredProductSection.style.display = 'none';
        }
        */

        // --- Placeholder Data (Remove this once Firebase fetching is implemented) ---
         allProducts = []; // Ensure it's empty initially
         featuredProduct = null; // Ensure featuredProduct is null initially
         if (featuredProductSection) featuredProductSection.style.display = 'none'; // Hide featured section by default

         // Dummy Data Structure (Replace with actual Firebase data)
         allProducts = [
             {
                id: 'netflix-standard-1month',
                name: 'Netflix Standard',
                description: 'Shared Account',
                imageUrl: 'https://via.placeholder.com/300x180/E50914/FFFFFF?text=Netflix',
                price: 500, // Base price
                rating: 4.5,
                ratingCount: 120,
                category: 'streaming-services',
                isBestSeller: true,
                isSoldOut: false,
                durationOptions: [ // These options now only control the "Choose Options" button logic
                    { duration: '1 Month', price: 500 },
                    { duration: '3 Months', price: 1400 } // Example: slightly discounted
                ],
                showQuantity: false,
                addToCartLink: true, // Indicates this product can be added to cart
                details: 'Works on TV, Mobile, Laptop'
             },
              {
                id: 'youtube-premium-individual-1month',
                name: 'YouTube Premium Individual',
                description: 'Monthly Plan',
                imageUrl: 'https://via.placeholder.com/300x180/FF0000/FFFFFF?text=YouTube+Premium',
                price: 250,
                rating: 4.8,
                ratingCount: 85,
                category: 'streaming-services',
                isBestSeller: true,
                isSoldOut: false,
                durationOptions: [
                     { duration: '1 Month', price: 250 },
                     { duration: '6 Months', price: 1400 }
                 ],
                 showQuantity: false,
                addToCartLink: true,
                 details: 'Ad-free videos, Offline playback'
             },
              {
                id: 'spotify-premium-individual',
                name: 'Spotify Premium Individual',
                description: 'Subscription',
                imageUrl: 'https://via.placeholder.com/300x180/1DB954/FFFFFF?text=Spotify',
                price: 150, // Base price
                rating: 4.7,
                ratingCount: 90,
                category: 'streaming-services',
                isBestSeller: false,
                isSoldOut: false,
                durationOptions: [
                     { duration: '1 Month', price: 150 },
                     { duration: '3 Months', price: 400 },
                     { duration: '6 Months', price: 750 }
                 ],
                  showQuantity: false,
                 addToCartLink: true,
                 details: 'Listen offline, Ad-free music'
             },
             {
                id: 'chatgpt-plus',
                name: 'ChatGPT Plus',
                description: 'Access Subscription',
                imageUrl: 'https://via.placeholder.co/300x180/424242/FFFFFF?text=ChatGPT+Plus',
                price: 1800, // Base price
                rating: 4.9,
                ratingCount: 50,
                category: 'educational-tools',
                isBestSeller: true,
                isSoldOut: false,
                durationOptions: [
                    { duration: '1 Month', price: 1800 }
                 ],
                 showQuantity: false,
                addToCartLink: true,
                 details: 'Priority access, Faster responses'
             },
              {
                id: 'grammarly-premium',
                name: 'Grammarly Premium',
                description: 'Subscription',
                imageUrl: 'https://via.placeholder.co/300x180/1C7C54/FFFFFF?text=Grammarly',
                price: 3500, // Base price
                rating: 4.6,
                ratingCount: 30,
                category: 'educational-tools',
                isBestSeller: false,
                isSoldOut: false,
                durationOptions: [
                    { duration: '1 Year', price: 3500 }
                 ],
                  showQuantity: false,
                addToCartLink: true,
                 details: 'Advanced grammar checks, Plagiarism detector'
             },
             {
                id: 'apple-music-individual',
                name: 'Apple Music Individual',
                description: 'Subscription',
                imageUrl: 'https://via.placeholder.co/300x180/FA203D/FFFFFF?text=Apple+Music',
                price: 200, // Base price
                rating: 4.3,
                ratingCount: 70,
                category: 'apple-services',
                isBestSeller: false,
                isSoldOut: false,
                durationOptions: [
                    { duration: '1 Month', price: 200 },
                    { duration: '3 Months', price: 550 },
                    { duration: '1 Year', price: 2000 }
                 ],
                 showQuantity: false,
                addToCartLink: true,
                 details: 'Millions of songs, Ad-free listening'
             },
             {
                id: 'apple-tv-plus',
                name: 'Apple TV+',
                description: 'Subscription',
                imageUrl: 'https://via.placeholder.co/300x180/1A1A1A/999999?text=Apple+TV%2B',
                price: 180, // Base price
                rating: 4.4,
                ratingCount: 45,
                category: 'apple-services',
                isBestSeller: false,
                isSoldOut: false,
                durationOptions: [
                    { duration: '1 Month', price: 180 }
                 ],
                 showQuantity: false,
                addToCartLink: true,
                 details: 'Original shows and movies'
             },
              {
                id: 'software-license',
                name: 'Software License',
                description: 'Single User License',
                imageUrl: 'https://via.placeholder.co/300x180/4A5568/FFFFFF?text=Software',
                price: 1000, // Base price
                rating: null,
                ratingCount: '',
                category: 'educational-tools',
                isBestSeller: false,
                isSoldOut: false,
                durationOptions: [], // No duration options
                showQuantity: true, // Enable quantity selector
                addToCartLink: true,
                 details: 'Perpetual license for one user'
             },
             {
                 id: 'sold-out-product',
                 name: 'Limited Edition Item',
                 description: 'This item is currently out of stock.',
                 imageUrl: 'https://via.placeholder.co/300x180/777777/EEEEEE?text=Sold+Out',
                 price: 999, // Price might still be displayed
                 rating: 4.0,
                 ratingCount: 10,
                 category: 'misc',
                 isBestSeller: false,
                 isSoldOut: true, // Mark as sold out
                 durationOptions: [],
                 showQuantity: false,
                 addToCartLink: false, // Cannot add to cart if sold out
                 details: 'Check back later for availability'
             },
              {
                id: 'simple-product',
                name: 'Simple E-book',
                description: 'Downloadable PDF',
                imageUrl: 'https://via.placeholder.co/300x180/5A67D8/FFFFFF?text=E-book',
                price: 50, // Fixed price, no options
                rating: 4.2,
                ratingCount: 25,
                category: 'educational-tools',
                isBestSeller: false,
                isSoldOut: false,
                durationOptions: [], // No duration options
                showQuantity: false, // No quantity selector
                addToCartLink: true, // Can be added directly to cart
                 details: 'Instant download'
             }
         ];

         // Select a dummy featured product (e.g., the first best seller with options)
         featuredProduct = allProducts.find(p => p.isBestSeller && !p.isSoldOut && (p.durationOptions.length > 0 || p.showQuantity));
         if (!featuredProduct) {
              // Fallback to any best seller if no actionable best seller
              featuredProduct = allProducts.find(p => p.isBestSeller && !p.isSoldOut);
         }
         if (featuredProduct) {
             // Add specific featured details if needed, or just use existing product data
             renderFeaturedProduct(featuredProduct);
         } else {
              console.warn("No eligible product found to be featured.");
              if (featuredProductSection) featuredProductSection.style.display = 'none'; // Hide if no featured product
         }


         // --- End Placeholder Data ---


        // --- Hardcoded Banner Images (Kept as they were not requested to be removed) ---
        const bannerImages = [
            "https://placehold.co/1200x400/1a1a1a/e50914?text=Welcome+to+FANFLIX+BD",
            "https://placehold.co/1200x400/1a1a1a/00A8E1?text=Get+Your+Prime+Video+Subscription",
            "https://placehold.co/1200x400/1a1a1a/ffffff?text=Exclusive+Offers+Inside!",
        ];
        // --- End Hardcoded Banner Images ---


        renderBanner(bannerImages);

        // Initial rendering based on fetched/dummy data
        renderProducts(streamingPlatformsContainer, filterProductsByCategory('streaming-services'));
        renderProducts(educationalServicesContainer, filterProductsByCategory('educational-tools'));
        renderProducts(appleServicesContainer, filterProductsByCategory('apple-services'));
        renderProducts(allProductsContainer, allProducts); // Render all products initially in the 'All Products' view container
        renderProducts(bestSellingProductsContainer, filterBestSellingProducts());


        showView('home'); // Show initial view (now with data)

    } catch (error) {
        console.error("Error fetching or rendering data:", error);
        displayErrorMessage("Failed to load data. Please try again later.");
        // Consider rendering a "failed to load" message in product containers
    }
}

// --- Product Filtering ---
function filterProductsByCategory(category) {
    return allProducts.filter(product => product.category === category);
}
function filterBestSellingProducts() {
    return allProducts.filter(product => product.isBestSeller);
}
function filterProductsBySearch(searchTerm) {
     if (!searchTerm) return allProducts;
     const lowerCaseSearchTerm = searchTerm.toLowerCase();
     return allProducts.filter(product =>
         product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
         (product.description && product.description.toLowerCase().includes(lowerCaseSearchTerm)) ||
         product.category.toLowerCase().includes(lowerCaseSearchTerm)
     );
}

// --- Rendering Functions ---
function renderProducts(containerElement, productsToRender) {
    if (!containerElement) return;
    containerElement.innerHTML = ''; // Clear existing content
    if (!productsToRender || productsToRender.length === 0) {
        // Display a message if no products are found (either initially or after filtering)
        containerElement.innerHTML = '<p class="text-center text-gray-500 col-span-full py-8">No products found.</p>';
        return;
    }
    const fragment = document.createDocumentFragment();
    productsToRender.forEach(product => {
        const cardElement = document.createElement('div');
        cardElement.innerHTML = createProductCardHTML(product).trim();
        // Use cardElement.firstElementChild instead of cardElement.firstChild
        // to get the actual element node, not potentially whitespace.
        if (cardElement.firstElementChild) {
            // Add a data attribute to the product card itself for easier event delegation targeting
             cardElement.firstElementChild.setAttribute('data-product-id', product.id);
             fragment.appendChild(cardElement.firstElementChild);
        }
    });
    containerElement.appendChild(fragment);
}


function createProductCardHTML(product) {
    // Ensure product object has necessary properties, provide defaults if missing
    const id = product.id || '';
    const name = product.name || 'Product Name';
    const description = product.description || '';
    const imageUrl = product.imageUrl || 'https://placehold.co/300x180/1a1a1a/ffffff?text=No+Image';
    const rating = product.rating !== undefined ? product.rating : null; // Use null if no rating
    const ratingCount = product.ratingCount !== undefined ? product.ratingCount : '';
    const price = product.price !== undefined ? product.price : 'Contact for Price'; // Default price
    const isSoldOut = product.isSoldOut || false;
    const durationOptions = product.durationOptions || [];
    const showQuantity = product.showQuantity || false;
    // Removed whatsappLink property check
    const addToCartLink = product.addToCartLink || ''; // Using this as a flag for 'Add to Cart' button presence
    const details = product.details || '';


    const priceFormatted = typeof price === 'number' ? formatPrice(price) : price;
    const isActionable = !isSoldOut;

    // --- Removed inline duration options and quantity selector HTML ---
    const durationOptionsHTML = ''; // No longer rendered inline
    const quantitySelectorHTML = ''; // No longer rendered inline
    // --- End Removed HTML ---


    // Only show 'Add to Cart' if addToCartLink is present AND there are no duration options or quantity selectors requiring 'Choose Options'
    // Also ensure the product is actionable (not sold out)
    const requiresOptions = durationOptions.length > 0 || showQuantity;
    const showAddToCartButton = addToCartLink && isActionable && !requiresOptions;
    const addToCartButtonHTML = showAddToCartButton ? `<button class="action-button btn-blue add-to-cart-button" data-product-id="${id}"><i class="fas fa-cart-plus mr-2"></i> Add to cart</button>` : '';

     // Show 'Choose Options' if the product is actionable AND requires options (duration or quantity)
    const showChooseOptionsButton = isActionable && requiresOptions;
    const chooseOptionsButtonHTML = showChooseOptionsButton ? `<button class="action-button btn-blue choose-options-button" data-product-id="${id}">Choose options</button>` : '';

    // Determine which button(s) to show
    let actionButtonsHTML = '';
    if (showAddToCartButton) {
        actionButtonsHTML += addToCartButtonHTML;
    }
    if (showChooseOptionsButton) {
         actionButtonsHTML += chooseOptionsButtonHTML;
    }
    // If product is sold out and no other buttons are shown, leave actionButtonsHTML empty or add a placeholder if needed


    // Ensure data-product-id is on the main product-card div
    return `<article class="product-card flex flex-col h-full ${isSoldOut ? 'relative' : ''}" aria-label="${name}" data-product-id="${id}">${isSoldOut ? '<div class="sold-out-overlay" aria-hidden="true">Sold out</div>' : ''}<img src="${imageUrl}" alt="${name}" class="product-image" onerror="this.onerror=null;this.src='https://placehold.co/300x180/1a1a1a/ffffff?text=Image+Error';"><div class="product-info flex flex-col flex-grow p-4"><div class="flex-grow"><h3 class="product-name font-semibold text-lg mb-1">${name}</h3>${description ? `<p class="product-description text-sm text-gray-400 mb-2">${description}</p>` : ''}${rating !== null ? `<div class="rating text-sm mb-2" role="img" aria-label="Rating: ${rating} out of 5 stars">${generateStarRatingHTML(rating)}${ratingCount !== '' ? `<span class="rating-count text-gray-500 ml-1">(${ratingCount})</span>` : ''}</div>` : ''}${details ? `<p class="text-xs text-gray-500 mb-3">${details}</p>` : ''}</div><div><p class="product-price text-xl font-bold mb-3">${priceFormatted}</p><div class="action-buttons mt-4 space-y-2">${actionButtonsHTML}</div></div></div></article>`;
}
function generateStarRatingHTML(rating) { let stars = ''; const fullStars = Math.floor(rating); const halfStar = rating % 1 >= 0.5; const emptyStars = 5 - fullStars - (halfStar ? 1 : 0); for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-yellow-400" aria-hidden="true"></i>'; if (halfStar) stars += '<i class="fas fa-star-half-alt text-yellow-400" aria-hidden="true"></i>'; for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star text-gray-500" aria-hidden="true"></i>'; return stars; }
function renderBanner(images) { if (!bannerSlidesContainer || !bannerIndicatorsContainer || !images || images.length === 0) return; bannerSlidesContainer.innerHTML = ''; bannerIndicatorsContainer.innerHTML = ''; const fragmentSlides = document.createDocumentFragment(); const fragmentIndicators = document.createDocumentFragment(); images.forEach((imageUrl, index) => { const slide = document.createElement('div'); slide.classList.add('banner-slide'); const img = document.createElement('img'); img.src = imageUrl; img.alt = `Banner Image ${index + 1}`; img.classList.add('w-full', 'h-auto', 'object-cover'); img.onerror = () => { img.alt = 'Banner Image Failed to Load'; img.src = `https://placehold.co/1200x400/1a1a1a/ffffff?text=Error+Loading+Banner+${index + 1}`; }; slide.appendChild(img); fragmentSlides.appendChild(slide); const dot = document.createElement('button'); dot.classList.add('indicator-dot', 'w-3', 'h-3', 'rounded-full', 'bg-white', 'opacity-50', 'hover:opacity-75', 'transition-opacity'); dot.setAttribute('aria-label', `Go to slide ${index + 1}`); if (index === 0) dot.classList.add('active', 'opacity-100'); dot.addEventListener('click', () => { goToSlide(index); resetSlideInterval(); }); fragmentIndicators.appendChild(dot); }); bannerSlidesContainer.appendChild(fragmentSlides); bannerIndicatorsContainer.appendChild(fragmentIndicators); currentSlideIndex = 0; goToSlide(0); startSlideShow(); }
function renderCartItems() { if (!cartItemsContainer || !cartTotalPriceElement) return; cartItemsContainer.innerHTML = ''; let total = 0; if (cartItems.length === 0) { cartItemsContainer.innerHTML = '<p class="text-center text-gray-500 py-8">Your cart is empty.</p>'; } else { const fragment = document.createDocumentFragment(); cartItems.forEach(item => { const itemTotal = item.price * item.quantity; total += itemTotal; const cartItemDiv = document.createElement('div'); cartItemDiv.classList.add('cart-item', 'flex', 'items-center', 'py-3', 'border-b', 'border-gray-700'); cartItemDiv.innerHTML = `<img src="${item.imageUrl || 'https://placehold.co/60x60/1a1a1a/ffffff?text=Item'}" alt="${item.name || 'Cart Item Image'}" class="w-16 h-16 object-cover rounded mr-4" onerror="this.onerror=null;this.src='https://placehold.co/60x60/1a1a1a/ffffff?text=Error';"><div class="item-details flex-grow"><h3 class="font-semibold text-base mb-1">${item.name || 'Item Name'}</h3>${item.selectedDuration ? `<p class="text-xs text-gray-400">Duration: ${item.selectedDuration}</p>` : ''}<p class="text-sm text-gray-400">${formatPrice(item.price)} x ${item.quantity}</p></div><span class="item-quantity font-semibold text-base ml-4">${formatPrice(itemTotal)}</span><button class="remove-item-button text-red-500 hover:text-red-400 ml-4 text-lg" data-item-id="${item.cartItemId}" aria-label="Remove ${item.name}"><i class="fas fa-trash-alt pointer-events-none"></i></button>`; fragment.appendChild(cartItemDiv); }); cartItemsContainer.appendChild(fragment); } cartTotalPriceElement.textContent = formatPrice(total); }

// --- UI Interaction Functions ---
function openMenu() { sideMenu?.classList.add('open'); menuOverlay?.classList.add('visible'); document.body.style.overflowY = 'hidden'; }
function closeMenu() { sideMenu?.classList.remove('open'); menuOverlay?.classList.remove('visible'); document.body.style.overflowY = 'auto'; }
function showSearchBar() { searchBarContainer?.classList.add('active'); searchInput?.focus(); }
function hideSearchBar() { searchBarContainer?.classList.remove('active'); if (searchInput) searchInput.value = ''; handleSearchInput(); }
function showCart() { cartContainer?.classList.add('active'); document.body.style.overflowY = 'hidden'; renderCartItems(); }
function hideCart() { cartContainer?.classList.remove('active'); document.body.style.overflowY = 'auto'; }
function showLoginModal() { if (loginModalOverlay) loginModalOverlay.classList.add('visible'); clearLoginError(); document.body.style.overflowY = 'hidden'; } // Prevent body scroll
function hideLoginModal() { if (loginModalOverlay) loginModalOverlay.classList.remove('visible'); if (!sideMenu?.classList.contains('open') && !cartContainer?.classList.contains('active')) { document.body.style.overflowY = 'auto'; } } // Restore scroll only if other overlays are closed

function handleViewChange(event) {
    event.preventDefault();
    const view = event.currentTarget.dataset.view; // Use currentTarget
    if (view) {
        showView(view);
        // Close menu if the click came from within the menu
        if (event.currentTarget.closest('#side-menu')) {
            closeMenu();
        }
    }
}

function showView(viewName) {
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    categorizedProductsView?.querySelectorAll('.category-section').forEach(section => section.classList.remove('active'));
    bestSellersSection?.classList.remove('active');
    // Keep featured section visible on home view if data is loaded and not searching
    if (viewName === 'home' && featuredProduct && !document.getElementById('search-bar-container')?.classList.contains('active')) {
         featuredProductSection?.classList.add('active');
    } else {
         featuredProductSection?.classList.remove('active');
    }


    let currentViewTitle = 'Home';
    // Products are now rendered when data is fetched, so we don't re-render all here
    // just activate the correct container if needed (though showView primarily controls sections)


    if (viewName === 'all-products') {
        allProductsView?.classList.add('active');
        currentViewTitle = 'All Products';
         // Ensure all products are rendered in this view's container
         // Only re-render if the search bar is empty, otherwise search handles rendering
         if (!document.getElementById('search-bar-container')?.classList.contains('active') || searchInput?.value.trim() === '') {
             renderProducts(allProductsContainer, allProducts);
         } else {
              // If search is active, leave the search results rendered
         }

    } else if (viewName === 'home') {
        categorizedProductsView?.classList.add('active');
        bestSellersSection?.classList.add('active');
         // Featured section visibility handled above

        // Ensure categorized sections and best sellers are visible and have products rendered
        categorizedProductsView?.querySelectorAll('.category-section').forEach(section => section.classList.add('active'));
        // Products for these sections are rendered during fetchAndRenderData
        // Re-render if necessary, but typically only need to show/hide sections
        // renderProducts(streamingPlatformsContainer, filterProductsByCategory('streaming-services'));
        // renderProducts(educationalServicesContainer, filterProductsByCategory('educational-tools'));
        // renderProducts(appleServicesContainer, filterProductsByCategory('apple-services'));
        // renderProducts(bestSellingProductsContainer, filterBestSellingProducts());

    } else { // Category view
        categorizedProductsView?.classList.add('active');
        const targetSection = document.getElementById(`${viewName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            currentViewTitle = targetSection.querySelector('h2')?.textContent || viewName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
             // Ensure products for this category are rendered in its container
             renderProducts(targetSection.querySelector('.grid'), filterProductsByCategory(viewName));
        } else {
            console.warn('Category section not found:', viewName);
            showView('home'); // Fallback to home if category not found
            return;
        }
    }
    updateBreadcrumbs(currentViewTitle, viewName);
    window.scrollTo(0, 0);
}


function updateBreadcrumbs(currentViewTitle, viewName) { if (!breadcrumbs) return; let breadcrumbHTML = `<a href="#" data-view="home" class="hover:text-white transition-colors">Home</a>`; if (viewName !== 'home') { breadcrumbHTML += ` <span class="separator" aria-hidden="true">/</span> `; if (viewName !== 'search-results') { breadcrumbHTML += `<span class="current-page" aria-current="page">${currentViewTitle}</span>`; } else { breadcrumbHTML += `<span class="current-page">${currentViewTitle}</span>`; } } else { breadcrumbHTML = `<span class="current-page" aria-current="page">Home</span>`; } breadcrumbs.innerHTML = breadcrumbHTML; }

function handleSearchInput() {
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const filtered = filterProductsBySearch(searchTerm);
    const isSearching = searchTerm.length > 0;

    // Always show the all-products view when searching
    showView('all-products'); // This will set the breadcrumbs and activate the all-products-view section
     // Hide featured section when searching
     if (featuredProductSection) featuredProductSection.classList.remove('active');

    if (isSearching) {
         renderProducts(allProductsContainer, filtered); // Render filtered results in the all products container
         updateBreadcrumbs(`Search Results for "${searchTerm}"`, 'search-results'); // Update breadcrumbs for search
    } else {
         // If search is cleared, re-render all products in the all-products view
         renderProducts(allProductsContainer, allProducts);
         // The showView('all-products') call already set the breadcrumb to 'All Products'
    }
}


// --- Banner Slideshow ---
function goToSlide(index) { const slides = bannerSlidesContainer?.querySelectorAll('.banner-slide'); const dots = bannerIndicatorsContainer?.querySelectorAll('.indicator-dot'); if (!slides || slides.length === 0 || !dots || dots.length === 0) return; const numSlides = slides.length; currentSlideIndex = (index + numSlides) % numSlides; const offset = -currentSlideIndex * 100; if (bannerSlidesContainer) bannerSlidesContainer.style.transform = `translateX(${offset}%)`; dots.forEach((dot, i) => { dot.classList.toggle('active', i === currentSlideIndex); dot.classList.toggle('opacity-100', i === currentSlideIndex); dot.classList.toggle('opacity-50', i !== currentSlideIndex); }); }
function showNextSlide() { goToSlide(currentSlideIndex + 1); }
function showPrevSlide() { goToSlide(currentSlideIndex - 1); }
function startSlideShow() { clearInterval(slideInterval); const numSlides = bannerSlidesContainer?.querySelectorAll('.banner-slide').length || 0; if (numSlides > 1) slideInterval = setInterval(showNextSlide, BANNER_INTERVAL_MS); }
function resetSlideInterval() { clearInterval(slideInterval); startSlideShow(); }

// --- Cart Logic ---
function addItemToCart(product, quantity = 1, selectedDuration = null, selectedPrice = product.price) {
     // Find the full product object from the allProducts array (important for latest data)
     const fullProduct = allProducts.find(p => p.id === product.id);
     if (!fullProduct || fullProduct.isSoldOut) {
         console.warn("Attempted to add invalid or sold out product:", product);
         return;
     }

     // Determine the price based on selected duration if applicable, otherwise use base price
     let priceToUse = fullProduct.price; // Default to base price from data
     if (selectedDuration && fullProduct.durationOptions && fullProduct.durationOptions.length > 0) {
         const selectedOption = fullProduct.durationOptions.find(option => option.duration === selectedDuration);
         if (selectedOption) {
             priceToUse = selectedOption.price;
         } else {
             console.warn(`Selected duration "${selectedDuration}" not found for product ${fullProduct.id}. Using base price.`);
         }
     } else if (selectedPrice !== undefined && selectedPrice !== null) {
         // Fallback to explicitly passed selectedPrice if no duration is selected/found
         priceToUse = selectedPrice;
     }
      // Ensure priceToUse is a number
      priceToUse = typeof priceToUse === 'number' ? priceToUse : parseFloat(String(priceToUse).replace(/[^\d.-]/g, '')) || 0;


     // Generate a unique cart item ID based on product ID and selected options (duration/price)
     // This ensures different durations of the same product are treated as separate line items
     let cartItemId = fullProduct.id;
     if (selectedDuration) {
         cartItemId += `-${selectedDuration.replace(/\s+/g, '-')}`; // Append duration, sanitize spaces
     } else if (fullProduct.showQuantity) {
          // If only quantity matters, the base ID is enough unless other options are added later
     }


     const existingItemIndex = cartItems.findIndex(item => item.cartItemId === cartItemId);

     if (existingItemIndex > -1) {
         cartItems[existingItemIndex].quantity += quantity;
     } else {
         cartItems.push({
             cartItemId, // Use the generated unique ID
             id: fullProduct.id,
             name: fullProduct.name,
             price: priceToUse, // Use the determined price
             quantity,
             imageUrl: fullProduct.imageUrl,
             selectedDuration // Store selected duration
         });
     }
     console.log("Cart updated:", cartItems);
     renderCartItems();
     showCart();
 }
function removeItemFromCart(cartItemIdToRemove) { cartItems = cartItems.filter(item => item.cartItemId !== cartItemIdToRemove); console.log("Item removed, cart:", cartItems); renderCartItems(); }
// function updateCartItemQuantity(cartItemIdToUpdate, newQuantity) { const itemIndex = cartItems.findIndex(item => item.cartItemId === cartItemIdToUpdate); if (itemIndex > -1) { if (newQuantity <= 0) removeItemFromCart(cartItemIdToUpdate); else { cartItems[itemIndex].quantity = newQuantity; renderCartItems(); } } } // Optional: Add +/- buttons in cart

// --- Event Handling for Product Cards (Delegated) ---
function handleProductCardInteraction(event) {
    const button = event.target.closest('button');
    // If the click wasn't on a button, exit
    if (!button) return;

    // Find the closest product card element using the data-product-id attribute
    const productCard = event.target.closest('.product-card');
    // If the click was on a button, but not inside a product card (e.g., banner nav), exit
    if (!productCard) return;

    // Get the product ID from the data-product-id attribute on the card
    const productId = productCard.dataset.productId;

    // Find the product data in the global allProducts array using the productId
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.warn("Product data not found in allProducts array for ID:", productId);
        return; // Exit if product data isn't found
    }

    // --- Removed handling for inline quantity buttons and duration options ---
    // if (button.classList.contains('quantity-button')) { ... }
    // else if (button.classList.contains('duration-option')) { ... }
    // --- End Removed handling ---


    if (button.classList.contains('add-to-cart-button')) {
        // This button is only shown for products *without* inline options
        // Default quantity is 1, no duration is selected
        addItemToCart(product, 1, null, product.price); // Pass the product object and default options
    } else if (button.classList.contains('choose-options-button')) {
        console.log(`Choose options clicked for product ${productId}`);
        // *** Placeholder for your future modal/popup logic ***
        // When you implement the modal, this is where you'll show it,
        // allow the user to select duration/quantity, and then call `addItemToCart`
        // with the selected options and corresponding price.
        alert(`Please select options for ${product.name}. Options available: Durations: ${product.durationOptions?.map(o => o.duration).join(', ')}, Quantity Selectable: ${product.showQuantity}`); // Placeholder for now
    }
    // Removed the 'whatsapp-button' handling logic for general product cards
}

// --- Featured Product Button Handlers ---
// This function is now handled by the delegated product card interaction
// function handleFeaturedBuyNow() { ... } // No longer needed

// Function to render the featured product details
function renderFeaturedProduct(product) {
    if (!product || !featuredProductImage || !featuredProductTitle || !featuredProductDescription || !featuredProductSection) {
        console.warn("Cannot render featured product: Missing elements or data.");
        if (featuredProductSection) featuredProductSection.style.display = 'none'; // Hide section if rendering fails
        return;
    }

    featuredProductImage.src = product.imageUrl || 'https://placehold.co/1200x400/1a1a1a/ffffff?text=Featured+Image+Error';
    featuredProductImage.alt = product.name || 'Featured Product Image';
    featuredProductTitle.textContent = product.name || 'Featured Product';
    featuredProductDescription.textContent = product.description || '';

    // Update the "Buy Now" button's data-product-id and class
     const buyNowButton = featuredProductSection.querySelector('#featured-buy-now');
     if (buyNowButton) {
         buyNowButton.setAttribute('data-product-id', product.id);
         // If the featured product requires options, change the button text/class
         const requiresOptions = (product.durationOptions?.length > 0 || product.showQuantity);
         if (requiresOptions) {
              buyNowButton.textContent = 'Choose options';
              buyNowButton.classList.remove('add-to-cart-button');
              buyNowButton.classList.add('choose-options-button');
         } else {
             buyNowButton.innerHTML = '<i class="fas fa-cart-plus mr-2"></i> Add to cart'; // Revert to Add to Cart
             buyNowButton.classList.remove('choose-options-button');
             buyNowButton.classList.add('add-to-cart-button');
         }
         buyNowButton.disabled = product.isSoldOut; // Disable if sold out
     }


    // Make the section visible
    featuredProductSection.style.display = 'block';
    // Ensure it's active if on the home view and not searching
    if (document.getElementById('categorized-products-view')?.classList.contains('active') && !document.getElementById('search-bar-container')?.classList.contains('active')) {
         featuredProductSection.classList.add('active');
    } else if (document.getElementById('best-sellers-section')?.classList.contains('active') && !document.getElementById('search-bar-container')?.classList.contains('active')) {
         // Also show featured on best sellers view if not searching
         featuredProductSection.classList.add('active');
    } else {
        // Hide on All Products view, Search view, or other non-home/non-best-seller views
         featuredProductSection.classList.remove('active');
    }


}


// --- Utility Functions ---
function formatPrice(price) { if (typeof price !== 'number') { const numericValue = parseFloat(String(price).replace(/[^\d.-]/g, '')); if (!isNaN(numericValue)) price = numericValue; else return price; } return `Tk ${price.toFixed(2)} BDT`; }
function displayErrorMessage(message) { const mainContent = document.querySelector('main'); if (mainContent) { const existingError = mainContent.querySelector('.error-message'); if(existingError) existingError.remove(); const errorDiv = document.createElement('div'); errorDiv.className = 'error-message bg-red-800 text-white p-4 rounded mb-6 text-center'; errorDiv.textContent = message; mainContent.insertBefore(errorDiv, mainContent.firstChild); } }
