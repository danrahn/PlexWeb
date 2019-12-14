<div id="navholder" currentPage="<?php $_SERVER['REQUEST_URI'] ?>">
<div id="nav">
    <div id="mainMenu" class="leftbutton" tabindex=1>
        <div class="ham"></div>
        <div class="ham"></div>
        <div class="ham"></div>
    </div>
    <div id="navShort">
        <div class="navButton rightbutton" id="navLogoutTop">
            <div class=btnimg><image src='icon/logout.png' alt='Logout' style='filter: invert(80%);margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navRequestsTop">
            <div class=btnimg><image src='icon/requests.png' alt='Requests' style='filter: invert(80%);margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navSettingsTop">
            <div class=btnimg><image src='icon/settings.png' alt='Settings' style='filter: invert(80%);margin-top:8px'/></div>
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
        <button class=btntxt disabled=true>Home</button>
        <div class=btnimg><image src='icon/home.png' alt='Home' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton rightbutton" id="navNewRequest">
        <button class=btntxt disabled=true>New Request</button>
        <div class=btnimg><image src='icon/new_request.png' alt='NewRequest' style='filter: invert(80%);'/></div>
    </div>
<?php if (isset($_SESSION['level']) && (int)$_SESSION['level'] >= 100) { ?>
    <div class="navButton" id="navMembers">
        <button class=btntxt disabled=true>Members</button>
        <div class=btnimg><image src='icon/members.png' alt='Home' style='filter: invert(80%);'/></div>
    </div>
<?php } ?>
    <div class="navButton rightbutton" id="navUserSettings">
        <button class=btntxt disabled=true>Settings</button>
        <div class=btnimg><image src='icon/settings.png' alt='Settings' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton" id="navRequests">
        <button class=btntxt disabled=true>Requests</button>
        <div class=btnimg><image src='icon/requests.png' alt='Requests' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton" id="navLogout">
        <button class=btntxt disabled=true>Logout</button>
        <div class=btnimg><image src='icon/logout.png' alt='Logout' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton" id="navGithub">
        <button class=btntxt disabled=true>Source Code</button>
        <div class=btnimg><image src='icon/github.png' alt='Github' style='filter: invert(80%);'/></div>
    </div>
</div>
<?php get_js("nav") ?>