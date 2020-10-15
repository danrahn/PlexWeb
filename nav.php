<div id="navholder" currentPage="<?php $_SERVER['REQUEST_URI'] ?>">
<div id="nav" plex_host="<?= PUBLIC_PLEX_HOST ?>">
    <div id="mainMenu" class="leftbutton" tabindex=1 title="Menu (Shift + M)">
        <div class="ham"></div>
        <div class="ham"></div>
        <div class="ham"></div>
        <div id="activityIndicator"></div>
    </div>
    <div id="navShort">
        <div class="navButton rightbutton" id="navLogoutTop" title="Logout">
            <div class=btnimg><image src='<?php icon('logout') ?>' alt='Logout' style='margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navSettingsTop" title="Settings (Shift + S)">
            <div class=btnimg><image src='<?php icon('settings') ?>' alt='Settings' style='margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navRequestsTop" title="Requests (Ctrl + R)">
            <div class=btnimg><image src='<?php icon('requests') ?>' alt='Requests' style='margin-top:8px'/></div>
        </div>
        <div class="navButton rightbutton" id="navActivityTop">
            <div class=btnImg><image src='<?php icon('bell') ?>' alt='Activity' class="activityImg" style='margin-top:8px;height:24px'/></div>
        </div>
    </div>
    <button id="pageName" class="navPageInfo" title="Home (Shift + H)">Home</button>
    <?php
        if ($_SERVER['REQUEST_URI'] != '/plex/index.php' &&
            $_SERVER['REQUEST_URI'] != '/plex/')
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
    <?php if ($location == "Library" || $location == "Password Reset") { ?>
    <div class="navPageInfo">&#x2192;</div>
    <button class="navPageInfo pageDetail" id="backToAdmin">Administration</button>
    <?php } else { ?>
    <div class="navPageInfo">&#x2192;</div>
    <button class="navPageInfo pageDetail" id="currentPage"><?= $location ?></button>
    <?php } } ?>
</div>
</div>
<div id="leftMenu">
    <div class="navButton" id="navHome" title="Home (Shift + H)">
        <button class=btntxt disabled=true>Home</button>
        <div class=btnimg><image src='<?php icon('home') ?>' alt='Home'/></div>
    </div>
    <div class="navButton rightbutton" id="navNewRequest" title="New Request (Shift + N)">
        <button class=btntxt disabled=true>New Request</button>
        <div class=btnimg><image src='<?php icon('new_request') ?>' alt='NewRequest'/></div>
    </div>
    <div class="navButton" id="navRequests" title="Requests (Shift + R)">
        <button class=btntxt disabled=true>Requests</button>
        <div class=btnimg><image src='<?php icon('requests') ?>' alt='Requests'/></div>
    </div>
    <div class="navButton" id="navActivity" title="Notifications (Shift + A)">
        <button class=btntxt disabled=true>Notifications</button>
        <div class=btnimg><image class='activityImg' src='<?php icon('bell') ?>' alt='Notifications'/></div>
    </div>
    <div class="navButton" id="navPlex" title="Plex Desktop (Shift + P)">
        <button class=btntxt disabled=true>Go to Plex</button>
        <div class=btnimg><image src='<?php icon('plex') ?>' alt='Plex'/></div>
    </div>
<?php if (UserLevel::is_admin()) { ?>
    <div class="navButton" id="navMembers" title="Members">
        <button class=btntxt disabled=true>Members</button>
        <div class=btnimg><image src='<?php icon('members') ?>' alt='Members'/></div>
    </div>
<?php } ?>
    <div class="navButton rightbutton" id="navUserSettings" title="Settings (Shift + S)">
        <button class=btntxt disabled=true>Settings</button>
        <div class=btnimg><image src='<?php icon('settings') ?>' alt='Settings'/></div>
    </div>
<?php if (UserLevel::is_admin()) { ?>
    <div class="navButton rightbutton" id="navAdmin" title="Admin">
        <button class=btntxt disabled=true>Admin</button>
        <div class=btnimg><image src='<?php icon('admin') ?>' alt='Admin' /></div>
    </div>
<?php } ?>
    <div class="navButton" id="navLogout" title='Logout'>
        <button class=btntxt disabled=true>Logout</button>
        <div class=btnimg><image src='<?php icon('logout') ?>' alt='Logout'/></div>
    </div>
    <div class="navButton" id="navGithub" title='GitHub'>
        <button class=btntxt disabled=true>Source Code</button>
        <div class=btnimg><image src='<?php icon('Github') ?>' alt='Github'/></div>
    </div>
</div>