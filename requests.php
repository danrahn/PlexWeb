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
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260">
    <title>Plex Requests</title>

    <!-- Inline stylesheets to reduce network roundtrip costs -->
    <?php get_css("style", "nav", "table", "overlay", "tooltip", "requests"); ?>
</head>

<body isAdmin="<?= (UserLevel::is_admin()) ? 1 : 0 ?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <div id="container">
            <h2 id="welcome">Requests</h2>
            <h3 id="requestSearch">Results for "<span id="searchTerm"></span>"<img src="<?php icon('exit') ?>" id="clearSearch" alt="Clear" title="Clear Search"></h3>
            <?php include "includes/table.html" ?>
        </div>
    </div>
</body>
<?php build_js("requests", "consolelog", "queryStatus", "animate", "common", "nav", "DateUtil", "tableCommon", "overlay", "tooltip", "iconMap") ?>
</html>