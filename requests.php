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
    <?php get_css("style", "nav", "table", "requests"); ?>
</head>

<body isAdmin="<?= (isset($_SESSION['level']) && $_SESSION['level'] >= 100) ? 1 : 0 ?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <div id="container">
            <?php include "includes/table.html" ?>
        </div>
    </div>
</body>
<?php build_js("requests", "consolelog", "queryStatus", "animate", "common", "nav", "tableCommon") ?>
</html>