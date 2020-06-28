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
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3C5260">
    <title>Activity</title>

    <?php build_css() ?>
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
<?php build_js(); ?>
</html>