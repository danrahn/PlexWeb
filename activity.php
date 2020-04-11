<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin(TRUE /*redirect*/, "activity.php");
requireSSL();
?>

<!DOCTYPE html>
<html lang=en-us>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260">
    <title>Activity</title>

    <?php get_css("style", "nav", "table") ?>
    <style>
.newActivity {
    background-color: rgba(63, 100, 69, 0.3);
}
.newActivity:hover {
    background-color: rgba(63, 100, 69, 0.6);
}

    </style>
</head>
<body
    uid="<?= $_SESSION['id']; ?>"
    username="<?= $_SESSION['username']; ?>"
    admin="<?php echo ($_SESSION['level'] >= 100 ? 1 : 0); ?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <div id="container">
            <?php include "includes/table.html" ?>
        </div>
    </div>
</body>
<?php build_js("consolelog", "animate", "common", "queryStatus", "nav", "activity", "tableCommon"); ?>
</html>