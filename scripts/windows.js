const draggableWindows = document.getElementsByClassName("window");
for (let i = 0; i < draggableWindows.length; i++) {
    dragElement(draggableWindows[i]);
}

function attachOrderFocus(elmnt, handle) {
    const known = ["ie", "documents", "help", "notepad", "trash"];
    const matched = known.find(cls => elmnt.classList.contains(cls));
    if (!matched) {
        return;
    }
    const orderInput = document.getElementById(`windows-${matched}-input-on-top`);
    const visibilityInput = document.getElementById(`windows-${matched}-input`);
    [elmnt, handle].forEach(node => {
        if (!node) {
            return;
        }
        node.addEventListener("mousedown", () => {
            if (orderInput) {
                orderInput.checked = true;
            }
            if (visibilityInput) {
                visibilityInput.checked = true;
            }
        });
    });
}

function dragElement(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = elmnt.querySelector(".header");
    if (header) {
        header.onmousedown = dragMouseDown;
        header.style.cursor = "move";
        elmnt.style.left = window.getComputedStyle(elmnt).getPropertyValue("left");
        elmnt.style.top = window.getComputedStyle(elmnt).getPropertyValue("top");
        attachOrderFocus(elmnt, header);
    }

    function dragMouseDown(e) {
        if (elmnt.getAttribute("maximized") === "false") {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const elemW = elmnt.offsetWidth;
        const elemH = elmnt.offsetHeight;
        const startBar = document.getElementById("start-bar");
        const barHeight = startBar ? startBar.offsetHeight : 0;
        const maxLeft = screenW - elemW - 4;
        const maxTop = screenH - elemH - barHeight - 4;
        const minLeft = 0;
        const minTop = 0;
        let newLeft = parseFloat(elmnt.style.left) - pos1;
        let newTop = parseFloat(elmnt.style.top) - pos2;
        if (newLeft < minLeft) {
            newLeft = minLeft;
        } else if (newLeft > maxLeft) {
            newLeft = maxLeft;
        }
        if (newTop < minTop) {
            newTop = minTop;
        } else if (newTop > maxTop) {
            newTop = maxTop;
        }
        elmnt.style.top = `${newTop}px`;
        elmnt.style.left = `${newLeft}px`;
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function isMobileScreen() {
    return window.matchMedia("(max-width: 960px)").matches;
}

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
        if (!defaultAttributes) {
            defaultAttributes = getWindowAttributes();
        }
        const startBar = document.getElementById("start-bar");
        const barHeight = startBar ? startBar.offsetHeight : 0;
        elmnt.style.left = "0";
        elmnt.style.top = "0";
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

    windowMaximizeFunctions.set(elmnt, maximize);
    toggleButton.onmousedown = maximizeRestore;
}

const Windows = document.getElementsByClassName("window");
for (let i = 0; i < Windows.length; i++) {
    Windows[i].setAttribute("maximized", "false");
    maximizeWindow(Windows[i]);
}

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
                    const windowClass = inputId.replace('-input', '').replace('windows-', '');
                    const windowElement = document.querySelector(`.window.${windowClass}`);
                    if (windowElement && windowElement.getAttribute("maximized") !== "true") {
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
                    e.preventDefault();
                    this.checked = false;
                }
            });
        }
    });
}

setupAutoMaximize();
disableMinimizeOnMobile();

window.addEventListener('resize', function() {
    if (isMobileScreen()) {
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