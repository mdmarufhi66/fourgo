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
let currentProductForOptions = null; // To hold the product data for the currently open options modal
let selectedOptions = { // To store selected options in the modal
    duration: null,
    quantity: 1, // Default quantity
    price: null // Price based on selected options
};


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

// New DOM Elements for Product Options Modal
const productOptionsModalOverlay = document.getElementById('product-options-modal-overlay');
const productOptionsModal = document.getElementById('product-options-modal');
const optionsModalCloseIcon = document.getElementById('options-modal-close-icon');
const optionsModalProductName = document.getElementById('options-modal-product-name');
const optionsModalPrice = document.getElementById('options-modal-price');
const optionsModalRating = document.getElementById('options-modal-rating'); // Added rating element
const optionsContainer = document.getElementById('options-container');
const optionsModalAddToCartButton = document.getElementById('options-modal-add-to-cart');
const optionsModalBuyNowButton = document.getElementById('options-modal-buy-now');
const optionsModalWhatsappButton = document.getElementById('options-modal-whatsapp');
const optionsModalSeeMoreLink = document.getElementById('options-modal-see-more');


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

    // Product Options Modal Close
    optionsModalCloseIcon?.addEventListener('click', hideOptionsModal);
     productOptionsModalOverlay?.addEventListener('click', (event) => {
         // Close modal if clicking on the overlay itself, not the modal content
         if (event.target === productOptionsModalOverlay) {
             hideOptionsModal();
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

    // Product Card Interactions (delegated) - Clicks on buttons within product cards
    const productContainers = [
        allProductsContainer, streamingPlatformsContainer, educationalServicesContainer,
        appleServicesContainer, bestSellingProductsContainer, featuredProductSection
    ];
    productContainers.forEach(container => {
        container?.addEventListener('click', handleProductCardInteraction);
    });

     // Product Options Modal Interactions (delegated within the modal)
     productOptionsModal?.addEventListener('click', handleOptionsModalInteraction);


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

        // --- Placeholder Data (Replace this once Firebase fetching is implemented) ---
         allProducts = []; // Ensure it's empty initially
         featuredProduct = null; // Ensure featuredProduct is null initially
         if (featuredProductSection) featuredProductSection.style.display = 'none'; // Hide featured section by default

         // Dummy Data Structure (Replace with actual Firebase data)
         allProducts = [
              {
                id: 'netflix-premium-mobile-pc-laptop',
                name: 'Netflix Premium',
                description: '(Mobile/PC/Laptop)', // Matching the image text
                imageUrl: 'https://via.placeholder.com/300x180/E50914/FFFFFF?text=Netflix+Premium',
                price: 249.00, // Matching the image price (base price)
                rating: 4.5, // Example rating
                ratingCount: 120, // Example count
                category: 'streaming-services',
                isBestSeller: true,
                isSoldOut: false,
                // Represent options as groups with choices
                optionGroups: [
                    {
                        name: 'Choose Screen Type',
                        type: 'select', // Can be 'select' or 'radio' etc.
                        choices: [
                            { label: 'Shared Screen', value: 'Shared Screen', priceModifier: 0 }, // priceModifier can be absolute price or difference
                            { label: 'Private Screen', value: 'Private Screen', priceModifier: 100 } // Example price difference
                        ]
                    },
                    {
                        name: 'Duration',
                        type: 'select',
                        choices: [
                            { label: '1 Month', value: '1 Month', priceModifier: 0 },
                            // Add other durations here with their price modifiers
                        ]
                    }
                ],
                durationOptions: null, // Using optionGroups instead of durationOptions
                showQuantity: true, // Enable quantity selection in modal
                addToCartLink: true, // Can be added to cart after choosing options
                whatsappLink: 'https://wa.me/YOUR_WHATSAPP_NUMBER/?text=Hi%2C%20I%27m%20interested%20in%20the%20Netflix%20Premium%20(Mobile%2FPC%2FLaptop).', // Example WhatsApp link - REPLACE WITH REAL LINK
                details: 'Official personal account, 4K Ultra HD' // Example details
             },
              {
                id: 'youtube-premium-individual',
                name: 'YouTube Premium Individual',
                description: 'Monthly Plan',
                imageUrl: 'https://via.placeholder.com/300x180/FF0000/FFFFFF?text=YouTube+Premium',
                price: 250, // Base price
                rating: 4.8,
                ratingCount: 85,
                category: 'streaming-services',
                isBestSeller: true,
                isSoldOut: false,
                optionGroups: [
                     {
                        name: 'Duration',
                        type: 'select',
                        choices: [
                            { label: '1 Month', value: '1 Month', priceModifier: 0 },
                            { label: '6 Months', value: '6 Months', priceModifier: 1200 }
                        ]
                    }
                 ],
                 durationOptions: null, // Using optionGroups
                 showQuantity: false, // Quantity not needed
                addToCartLink: true,
                 details: 'Ad-free videos, Offline playback'
             },
              {
                id: 'spotify-premium-individual',
                name: 'Spotify Premium Individual',
                description: 'Subscription',
                imageUrl: 'https://via.placeholder.co/300x180/1DB954/FFFFFF?text=Spotify',
                price: 150, // Base price
                rating: 4.7,
                ratingCount: 90,
                category: 'streaming-services',
                isBestSeller: false,
                isSoldOut: false,
                 optionGroups: [
                     {
                        name: 'Duration',
                        type: 'select',
                        choices: [
                            { label: '1 Month', value: '1 Month', priceModifier: 0 },
                            { label: '3 Months', value: '3 Months', priceModifier: 250 },
                            { label: '6 Months', value: '6 Months', priceModifier: 600 }
                        ]
                     }
                 ],
                 durationOptions: null,
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
                optionGroups: [
                    {
                        name: 'Duration',
                        type: 'select',
                        choices: [
                            { label: '1 Month', value: '1 Month', priceModifier: 0 }
                        ]
                    }
                 ],
                 durationOptions: null,
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
                optionGroups: [
                    {
                        name: 'Duration',
                        type: 'select',
                        choices: [
                            { label: '1 Year', value: '1 Year', priceModifier: 0 }
                        ]
                    }
                 ],
                 durationOptions: null,
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
                 optionGroups: [
                     {
                        name: 'Duration',
                        type: 'select',
                        choices: [
                            { label: '1 Month', value: '1 Month', priceModifier: 0 },
                            { label: '3 Months', value: '3 Months', priceModifier: 350 },
                            { label: '1 Year', value: '1 Year', priceModifier: 1800 }
                        ]
                    }
                 ],
                 durationOptions: null,
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
                optionGroups: [
                    {
                        name: 'Duration',
                        type: 'select',
                        choices: [
                            { label: '1 Month', value: '1 Month', priceModifier: 0 }
                        ]
                    }
                 ],
                 durationOptions: null,
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
                optionGroups: [], // No specific option groups
                durationOptions: null,
                showQuantity: true, // Enable quantity selection in modal
                addToCartLink: true, // Can be added to cart after choosing quantity
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
                 optionGroups: [],
                 durationOptions: null,
                 showQuantity: false,
                 addToCartLink: false, // Cannot add to cart if sold out
                 whatsappLink: null, // Or leave undefined/empty
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
                optionGroups: [], // No option groups
                durationOptions: null,
                showQuantity: false, // No quantity selector
                addToCartLink: true, // Can be added directly to cart
                whatsappLink: null, // Or leave undefined/empty
                 details: 'Instant download'
             },
             {
                 id: 'whatsapp-only-product',
                 name: 'Custom Service',
                 description: 'Contact us for a quote',
                 imageUrl: 'https://via.placeholder.co/300x180/667EEA/FFFFFF?text=Custom',
                 price: 'Contact for Price', // Or null
                 rating: null,
                 ratingCount: '',
                 category: 'misc',
                 isBestSeller: false,
                 isSoldOut: false,
                 optionGroups: [],
                 durationOptions: null,
                 showQuantity: false,
                 addToCartLink: false, // Cannot add to cart
                 whatsappLink: 'https://wa.me/YOUR_WHATSAPP_NUMBER/?text=Hi%2C%20I%27m%20interested%20in%20your%20custom%20service.', // WhatsApp only
                 details: 'Tailored solutions'
             }
         ];

         // Select a dummy featured product (e.g., the Netflix one from the image)
         featuredProduct = allProducts.find(p => p.id === 'netflix-premium-mobile-pc-laptop'); // Find the specific Netflix product
          if (!featuredProduct) {
               // Fallback logic if the specific Netflix product isn't found (e.g., find any best seller with options)
               featuredProduct = allProducts.find(p => p.isBestSeller && !p.isSoldOut && (p.optionGroups?.length > 0 || p.showQuantity));
               if (!featuredProduct) {
                    featuredProduct = allProducts.find(p => p.isBestSeller && !p.isSoldOut); // Fallback to any best seller
               }
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
            "https://placehold.co/1200x400/1a1a1a/00A8E1/FFFFFF?text=Get+Your+Prime+Video+Subscription", // Updated text
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
    const optionGroups = product.optionGroups || []; // Using optionGroups now
    const showQuantity = product.showQuantity || false;
    const whatsappLink = product.whatsappLink || null; // Get the WhatsApp link
    const details = product.details || '';


    const priceFormatted = typeof price === 'number' ? formatPrice(price) : price;
    const isActionable = !isSoldOut;

    const requiresOptions = optionGroups.length > 0 || showQuantity;

    // Determine the primary action button based on product data and actionability
    let primaryActionButtonHTML = '';
    let secondaryActionButtonHTML = ''; // For the WhatsApp button if displayed alongside

    // If requires options, the primary button is "Choose options"
    if (isActionable && requiresOptions) {
        primaryActionButtonHTML = `<button class="action-button btn-blue choose-options-button" data-product-id="${id}">Choose options</button>`;
         // If WhatsApp link exists AND it's also actionable, show WhatsApp button as secondary
        if (isActionable && whatsappLink) {
             secondaryActionButtonHTML = `<button class="action-button btn-green whatsapp-button" data-product-id="${id}" data-whatsapp-link="${whatsappLink}"><i class="fab fa-whatsapp mr-2"></i> Order On WhatsApp</button>`;
        }
    }
    // If doesn't require options AND can be added to cart, the primary button is "Add to cart"
    else if (isActionable && product.addToCartLink && !requiresOptions) { // Check product.addToCartLink and ensure no options are required
        primaryActionButtonHTML = `<button class="action-button btn-blue add-to-cart-button" data-product-id="${id}"><i class="fas fa-cart-plus mr-2"></i> Add to cart</button>`;
         // If WhatsApp link exists AND it's also actionable, show WhatsApp button as secondary
        if (isActionable && whatsappLink) {
             secondaryActionButtonHTML = `<button class="action-button btn-green whatsapp-button" data-product-id="${id}" data-whatsapp-link="${whatsappLink}"><i class="fab fa-whatsapp mr-2"></i> Order On WhatsApp</button>`;
        }
    }
    // If only WhatsApp is available and actionable
    else if (isActionable && whatsappLink && !requiresOptions && !product.addToCartLink) { // Ensure it's WhatsApp only
         primaryActionButtonHTML = `<button class="action-button btn-green whatsapp-button" data-product-id="${id}" data-whatsapp-link="${whatsappLink}"><i class="fab fa-whatsapp mr-2"></i> Order On WhatsApp</button>`;
         // No secondary button in this case
    }
     // If none of the above and not sold out, maybe show a placeholder or nothing (actionButtonsHTML remains empty)

     // If sold out, ensure no buttons are shown (covered by isActionable checks)
     // The sold out overlay is already handled


    // Combine buttons - place primary first, then secondary
    const actionButtonsHTML = primaryActionButtonHTML + secondaryActionButtonHTML;


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
function hideLoginModal() { if (loginModalOverlay) loginModalOverlay.classList.remove('visible'); if (!sideMenu?.classList.contains('open') && !cartContainer?.classList.contains('active') && !productOptionsModalOverlay?.classList.contains('visible')) { document.body.style.overflowY = 'auto'; } } // Restore scroll only if other overlays are closed

// New functions for Product Options Modal
function showOptionsModal(product) {
     if (!productOptionsModalOverlay || !productOptionsModal || !product) return;

     currentProductForOptions = product;
     // Reset selected options to default quantity and base price
     selectedOptions = {
         duration: null,
         quantity: 1,
         price: product.price // Start with base price
     };

     // Populate modal content
     optionsModalProductName.textContent = product.name || 'Product Options';
     // Initially display the base price or 'Contact for Price'
     optionsModalPrice.textContent = typeof product.price === 'number' ? formatPrice(product.price) : product.price;
     optionsModalRating.innerHTML = generateStarRatingHTML(product.rating); // Populate rating

     renderProductOptions(product); // Render the dynamic options

     // Set WhatsApp button link if available
     if (product.whatsappLink && optionsModalWhatsappButton) {
         optionsModalWhatsappButton.style.display = 'flex'; // Show button
         optionsModalWhatsappButton.setAttribute('data-whatsapp-link', product.whatsappLink);
     } else {
         if (optionsModalWhatsappButton) optionsModalWhatsappButton.style.display = 'none'; // Hide button
     }

     // Set See More link (assuming it links to a product details page)
     // You'll need a way to generate product detail page URLs
     if (optionsModalSeeMoreLink) {
          optionsModalSeeMoreLink.href = `#product-details/${product.id}`; // Placeholder link
     }


     productOptionsModalOverlay.classList.add('visible');
     document.body.style.overflowY = 'hidden'; // Prevent body scroll
}

function hideOptionsModal() {
     if (!productOptionsModalOverlay) return;
     productOptionsModalOverlay.classList.remove('visible');
     currentProductForOptions = null; // Clear current product context
     // Restore body scroll only if other overlays are closed
     if (!sideMenu?.classList.contains('open') && !cartContainer?.classList.contains('active') && !loginModalOverlay?.classList.contains('visible')) {
          document.body.style.overflowY = 'auto';
     }
}

function renderProductOptions(product) {
    if (!optionsContainer || !product) return;
    optionsContainer.innerHTML = ''; // Clear existing options

    const fragment = document.createDocumentFragment();

    // Render Option Groups (like Screen Type, Duration)
    if (product.optionGroups && product.optionGroups.length > 0) {
        product.optionGroups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('mb-4', 'option-group');
            groupDiv.setAttribute('data-option-group-name', group.name); // Add data attribute for group name

            const title = document.createElement('h3');
            title.classList.add('text-sm', 'font-semibold', 'mb-2', 'text-gray-400', 'uppercase', 'tracking-wider');
            title.textContent = group.name;
            groupDiv.appendChild(title);

            const choicesContainer = document.createElement('div');
            choicesContainer.classList.add('flex', 'flex-wrap', 'gap-2');

            group.choices.forEach((choice, index) => {
                const choiceButton = document.createElement('button');
                choiceButton.classList.add('duration-option', 'text-sm', 'px-3', 'py-1', 'border', 'border-gray-600', 'rounded', 'hover:bg-gray-600', 'transition-colors');
                choiceButton.textContent = choice.label;
                 // Add data attributes for easier handling
                choiceButton.setAttribute('data-option-value', choice.value);
                choiceButton.setAttribute('data-option-group-name', group.name);
                choiceButton.setAttribute('data-price-modifier', choice.priceModifier !== undefined ? choice.priceModifier : 0);


                // Automatically select the first option in each group
                if (index === 0) {
                    choiceButton.classList.add('active', 'bg-gray-600');
                     // Set the default selected option in global state
                     if (!selectedOptions[group.name]) { // Only set if not already selected
                          selectedOptions[group.name] = choice.value;
                     }
                }
                choicesContainer.appendChild(choiceButton);
            });

            groupDiv.appendChild(choicesContainer);
            fragment.appendChild(groupDiv);
        });
    }

    // Render Quantity Selector
    if (product.showQuantity) {
         const quantityDiv = document.createElement('div');
         quantityDiv.classList.add('mb-4', 'quantity-selector-container'); // Using container class

         const title = document.createElement('h3');
         title.classList.add('text-sm', 'font-semibold', 'mb-2', 'text-gray-400', 'uppercase', 'tracking-wider');
         title.textContent = 'Quantity';
         quantityDiv.appendChild(title);

         const selector = document.createElement('div');
         selector.classList.add('quantity-selector', 'inline-flex');

         const minusButton = document.createElement('button');
         minusButton.classList.add('quantity-button', 'minus', 'bg-gray-600', 'hover:bg-gray-500', 'rounded-l', 'px-3', 'py-1');
         minusButton.textContent = '-';
         selector.appendChild(minusButton);

         const quantityInput = document.createElement('input');
         quantityInput.type = 'number';
         quantityInput.value = selectedOptions.quantity; // Use current selected quantity
         quantityInput.min = '1';
         quantityInput.classList.add('quantity-input', 'w-12', 'text-center', 'bg-gray-700', 'border-t', 'border-b', 'border-gray-600');
         quantityInput.readOnly = true; // Prevent direct input
         selector.appendChild(quantityInput);

         const plusButton = document.createElement('button');
         plusButton.classList.add('quantity-button', 'plus', 'bg-gray-600', 'hover:bg-gray-500', 'rounded-r', 'px-3', 'py-1');
         plusButton.textContent = '+';
         selector.appendChild(plusButton);

         quantityDiv.appendChild(selector);
         fragment.appendChild(quantityDiv);
    }

    optionsContainer.appendChild(fragment);

     // After rendering, update the price based on initial selections
     updateOptionsModalPrice();
}

function updateOptionsModalPrice() {
    if (!currentProductForOptions || !optionsModalPrice) return;

    let calculatedPrice = currentProductForOptions.price; // Start with the base price

    // Apply price modifiers from selected options
    if (currentProductForOptions.optionGroups && currentProductForOptions.optionGroups.length > 0) {
        currentProductForOptions.optionGroups.forEach(group => {
            const selectedValue = selectedOptions[group.name];
            if (selectedValue) {
                const selectedChoice = group.choices.find(choice => choice.value === selectedValue);
                if (selectedChoice && selectedChoice.priceModifier !== undefined) {
                    // Assuming priceModifier is a value to add to the base price
                    calculatedPrice += selectedChoice.priceModifier;
                }
            }
        });
    }

    // Price is also affected by quantity (Total Price = Price per item * Quantity)
     calculatedPrice = calculatedPrice * selectedOptions.quantity;


    selectedOptions.price = calculatedPrice; // Store the calculated price
    optionsModalPrice.textContent = formatPrice(calculatedPrice); // Update displayed price
}


function handleOptionsModalInteraction(event) {
    const button = event.target.closest('button');
    if (!button || !currentProductForOptions) return; // Need a button and a product context

     // Handle Quantity Buttons (+/-)
    if (button.classList.contains('quantity-button')) {
        const quantityInput = productOptionsModal.querySelector('.quantity-input'); // Find the input within the modal
        if (!quantityInput) return;

        let currentValue = parseInt(quantityInput.value);
        if (button.classList.contains('plus')) {
            currentValue++;
        } else if (button.classList.contains('minus') && currentValue > 1) {
            currentValue--;
        }
        quantityInput.value = currentValue;
        selectedOptions.quantity = currentValue; // Update selected quantity
        updateOptionsModalPrice(); // Update price based on new quantity
    }
     // Handle Option Choice Buttons (Duration, Screen Type etc.)
    else if (button.classList.contains('duration-option')) {
         const optionValue = button.dataset.optionValue;
         const optionGroupName = button.dataset.optionGroupName;
         const priceModifier = parseFloat(button.dataset.priceModifier);

         if (optionValue && optionGroupName) {
             // Deselect other options in the same group
             productOptionsModal.querySelectorAll(`.duration-option[data-option-group-name="${optionGroupName}"]`).forEach(opt => {
                 opt.classList.remove('active', 'bg-gray-600');
             });
             // Select the clicked option
             button.classList.add('active', 'bg-gray-600');

             // Update selected options
             selectedOptions[optionGroupName] = optionValue;
             // Note: Price update is handled by updateOptionsModalPrice,
             // which recalculates based on ALL selected options and quantity.
             updateOptionsModalPrice();
         }
    }
     // Handle Add to Cart button
    else if (button.id === 'options-modal-add-to-cart') {
         // Check if required options are selected (e.g., if any option group is mandatory)
         // For now, assuming all options are selected if rendered
         addItemToCart(currentProductForOptions, selectedOptions.quantity, selectedOptions.duration, selectedOptions.price); // Pass all selected options
         hideOptionsModal(); // Close modal after adding to cart
    }
    // Handle Buy it Now button
    else if (button.id === 'options-modal-buy-now') {
         // Implement Buy It Now logic (similar to Add to Cart but proceed directly to checkout)
         console.log("Buy It Now clicked with selected options:", selectedOptions);
          // You might want to add the item to cart first, then redirect to checkout
          // addItemToCart(currentProductForOptions, selectedOptions.quantity, selectedOptions.duration, selectedOptions.price);
          alert("Buy It Now - Proceeding to checkout (placeholder)"); // Placeholder
         hideOptionsModal();
    }
     // Handle Order On WhatsApp button
    else if (button.id === 'options-modal-whatsapp') {
        const whatsappLink = button.dataset.whatsappLink;
        if (whatsappLink) {
            console.log(`Opening WhatsApp link from modal: ${whatsappLink}`);
            window.open(whatsappLink, '_blank'); // Open link in new tab
             // Decide if you want to close the modal after opening WhatsApp
             // hideOptionsModal();
        } else {
             console.warn("WhatsApp link not found for the current product.");
        }
    }
     // Handle See More link click (assuming it's an anchor tag, prevent default if necessary)
    else if (button.id === 'options-modal-see-more' && event.target.tagName === 'A') {
         // Prevent default navigation if you handle routing client-side
         // event.preventDefault();
         console.log("See More clicked for product:", currentProductForOptions);
         // Implement navigation to product details page
         hideOptionsModal(); // Close the modal
    }
}


// --- Banner Slideshow ---
function goToSlide(index) { const slides = bannerSlidesContainer?.querySelectorAll('.banner-slide'); const dots = bannerIndicatorsContainer?.querySelectorAll('.indicator-dot'); if (!slides || slides.length === 0 || !dots || dots.length === 0) return; const numSlides = slides.length; currentSlideIndex = (index + numSlides) % numSlides; const offset = -currentSlideIndex * 100; if (bannerSlidesContainer) bannerSlidesContainer.style.transform = `translateX(${offset}%)`; dots.forEach((dot, i) => { dot.classList.toggle('active', i === currentSlideIndex); dot.classList.toggle('opacity-100', i === currentSlideIndex); dot.classList.toggle('opacity-50', i !== currentSlideIndex); }); }
function showNextSlide() { goToSlide(currentSlideIndex + 1); }
function showPrevSlide() { goToSlide(currentSlideIndex - 1); }
function startSlideShow() { clearInterval(slideInterval); const numSlides = bannerSlidesContainer?.querySelectorAll('.banner-slide').length || 0; if (numSlides > 1) slideInterval = setInterval(showNextSlide, BANNER_INTERVAL_MS); }
function resetSlideInterval() { clearInterval(slideInterval); startSlideShow(); }

// --- Cart Logic ---
// Updated addItemToCart to handle more complex options structure
function addItemToCart(product, quantity = 1, selectedDuration = null, selectedPrice = product.price, selectedOptions = {}) {
     // Find the full product object from the allProducts array (important for latest data)
     const fullProduct = allProducts.find(p => p.id === product.id);
     if (!fullProduct || fullProduct.isSoldOut) {
         console.warn("Attempted to add invalid or sold out product:", product);
         return;
     }

     // Determine the final price based on selected options
     let finalPrice = fullProduct.price; // Start with the base price
      if (fullProduct.optionGroups && fullProduct.optionGroups.length > 0) {
          fullProduct.optionGroups.forEach(group => {
              const selectedValue = selectedOptions[group.name];
              if (selectedValue) {
                  const selectedChoice = group.choices.find(choice => choice.value === selectedValue);
                  if (selectedChoice && selectedChoice.priceModifier !== undefined) {
                       // Apply price modifier - assuming priceModifier is an absolute price *override* for now
                       // If priceModifier is meant to be added: finalPrice += selectedChoice.priceModifier;
                       // Let's assume it's an override for simplicity based on the image showing a fixed price
                        finalPrice = selectedChoice.priceModifier; // Override base price with option price
                  }
              }
          });
      } else if (selectedPrice !== undefined && selectedPrice !== null) {
          // Fallback to explicitly passed selectedPrice if no optionGroups are used
          finalPrice = selectedPrice;
      }

      // Ensure priceToUse is a number
      finalPrice = typeof finalPrice === 'number' ? finalPrice : parseFloat(String(finalPrice).replace(/[^\d.-]/g, '')) || 0;

     // Generate a unique cart item ID based on product ID and selected options
     let cartItemId = fullProduct.id;
     if (fullProduct.optionGroups && fullProduct.optionGroups.length > 0) {
         // Append selected option values to the ID for uniqueness
         Object.keys(selectedOptions).forEach(groupName => {
              if (selectedOptions[groupName]) {
                  cartItemId += `-${groupName.replace(/\s+/g, '-')}-${selectedOptions[groupName].replace(/\s+/g, '-')}`;
              }
         });
     } else if (selectedDuration) { // Keep old duration logic for compatibility if no optionGroups
         cartItemId += `-${selectedDuration.replace(/\s+/g, '-')}`;
     }
     // If only quantity matters and no other options, the base ID is sufficient.


     const existingItemIndex = cartItems.findIndex(item => item.cartItemId === cartItemId);

     if (existingItemIndex > -1) {
         cartItems[existingItemIndex].quantity += quantity;
     } else {
         cartItems.push({
             cartItemId, // Use the generated unique ID
             id: fullProduct.id,
             name: fullProduct.name,
             price: finalPrice, // Use the determined final price
             quantity,
             // Store selected options explicitly if optionGroups are used
             selectedOptions: fullProduct.optionGroups?.length > 0 ? selectedOptions : (selectedDuration ? { 'Duration': selectedDuration } : {}),
             imageUrl: fullProduct.imageUrl,
             selectedDuration: selectedDuration // Keep for compatibility with existing cart rendering if needed
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
    // Note: Featured product button is handled via delegation on its section, which is also a 'product-card' in a sense
     const featuredProductButton = event.target.closest('#featured-buy-now');
    if (!productCard && !featuredProductButton) return;

     // Get the product ID. Prioritize data-product-id on the button, then on the card/featured section.
    const productId = button.dataset.productId || productCard?.dataset.productId || featuredProductButton?.dataset.productId;

    if (!productId) {
         console.warn("Could not find product ID for interaction:", event.target);
         return; // Exit if no product ID is found
    }

    // Find the product data in the global allProducts array using the productId
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.warn("Product data not found in allProducts array for ID:", productId);
        return; // Exit if product data isn't found
    }

    if (button.classList.contains('add-to-cart-button')) {
        // This button is only shown for products *without* inline options or whatsapp link
        // Default quantity is 1, no duration is selected
        addItemToCart(product, 1, null, product.price); // Pass the product object and default options
    } else if (button.classList.contains('choose-options-button')) {
        console.log(`Choose options clicked for product ${productId}`);
        // Show the product options modal
        showOptionsModal(product);
    } else if (button.classList.contains('whatsapp-button')) {
        const whatsappLink = button.dataset.whatsappLink;
        if (whatsappLink) {
            console.log(`Opening WhatsApp link for product ${productId}: ${whatsappLink}`);
            window.open(whatsappLink, '_blank'); // Open link in new tab
        } else {
             console.warn(`WhatsApp link not found for product ${productId}`);
        }
    }
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

    // Update the featured buttons container
    const featuredButtonsContainer = featuredProductSection.querySelector('.featured-buttons');
     if (featuredButtonsContainer) {
         featuredButtonsContainer.innerHTML = ''; // Clear existing buttons

         const isActionable = !product.isSoldOut;
         const requiresOptions = (product.optionGroups?.length > 0 || product.showQuantity); // Check optionGroups now
         const hasAddToCart = product.addToCartLink; // Assuming addToCartLink exists means it can be added to cart
         const hasWhatsApp = product.whatsappLink;

         let primaryButtonHTML = '';
         let secondaryButtonHTML = '';

         // Determine primary button
         if (isActionable && requiresOptions) {
              primaryButtonHTML = `<button id="featured-buy-now" class="action-button btn-blue choose-options-button" data-product-id="${product.id}">Choose options</button>`;
         } else if (isActionable && hasAddToCart && !requiresOptions) { // Ensure it doesn't require options if showing Add to Cart
              primaryButtonHTML = `<button id="featured-buy-now" class="action-button btn-blue add-to-cart-button" data-product-id="${product.id}"><i class="fas fa-cart-plus mr-2"></i> Add to cart</button>`;
         } else if (isActionable && hasWhatsApp && !requiresOptions && !hasAddToCart) { // Ensure it's WhatsApp only if it's the primary action
             primaryButtonHTML = `<button id="featured-buy-now" class="action-button btn-green whatsapp-button" data-product-id="${product.id}" data-whatsapp-link="${product.whatsappLink}"><i class="fab fa-whatsapp mr-2"></i> Order On WhatsApp</button>`;
         } else if (!isActionable) {
             // Product is not actionable (e.g., sold out), no buttons
              primaryButtonHTML = ''; // Explicitly empty
         }


         // Determine secondary button (WhatsApp, if not primary and exists)
         if (isActionable && hasWhatsApp && primaryButtonHTML && !primaryButtonHTML.includes('whatsapp-button')) {
             secondaryButtonHTML = `<button class="action-button btn-green whatsapp-button" data-product-id="${product.id}" data-whatsapp-link="${product.whatsappLink}"><i class="fab fa-whatsapp mr-2"></i> Order On WhatsApp</button>`;
         }

          featuredButtonsContainer.innerHTML = primaryButtonHTML + secondaryButtonHTML;

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
