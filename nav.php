<div id="navholder">
<div id="nav">
    <div id="mainMenu" class="leftbutton">
        <div class="ham"></div>
        <div class="ham"></div>
        <div class="ham"></div>
    </div>
    <div id="navShort">
        <div class="navButton rightbutton" id="navLogoutTop">
            <div class=btnimg><image src='resource/logout.png' alt='Logout' style='filter: invert(80%);margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navRequestsTop">
            <div class=btnimg><image src='resource/requests.png' alt='Requests' style='filter: invert(80%);margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navSettingsTop">
            <div class=btnimg><image src='resource/settings.png' alt='Settings' style='filter: invert(80%);margin-top:8px'/></div>
        </div>
    </div>
    <button id="pageName" class="navPageInfo">Plex Web</button>
    <?php
        if ($_SERVER['REQUEST_URI'] != '/plexweb/index.php' &&
            $_SERVER['REQUEST_URI'] != '/plexweb/')
        {
            $location = $_SERVER['REQUEST_URI'];
            $start = strrpos($location, '/') + 1;
            $end = strrpos($location, '.');
            $location = ucwords(str_replace('_', ' ', substr($location, $start, $end - $start)));
    ?>
    <?php if ($location == "Request") {?>
    <div class="navPageInfo">&#x2192;</div>
    <button class="navPageInfo pageDetail" id="backToRequests">Requests</button>
    <?php } ?>
    <div class="navPageInfo">&#x2192;</div>
    <button class="navPageInfo pageDetail" id="currentPage"><?= $location ?></button>
    <?php } ?>
</div>
</div>
<div id="leftMenu">
    <div class="navButton" id="navHome">
        <button class=btntxt>Home</button>
        <div class=btnimg><image src='resource/home.png' alt='Home' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton rightbutton" id="navNewRequest">
        <button class=btntxt>New Request</button>
        <div class=btnimg><image src='resource/new_request.png' alt='NewRequest' style='filter: invert(80%);'/></div>
    </div>
<?php if (isset($_SESSION['level']) && (int)$_SESSION['level'] >= 100) { ?>
    <div class="navButton" id="navMembers">
        <button class=btntxt>Members</button>
        <div class=btnimg><image src='resource/members.png' alt='Home' style='filter: invert(80%);'/></div>
    </div>
<?php } ?>
    <div class="navButton rightbutton" id="navUserSettings">
        <button class=btntxt>Settings</button>
        <div class=btnimg><image src='resource/settings.png' alt='Settings' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton" id="navRequests">
        <button class=btntxt>Requests</button>
        <div class=btnimg><image src='resource/requests.png' alt='Requests' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton" id="navLogout">
        <button class=btntxt>Logout</button>
        <div class=btnimg><image src='resource/logout.png' alt='Logout' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton" id="navGithub">
        <button class=btntxt>Source Code</button>
        <div class=btnimg><image src='resource/github.png' alt='Github' style='filter: invert(80%);'/></div>
    </div>
</div>
<script>
(function() {
    document.getElementById("mainMenu").addEventListener("click", function() {
        let menu = document.getElementById("leftMenu");
        if (menu) {
            if (menu.style.opacity == "1") {
                logVerbose("Contracting Menu");
                Animation.queue({"opacity" : 0, "left": "-170px"}, menu, 200);
            } else {
                logVerbose("Expanding menu");
                Animation.queue({"opacity" : 1, "left" : "0px"}, menu, 200);
            }
        }
    });

    setupClicks("pageName", "index.php");
    setupClicks("backToRequests", "requests.php");
    setupClicks("currentPage", "<?= $_SERVER['REQUEST_URI'] ?>");

    setupClicks("navLogoutTop", "logout.php");
    setupClicks("navRequestsTop", "requests.php");
    setupClicks("navSettingsTop", "user_settings.php");

    setupClicks("navHome", "index.php");
    setupClicks("navNewRequest", "new_request.php");
    setupClicks("navMembers", "members.php");
    setupClicks("navUserSettings", "user_settings.php");
    setupClicks("navRequests", "requests.php");
    setupClicks("navLogout", "logout.php");
    setupClicks("navGithub", "https://github.com/danrahn/plexweb", true);


    function setupClicks(id, url, forceNewWindow)
    {
        let element = document.getElementById(id);
        if (!element)
        {
            return;
        }

        if (forceNewWindow)
        {
            element.addEventListener("click", function(e) {
                window.open(url, "_blank");
            });
        }
        else
        {
            element.addEventListener("click", function(e) {
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

    window.addEventListener("keydown", function(e) {
        e = e || window.event;
        const key = e.which || e.keyCode;
        if (key === 27 /*esc*/) {
            let menu = document.getElementById("leftMenu");
            if (menu && menu.style.opacity != 0) {
                Animation.queue({"opacity" : 0, "left": "-170px"}, menu, 200);
            }
        }
    });

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
            Animation.queue({"opacity" : 0, "left": "-170px"}, menu, 200);
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
        let visible = !!menu.style.opacity;

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
            menu.style.opacity = Math.max(0, 1 - (170 - diff) / 170);
            menu.style.left = "-" + (170 - diff) + "px";
        } else {
            // Minimizing
            menu.style.opacity = Math.max(0, (170 - diff) / 170);
            menu.style.left = "-" + Math.min(170, diff) + "px";
        }

    });

    window.addEventListener("touchend", function(e) {
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
                Animation.queue({"opacity" : 0, "left": "-170px"}, menu, duration);
            }
        } else {
            let duration = Math.round((Math.abs(left) / 170) * 200);
            if (duration != 0) {
                Animation.queue({"opacity" : 1, "left": "0px"}, menu, duration);
            }
        }

        touchStart = { "time" : 0, "x" : 0, "y" : 0 }; 
    });
})();
</script>