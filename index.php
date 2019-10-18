<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin(true);
requireSSL();

$file = 'index.php';
$last_modified_time = filemtime($file); 
$etag = md5_file($file); 

header("Last-Modified: ".gmdate("D, d M Y H:i:s", $last_modified_time)." GMT"); 
header("Etag: $etag");

$plex_ok = does_plex_exist();

function does_plex_exist()
{
    return !!(@get_headers(PLEX_SERVER));
}

function get_plex_status($class)
{
    global $plex_ok;
    if ($class)
    {
        print ($plex_ok ? 'statusOk' : 'statusBad');
    }
    else
    {
        print($plex_ok ? 'Plex is running!' : 'Unable to find the plex server!');
    }
}

function get_username()
{
    global $db;
    $userid = $_SESSION['id'];
    $query = "SELECT firstname, lastname FROM user_info WHERE userid=$userid";
    $result = $db->query($query);
    if (!$result)
    {
        return $_SESSION["username"];
    }

    $row = $result->fetch_row();
    $result->close();
    if (empty($row[0]))
    {
        return $_SESSION["username"];
    }

    return $row[0] . ' ' . $row[1];
}
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="shortcut icon" href="favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <script src="resource/consolelog.js"></script>
    <script src="resource/min/animate.min.js"></script>
    <title>Plex Status</title>
</head>
<body>
<script>
function plexOk()
{
    return <?= does_plex_exist() ? 'true' : 'false'; ?>;
}
</script>
<script src="resource/script.js"></script>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <h3 id="welcome">Welcome <?= get_username() ?></h3>
    <h1 id="header" class=<?= get_plex_status(true /*class*/) ?>><?= get_plex_status(false) ?></h1>
    <div id="container">
        <h2 id="active">Active Streams: <span id="activeNum">loading...</span></h2>
        <div id="mediaentries">
        </div>
        <div id="actions">
            <div class="action actionLeft">
                <a href="new_request.php" class="actionLink">
                    <img src="resource/new_request.png" class="actionImg" style="filter: invert(80)">
                    <span>New Request</span>
                </a>
            </div>
            <div class="action actionRight">
                <a href="requests.php" class="actionLink">
                    <img src="resource/requests_large.png" class="actionImg" style="filter: invert(80)">
                    <span>View Requests</span>
                </a>
            </div>
            <div class="action actionRight">
                <a href="user_settings.php" class="actionLink">
                    <img src="resource/settings_large.png" class="actionImg" style="filter: invert(80)">
                    <span>Settings</span>
                </a>
            </div>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
    <div id="tooltip"></div>
</div>
</body>
</html>