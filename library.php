<?php

session_start();


require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin();
$admin_page = TRUE;
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
    <title>Library Management</title>
    <?php get_css("style", "nav", "table") ?>
    <style>
#sections {
    margin-top: 50px;
    color: #c1c1c1;
}

input[type=button] {
    float: none;
}
    </style>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <?php include "includes/table.html" ?>
    </div>
</div>
<?php build_js("consolelog", "animate", "common", "querystatus", "nav", "library", "tableCommon"); ?>
</body>
</html>