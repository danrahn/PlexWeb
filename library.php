<?php

session_start();


require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin();
$admin_page = TRUE;
if (!UserLevel::is_admin())
{
    error_and_exit(403);
}
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Library Management</title>
    <?php build_css() ?>
    <style>
#sections {
    margin-top: 50px;
    color: #c1c1c1;
}

input[type=button] {
    float: none;
}

#tooltip {
    font-size: smaller;
}
    </style>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <div style='margin-top: 50px; overflow: auto'></div>
        <?php include "includes/table.html" ?>
    </div>
</div>
<?php build_js(); ?>
</body>
</html>