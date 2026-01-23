const Windows = document.getElementsByClassName("window");
for (let i = 0; i < Windows.length; i++) {
    Windows[i].setAttribute("maximized", "false");
    maximizeWindow(Windows[i]);
}

function maximizeWindow(elmnt) {
    let defaultAttributes = null;
    const toggleButton = elmnt.querySelector(".maximize");
    if (!toggleButton) {
        return;
    }
    toggleButton.onmousedown = maximizeRestore;

    function maximizeRestore(e) {
        e.preventDefault();
        if (elmnt.getAttribute("maximized") === "true") {
            restore();
        } else {
            defaultAttributes = getWindowAttributes();
            maximize();
        }
    }

    function maximize() {
        const startBar = document.getElementById("start-bar");
        const barHeight = startBar ? startBar.offsetHeight : 0;
        elmnt.style.left = "0";
        elmnt.style.top = "0";
        elmnt.style.width = "100%";
        elmnt.style.height = `calc(100% - ${barHeight}px)`;
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
        elmnt.setAttribute("maximized", "false");
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
        };
    }
}

