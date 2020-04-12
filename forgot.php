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
    <title>Reset Password</title>
    <?php get_css("style", "overlay") ?>
</head>
<body>

<div id="plexFrame">
    <div id="container">
        <div id="forgot" class="formContainer">
            <div class="formTitle">Forgot your password? &nbsp; <span style="float: right; font-size: smaller">(<a href="login.php">Login</a>)</span></div>
            <form id="forgotForm">
                <hr />
                <div class="formInput"><label for="username">Username: </label><input type="text" name="username" id="username"></div>
                <div class="formInput"><input type="button" value="Continue" id="go"></input></div>
            </form>
            <hr />
            <div><a href="#" style="float:right;font-size:smaller" id="forgotUser">Forgot your username?</a></div>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
<?php build_js("forgot", "consolelog", "animate", "common", "overlay") ?>
</body>
</html>