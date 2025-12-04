// Get computed styles from CSS custom properties
const root = getComputedStyle(document.documentElement);

// Configuration object for each umbrella color
// Contains theme class, image path, and button color for each variant
const umbrellaConfig = {
  pink: {
    theme: "theme-pink",
    imageSrc: "assets/images/Pink umbrella.png",
    buttonColor: root.getPropertyValue("--pink-btn").trim(),
  },
  blue: {
    theme: "theme-blue",
    imageSrc: "assets/images/Blue umbrella.png",
    buttonColor: root.getPropertyValue("--blue-btn").trim(),
  },
  yellow: {
    theme: "theme-yellow",
    imageSrc: "assets/images/Yello umbrella.png",
    buttonColor: root.getPropertyValue("--yellow-btn").trim(),
  },
};

// Application state
// Tracks current color selection, uploaded logo data, and filename
const state = {
  currentColor: "blue",
  uploadedLogo: null,
  uploadedFileName: "",
};

// DOM element references
const domElements = {
  body: document.body,
  umbrellaImage: document.getElementById("umbrellaImage"),
  loaderOverlay: document.getElementById("loaderOverlay"),
  loaderIcon: document.querySelector("#loaderIcon path"),
  colorSwatches: document.querySelectorAll(".color-swatch"),
  uploadButton: document.getElementById("uploadButton"),
  fileInput: document.getElementById("fileInput"),
  fileDisplay: document.getElementById("fileDisplay"),
  fileName: document.getElementById("fileName"),
  removeButton: document.getElementById("removeButton"),
  logoOverlay: document.getElementById("logoOverlay"),
  logoPreview: document.getElementById("logoPreview"),
  //   logoAnnotation: document.getElementById("logoAnnotation"),
  errorMessage: document.getElementById("errorMessage"),
};

// Initialize the application
function init() {
  setupEventListeners();
  updateUI();
}

function setupEventListeners() {
  // Color swatch click handlers
  domElements.colorSwatches.forEach((swatch) => {
    swatch.addEventListener("click", handleColorChange);
  });

  // Upload button triggers file input
  domElements.uploadButton.addEventListener("click", () => {
    domElements.fileInput.click();
  });

  // File input change handler
  domElements.fileInput.addEventListener("change", handleFileUpload);

  // Remove button click handler
  domElements.removeButton.addEventListener("click", handleLogoRemove);
}

// Handle color swatch selection
function handleColorChange(event) {
  const selectedColor = event.currentTarget.getAttribute("data-color");

  // Prevent unnecessary updates if same color is clicked
  if (selectedColor === state.currentColor) {
    return;
  }

  // Update current color in state
  state.currentColor = selectedColor;

  // Get configuration for selected color
  const config = umbrellaConfig[selectedColor];

  domElements.uploadButton.style.backgroundColor = config.buttonColor;
  domElements.fileDisplay.style.backgroundColor = config.buttonColor;
  domElements.loaderIcon.style.fill = config.buttonColor;

  // Update active state on color swatches
  domElements.colorSwatches.forEach((swatch) => {
    swatch.classList.remove("active");
  });
  event.currentTarget.classList.add("active");

  updateTheme();
  updateUmbrellaImage();
}

// Update the page theme based on selected color
function updateTheme() {
  const config = umbrellaConfig[state.currentColor];

  domElements.body.className = "";

  domElements.body.classList.add(config.theme);
}

// Update the umbrella image with loading animation
function updateUmbrellaImage() {
  const config = umbrellaConfig[state.currentColor];

  showUmbrellaLoader();

  // Simulate loading delay for better UX (800ms)
  setTimeout(() => {
    domElements.umbrellaImage.src = config.imageSrc;

    domElements.umbrellaImage.onload = () => {
      hideUmbrellaLoader();
    };

    domElements.umbrellaImage.onerror = () => {
      hideUmbrellaLoader();
    };
  }, 800);
}

// Show loading overlay on umbrella preview
function showUmbrellaLoader() {
  domElements.umbrellaImage.classList.add("hidden");
  domElements.loaderOverlay.classList.add("visible");
  domElements.logoOverlay.classList.remove("visible");
  //   domElements.logoAnnotation.classList.add("hidden");
}

// Hide loading overlay on umbrella preview
function hideUmbrellaLoader() {
  domElements.umbrellaImage.classList.remove("hidden");
  domElements.loaderOverlay.classList.remove("visible");

  if (state.uploadedLogo) {
    domElements.logoOverlay.classList.add("visible");
  } else {
    // domElements.logoAnnotation.classList.remove("hidden");
  }
}

// Handle file upload from file input
function handleFileUpload(event) {
  const file = event.target.files[0];

  hideError();

  if (!file) {
    return;
  }

  // Validate file type (only PNG and JPG allowed)
  const validTypes = ["image/png", "image/jpeg", "image/jpg"];
  if (!validTypes.includes(file.type)) {
    showError("Please upload a .png or .jpg file only.");
    domElements.fileInput.value = "";
    return;
  }

  // Validate file size (5MB = 5 * 1024 * 1024 bytes)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showError("File size must be less than 5MB.");
    domElements.fileInput.value = "";
    return;
  }

  showLoading(file.name);
  showUmbrellaLoader();

  const reader = new FileReader();

  reader.onload = function (e) {
    // Store logo data in state
    state.uploadedLogo = e.target.result;
    state.uploadedFileName = file.name;

    // Simulate processing delay for better UX (600ms)
    setTimeout(() => {
      displayLogo();
      hideLoading();
      hideUmbrellaLoader();
    }, 600);
  };

  // Handle file reading errors
  reader.onerror = function () {
    showError("Error reading file. Please try again.");
    hideLoading();
    hideUmbrellaLoader();
    domElements.fileInput.value = "";
  };

  reader.readAsDataURL(file);
}

// Display uploaded logo on umbrella
function displayLogo() {
  domElements.logoPreview.src = state.uploadedLogo;

  domElements.logoOverlay.classList.add("visible");
  //   domElements.logoAnnotation.classList.add("hidden");

  domElements.fileName.textContent = state.uploadedFileName.toUpperCase();
  domElements.fileDisplay.style.backgroundColor =
    umbrellaConfig[state.currentColor].buttonColor; // Add this line
}

// Handle logo removal
function handleLogoRemove() {
  state.uploadedLogo = null;
  state.uploadedFileName = "";

  domElements.fileInput.value = "";

  updateUI();
  hideError();
}

// Show loading state during file upload
function showLoading(filename) {
  domElements.fileName.textContent = filename.toUpperCase();
  domElements.uploadButton.style.display = "none";
  domElements.fileDisplay.classList.add("visible");
  domElements.removeButton.style.visibility = "hidden";

  domElements.fileDisplay.style.backgroundColor =
    umbrellaConfig[state.currentColor].buttonColor;
}

// Hide loading state after upload completes
function hideLoading() {
  domElements.removeButton.style.visibility = "visible";
}

function showError(message) {
  domElements.errorMessage.textContent = message;
  domElements.errorMessage.classList.add("visible");
}

function hideError() {
  domElements.errorMessage.classList.remove("visible");
  domElements.errorMessage.textContent = "";
}

// Update UI based on current state
function updateUI() {
  if (state.uploadedLogo) {
    domElements.uploadButton.style.display = "none";
    domElements.fileDisplay.classList.add("visible");
    domElements.logoOverlay.classList.add("visible");
    // domElements.logoAnnotation.classList.add("hidden");
  } else {
    domElements.uploadButton.style.display = "flex";
    domElements.fileDisplay.classList.remove("visible");
    domElements.logoOverlay.classList.remove("visible");
    // domElements.logoAnnotation.classList.remove("hidden");
  }
}

// Initialize app when DOM is fully loaded
document.addEventListener("DOMContentLoaded", init);
