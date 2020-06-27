<?php

session_start();

require_once "includes/common.php";
require_once "includes/config.php";

if (!UserLevel::is_admin())
{
    error_and_exit(403);
}
verify_loggedin();
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Password Reset</title>
    <?php build_css("style", "nav") ?>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="resetContainer">
            <div id="manual_reset" class="formContainer">
                <div class="formTitle">Manual User Password Reset</div>
                <form id="resetForm">
                    <div class="formInput"><label for="username">Username: </label><input type="text" name="username" id="username"></div>
                    <div class="formInput"><label for="email">Email: </label><input type="text" name="email" id="email"></div>
                    <div class="formInput"><input type="button" value="Go" id="go" style="float:right"></input></div>
                </form>
            </div>
            <div id="formStatus" class="formContainer"></div>
        </div>
    </div>
</div>
<?php build_js(); ?>
</body>
</html>