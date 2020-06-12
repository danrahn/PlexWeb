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
    // Apache and Plex are on the same machine so a
    // timeout of 0.1 seconds should be more than enough
    $socket =@ fsockopen(PLEX_HOST, PLEX_PORT, $errno, $errstr, 0.1);
    if ($socket)
    {
        fclose($socket);
        return true;
    }

    return false;
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
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Plex Status</title>
    <?php get_css("style", "nav", "overlay", "actions", "tooltip", "index") ?>
</head>
<body plexok="<?php echo does_plex_exist() ? "1" : "0" ?>">
<script>
</script>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <h3 id="welcome">Welcome <?= get_username() ?></h3>
    <h1 id="header" class=<?= get_plex_status(true /*class*/) ?>><?= get_plex_status(false) ?></h1>
    <div id="container">
        <h2 id="active"><span id="activeText">Active Streams: <span id="activeNum">loading...</span></span></h2>
        <div id="mediaentries">
        </div>
        <div id="actions">
            <div class="action">
                <a href="new_request.php" class="actionLink">
                    <img src="<?php icon('new_request') ?>" class="actionImg" alt="New Request">
                    <span>New Request</span>
                </a>
            </div>
            <div class="actionSpacer"></div>
            <div class="action">
                <a href="requests.php" class="actionLink">
                    <img src="<?php icon('requests') ?>" class="actionImg" alt="View Requests">
                    <span>View Requests</span>
                </a>
            </div>
            <div class="actionSpacer"></div>
            <div class="action">
                <a href="https://app.plex.tv/desktop" target="_blank" class="actionLink">
                    <img src="<?php icon('plex') ?>" class="actionImg" alt="Plex">
                    <span>Go to Plex</span>
                </a>
            </div>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
</div>
</body>
<?php build_js("index", "consolelog", "animate", "common", "nav", "overlay", "tooltip", "iconMap"); ?>
</html>