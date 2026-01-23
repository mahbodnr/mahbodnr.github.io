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
