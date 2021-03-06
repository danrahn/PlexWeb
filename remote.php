<?php

session_start();

require_once "includes/common.php";
require_once "includes/config.php";

requireSSL();
verify_loggedin(TRUE);
if (!UserLevel::is_admin())
{
    error_and_exit(403);
}

/// <summary>
/// Performs the remote operation
/// </summary>
function remote($identifier, $endpoint, $command, $command_id, $client_identifier)
{
    $result = send_command($identifier, $endpoint, $command, $command_id, $client_identifier);
    if (!property_exists(json_decode($result), "Success"))
    {
        $result = init_control($identifier, $client_identifier);
        if (!property_exists(json_decode($result), "Success"))
        {
            return $result;
        }

        $result = json_decode(send_command($identifier, $endpoint, $command, 2, $client_identifier));
        $result->needed_init = TRUE;
        return json_encode($result);
    }

    return $result;
}

/// <summary>
/// On the first remote command sent (or if it's been awhile since the last one),
/// we need to register with Plex as a remote
/// </summary>
function init_control($identifier, $client_identifier)
{
    // NEEDED:
    // X-Plex-Device-Name
    $domain = SITE_DOMAIN;
    $client_id_post = str_replace(".", "-", $domain);
    $customHeaders = array(
        "Accept-Encoding: gzip",
        "Host: https://$domain:32400",
        "Connection: Keep-Alive",
        "X-Plex-Client-Identifier: $client_identifier-plex-$client_id_post",
        "X-Plex-Target-Client-Identifier: $identifier",

        "X-Plex-Provides: controller",
        "X-Plex-Device-Name: $domain Controller",
    );

    $result = curl(
        PLEX_HOST . ":" . PLEX_PORT . "/player/timeline/subscribe?protocol=https&port=32500&commandID=1&includeExternalMedia=1&" . PLEX_TOKEN,
        Array(CURLOPT_HTTPHEADER => $customHeaders, CURLOPT_TIMEOUT => 2, CURLOPT_ENCODING => "gzip")
    );

    if ($result && $result[0] == '{')
    {
        // Smells like a cURL error
        return $result;
    }

    return json_success();
}

/// <summary>
/// Attempts to send the remote command to the given client
/// </summary>
function send_command($identifier, $endpoint, $command, $command_id, $client_identifier)
{
    // NEEDED:
    // X-Plex-Client-Identifier
    // X-Plex-Target-Client-Identifier
    //
    // Probably needed:
    // Accept-Encoding: gzip
    // Host
    // Connection: Keep-Alive
    //
    // commandID needs to be there, but the value doesn't seem to actually matter
    $domain = SITE_DOMAIN;
    $client_id_post = str_replace(".", "-", $domain);
    $customHeaders = array(
        "Accept-Encoding: gzip",
        "Host: https://$domain:32400",
        "Connection: Keep-Alive",
        "X-Plex-Client-Identifier: $client_identifier-plex-$client_id_post",
        "X-Plex-Target-Client-Identifier: $identifier"
    );

    $result = curl(
        PLEX_HOST . ":" . PLEX_PORT . "/player/$endpoint/$command?type=video&commandID=$command_id&" . PLEX_TOKEN,
        array(CURLOPT_HTTPHEADER => $customHeaders, CURLOPT_TIMEOUT => 2, CURLOPT_ENCODING => "gzip")
    );

    if ($result && $result[0] == '{')
    {
        return $result;
    }

    return json_success();
}

/// <summary>
/// Get all clients we can potentially control
/// </summary>
function get_clients()
{
    $clients = simplexml_load_string(curl(PLEX_SERVER . '/clients?' . PLEX_TOKEN));
    $return = array();
    foreach ($clients as $client)
    {
        $ip = (string)$client['address'];
        $id = (string)$client['machineIdentifier'];
        $entry = new \stdClass();
        $entry->ip = $ip;
        $entry->user = try_get_user($id);
        $entry->device = (string)$client['product'] . " (" . (string)$client['name'] . ")";
        $entry->capabilities = explode(",", $client['protocolCapabilities']);
        $return[$id] = $entry;
    }

    return json_encode($return);
}

/// <summary>
/// The Client list does not include the user associated with the machine, but if that client
/// is currently playing something we can still match it.
/// </summary>
function try_get_user($id)
{
    $sessions = simplexml_load_string(curl(PLEX_SERVER . '/status/sessions?' . PLEX_TOKEN));
    foreach ($sessions as $sesh)
    {
        $player = $sesh->xpath("Player")[0];
        if ($id == (string)$player['machineIdentifier'])
        {
            return (string)$sesh->xpath("User")[0]["title"];
        }
    }

    return "";
}

$endpoint = try_get("endpoint");
if ($endpoint)
{
    json_message_and_exit(remote(get("id"), get("endpoint"), get("command"), get("command_id"), get("client_id")));
}
else
{
    $type = try_get("clients");
    if ($type)
    {
        json_message_and_exit(get_clients());
    }
?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta charset="utf-8">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="alternate icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Remote Control</title>
    <?php build_css() ?>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <h2 style="margin-top:50px;">Remote Control</h2>
        <div class="playerSelection">
            <div>Client:<span id="refreshClients" title="Refresh Clients">&#8635;</span></div>
        </div>
        <div class="playerSelection">
            <select id="devices"></select>
        </div>
        <div id="playback">
            <button class="playbackButton" id="seekBack" title="Seek Back (Shift + Left)"><span class="bigger">&laquo;</span></button>
            <button class="playbackButton" id="play" title="Play (Shift + .)">&#x25ba;</button>
            <button class="playbackButton" id="pause" title="Pause (Shift + \)">&#10073;&#10073;</button>
            <button class="playbackButton" id="seekForward" title="Seek Forward (Shift + Right)"><span class="bigger">&raquo;</span></button>
        </div>
        <div id="remoteNav">
            <div class="navRow">
                <button class="playerNavButton" id="navBack" title="Go Back (Shift + Backspace)">Back</button>
                <button class="playerNavButton" id="navUp" title="Up (Up Arrow)">Up</button>
                <button class="playerNavButton" id="plexNavHome" title="Home (Home Key)">Home</button>
            </div>
            <div class="navRow">
                <button class="playerNavButton" id="navLeft" title="Left (Left Arrow)">Left</button>
                <button class="playerNavButton" id="navSelect" title="Select (Enter)">Go</button>
                <button class="playerNavButton" id="navRight" title="Right (Right Arrow)">Right</button>
            </div>
            <div class="navRow">
                <button class="playerNavButton" id="navDown" title="Down (Down Arrow)">Down</button>
            </div>
        </div>
    </div>
</div>
<?php build_js(); ?>
</body>
</html>
<?php } ?>