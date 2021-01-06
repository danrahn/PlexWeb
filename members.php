<?php
session_start();

require_once "includes/config.php";
require_once "includes/common.php";
verify_loggedin(true);
requireSSL();

if (!UserLevel::is_admin())
{
    error_and_exit(401);
}

?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta charset="utf-8">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Plex Status: Members</title>
    <?php build_css(); ?>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div style='margin-top: 50px; overflow: auto'></div>
        <?php include "includes/table.html" ?>
    </div>
</div>
</body>
<?php build_js(); ?>
</html>