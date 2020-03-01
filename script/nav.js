(function() {

    getNewActivities();

    document.getElementById("mainMenu").addEventListener("click", function() {
        let menu = document.getElementById("leftMenu");
        if (!menu)
        {
            return;
        }

        expandContractMenu(menu, menu.style.opacity != 1);
    });

    document.getElementById("mainMenu").addEventListener("keyup", function(e) {
        let menu = document.getElementById("leftMenu");
        if (!menu || (e.keyCode != 13 /*enter*/ && e.keyCode != 32/*space*/)) {
            return;
        }

        expandContractMenu(menu, menu.style.opacity != 1);
    });

    setupClicks("pageName", "index.php");
    setupClicks("backToRequests", "requests.php");
    setupClicks("currentPage", document.getElementById("navholder").getAttribute("currentPage"));

    setupClicks("navLogoutTop", "logout.php");
    setupClicks("navRequestsTop", "requests.php");
    setupClicks("navSettingsTop", "user_settings.php");
    setupClicks("navActivityTop", "activity.php");

    setupClicks("navHome", "index.php");
    setupClicks("navNewRequest", "new_request.php");
    setupClicks("navRequests", "requests.php");
    setupClicks("navActivity", "activity.php");
    setupClicks("navMembers", "members.php");
    setupClicks("navUserSettings", "user_settings.php");
    setupClicks("navLogout", "logout.php");
    setupClicks("navGithub", "https://github.com/danrahn/plexweb", true);

    /// <summary>
    /// Get the number of new activities to show
    /// </summary>
    function getNewActivities()
    {
        let activityBtn = document.getElementById("navActivityTop");
        if (!activityBtn)
        {
            return;
        }

        let http = new XMLHttpRequest();
        http.open("POST", "process_request.php", true /*async*/);
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        http.onreadystatechange = function()
        {
            if (this.readyState != 4 || this.status != 200)
            {
                return;
            }

            try
            {
                let response = JSON.parse(this.responseText);
                logInfo(`${response.new} new activities`);

                if (response.Error)
                {
                    logError(response.Error, `Error querying ${url}${queryString}`);
                    return;
                }

                let title = `${response.new == 0 ? "No" : response.new} new notification${response.new == 1 ? "" : "s"}`;
                activityBtn.title = title;
                if (response.new > 0)
                {
                    document.querySelector("#mainMenu").title = "Menu (Shift + M) - " + title;
                    document.querySelector("#navActivity").title = `Notifications (${response.new} new, Shift + A)`;
                    document.querySelectorAll(".activityImg").forEach(function(ele)
                    {
                        ele.classList.add("hasNewActivity");
                    });

                    document.getElementById("activityIndicator").style.display = "block";
                }
                else
                {
                    document.querySelector("#mainMenu").title = "Menu (Shift + M)";
                    document.querySelector("#navActivity").title = `Notifications (Shift + A)`;
                    document.querySelectorAll(".activityImg").forEach(function(ele)
                    {
                        ele.classList.remove("hasNewActivity");
                    });

                    document.getElementById("activityIndicator").style.display = "none";
                }

            }
            catch (ex)
            {
                logError(ex, "Exception");
                logError(ex.stack);
                logError(this.responseText, "Response Text");
            }
        };

        http.send("&type=new_activities");
    }

    /// <summary>
    /// Shows or hides the menu
    /// </summary>
    function expandContractMenu(menu, expand, duration)
    {
        logVerbose((expand ? "Expanding" : "Contracting") + " Menu");
        Animation.queue({"opacity" : (expand ? 1 : 0), "left" : (expand ? "0px" : "-170px")}, menu, duration || 200);
        setEnabled(expand);
    }

    /// <summary>
    /// Setup URL click handlers for the given id, ensuring a middle mouse click
    /// opens in a new tab
    /// </summary>
    function setupClicks(id, url, forceNewWindow)
    {
        let element = document.getElementById(id);
        if (!element)
        {
            return;
        }

        if (forceNewWindow)
        {
            element.addEventListener("click", function() {
                window.open(url, "_blank");
            });
        }
        else
        {
            element.addEventListener("click", function() {
                window.location = url;
            });
        }

        element.addEventListener("auxclick", function(e) {
            if (e.which != 2)
            {
                return;
            }

            window.open(url, "_blank");
        });
    }

    /// <summary>
    /// Set left menu buttons to be enabled/disabled to help with tab navigation
    /// </summary>
    function setEnabled(enabled)
    {
        [
        "navHome",
        "navNewRequest",
        "navRequests",
        "navActivity",
        "navMembers",
        "navUserSettings",
        "navLogout",
        "navGithub"].forEach((element) => enableSingle(element, enabled));
    }

    function enableSingle(id, enabled)
    {
        let element = document.querySelector(`#${id} button`);
        if (element)
        {
            element.disabled = !enabled;
        }
    }

    const KEY =  {
        TAB   : 9,  SPACE : 32,
        ENTER : 13, SHIFT : 16, CTRL  : 17, ALT   : 18, ESC  : 27,
        LEFT  : 37, UP    : 38, RIGHT : 39, DOWN  : 40,
        ZERO  : 48, ONE   : 49, TWO   : 50, THREE : 51, FOUR : 52,
        FIVE  : 53, SIX   : 54, SEVEN : 55, EIGHT : 56, NINE : 57,
        A : 65, B : 66, C : 67, D : 68, E : 69, F : 70, G : 71, H : 72,
        I : 73, J : 74, K : 75, L : 76, M : 77, N : 78, O : 79, P : 80,
        Q : 81, R : 82, S : 83, T : 84, U : 85, V : 86, W : 87, X : 88,
        Y : 89, Z : 90, OPEN_BRACKET : 219, CLOSE_BRACKET : 221
    };

    /// <summary>
    /// Key listener. Escape dismisses the menu, and various other shortcuts
    /// to navigate around pages.
    /// </summary>
    window.addEventListener("keydown", function(e) {
        e = e || window.event;
        const key = e.which || e.keyCode;
        if (key === 27 /*esc*/) {
            let menu = document.getElementById("leftMenu");
            if (menu && menu.style.opacity != 0) {
                expandContractMenu(menu, false);
            }

            return;
        }

        let active = document.activeElement.tagName.toLowerCase();
        if (active == "textarea" || active == "input")
        {
            return;
        }

        if (e.shiftKey && !e.altKey && !e.ctrlKey)
        {
            let target = "";
            switch (key)
            {
                case KEY.H:
                    target = "index.php";
                    break;
                case KEY.R:
                    target = "requests.php";
                    break;
                case KEY.N:
                    target = "new_request.php";
                    break;
                case KEY.S:
                    target = "settings.php";
                    break;
                case KEY.A:
                    target = "activity.php";
                    break;
                case KEY.M:
                {
                    let menu = document.getElementById("leftMenu");
                    expandContractMenu(menu, menu.style.opacity == 0);
                }
                default:
                    break;
            }

            if (target.length > 0)
            {
                window.location = target;
            }
        }
    });

    /// <summary>
    /// If the menu is open and the user clicks anywhere expect the
    /// menu or nav header, dismiss the menu
    /// </summary>
    window.addEventListener("click", function(e) {
        e = e || window.event;
        let element = e.target;
        let parent = element;
        while (parent) {
            if (parent.id == 'leftMenu' || parent.id == 'nav') {
                return;
            }
            parent = parent.parentNode;
        }

        let menu = document.getElementById("leftMenu");
        if (menu && menu.style.opacity != 0) {
            expandContractMenu(menu, false);
        }

    });

    // Keep track of where our touch started
    let touchStart = { "x" : 0, "y" : 0 };

    // Our last known touch position
    let lastMove = { "x" : 0, "y" : 0 };

    // Our total x movement for a single touch event. Used in conjunction with
    // dyTotal to determine whether we should attempt to expand/contract the menu
    let dxTotal = 0;

    // Our total y movement for a single touch event
    let dyTotal = 0;

    // The direction we're moving. 1 for expansion, -1 for contraction, 0 for nothing
    let direction = 0;

    window.addEventListener("touchstart", function(e) {
        touchStart.x = e.touches[0].clientX;
        touchStart.y = e.touches[0].clientY;
        lastMove.x = touchStart.x;
        lastMove.y = touchStart.y;

        let opacity = parseFloat(document.getElementById("leftMenu").style.opacity) || 0;
        if (touchStart.x < 50 && opacity <= 0) {
            direction = 1;
        } else if (touchStart.x >= 100 && opacity > 0) {
            direction = -1;
        } else {
            direction = 0;
        }
    });

    window.addEventListener("touchmove", function(e) {
        if (direction == 0) {
            // Touch didn't start in a valid position. Nothing to do
            return;
        }

        let menu = document.getElementById("leftMenu");

        // Update our total movement
        dxTotal += Math.abs(lastMove.x - e.touches[0].clientX);
        dyTotal += Math.abs(lastMove.y - e.touches[0].clientY);
        let dx = direction * (e.touches[0].clientX - touchStart.x);

        // If we haven't moved a decent amount on the x-axis, or we've moved
        // along the y-axis, do nothing
        if (dx < 20 || dyTotal > dxTotal * 3) {
            return;
        }

        // Expand/contract at a rate 1.3x the movement of the touch
        let diff = (dx - 20) * 1.3;

        if (direction == 1) {
            // Maximizing
            menu.style.opacity = Math.min(1, Math.max(0, 1 - (170 - diff) / 170));
            menu.style.left = "-" + (170 - diff) + "px";
        } else {
            // Minimizing
            menu.style.opacity = Math.max(0, (170 - diff) / 170);
            menu.style.left = "-" + Math.min(170, diff) + "px";
        }

    });

    window.addEventListener("touchend", function() {
        let menu = document.getElementById("leftMenu");
        let dxFinal = dxTotal;
        dxTotal = 0;
        dyTotal = 0;
        if (direction == 0 || dxFinal < 20) {
            return;
        }

        // At the end of the touch, decide if we should fully expand or fully contract
        // the menu. No intermediate states.
        let left = parseInt(menu.style.left) || parseInt(getComputedStyle(menu).left);
        if (isNaN(left)) {
            left = -170;
        }

        let threshold = direction == 1 ? -100 : -60;
        if (left < threshold) {
            let duration = Math.round(((170 - Math.abs(left)) / 170) * 200);
            if (duration != 0) {
                expandContractMenu(menu, false, duration);
            }
        } else {
            let duration = Math.round((Math.abs(left) / 170) * 200);
            if (duration != 0) {
                expandContractMenu(menu, true, duration);
            }
        }

        touchStart = { "time" : 0, "x" : 0, "y" : 0 }; 
    });
})();
