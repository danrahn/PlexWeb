<?php

session_start();

require_once "includes/common.php";
require_once "includes/config.php";
requireSSL();
ieCheck();

if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === TRUE)
{
    header("location: index.php");
    exit;
}

$token = try_get("token");
if (!$token)
{
    header("location: forgot.php");
    exit;
}

$valid = validate_request($token);

function validate_request($token)
{
    global $db;
    $query = "SELECT user_id, CONVERT_TZ(timestamp, @@session.time_zone, '+00:00') AS `utc_timestamp` FROM `password_reset` WHERE token='$token'";

    $result = $db->query($query);
    if (!$result || $result->num_rows != 1)
    {
        return -1;
    }

    $row = $result->fetch_assoc();
    $timestamp = new DateTime($row['utc_timestamp']);
    $now = new DateTime(date('Y-m-d H:i:s'));
    $diff = $now->getTimestamp() - $timestamp->getTimestamp();
    if ($diff < 0 || $diff > 20 * 60) // 20 minute timeout
    {
        return 0;
    }

    $id = $row['user_id'];
    $query = "SELECT `token` FROM `password_reset` WHERE `user_id`=$id ORDER BY `timestamp` DESC";
    $result = $db->query($query);
    if ($result && $result->fetch_row()[0] != $token)
    {
        return -2;
    }

    return 1;
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
<body valid="<?= $valid ?>" token="<?= $token ?>">

<div id="plexFrame">
    <div id="container">
        <div id="reset" class="formContainer">
            <div class="formTitle">Password Reset<span style="float: right; font-size: smaller">(<a href="login.php">Login</a>)</span></div>
            <form id="resetForm">
                <hr />
                <div class="formInput"><label for="password">New Password: </label><input type="password" name="password" id="password"></div>
                <div class="formInput"><label for="confirm">Confirm Password: </label><input type="password" name="confirm" id="confirm"></div>
                <div class="formInput"><input type="button" value="Reset Password" id="go"></input></div>
            </form>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
<?php build_js("reset", "consolelog", "animate", "common", "overlay"); ?>
</body>
</html>