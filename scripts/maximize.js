// Check if we're on a mobile screen (max-width: 960px)
function isMobileScreen() {
    return window.matchMedia("(max-width: 960px)").matches;
}

// Store maximize functions for each window
const windowMaximizeFunctions = new Map();

function maximizeWindow(elmnt) {
    let defaultAttributes = null;
    const toggleButton = elmnt.querySelector(".maximize");
    if (!toggleButton) {
        return;
    }

    function getWindowAttributes() {
        const styles = window.getComputedStyle(elmnt);
        return {
            left: styles.getPropertyValue("left"),
            top: styles.getPropertyValue("top"),
            width: styles.getPropertyValue("width"),
            height: styles.getPropertyValue("height"),
            position: styles.getPropertyValue("position"),
            zIndex: styles.getPropertyValue("z-index"),
            margin: styles.getPropertyValue("margin"),
        };
    }

    function maximize() {
        // Save current attributes if not already saved
        if (!defaultAttributes) {
            defaultAttributes = getWindowAttributes();
        }
        const startBar = document.getElementById("start-bar");
        const barHeight = startBar ? startBar.offsetHeight : 0;
        elmnt.style.left = "0";
        elmnt.style.top = "0";
        // Use 100% on mobile to avoid scrollbar issues, 100vw on desktop
        elmnt.style.width = isMobileScreen() ? "100%" : "100vw";
        elmnt.style.height = `calc(100vh - ${barHeight}px)`;
        elmnt.style.margin = "0";
        elmnt.style.position = "absolute";
        elmnt.style.zIndex = "100";
        elmnt.setAttribute("maximized", "true");
    }

    function restore() {
        const currentDefaults = defaultAttributes || getWindowAttributes();
        elmnt.style.left = currentDefaults.left;
        elmnt.style.top = currentDefaults.top;
        elmnt.style.width = currentDefaults.width;
        elmnt.style.height = currentDefaults.height;
        elmnt.style.position = currentDefaults.position;
        elmnt.style.zIndex = currentDefaults.zIndex;
        elmnt.style.margin = currentDefaults.margin;
        elmnt.setAttribute("maximized", "false");
    }

    function maximizeRestore(e) {
        if (e) {
            e.preventDefault();
        }
        // Disable maximize/restore functionality on mobile screens
        if (isMobileScreen()) {
            return;
        }
        if (elmnt.getAttribute("maximized") === "true") {
            restore();
        } else {
            defaultAttributes = getWindowAttributes();
            maximize();
        }
    }

    // Store the maximize function for external access
    windowMaximizeFunctions.set(elmnt, maximize);

    toggleButton.onmousedown = maximizeRestore;
}

// Initialize all windows
const Windows = document.getElementsByClassName("window");
for (let i = 0; i < Windows.length; i++) {
    Windows[i].setAttribute("maximized", "false");
    maximizeWindow(Windows[i]);
}

// Auto-maximize windows when opened on mobile screens
function setupAutoMaximize() {
    const windowInputs = [
        'windows-ie-input',
        'windows-documents-input',
        'windows-help-input',
        'windows-notepad-input',
        'windows-trash-input'
    ];

    windowInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', function() {
                if (this.checked && isMobileScreen()) {
                    // Find the corresponding window
                    const windowClass = inputId.replace('-input', '').replace('windows-', '');
                    const windowElement = document.querySelector(`.window.${windowClass}`);
                    if (windowElement && windowElement.getAttribute("maximized") !== "true") {
                        // Call maximize function directly
                        const maximizeFn = windowMaximizeFunctions.get(windowElement);
                        if (maximizeFn) {
                            maximizeFn();
                        }
                    }
                }
            });
        }
    });
}

// Disable minimize functionality on mobile screens
function disableMinimizeOnMobile() {
    const minimizeInputs = [
        'windows-ie-input-min',
        'windows-documents-input-min',
        'windows-help-input-min',
        'windows-notepad-input-min',
        'windows-trash-input-min'
    ];

    minimizeInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', function(e) {
                if (isMobileScreen() && this.checked) {
                    // Prevent minimizing on mobile
                    e.preventDefault();
                    this.checked = false;
                }
            });
        }
    });
}

// Setup auto-maximize on page load
setupAutoMaximize();
// Disable minimize on mobile
disableMinimizeOnMobile();

// Also handle window resize to maximize if switching to mobile
window.addEventListener('resize', function() {
    if (isMobileScreen()) {
        // Check all visible windows and maximize them if not already maximized
        const visibleWindows = document.querySelectorAll('.window[style*="display: block"], .window:not([style*="display: none"])');
        visibleWindows.forEach(windowElement => {
            if (windowElement.getAttribute("maximized") !== "true") {
                const maximizeFn = windowMaximizeFunctions.get(windowElement);
                if (maximizeFn) {
                    maximizeFn();
                }
            }
        });
    }
});

