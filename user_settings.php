<?php
session_start();
require_once "includes/common.php";
verify_loggedin(TRUE /*redirect*/, "user_settings.php");
requireSSL();
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>User Settings</title>
    <?php build_css("style", "nav"); ?>
    <style>
#formError {
  background-color: rgb(100, 66, 69);
  color: #c1c1c1;
  border-radius: 5px;
  text-align: center;
  opacity: 0;
  width: 30%;
  max-width: 400px;
  margin-top: 20px;
  display: none;
}

#formStatus {
    opacity: 0;
}

input[type=checkbox] {
    appearance: none;
    -webkit-appearance: none;
    padding: 7px;
    display: inline-block;
    position: relative;
}

input[type=checkbox]:checked {
    background-color: rgb(192, 189, 186);
}

input[type=checkbox]:focus {
    outline: none;
    border: 1px solid rgb(255, 127, 0);
}

input[type=button] {
    padding: 10px;
}

.forNotify {
    background: rgba(63, 100, 69, 0.5);
}

.forNotify:hover {
    background: rgba(63, 100, 69, 0.8);
}

    </style>
</head>
<body fornotify="<?php echo try_get('fornotify') ?>">
<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="info" class="formContainer">
            <div class="formTitle">User Information and Settings</div>
            <form id="infoForm">
                <hr />
                <div class="formInput"><label for="firstname" id="firstnamelabel">First Name: </label><input type="text" name="firstname" id="firstname" maxlength=1280></div>
                <div class="formInput"><label for="lastname" id="lastnamelabel">Last Name: </label><input type="text" name="lastname" id="lastname" maxlength=128></div>
                <hr />
                <div class="formInput"><label for="email" id="emaillabel" maxlength=256>Email: </label><input type="text" name="email" id="email"></div>
                <div class="formInput hiddenInput"><label for="emailalerts" id="emailalertslabel">Receive email alerts: </label><input type="checkbox" name="emailalerts" id="emailalerts"></div>
                <hr />
                <div class="formInput"><label for="phone" id="phonelabel">Phone number: </label><input type="text" name="phone" id="phone"></div>
                <div class="formInput"><label for="carrier" id="carrierlabel">Phone carrier: </label>
                    <select name="carrier" id="carrier">
                        <option value="verizon">Verizon</option>
                        <option value="att">AT&T</option>
                        <option value="tmobile">T-Mobile</option>
                        <option value="sprint">Sprint</option>
                    </select>
                </div>
                <div class="formInput hiddenInput"><label for="phonealerts" id="phonealertslabel">Receive text alerts: </label><input type="checkbox" name="phonealerts" id="phonealerts"></div>
                <hr />
                <div class="formInput"><input type="button" value="Update" id="go"></input></div>
            </form>
        </div>
        <div id="formError" class="formContainer">...</div>
        <div id="pwReset" class="formContainer">
            <div class="formTitle">Change Password</div>
            <form id="pwForm">
                <hr />
                <div class="formInput"><label for="oldPass" id="oldPassLabel">Old Password: </label><input type="password" name="oldPass" id="oldPass"></div>
                <hr />
                <div class="formInput"><label for="newPass" id="newPassLabel">New Password: </label><input type="password" name="newPass" id="newPass"></div>
                <div class="formInput"><label for="newPassConf" id="newPassConfLabel">Confirm Password: </label><input type="password" name="newPassConf" id="newPassConf"></div>
                <div class="formInput"><input type="button" value="Change" id="pwGo"></input></div>
            </form>
        </div>
        <div id="formStatus" class="formContainer">...</div>
    </div>
</div>
</body>
<?php build_js(); ?>
</html>
