<?php

session_start();

require_once "includes/common.php";
require_once "includes/config.php";

verify_loggedin();
if (!UserLevel::is_admin())
{
    error_and_exit(403);
}

/// <summary>
/// Get the contents of the given url
/// </summary>
function curl($url)
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $return = curl_exec($ch);
    curl_close($ch);
    return $return;
}

/// <summary>
/// Map of library types, mapping string representations to the underlying library type
/// </summary>
$types = [
    "movie" => 1,
    "show" => 2,
    "season" => 3,
    "episode" => 4,
    "trailer" => 5,
    "comic" => 6,
    "person" => 7,
    "artist" => 8,
    "album" => 9,
    "track" => 10,
    "photoAlbum" => 11,
    "picture" => 12,
    "photo" => 13,
    "clip" => 14,
    "playlistItem" => 15
];

/// <summary>
/// Entrypoint for administration requests
/// </summary>
function process_query($type)
{
    switch ($type)
    {
        case "sections":
            return get_sections();
        case "refresh":
            return refresh_library(get("section"));
        default:
            return json_error("Unknown admin request: " . $type);
    }
}

function get_sections()
{
    return json_encode(get_sections_array());
}

/// <summary>
/// Return an array of all sections in plex library
/// </summary>
function get_sections_array()
{
    $json_sections = array();
    $sections = simplexml_load_string(curl(PLEX_SERVER . '/library/sections?' . PLEX_TOKEN));
    foreach ($sections as $section)
    {
        array_push($json_sections, parse_section($section));
    }

    return $json_sections;
}

/// <summary>
/// Refresh the plex library with the associated id
/// </summary>
function refresh_library($section_id)
{
    $found = FALSE;
    $sections = get_sections_array();
    foreach ($sections as $section)
    {
        if ($section->key == (int)$section_id)
        {
            $found = TRUE;
            break;
        }
    }

    if (!$found)
    {
        return json_error('Invalid section provided');
    }

    $url = PLEX_SERVER . '/library/sections/' . $section_id . '/refresh?' . PLEX_TOKEN;
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

    $return = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ((int)$code != 200)
    {
        return json_error('Refresh failed. Response code: ' . $code);
    }

    curl_close($ch);
    return json_success();
}

/// <summary>
/// Return a JSON object with details for the given section
/// </summary>
function parse_section($section)
{
    global $types;
    $json = new \stdClass();
    $json->title = (string)$section['title'];
    get_num_items((int)$section['key'], $types[(string)$section['type']], $json);
    $json->created = (int)$section['createdAt'];
    $json->updated = (int)$section['updatedAt'];
    $json->last_scanned = (int)$section['scannedAt'];
    $json->type = (string)$section['type'];
    $json->key = (int)$section['key'];

    return $json;

    // Sample requests for future reference
    // http://localhost:32400/library/sections/2/all?type=1&sort=addedAt%3Adesc&includeCollections=1&includeExternalMedia=1&includeAdvanced=1&includeMeta=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0&X-Plex-Product=Plex%20Web&X-Plex-Version=4.18.1&X-Plex-Client-Identifier=f20vu99fnshsjforrrmflb4c&X-Plex-Platform=Chrome&X-Plex-Platform-Version=79.0&X-Plex-Sync-Version=2&X-Plex-Features=external-media%2Cindirect-media&X-Plex-Model=hosted&X-Plex-Device=Windows&X-Plex-Device-Name=Chrome&X-Plex-Device-Screen-Resolution=2560x1297%2C2560x1440&X-Plex-Token=***&X-Plex-Language=en&X-Plex-Text-Format=plain&X-Plex-Provider-Version=1.3&X-Plex-Drm=widevine

    // http://localhost:32400/library/sections/2/all?type=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0&X-Plex-Token=***

    // http://localhost:32400/library/sections/3/all?type=4&X-Plex-Container-Start=0&X-Plex-Container-Size=0&X-Plex-Token=***
}

/// <summary>
/// Get the number of items in the given library and add it to the given section
/// For TV/Music based libraries, include stats for Shows/Seasons/Episodes and Artists/Albums/Tracks
/// </summary>
function get_num_items($key, $type, &$section)
{
    $type_start = $type;
    $type_end = $type;
    $labels = array("Movies");
    if ($type > 1 && $type < 5)
    {
        // TV shows, 4 indicates number of episodes - get shows, seasons, and episodes
        $type_start = 2;
        $type_end = 4;
        $labels = array("Shows", "Seasons", "Episodes");
    }
    else if ($type > 7 && $type < 11)
    {
        // Music, get artists, albums, and tracks
        $type_start = 8;
        $type_end = 10;
        $labels = array("Artists", "Albums", "Tracks");
    }

    $items = array();
    for ($iType = $type_start; $iType <= $type_end; ++$iType)
    {
        $xml = simplexml_load_string(curl(PLEX_SERVER . '/library/sections/' . $key . '/all?type=' . $iType . '&X-Plex-Container-Start=0&X-Plex-Container-Size=0&' . PLEX_TOKEN));
        $section->{$labels[$iType - $type_start]} = (int)$xml['totalSize'];
        array_push($items, (int)$xml['totalSize']);
    }

    return $items;
}

$type = try_get("type");
if ($type)
{
    json_message_and_exit(process_query($type));
}
else
{

?>

<!DOCTYPE html>
<html lang="en-us">
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
    <link rel="shortcut icon" href="favicon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#3C5260" />
    <title>Administration</title>
    <?php build_css() ?>
</head>
<body>

<div id="plexFrame">
    <?php include "nav.php" ?>
    <div id="container">
        <h2 style="margin-top:50px; color:#c1c1c1">Administrative Tools</h2>
        <div id="actions">
            <div class="action actionLeft">
                <a href="library.php" class="actionLink">
                    <img src="<?php icon('settings') ?>" class="actionImg">
                    <span>Manage Library</span>
                </a>
            </div>
            <div class="action actionRight">
                <a href="password_reset.php" class="actionLink">
                    <img src="<?php icon('lock') ?>" class="actionImg">
                    <span>Password Reset</span>
                </a>
            </div>
        </div>
    </div>
</div>
<?php build_js(); ?>
</body>
</html>
<?php } ?>