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
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=ISO-8859-1">
    <link rel="stylesheet" type="text/css" href="resource/style.css">
    <link rel="shortcut icon" href="favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <script src="resource/consolelog.js"></script>
    <script src="resource/animate.js"></script>
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
        <div id="invalid">Please fill out all fields!</div>
        <div id="suggest" class="formContainer">
            <div class="formTitle">Media Request</div>
            <form id="suggestForm" action="javascript:void(0);">
                <hr />
                <div class="formInput"><label for="name">Suggestion:</label><input type="text" name="name" id="name" maxlength=64></div>
                <div class="formInput"><label for="type">Suggestion Type: </label><select name="type" id="type">
                    <option value="movie">Movie</option>
                    <option value="tv">TV Show</option>
                    <option value="audiobook">Audiobook</option>
                    <option value="music">Music</option>
                </select></div><hr />
                <div id="suggestions">
                    <div id="outsideSuggestions">
                        <h4>Matches</h4>
                    </div>
                    <div id="existingSuggestions">
                        <h4>Existing Items</h4>
                    </div>
                </div>
                <div class="formInput"><label for="comment">Comments:</label><textarea name="comment" id="comment" maxlength=1024></textarea></div>
                <div class="formInput"><input type="button" value="Submit" id="go"></input></div>
            </form>
            <a href="user_settings.php">Change notification settings</a>
        </div>
        <div id="formStatus" class="formContainer"></div>
    </div>
    <div id="tooltip"></div>
</div>
</body>
</html>