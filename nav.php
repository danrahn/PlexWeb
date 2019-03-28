<style>
#nav {
    width: 100%;
    height: 40px;
    background-color: #2E5E3E;
    opacity: 0.8;
    position: fixed;
    left: 0;
    top: 0;
}

#nav button {
    height: 100%;
    background-color: #2E5E3E;
    color: #C1C1C1;
    font-weight: bold;
    padding-left: 10px;
    padding-right: 10px;
    border: none;
}

#nav .leftbutton {
    border-right: 2px solid #808080;
    float: left;
}

#nav .rightbutton {
    border-left: 2px solid #808080;
    float: right;
}

#navholder button:hover, #mainMenu:hover, #pageName:hover {
    background-color: #0E3E1E;
}

.ham {
    width: 30px;
    height: 5px;
    background-color: #c1c1c1;
    margin-top: 5px;
}

#mainMenu {
    height: 37px;
    padding: 3px 10px 0 10px;
    margin: auto;
}

#mainMenu:hover .ham {
    background-color: #A1A1A1;
}

#leftMenu {
    background-color: rgb(46, 94, 62);
    color: #C1C1C1;
    width: 169px;
    height: calc(100vh - 40px);
    position: absolute;
    top: 40px;
    left: -170px;
    border-right: 1px solid #808080;
    z-index: 1;
}

#leftMenu button {
    height: 35px;
    width: 100%;
    background-color: transparent;
    color: #C1C1C1;
    font-weight: bold;
    padding-left: 15px;
    padding-right: 15px;
    border: none;
    font-size: 12pt;
    line-height: 35px;
    border-bottom: 2px solid #808080;
}

.btnimg {
    float: right;
}

.btntxt {
    float: left;
}

#pageName {
    color: #c1c1c1;
    float: left;
    display: inline-block;
    vertical-align: center;
    line-height: 40px;
    padding: 0 10px;
    font-size: 14pt;
    cursor: pointer;
}

#pageName:hover {
    color: #a1a1a1;
}

@media all and (orientation: portrait) and (max-width: 767px) {
    #navShort {
        display: none;
    }
}
</style>
<div id="navholder">
<div id="nav">
    <div id="mainMenu" class="leftbutton">
        <div class="ham"></div>
        <div class="ham"></div>
        <div class="ham"></div>
    </div>
    <div id="navShort">
        <button class="rightbutton" onclick="window.location = 'logout.php'">
            <div class=btnimg><image src='resource/logout.png' alt='Logout' height=24px style='filter: invert(80%);margin-top:3px'/></div>
        </button>
        <button class="rightbutton"onclick="window.location = 'view_requests.php'">
            <div class=btnimg><image src='resource/requests.png' alt='Requests' height=24px style='filter: invert(80%);margin-top:3px'/></div>
        </button>
        <button class="rightbutton" onclick="window.location = 'user_settings.php'">
            <div class=btnimg><image src='resource/settings.png' alt='Settings' height=24px style='filter: invert(80%);margin-top:3px'/></div>
        </button>
    </div>
    <div id="pageName" onclick="window.location = 'index.php'">Plex Web</button>
</div>
</div>
<div id="leftMenu">
    <button onclick="window.location = 'index.php'">
        <div class=btntxt>Home</div>
        <div class=btnimg><image src='resource/home.png' alt='Home' height=24px style='filter: invert(80%);margin-top:3px'/></div>
    </button>
<?php if (isset($_SESSION['level']) && (int)$_SESSION['level'] >= 100) { ?>
    <button onclick="window.location = 'members.php'">
        <div class=btntxt>Members</div>
        <div class=btnimg><image src='resource/members.png' alt='Home' height=24px style='filter: invert(80%);margin-top:3px'/></div>
    </button>
<?php } ?>
    <button class="rightbutton" onclick="window.location = 'user_settings.php'">
        <div class=btntxt>Settings</div>
        <div class=btnimg><image src='resource/settings.png' alt='Settings' height=24px style='filter: invert(80%);margin-top:3px'/></div>
    </button>
    <button onclick="window.location = 'view_requests.php'">
        <div class=btntxt>Requests</div>
        <div class=btnimg><image src='resource/requests.png' alt='Requests' height=24px style='filter: invert(80%);margin-top:3px'/></div>
    </button>
    <button onclick="window.location = 'logout.php'">
        <div class=btntxt>Logout</div>
        <div class=btnimg><image src='resource/logout.png' alt='Logout' height=24px style='filter: invert(80%);margin-top:3px'/></div>
    </button>
    <button onclick="window.open('https://github.com/danrahn/plexweb', '_blank')">
        <div class=btntxt>Source Code</div>
        <div class=btnimg><image src='resource/github.png' alt='Github' height=24px style='filter: invert(80%);margin-top:3px'/></div>
    </button>
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