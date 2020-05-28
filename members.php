<?php
session_start();

require_once "includes/config.php";
require_once "includes/common.php";
verify_loggedin(true);
requireSSL();

if ((int)$_SESSION['level'] < 100)
{
    error_and_exit(401);
}

?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Plex Status: Members</title>
    <?php get_css("style", "nav", "request"); ?>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div id="welcome">Loading Member List...</div>
        <div class="tableHolder">
        </div>
    </div>
</div>
</body>
<?php build_js("members", "common", "consolelog", "animate", "nav"); ?>
</html>