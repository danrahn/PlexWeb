<?php

session_start();

require_once "includes/common.php";
requireSSL();
ieCheck();

if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === TRUE)
{
    header("location: index.php");
    exit;
}
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Plex Status: Login</title>
    <?php get_css("style") ?>
</head>
<body>

<div id="plexFrame">
    <div id="container">
        <div id="login" class="formContainer">
            <div class="formTitle">Login (<a href="register.php">register</a>)</div>
            <form id="loginForm">
                <div class="formInput"><label for="username">Username: </label><input type="text" name="username" id="username"></div>
                <hr />
                <div class="formInput"><label for="password">Password: </label><input type="password" name="password" id="password"></div>
                <hr />
                <div class="formInput"><input type="button" value="Login" id="go"></input></div>
            </form>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
<?php get_js("consolelog", "animate", "login"); ?>
</body>
</html>