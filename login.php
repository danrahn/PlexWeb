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
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Plex Status: Login</title>
    <?php build_css() ?>
</head>
<body>

<div id="plexFrame">
    <div id="container">
        <div id="login" class="formContainer">
            <div class="formTitle">Login (<a href="register.php">register</a>)</div>
            <form id="loginForm">
                <hr />
                <div class="formInput">
                    <label for="username">Username: </label>
                    <input type="text" name="username" id="username" autocomplete="username">
                </div>
                <div class="formInput">
                    <label for="password">Password: </label>
                    <input type="password" name="password" id="password" autocomplete="current-password">
                </div>
                <div class="formInput"><input type="button" value="Login" id="go" style="padding:5px"></input></div>
                <hr />
                <div><a href="forgot.php" style="float:right; font-size: smaller">Forgot your password?</a></div>
            </form>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
<?php build_js(); ?>
</body>
</html>