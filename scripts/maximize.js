//Make the DIV element draggagle:
var Windows = document.getElementsByClassName("window");
for (var i = 0; i < Windows.length; i++) {
    Windows[i].setAttribute('maximized', false)
    maximizeWindow(Windows[i]);
}

function maximizeWindow(elmnt) {
    var defaultAttributes = getWindowAttributes();
    elmnt.querySelector(".maximize").onmousedown = maximize_restore;

    function maximize_restore(e) {
        console.log("maximized", elmnt.getAttribute("maximized"))
        if (elmnt.getAttribute("maximized") == "true") {
            console.log("restoring")
            restore(defaultAttributes);
        } else {
            console.log("maximizing")
            maximize();
        }
    }

    function maximize() {
        // Adjust css of the window to fill the screen
        elmnt.style.left = "-0.5rem";
        elmnt.style.top = "0.1%";
        elmnt.style.width = "100%";
        elmnt.style.height = "calc(100% - 3.75rem)";
        elmnt.style.position = "absolute";
        elmnt.style.zIndex = "100";
        elmnt.setAttribute('maximized', true);
    }

    function restore(defaultAttributes) {
        console.log("defaultAttributes", defaultAttributes)
        // Restore css attributes
        elmnt.style.left = defaultAttributes.left;
        elmnt.style.top = defaultAttributes.top;
        elmnt.style.width = defaultAttributes.width;
        elmnt.style.height = defaultAttributes.height;
        elmnt.style.position = defaultAttributes.position;
        elmnt.style.zIndex = defaultAttributes.zIndex;
        elmnt.setAttribute('maximized', false);
    }

    function getWindowAttributes() {
        return {
            left: window.getComputedStyle(elmnt).getPropertyValue("left"),
            top: window.getComputedStyle(elmnt).getPropertyValue("top"),
            width: window.getComputedStyle(elmnt).getPropertyValue("width"),
            height: window.getComputedStyle(elmnt).getPropertyValue("height"),
            position: window.getComputedStyle(elmnt).getPropertyValue("position"),
            zIndex: window.getComputedStyle(elmnt).getPropertyValue("z-index"),
        };
    }
}

