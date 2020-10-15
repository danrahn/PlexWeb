<?php
session_start();
require_once "includes/config.php";
require_once "includes/common.php";

requireSSL();
verify_loggedin(TRUE /*redirect*/, "requests.php");

?>

<!DOCTYPE html>
<html lang=en-us>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260">
    <title>Plex Requests</title>

    <?php build_css(); ?>
</head>

<body isAdmin="<?= (UserLevel::is_admin()) ? 1 : 0 ?>"
    plex_host="<?= PUBLIC_PLEX_HOST ?>"
    plex_nav="<?= PUBLIC_PLEX_NAV ?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <div id="container">
            <h2 id="welcome">Requests</h2>
            <?php include "includes/table.html" ?>
        </div>
    </div>
</body>
<?php build_js() ?>
</html>