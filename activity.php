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

    <?php get_css("style", "nav", "overlay", "table", "tooltip") ?>
    <style>
.newActivity {
    background-color: rgba(63, 100, 69, 0.3);
}
.newActivity:hover {
    background-color: rgba(63, 100, 69, 0.6);
}
#tooltip {
    font-size: smaller;
}


    </style>
</head>
<body
    uid="<?= $_SESSION['id']; ?>"
    username="<?= $_SESSION['username']; ?>"
    admin="<?php echo (UserLevel::is_admin() ? 1 : 0); ?>">
    <div id="plexFrame">
        <?php include "nav.php" ?>
        <div id="container">
            <div style='margin-top: 50px; overflow: auto'></div>
            <?php include "includes/table.html" ?>
        </div>
    </div>
</body>
<?php build_js("activity", "consolelog", "animate", "common", "queryStatus", "nav", "DateUtil", "overlay", "tableCommon", "tooltip"); ?>
</html>