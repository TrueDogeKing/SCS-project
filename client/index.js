/**
 * SCS Project - Client
 * Browser-based client for secure communication
 */

// Configuration
const CONFIG = {
    SERVER_URL: "http://localhost:3001",
    TTP_URL: "http://localhost:3002",
};

// Client state
const client = {
    initialized: false,
    keys: null,
    certificate: null,
    sessionKey: null,
};

/**
 * Initialize the client
 */
async function initializeClient() {
    console.log("Initializing client...");
    logOutput("Initializing client...");

    try {
        client.initialized = true;
        logOutput("✓ Client initialized");
        console.log("Client state:", client);
    } catch (error) {
        console.error("Initialization error:", error);
        logOutput("✗ Initialization failed: " + error.message);
    }
}

/**
 * Log output to the UI
 */
function logOutput(message) {
    const outputDiv = document.getElementById("output");
    const timestamp = new Date().toLocaleTimeString();

    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${escapeHtml(message)}`;

    outputDiv.classList.add("show");
    outputDiv.appendChild(logEntry);

    // Scroll to bottom
    outputDiv.scrollTop = outputDiv.scrollHeight;
}

/**
 * Clear output
 */
function clearOutput() {
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML = "";
    outputDiv.classList.remove("show");
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Log that client is ready
console.log("%cSCS Client Ready", "font-size: 16px; font-weight: bold; color: #667eea;");
console.log("Configuration:", CONFIG);
