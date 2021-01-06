<?php
session_start();
require_once "includes/common.php";
require_once "includes/config.php";
verify_loggedin(TRUE /*redirect*/, "user_settings.php");
requireSSL();
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta charset="utf-8">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>User Settings</title>
    <?php build_css(); ?>
</head>
<body fornotify="<?php echo try_get('fornotify') ?>">
<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="info" class="formContainer">
            <div class="formTitle">User Information and Settings</div>
            <form id="infoForm">
                <hr />
                <div class="formInput">
                    <label for="firstname" id="firstnamelabel">First Name: </label>
                    <input type="text" name="firstname" id="firstname" maxlength=1280 autocomplete="given-name">
                </div>
                <div class="formInput">
                    <label for="lastname" id="lastnamelabel">Last Name: </label>
                    <input type="text" name="lastname" id="lastname" maxlength=128 autocomplete="family-name">
                </div>
                <hr />
                <div class="formInput">
                    <label for="email" id="emaillabel" maxlength=256>Email: </label>
                    <input type="text" name="email" id="email" autocomplete="email">
                </div>
                <div class="formInput hiddenInput">
                    <label for="emailalerts" id="emailalertslabel">Receive email alerts: </label>
                    <input type="checkbox" name="emailalerts" id="emailalerts">
                </div>
                <hr />
                <div class="formInput">
                    <label for="phone" id="phonelabel">Phone number: </label>
                    <input type="text" name="phone" id="phone" autocomplete="tel-national">
                </div>
                <div class="formInput">
                    <label for="carrier" id="carrierlabel">Phone carrier: </label>
                    <select name="carrier" id="carrier">
                        <option value="verizon">Verizon</option>
                        <option value="att">AT&T</option>
                        <option value="tmobile">T-Mobile</option>
                        <option value="sprint">Sprint</option>
                    </select>
                </div>
                <div class="formInput hiddenInput">
                    <label for="phonealerts" id="phonealertslabel">Receive text alerts: </label>
                    <input type="checkbox" name="phonealerts" id="phonealerts">
                </div>
                <hr />
                <div class="formInput"><input type="button" value="Update" id="go"></input></div>
            </form>
        </div>
        <div id="formError" class="formContainer">...</div>
        <div id="pwReset" class="formContainer">
            <div class="formTitle">Change Password</div>
            <form id="pwForm">
                <hr />
                <label style="display:none" for="passUsername">Username</label>
                <input hidden="1" type="text" id="passUsername" name="username" autocomplete="username">
                <div class="formInput">
                    <label for="oldPass" id="oldPassLabel">Old Password: </label>
                    <input type="password" name="oldPass" id="oldPass" autocomplete="current-password">
                </div>
                <hr />
                <div class="formInput">
                    <label for="newPass" id="newPassLabel">New Password: </label>
                    <input type="password" name="newPass" id="newPass" autocomplete="new-password">
                </div>
                <div class="formInput">
                    <label for="newPassConf" id="newPassConfLabel">Confirm Password: </label>
                    <input type="password" name="newPassConf" id="newPassConf" autocomplete="new-password">
                </div>
                <div class="formInput"><input type="button" value="Change" id="pwGo"></input></div>
            </form>
        </div>
        <div id="formStatus" class="formContainer">...</div>
    </div>
</div>
</body>
<?php build_js(); ?>
</html>
