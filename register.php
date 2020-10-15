<?php

session_start();

require_once "includes/common.php";
requireSSL();
ieCheck();

$success = 0;
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
    <title>Plex Status: Register</title>
    <?php build_css(); ?>
</head>
<body>

<div id="plexFrame">
    <div id="container">
        <div id="register" class="formContainer">
            <div id="registerSuccess" style="display: none;"></div>
            <div class="formTitle">Register (<a href="login.php">login</a>)</div>
            <form id="registerForm" action="<?php echo htmlspecialchars($_SERVER['PHP_SELF']) ?>" method="POST">
                <hr />
                <div class="formInput">
                    <label for="username">Username: </label>
                    <input type="text" name="username" autocomplete="username">
                </div>
                <hr />
                <div class="formInput">
                    <label for="password">Password: </label>
                    <input type="password" name="password" autocomplete="new-password">
                </div>
                <div class="formInput" style="display: none">
                    <label for="confirm">Confirm Password: </label>
                    <input type="password" name="confirm" autocomplete="new-password">
                </div>
                <hr />
                <div class="formInput"><input type="button" value="Register" id="go"></input></div>
            </form>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
<?php build_js(); ?>
</body>