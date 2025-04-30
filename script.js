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
let allProducts = []; // This will be populated from Firebase or placeholders
let featuredProduct = null; // This will hold the featured product data
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
    fetchAndRenderData(); // This will now fetch data (or use placeholders)
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
        appleServicesContainer, bestSellingProductsContainer
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

     // Event Listener for Featured Product Buy Now Button
     document.getElementById('featured-buy-now')?.addEventListener('click', handleFeaturedBuyNow);
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
                // Try to make the default Firebase message more readable
                if (message.startsWith("Firebase: Error")) {
                    message = message.replace("Firebase: Error ", "").replace(/\(auth\/.*\)\.?/, "").trim();
                    message = message.charAt(0).toUpperCase() + message.slice(1) + '.'; // Capitalize
                } else {
                    message = "An error occurred. Please try again."; // Generic fallback
                }

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
    console.log("Attempting to fetch data (using placeholders for now)...");
    try {
        // --- Placeholder Data ---
        // Replace this with your actual Firebase fetching logic
        allProducts = [
            // Streaming Services
            { id: 'netflix1', name: 'Netflix Premium', description: 'Ultra HD streaming', imageUrl: 'https://placehold.co/300x180/e50914/ffffff?text=Netflix', rating: 4.8, ratingCount: 1500, price: 15.99, category: 'streaming-services', isBestSeller: true, durationOptions: ['1 Month', '3 Months', '6 Months'], addToCartLink: '#' },
            { id: 'prime1', name: 'Amazon Prime Video', description: 'Movies and TV shows', imageUrl: 'https://placehold.co/300x180/00A8E1/ffffff?text=Prime+Video', rating: 4.5, ratingCount: 1200, price: 8.99, category: 'streaming-services', isSoldOut: false, durationOptions: ['1 Month'], addToCartLink: '#' },
            { id: 'hulu1', name: 'Hulu (With Ads)', description: 'Extensive library', imageUrl: 'https://placehold.co/300x180/1ce783/000000?text=Hulu', rating: 4.2, ratingCount: 900, price: 7.99, category: 'streaming-services', isSoldOut: true, durationOptions: ['1 Month'], addToCartLink: '#' },
            { id: 'disney1', name: 'Disney+', description: 'Family-friendly content', imageUrl: 'https://placehold.co/300x180/01147C/ffffff?text=Disney+', rating: 4.7, ratingCount: 1800, price: 10.99, category: 'streaming-services', durationOptions: ['1 Month', '1 Year'], addToCartLink: '#' },

            // Educational Tools
            { id: 'coursera1', name: 'Coursera Plus', description: 'Access thousands of courses', imageUrl: 'https://placehold.co/300x180/2a73cc/ffffff?text=Coursera', rating: 4.9, ratingCount: 2500, price: 59.00, category: 'educational-tools', durationOptions: ['1 Month', '1 Year'], addToCartLink: '#' },
            { id: 'skillshare1', name: 'Skillshare Premium', description: 'Creative classes', imageUrl: 'https://placehold.co/300x180/00a67d/ffffff?text=Skillshare', rating: 4.6, ratingCount: 1100, price: 13.99, category: 'educational-tools', isBestSeller: true, durationOptions: ['1 Month', '1 Year'], addToCartLink: '#' },
            { id: 'udemy1', name: 'Udemy Course Credit', description: 'Learn specific skills', imageUrl: 'https://placehold.co/300x180/a435f0/ffffff?text=Udemy', price: 'Varies', category: 'educational-tools', details: 'Buy credits for courses', addToCartLink: '#' }, // Price varies example

            // Apple Services
            { id: 'apple-music1', name: 'Apple Music', description: 'Millions of songs', imageUrl: 'https://placehold.co/300x180/fa243c/ffffff?text=Apple+Music', rating: 4.7, ratingCount: 2000, price: 10.99, category: 'apple-services', durationOptions: ['1 Month'], addToCartLink: '#' },
            { id: 'apple-tv1', name: 'Apple TV+', description: 'Original shows and movies', imageUrl: 'https://placehold.co/300x180/000000/ffffff?text=Apple+TV+', rating: 4.3, ratingCount: 800, price: 6.99, category: 'apple-services', durationOptions: ['1 Month'], addToCartLink: '#' },
            { id: 'apple-arcade1', name: 'Apple Arcade', description: 'Ad-free games', imageUrl: 'https://placehold.co/300x180/f48f79/000000?text=Apple+Arcade', rating: 4.5, ratingCount: 750, price: 4.99, category: 'apple-services', durationOptions: ['1 Month'], addToCartLink: '#' },
            { id: 'icloud1', name: 'iCloud+ Storage', description: 'Secure cloud storage', imageUrl: 'https://placehold.co/300x180/2799f9/ffffff?text=iCloud+', price: 2.99, category: 'apple-services', details: 'Starts at 200GB', durationOptions: ['50GB', '200GB', '2TB'], addToCartLink: '#' }
        ];

        // Placeholder for featured product
        featuredProduct = allProducts.find(p => p.id === 'netflix1'); // Example: Feature Netflix

        // --- End Placeholder Data ---

        // --- Banner Images (Using Placeholders) ---
        const bannerImages = [
            "https://placehold.co/1200x400/1a1a1a/e50914?text=Welcome+to+FANFLIX+BD",
            "https://placehold.co/1200x400/1a1a1a/00A8E1?text=Get+Your+Prime+Video+Subscription",
            "https://placehold.co/1200x400/1a1a1a/ffffff?text=Exclusive+Offers+Inside!",
        ];
        renderBanner(bannerImages);
        // --- End Banner Images ---

        // Render products based on the populated data
        renderProducts(streamingPlatformsContainer, filterProductsByCategory('streaming-services'));
        renderProducts(educationalServicesContainer, filterProductsByCategory('educational-tools'));
        renderProducts(appleServicesContainer, filterProductsByCategory('apple-services'));
        renderProducts(allProductsContainer, allProducts); // Initially empty, shown when "All Products" is selected
        renderProducts(bestSellingProductsContainer, filterBestSellingProducts());

        // Render the featured product if data is available
        if (featuredProduct) {
            renderFeaturedProduct(featuredProduct);
        } else {
             if (featuredProductSection) featuredProductSection.style.display = 'none';
        }

        showView('home'); // Show initial view

    } catch (error) {
        console.error("Error fetching or rendering data:", error);
        displayErrorMessage("Failed to load product data. Please try refreshing the page.");
        // Clear containers on error
        renderProducts(streamingPlatformsContainer, []);
        renderProducts(educationalServicesContainer, []);
        renderProducts(appleServicesContainer, []);
        renderProducts(allProductsContainer, []);
        renderProducts(bestSellingProductsContainer, []);
        if (featuredProductSection) featuredProductSection.style.display = 'none';
    }
}

// --- Product Filtering ---
function filterProductsByCategory(category) {
    return allProducts.filter(product => product.category === category);
}
function filterBestSellingProducts() {
    // Ensure isBestSeller is treated as boolean true
    return allProducts.filter(product => product.isBestSeller === true);
}
function filterProductsBySearch(searchTerm) {
     if (!searchTerm) return allProducts; // Return all if search is empty
     const lowerCaseSearchTerm = searchTerm.toLowerCase();
     return allProducts.filter(product =>
         product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
         (product.description && product.description.toLowerCase().includes(lowerCaseSearchTerm)) ||
         (product.category && product.category.toLowerCase().replace('-', ' ').includes(lowerCaseSearchTerm)) || // Allow searching category names
         (product.id && product.id.toLowerCase().includes(lowerCaseSearchTerm)) // Allow searching by ID
     );
}

// --- Rendering Functions ---
function renderProducts(containerElement, productsToRender) {
    if (!containerElement) {
        console.warn("Attempted to render products into a null container.");
        return;
    }
    containerElement.innerHTML = ''; // Clear existing content
    if (!productsToRender || productsToRender.length === 0) {
        // Display a message if no products are found
        containerElement.innerHTML = '<p class="text-center text-gray-500 col-span-full py-8">No products found matching your criteria.</p>';
        return;
    }
    const fragment = document.createDocumentFragment();
    productsToRender.forEach(product => {
        const cardHTML = createProductCardHTML(product);
        if (cardHTML) { // Ensure HTML was generated
             const cardElement = document.createElement('div'); // Create a wrapper div
             cardElement.innerHTML = cardHTML.trim(); // Add the HTML to the wrapper
             if (cardElement.firstChild) {
                 // Set data-product-id on the main article element for easier access
                 cardElement.firstChild.dataset.productId = product.id;
                 fragment.appendChild(cardElement.firstChild); // Append the actual card element
             }
        }
    });
    containerElement.appendChild(fragment);
}


function createProductCardHTML(product) {
    // Ensure product object has necessary properties, provide defaults if missing
    const id = product.id || `unknown-${Math.random().toString(16).slice(2)}`;
    const name = product.name || 'Unnamed Product';
    const description = product.description || '';
    const imageUrl = product.imageUrl || 'https://placehold.co/300x180/1a1a1a/ffffff?text=No+Image';
    const rating = product.rating !== undefined && product.rating !== null ? Number(product.rating) : null; // Ensure rating is a number or null
    const ratingCount = product.ratingCount !== undefined ? product.ratingCount : '';
    const price = product.price; // Keep original price (could be number or string like 'Varies')
    const isSoldOut = product.isSoldOut === true; // Ensure boolean check
    const durationOptions = Array.isArray(product.durationOptions) ? product.durationOptions : [];
    const showQuantity = product.showQuantity === true; // Ensure boolean check
    const addToCartLink = product.addToCartLink || ''; // Flag for simple 'Add to Cart'
    const details = product.details || '';

    const priceFormatted = typeof price === 'number' ? formatPrice(price) : (price || 'N/A'); // Format if number, otherwise display as is or 'N/A'
    const isActionable = !isSoldOut;

    const durationOptionsHTML = durationOptions.length > 0 ? `<div class="duration-options mt-4"><h3 class="text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wider">Duration</h3><div class="flex flex-wrap gap-2">${durationOptions.map((option, index) => `<button class="duration-option text-sm px-3 py-1 border border-gray-600 rounded hover:bg-gray-600 transition-colors ${index === 0 ? 'active bg-gray-600' : ''}" data-duration="${option}" data-product-id="${id}" ${!isActionable ? 'disabled' : ''}>${option}</button>`).join('')}</div></div>` : '';

    const quantitySelectorHTML = showQuantity ? `<div class="quantity-selector-container mt-4"><h3 class="text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wider">Quantity</h3><div class="quantity-selector inline-flex"><button class="quantity-button minus bg-gray-600 hover:bg-gray-500 rounded-l px-3 py-1" data-product-id="${id}" ${!isActionable ? 'disabled' : ''}>-</button><input type="number" value="1" min="1" class="quantity-input w-12 text-center bg-gray-700 border-t border-b border-gray-600" readonly data-product-id="${id}"><button class="quantity-button plus bg-gray-600 hover:bg-gray-500 rounded-r px-3 py-1" data-product-id="${id}" ${!isActionable ? 'disabled' : ''}>+</button></div></div>` : '';

    // Determine button logic:
    // Show "Add to Cart" if product is actionable AND has addToCartLink AND ( (no duration options AND no quantity selector) OR (it's a simple product without options needing choice) )
    const needsOptionsSelection = durationOptions.length > 0 || showQuantity;
    const showDirectAddToCart = isActionable && addToCartLink && !needsOptionsSelection;
    // Show "Choose Options" if product is actionable AND needs options selection
    const showChooseOptions = isActionable && needsOptionsSelection;

    let actionButtonsHTML = '';
    if (showDirectAddToCart) {
        actionButtonsHTML += `<button class="action-button btn-blue add-to-cart-button" data-product-id="${id}"><i class="fas fa-cart-plus mr-2"></i> Add to cart</button>`;
    }
    if (showChooseOptions) {
        // For products with options, the primary button should add the selected options to cart
        actionButtonsHTML += `<button class="action-button btn-blue add-to-cart-button" data-product-id="${id}"><i class="fas fa-cart-plus mr-2"></i> Add to cart</button>`;
        // Alternative: Use a separate "Choose Options" button if you have a modal flow
        // actionButtonsHTML += `<button class="action-button btn-blue choose-options-button" data-product-id="${id}">Choose options</button>`;
    }
    // If Sold Out, no buttons are added.

    return `
        <article class="product-card flex flex-col h-full ${isSoldOut ? 'relative opacity-60' : ''}" aria-label="${name}">
            ${isSoldOut ? '<div class="sold-out-overlay" aria-hidden="true">Sold out</div>' : ''}
            <img src="${imageUrl}" alt="${name}" class="product-image" onerror="this.onerror=null;this.src='https://placehold.co/300x180/1a1a1a/ffffff?text=Image+Error';">
            <div class="product-info flex flex-col flex-grow p-4">
                <div class="flex-grow">
                    <h3 class="product-name font-semibold text-lg mb-1">${name}</h3>
                    ${description ? `<p class="product-description text-sm text-gray-400 mb-2">${description}</p>` : ''}
                    ${rating !== null ? `<div class="rating text-sm mb-2" role="img" aria-label="Rating: ${rating} out of 5 stars">${generateStarRatingHTML(rating)}${ratingCount !== '' ? `<span class="rating-count text-gray-500 ml-1">(${ratingCount})</span>` : ''}</div>` : ''}
                    ${details ? `<p class="text-xs text-gray-500 mb-3">${details}</p>` : ''}
                </div>
                <div>
                    <p class="product-price text-xl font-bold mb-3">${priceFormatted}</p>
                    ${durationOptionsHTML}
                    ${quantitySelectorHTML}
                    <div class="action-buttons mt-4 space-y-2">
                        ${actionButtonsHTML}
                    </div>
                </div>
            </div>
        </article>
    `;
}

function generateStarRatingHTML(rating) { let stars = ''; const fullStars = Math.floor(rating); const halfStar = rating % 1 >= 0.5; const emptyStars = 5 - fullStars - (halfStar ? 1 : 0); for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-yellow-400" aria-hidden="true"></i>'; if (halfStar) stars += '<i class="fas fa-star-half-alt text-yellow-400" aria-hidden="true"></i>'; for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star text-gray-500" aria-hidden="true"></i>'; return stars; }

function renderBanner(images) { if (!bannerSlidesContainer || !bannerIndicatorsContainer || !images || images.length === 0) return; bannerSlidesContainer.innerHTML = ''; bannerIndicatorsContainer.innerHTML = ''; const fragmentSlides = document.createDocumentFragment(); const fragmentIndicators = document.createDocumentFragment(); images.forEach((imageUrl, index) => { const slide = document.createElement('div'); slide.classList.add('banner-slide'); const img = document.createElement('img'); img.src = imageUrl; img.alt = `Banner Image ${index + 1}`; img.classList.add('w-full', 'h-auto', 'object-cover'); img.onerror = () => { img.alt = 'Banner Image Failed to Load'; img.src = `https://placehold.co/1200x400/1a1a1a/ffffff?text=Error+Loading+Banner+${index + 1}`; }; slide.appendChild(img); fragmentSlides.appendChild(slide); const dot = document.createElement('button'); dot.classList.add('indicator-dot', 'w-3', 'h-3', 'rounded-full', 'bg-white', 'opacity-50', 'hover:opacity-75', 'transition-opacity'); dot.setAttribute('aria-label', `Go to slide ${index + 1}`); if (index === 0) dot.classList.add('active', 'opacity-100'); dot.addEventListener('click', () => { goToSlide(index); resetSlideInterval(); }); fragmentIndicators.appendChild(dot); }); bannerSlidesContainer.appendChild(fragmentSlides); bannerIndicatorsContainer.appendChild(fragmentIndicators); currentSlideIndex = 0; goToSlide(0); startSlideShow(); }

function renderCartItems() {
    if (!cartItemsContainer || !cartTotalPriceElement) return;
    cartItemsContainer.innerHTML = '';
    let total = 0;
    if (cartItems.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-center text-gray-500 py-8">Your cart is empty.</p>';
    } else {
        const fragment = document.createDocumentFragment();
        cartItems.forEach(item => {
            // Ensure price is a number for calculation
            const itemPrice = typeof item.price === 'number' ? item.price : 0;
            const itemTotal = itemPrice * item.quantity;
            total += itemTotal;

            const cartItemDiv = document.createElement('div');
            cartItemDiv.classList.add('cart-item', 'flex', 'items-center', 'py-3', 'border-b', 'border-gray-700');
            cartItemDiv.innerHTML = `
                <img src="${item.imageUrl || 'https://placehold.co/60x60/1a1a1a/ffffff?text=Item'}" alt="${item.name || 'Cart Item Image'}" class="w-16 h-16 object-cover rounded mr-4" onerror="this.onerror=null;this.src='https://placehold.co/60x60/1a1a1a/ffffff?text=Error';">
                <div class="item-details flex-grow">
                    <h3 class="font-semibold text-base mb-1">${item.name || 'Item Name'}</h3>
                    ${item.selectedDuration ? `<p class="text-xs text-gray-400">Duration: ${item.selectedDuration}</p>` : ''}
                    <p class="text-sm text-gray-400">${formatPrice(itemPrice)} x ${item.quantity}</p>
                </div>
                <span class="item-quantity font-semibold text-base ml-4">${formatPrice(itemTotal)}</span>
                <button class="remove-item-button text-red-500 hover:text-red-400 ml-4 text-lg" data-item-id="${item.cartItemId}" aria-label="Remove ${item.name}">
                    <i class="fas fa-trash-alt pointer-events-none"></i>
                </button>`;
            fragment.appendChild(cartItemDiv);
        });
        cartItemsContainer.appendChild(fragment);
    }
    cartTotalPriceElement.textContent = formatPrice(total);
}


// --- UI Interaction Functions ---
function openMenu() { sideMenu?.classList.add('open'); menuOverlay?.classList.add('visible'); document.body.style.overflowY = 'hidden'; }
function closeMenu() { sideMenu?.classList.remove('open'); menuOverlay?.classList.remove('visible'); document.body.style.overflowY = 'auto'; }
function showSearchBar() { searchBarContainer?.classList.add('active'); searchInput?.focus(); }
function hideSearchBar() { searchBarContainer?.classList.remove('active'); if (searchInput) searchInput.value = ''; handleSearchInput(); } // Clear search on close
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
    console.log("Showing view:", viewName);
    // Hide all main view sections first
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    // Also hide best sellers and featured product initially
    bestSellersSection?.classList.remove('active');
    featuredProductSection?.classList.remove('active');
     // Hide all category sections within the categorized view
    categorizedProductsView?.querySelectorAll('.category-section').forEach(section => section.classList.remove('active'));


    let currentViewTitle = 'Home';

    if (viewName === 'all-products') {
        allProductsView?.classList.add('active');
        currentViewTitle = 'All Products';
        renderProducts(allProductsContainer, allProducts); // Render all products into its container
    } else if (viewName === 'home') {
        categorizedProductsView?.classList.add('active'); // Show the container for categories
        bestSellersSection?.classList.add('active'); // Show best sellers section
        if (featuredProduct) featuredProductSection?.classList.add('active'); // Show featured section if data exists

        // Ensure category sections are rendered and made active *within* the categorized view
        renderProducts(streamingPlatformsContainer, filterProductsByCategory('streaming-services'));
        renderProducts(educationalServicesContainer, filterProductsByCategory('educational-tools'));
        renderProducts(appleServicesContainer, filterProductsByCategory('apple-services'));
        // Make sure these sections are visible
        document.getElementById('streaming-services-section')?.classList.add('active');
        document.getElementById('educational-tools-section')?.classList.add('active');
        document.getElementById('apple-services-section')?.classList.add('active');

        renderProducts(bestSellingProductsContainer, filterBestSellingProducts()); // Render best sellers

    } else if (viewName === 'streaming-services' || viewName === 'educational-tools' || viewName === 'apple-services') {
        // This is a specific category view
        categorizedProductsView?.classList.add('active'); // Show the main category container
        const targetSection = document.getElementById(`${viewName}-section`);
        const targetContainer = document.getElementById(`${viewName}-container`) || targetSection?.querySelector('.grid'); // Find the grid container

        if (targetSection && targetContainer) {
            targetSection.classList.add('active'); // Activate the specific category section
            currentViewTitle = targetSection.querySelector('h2')?.textContent || viewName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const productsToRender = filterProductsByCategory(viewName); // Filter by category
            renderProducts(targetContainer, productsToRender); // Render products into the category's grid
        } else {
            console.warn('Category section or container not found:', viewName);
            showView('home'); // Fallback to home
            return;
        }
    } else {
        // Default to home view if viewName is unknown
        console.warn("Unknown view requested:", viewName, "Defaulting to home.");
        showView('home');
        return; // Exit here to prevent breadcrumb update for the invalid view
    }

    updateBreadcrumbs(currentViewTitle, viewName);
    window.scrollTo(0, 0); // Scroll to top on view change
}


function updateBreadcrumbs(currentViewTitle, viewName) {
    if (!breadcrumbs) return;
    let breadcrumbHTML = `<a href="#" data-view="home" class="hover:text-white transition-colors">Home</a>`;

    if (viewName === 'home') {
        // For home view, just show "Home" as current page
        breadcrumbHTML = `<span class="current-page" aria-current="page">Home</span>`;
    } else if (viewName === 'search-results') {
        // Special case for search results
        breadcrumbHTML += ` <span class="separator" aria-hidden="true">/</span> `;
        breadcrumbHTML += `<span class="current-page" aria-current="page">${currentViewTitle}</span>`;
    } else {
        // For other views (all products, categories)
        breadcrumbHTML += ` <span class="separator" aria-hidden="true">/</span> `;
        breadcrumbHTML += `<span class="current-page" aria-current="page">${currentViewTitle}</span>`;
    }

    breadcrumbs.innerHTML = breadcrumbHTML;
}


function handleSearchInput() {
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const filtered = filterProductsBySearch(searchTerm);
    const isSearching = searchTerm.length > 0;

    if (isSearching) {
        // If searching, force the 'all-products' view to be active
        if (!allProductsView?.classList.contains('active')) {
            showView('all-products'); // Activate the view section
        }
         renderProducts(allProductsContainer, filtered); // Render filtered results
         updateBreadcrumbs(`Search Results for "${searchTerm}"`, 'search-results'); // Update breadcrumbs
    } else {
        // If search is cleared, decide which view to show.
        // Option 1: Go back to 'all-products' showing everything
         // showView('all-products');
        // Option 2: Go back to 'home' (might be preferable)
         showView('home');
    }
}


// --- Banner Slideshow ---
function goToSlide(index) { const slides = bannerSlidesContainer?.querySelectorAll('.banner-slide'); const dots = bannerIndicatorsContainer?.querySelectorAll('.indicator-dot'); if (!slides || slides.length === 0 || !dots || dots.length === 0) return; const numSlides = slides.length; currentSlideIndex = (index + numSlides) % numSlides; const offset = -currentSlideIndex * 100; if (bannerSlidesContainer) bannerSlidesContainer.style.transform = `translateX(${offset}%)`; dots.forEach((dot, i) => { dot.classList.toggle('active', i === currentSlideIndex); dot.classList.toggle('opacity-100', i === currentSlideIndex); dot.classList.toggle('opacity-50', i !== currentSlideIndex); }); }
function showNextSlide() { goToSlide(currentSlideIndex + 1); }
function showPrevSlide() { goToSlide(currentSlideIndex - 1); }
function startSlideShow() { clearInterval(slideInterval); const numSlides = bannerSlidesContainer?.querySelectorAll('.banner-slide').length || 0; if (numSlides > 1) slideInterval = setInterval(showNextSlide, BANNER_INTERVAL_MS); }
function resetSlideInterval() { clearInterval(slideInterval); startSlideShow(); }

// --- Cart Logic ---
function addItemToCart(productData, quantity = 1, selectedDuration = null) {
    // Find the full product object from the allProducts array using the ID from productData
    const fullProduct = allProducts.find(p => p.id === productData.id);

    if (!fullProduct) {
        console.error("Could not find product details in allProducts for ID:", productData.id);
        alert("Error: Product details not found.");
        return;
    }

    if (fullProduct.isSoldOut) {
        console.warn("Attempted to add sold out product:", fullProduct.name);
        alert(`${fullProduct.name} is currently sold out.`);
        return;
    }

    // Use the price from the full product object found in allProducts
    let price = fullProduct.price;
    // Handle non-numeric prices (like 'Varies' or null/undefined)
    if (typeof price !== 'number') {
        console.warn(`Product ${fullProduct.name} has a non-numeric price: ${price}. Cannot add to cart.`);
        alert(`Cannot add ${fullProduct.name} to cart as price is not set.`);
        return;
    }

    // Create a unique ID for the cart item based on product ID and selected duration
    const cartItemId = selectedDuration ? `${fullProduct.id}-${selectedDuration}` : fullProduct.id;
    const existingItemIndex = cartItems.findIndex(item => item.cartItemId === cartItemId);

    if (existingItemIndex > -1) {
        // Item already exists, update quantity
        cartItems[existingItemIndex].quantity += quantity;
    } else {
        // Add new item to cart
        cartItems.push({
            cartItemId, // Unique ID for this cart entry
            id: fullProduct.id, // Original product ID
            name: fullProduct.name,
            price, // Use the validated numeric price
            quantity,
            imageUrl: fullProduct.imageUrl,
            selectedDuration // Store the selected duration
        });
    }
    console.log("Cart updated:", cartItems);
    renderCartItems(); // Update the cart display
    showCart(); // Open the cart drawer
}

function removeItemFromCart(cartItemIdToRemove) { cartItems = cartItems.filter(item => item.cartItemId !== cartItemIdToRemove); console.log("Item removed, cart:", cartItems); renderCartItems(); }
// Optional: function updateCartItemQuantity(cartItemIdToUpdate, newQuantity) { ... }

// --- Event Handling for Product Cards (Delegated) ---
function handleProductCardInteraction(event) {
    const button = event.target.closest('button');
    if (!button) return; // Exit if the click wasn't on or inside a button

    const productCard = button.closest('.product-card');
    if (!productCard) return; // Exit if the button isn't inside a product card

    // Get product ID from the card's dataset (set during rendering)
    const productId = productCard.dataset.productId;
    if (!productId) {
         console.warn("Could not find product ID on the product card.");
         return;
    }

    // Find the full product data using the ID
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.warn("Product data not found in allProducts array for ID:", productId);
        return;
    }

    // --- Handle different button types ---

    // Quantity +/- buttons
    if (button.classList.contains('quantity-button')) {
        const quantityInput = productCard.querySelector(`.quantity-input[data-product-id="${productId}"]`);
        if (!quantityInput) return;
        let currentValue = parseInt(quantityInput.value);
        if (button.classList.contains('plus')) {
            quantityInput.value = currentValue + 1;
        } else if (button.classList.contains('minus') && currentValue > 1) {
            quantityInput.value = currentValue - 1;
        }
    }
    // Duration selection buttons
    else if (button.classList.contains('duration-option')) {
        const duration = button.dataset.duration;
        const durationContainer = button.closest('.duration-options');
        // Deactivate other options, activate the clicked one
        durationContainer?.querySelectorAll('.duration-option').forEach(opt => opt.classList.remove('active', 'bg-gray-600'));
        button.classList.add('active', 'bg-gray-600');
        console.log(`Selected duration: ${duration} for product ${productId}`);
        // Note: Selection state is stored visually here. Add-to-cart reads this state.
    }
    // Add to Cart button (covers both direct add and add after options)
    else if (button.classList.contains('add-to-cart-button')) {
        let quantity = 1;
        const quantityInput = productCard.querySelector(`.quantity-input[data-product-id="${productId}"]`);
        if (quantityInput) {
            quantity = parseInt(quantityInput.value) || 1; // Ensure it's a valid number, default to 1
        }

        let selectedDuration = null;
        const activeDurationButton = productCard.querySelector('.duration-option.active');
        if (activeDurationButton) {
            selectedDuration = activeDurationButton.dataset.duration;
        }

        console.log(`Adding to cart: ID=${productId}, Qty=${quantity}, Duration=${selectedDuration || 'N/A'}`);
        addItemToCart(product, quantity, selectedDuration); // Pass the full product object
    }
    // "Choose Options" button (if you implement a modal/expansion flow)
    // else if (button.classList.contains('choose-options-button')) {
    //     console.log(`Choose options clicked for product ${productId}`);
    //     // Implement logic here, e.g., open a modal:
    //     // showOptionsModal(product);
    //     alert(`Please select options for ${product.name} on the card.`); // Placeholder
    // }
}


// --- Featured Product Button Handlers ---
function handleFeaturedBuyNow() {
     console.log("Featured 'Buy Now' clicked");
     if (featuredProduct) {
         // Assuming the featured product doesn't have selectable options for simplicity
         // If it could have options, you'd need logic similar to product cards
         addItemToCart(featuredProduct, 1, null); // Add with quantity 1, no duration
     } else {
         console.warn("Featured product data not available to add to cart.");
         alert("Unable to add featured product. Details not loaded.");
     }
}

// Function to render the featured product details
function renderFeaturedProduct(product) {
    if (!product || !featuredProductImage || !featuredProductTitle || !featuredProductDescription || !featuredProductSection) {
        console.warn("Cannot render featured product: Missing elements or data.");
        if (featuredProductSection) featuredProductSection.style.display = 'none';
        return;
    }

    featuredProductImage.src = product.imageUrl || 'https://placehold.co/1200x400/1a1a1a/ffffff?text=Featured+Image+Error';
    featuredProductImage.alt = product.name || 'Featured Product Image';
    featuredProductTitle.textContent = product.name || 'Featured Product';
    featuredProductDescription.textContent = product.description || 'No description available.';

    // Buttons might need adjustment based on the featured product type
    // For now, the "Buy Now" button uses handleFeaturedBuyNow

    featuredProductSection.style.display = 'block'; // Make the section visible
    // The .active class is handled by the showView function
}


// --- Utility Functions ---
function formatPrice(price) {
    if (typeof price !== 'number' || isNaN(price)) {
        // Attempt to parse if it's a string that looks like a number
        const numericValue = parseFloat(String(price).replace(/[^\d.-]/g, ''));
        if (!isNaN(numericValue)) {
            price = numericValue;
        } else {
            // Return the original string or a placeholder if it's not convertible
            return String(price) || 'N/A';
        }
    }
    // Format valid numbers
    return `Tk ${price.toFixed(2)} BDT`;
}

function displayErrorMessage(message) {
    const mainContent = document.querySelector('main');
    if (mainContent) {
        const existingError = mainContent.querySelector('.error-message');
        if (existingError) existingError.remove(); // Remove previous error

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message bg-red-800 text-white p-4 rounded mb-6 text-center';
        errorDiv.textContent = message;
        // Prepend the error message at the top of the main content area
        mainContent.insertBefore(errorDiv, mainContent.firstChild);
    } else {
        // Fallback if main content area isn't found
        alert(`Error: ${message}`);
    }
}
