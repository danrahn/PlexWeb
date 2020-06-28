/// <summary>
/// Contains handlers for displaying and interacting with the main site menu
/// </summary>

getNewActivities();

/// <summary>
/// Hamburger menu click handler to expand or contract the left-hand menu
/// </summary>
$("#mainMenu").addEventListener("click", function()
{
    let menu = $("#leftMenu");
    if (!menu)
    {
        return;
    }

    expandContractMenu(menu, menu.style.opacity != 1);
});

/// <summary>
/// Handler to expand or contract the menu on enter/space
/// </summary>
$("#mainMenu").addEventListener("keyup", function(e)
{
    let menu = $("#leftMenu");
    if (!menu || (e.keyCode != KEY.ENTER && e.keyCode != KEY.SPACE))
    {
        return;
    }

    expandContractMenu(menu, menu.style.opacity != 1);
});

setupClicks("pageName", "index.php");
setupClicks("backToRequests", "requests.php");
setupClicks("backToAdmin", "administration.php");
setupClicks("currentPage", $("#navholder").getAttribute("currentPage"));

setupClicks("navLogoutTop", "logout.php");
setupClicks("navRequestsTop", "requests.php");
setupClicks("navSettingsTop", "user_settings.php");
setupClicks("navActivityTop", "activity.php");

setupClicks("navHome", "index.php");
setupClicks("navNewRequest", "new_request.php");
setupClicks("navRequests", "requests.php");
setupClicks("navActivity", "activity.php");
setupClicks("navPlex", "https://app.plex.tv/desktop", true);
setupClicks("navMembers", "members.php");
setupClicks("navUserSettings", "user_settings.php");
setupClicks("navAdmin", "administration.php");
setupClicks("navLogout", "logout.php");
setupClicks("navGithub", "https://github.com/danrahn/plexweb", true);

/// <summary>
/// Get the number of new activities to show
/// </summary>
function getNewActivities()
{
    let activityBtn = $("#navActivityTop");
    if (!activityBtn)
    {
        return;
    }

    let successFunc = function(response)
    {
        let title = `${response.new == 0 ? "No" : response.new} new notification${response.new == 1 ? "" : "s"} (Shift + A)`;
        activityBtn.title = title;
        if (response.new > 0)
        {
            $("#mainMenu").title = "Menu (Shift + M) - " + title;
            $("#navActivity").title = `Notifications (${response.new} new, Shift + A)`;
            $(".activityImg").forEach(function(ele)
            {
                ele.src = Icons.getColor("bell", "d15211");
            });

            $("#activityIndicator").style.display = "block";
        }
        else
        {
            $("#mainMenu").title = "Menu (Shift + M)";
            $("#navActivity").title = `Notifications (Shift + A)`;
            $(".activityImg").forEach(function(ele)
            {
                ele.src = Icons.get("bell");
            });

            $("#activityIndicator").style.display = "none";
        }
    };

    sendHtmlJsonRequest("process_request.php", { type : ProcessRequest.NewActivities }, successFunc);
}

/// <summary>
/// Shows or hides the menu
/// </summary>
function expandContractMenu(menu, expand, duration)
{
    logVerbose((expand ? "Expanding" : "Contracting") + " Menu");
    Animation.queue({ opacity : (expand ? 1 : 0), left : (expand ? "0px" : "-170px") }, menu, duration || 200);
    setEnabled(expand);
}

/// <summary>
/// Setup URL click handlers for the given id, ensuring a middle mouse click
/// opens in a new tab
/// </summary>
function setupClicks(id, url, forceNewWindow)
{
    let element = $("#" + id);
    if (!element)
    {
        return;
    }

    if (forceNewWindow)
    {
        element.addEventListener("click", function()
        {
            window.open(url, "_blank");
        });
    }
    else
    {
        element.addEventListener("click", function()
        {
            window.location = url;
        });
    }

    element.addEventListener("auxclick", function(e)
    {
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
        "navPlex",
        "navMembers",
        "navUserSettings",
        "navAdmin",
        "navLogout",
        "navGithub"
    ].forEach((element) => enableSingle(element, enabled));
}

/// <summary>
/// Enables or disables a single button
/// </summary>
function enableSingle(id, enabled)
{
    let element = $$(`#${id} button`);
    if (element)
    {
        element.disabled = !enabled;
    }
}

/// <summary>
/// Window keydown event handler to process
/// potential keyboard shortcuts
/// </summary>
function tryNavKeyDispatch(key)
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
            target = "user_settings.php";
            break;
        case KEY.A:
            target = "activity.php";
            break;
        case KEY.M:
        {
            let menu = $("#leftMenu");
            expandContractMenu(menu, menu.style.opacity == 0);
            break;
        }
        case KEY.P:
            target = "https://app.plex.tv/desktop";
            break;
        default:
            break;
    }

    if (target.length > 0)
    {
        if (target.startsWith("http"))
        {
            // Open external links in a new tab
            window.open(target, "_blank");
        }
        else
        {
            window.location = target;
        }
    }
}

/// <summary>
/// Key listener. Escape dismisses the menu, and various other shortcuts
/// to navigate around pages.
/// </summary>
window.addEventListener("keydown", function(e)
{
    e = e || window.event;
    const key = e.which || e.keyCode;
    if (key === KEY.ESC)
    {
        let menu = $("#leftMenu");
        if (menu && menu.style.opacity != 0)
        {
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
        tryNavKeyDispatch(key);
    }
});

/// <summary>
/// If the menu is open and the user clicks anywhere expect the
/// menu or nav header, dismiss the menu
/// </summary>
window.addEventListener("click", function(e)
{
    e = e || window.event;
    let element = e.target;
    let parent = element;
    while (parent)
    {
        if (parent.id == "leftMenu" || parent.id == "nav")
        {
            return;
        }

        parent = parent.parentNode;
    }

    let menu = $("#leftMenu");
    if (menu && menu.style.opacity != 0)
    {
        expandContractMenu(menu, false);
    }

});

// Keep track of where our touch started
let touchStart = { x : 0, y : 0 };

// Our last known touch position
let lastMove = { x : 0, y : 0 };

// Our total x movement for a single touch event. Used in conjunction with
// dyTotal to determine whether we should attempt to expand/contract the menu
let dxTotal = 0;

// Our total y movement for a single touch event
let dyTotal = 0;

// The direction we're moving. 1 for expansion, -1 for contraction, 0 for nothing
let direction = 0;

/// <summary>
/// Capture touchstart to set up our swipe gesture handling
/// </summary>
window.addEventListener("touchstart", function(e)
{
    touchStart.x = e.touches[0].clientX;
    touchStart.y = e.touches[0].clientY;
    lastMove.x = touchStart.x;
    lastMove.y = touchStart.y;

    let opacity = parseFloat($("#leftMenu").style.opacity) || 0;
    if (touchStart.x < 50 && opacity <= 0)
    {
        direction = 1;
    }
    else if (touchStart.x >= 100 && opacity > 0)
    {
        direction = -1;
    }
    else
    {
        direction = 0;
    }
});

/// <summary>
/// Keep track of where the user swipes, opening or closing the left menu
/// based on their action
/// </summary>
window.addEventListener("touchmove", function(e)
{
    if (direction == 0)
    {
        // Touch didn't start in a valid position. Nothing to do
        return;
    }

    let menu = $("#leftMenu");

    // Update our total movement
    dxTotal += Math.abs(lastMove.x - e.touches[0].clientX);
    dyTotal += Math.abs(lastMove.y - e.touches[0].clientY);
    let dx = direction * (e.touches[0].clientX - touchStart.x);

    // If we haven't moved a decent amount on the x-axis, or we've moved
    // along the y-axis, do nothing
    if (dx < 20 || dyTotal > dxTotal * 3)
    {
        return;
    }

    // Expand/contract at a rate 1.3x the movement of the touch
    let diff = (dx - 20) * 1.3;

    if (direction == 1)
    {
        // Maximizing
        menu.style.opacity = Math.min(1, Math.max(0, 1 - (170 - diff) / 170));
        menu.style.left = "-" + (170 - diff) + "px";
    }
    else
    {
        // Minimizing
        menu.style.opacity = Math.max(0, (170 - diff) / 170);
        menu.style.left = "-" + Math.min(170, diff) + "px";
    }

});

/// <summary>
/// When the user ends their gesture, determine whether to fully
/// expand or contract the menu
/// </summary>
window.addEventListener("touchend", function()
{
    let menu = $("#leftMenu");
    let dxFinal = dxTotal;
    dxTotal = 0;
    dyTotal = 0;
    if (direction == 0 || dxFinal < 20)
    {
        return;
    }

    // At the end of the touch, decide if we should fully expand or fully contract
    // the menu. No intermediate states.
    let left = parseInt(menu.style.left) || parseInt(getComputedStyle(menu).left);
    if (isNaN(left))
    {
        left = -170;
    }

    let threshold = direction == 1 ? -100 : -60;
    if (left < threshold)
    {
        let duration = Math.round(((170 - Math.abs(left)) / 170) * 200);
        if (duration != 0)
        {
            expandContractMenu(menu, false, duration);
        }
    }
    else
    {
        let duration = Math.round((Math.abs(left) / 170) * 200);
        if (duration != 0)
        {
            expandContractMenu(menu, true, duration);
        }
    }

    touchStart = { time : 0, x : 0, y : 0 };
});
