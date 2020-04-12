<?php

session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin();
if ($_SESSION['level'] < 100)
{
    error_and_exit(403);
}
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Administration</title>
    <?php get_css("style", "nav") ?>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="resetContainer">
            <div id="manual_reset" class="formContainer" style="width:50%;min-width:500px">
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
<?php build_js("password_reset", "consolelog", "animate", "queryStatus", "nav"); ?>
</body>
</html>