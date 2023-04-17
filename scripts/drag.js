//Make the DIV element draggagle:
var draggableWindows = document.getElementsByClassName("window");
for (var i = 0; i < draggableWindows.length; i++) {
    dragElement(draggableWindows[i]);
}

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (elmnt.querySelector(".header")) {
        /* if present, the header is where you move the DIV from:*/
        elmnt.querySelector(".header").onmousedown = dragMouseDown;
        elmnt.style.left = window.getComputedStyle(elmnt).getPropertyValue("left");
        elmnt.style.top = window.getComputedStyle(elmnt).getPropertyValue("top");
    } else {
        /* otherwise, move the DIV from anywhere inside the DIV:*/
        // elmnt.onmousedown = dragMouseDown;
        console.log("No header found for " + elmnt.id);
    }

    function dragMouseDown(e) {
        if (elmnt.getAttribute("maximized") == "false") {
            e = e || window.event;
            e.preventDefault();
            // get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        }
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // calculate the minimum and maximum positions for the element:
        var screenW = window.innerWidth;
        var screenH = window.innerHeight;
        var elemW = elmnt.offsetWidth;
        var elemH = elmnt.offsetHeight;
        var maxLeft = 0.99 * screenW - elemW;
        var maxTop = 0.95 * screenH - elemH;
        var minLeft = 0;
        var minTop = 0;
        // restrict the element to the bounds of the screen:
        var newLeft = parseFloat(elmnt.style.left) - pos1;
        var newTop = parseFloat(elmnt.style.top) - pos2;
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
        elmnt.style.top = newTop + "px";
        elmnt.style.left = newLeft + "px";
    }

    function closeDragElement() {
        /* stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
    }
}
