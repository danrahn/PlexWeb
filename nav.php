<div id="navholder" currentPage="<?php $_SERVER['REQUEST_URI'] ?>">
<div id="nav">
    <div id="mainMenu" class="leftbutton" tabindex=1 title="Menu (Shift + M)">
        <div class="ham"></div>
        <div class="ham"></div>
        <div class="ham"></div>
    </div>
    <div id="navShort">
        <div class="navButton rightbutton" id="navLogoutTop">
            <div class=btnimg><image src='icon/logout.png' alt='Logout' style='filter: invert(80%);margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navRequestsTop" title="Requests (Ctrl + R)">
            <div class=btnimg><image src='icon/requests.png' alt='Requests' style='filter: invert(80%);margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navSettingsTop" title="Settings (Shift + S)">
            <div class=btnimg><image src='icon/settings.png' alt='Settings' style='filter: invert(80%);margin-top:8px'/></div>
        </div>
    </div>
    <?php if ($_SESSION['level'] >= 100) { ?>
    <div class="navButton rightbutton" id="navActivityTop">
        <div class=btnImg><image src='icon/bell.png' alt='Activity' id="activityImg" style='margin-top:8px;height:24px'/></div>
    </div>
<?php } ?>
    <button id="pageName" class="navPageInfo" title="Home (Shift + H)">Plex Web</button>
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
    <div class="navButton" id="navHome" title="Home (Shift + H)">
        <button class=btntxt disabled=true>Home</button>
        <div class=btnimg><image src='icon/home.png' alt='Home' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton rightbutton" id="navNewRequest" title="New Request (Shift + N)">
        <button class=btntxt disabled=true>New Request</button>
        <div class=btnimg><image src='icon/new_request.png' alt='NewRequest' style='filter: invert(80%);'/></div>
    </div>
<?php if (isset($_SESSION['level']) && (int)$_SESSION['level'] >= 100) { ?>
    <div class="navButton" id="navMembers">
        <button class=btntxt disabled=true>Members</button>
        <div class=btnimg><image src='icon/members.png' alt='Home' style='filter: invert(80%);'/></div>
    </div>
<?php } ?>
    <div class="navButton rightbutton" id="navUserSettings" title="Settings (Shift + S)">
        <button class=btntxt disabled=true>Settings</button>
        <div class=btnimg><image src='icon/settings.png' alt='Settings' style='filter: invert(80%);'/></div>
    </div>
    <div class="navButton" id="navRequests" title="Requests (Shift + R)">
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