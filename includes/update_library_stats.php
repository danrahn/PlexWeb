<?php
require_once "common.php";
require_once "config.php";
requireSSL();

/// <summary>
/// Refresh our cached library stats by querying the Plex server
/// </summary>
function refresh_library_stats()
{
    global $db;
    $json_sections = array();
    $sections = simplexml_load_string(curl(PLEX_SERVER . '/library/sections?' . PLEX_TOKEN));
    foreach ($sections as $section)
    {
        array_push($json_sections, parse_section($section));
    }

    array_push($json_sections, parse_capacity());

    // Always add a new entry. Not really necessary, but could be nice to see the history of the
    // library over time.
    $data = json_encode($json_sections);
    $db_data = $db->real_escape_string($data);
    $query = "";
    $id = try_get("id");
    if ($id)
    {
        // For background updates, we created a dummy entry to mark that we are currently updating
        // and shouldn't send another request.
        $query = "UPDATE `library_stats_cache` SET `data`='$db_data' WHERE `id`=$id";
    }
    else
    {
        $query = "INSERT INTO `library_stats_cache` (`data`) VALUES ('$db_data')";
    }

    if (!$db->query($query))
    {
        return db_error();
    }

    return $data;
}

/// <summary>
/// Parses a single section of a Plex library
/// </summary>
function parse_section($section)
{
    $types = [
        "movie" => 1,
        "show" => 2, "season" => 3, "episode" => 4,
        "trailer" => 5, "comic" => 6, "person" => 7,
        "artist" => 8, "album" => 9, "track" => 10,
        "photoAlbum" => 11, "picture" => 12, "photo" => 13, "clip" => 14, "playlistItem" => 15
    ];

    $json = new \stdClass();
    $json->title = (string)$section['title'];
    process_section_items((int)$section['key'], $types[(string)$section['type']], $json);
    return $json;
}

/// <summary>
/// Processes the items of a given section, doing different operations
/// based on the section type
/// </summary>
function process_section_items($key, $type, &$section)
{
    $type_start = $type;
    $type_end = $type;
    $labels = array("Movies");
    $audiobook_section = FALSE;

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
        $audiobook_section = $section->title == LIBRARIES["AUDIOBOOKS"];
        $labels = $audiobook_section ? array("Authors", "Books", "Chapters") : array("Artists", "Albums", "Tracks");
    }

    $items = array();
    for ($iType = $type_start; $iType <= $type_end; ++$iType)
    {
        $xml = simplexml_load_string(curl(PLEX_SERVER . '/library/sections/' . $key . '/all?type=' . $iType . '&X-Plex-Container-Start=0&X-Plex-Container-Size=0&' . PLEX_TOKEN));
        $section->{$labels[$iType - $type_start]} = (int)$xml['totalSize'];
        array_push($items, (int)$xml['totalSize']);
    }

    switch ($type)
    {
        case 1:
            addMovieDetails($key, $section);
            break;
        case 2:
            addTvDetails($key, $section);
            break;
        case 8:
            addAudioDetails($key, $section, $audiobook_section);
            break;
        default:
            break;
    }

    return $items;
}

/// <summary>
/// Adds details about the resolutions of movies in the Plex library
/// </summary>
function addMovieDetails($key, $section)
{
    addSectionDetails(1, $key, "resolution", $section);
}

/// <summary>
///  Adds details about the content rating of tv shows in the Plex library
/// </summary>
function addTvDetails($key, $section)
{
    addSectionDetails(2, $key, "contentRating", $section);
}

/// <summary>
/// Retrieves details for the given section and adds it to the current section
/// </summary>
function addSectionDetails($type, $sectionKey, $detailKey, &$section)
{
    $append = "&type=$type&X-Plex-Container-Start=0&X-Plex-Container-Size=0";
    $base = PLEX_SERVER . "/library/sections/$sectionKey";
    $data = simplexml_load_string(curl($base . "/$detailKey?" . PLEX_TOKEN));
    $items = new \stdClass();
    foreach ($data as $item)
    {
        $path = $base . "/all?type=$type&$detailKey=" . (string)$item["key"] . "&" . PLEX_TOKEN . $append;
        $dict_key = (string)$item["title"];
        $items->$dict_key = (int)simplexml_load_string(curl($path))["totalSize"];
    }

    $section->$detailKey = $items;
}

/// <summary>
/// Adds details about music sections. For "real" music, organize by tracks per decade.
/// For audiobooks, organize by books (i.e. albums) per decade.
/// </summary>
function addAudioDetails($key, $section, $audiobook_section)
{
    $type_query = $audiobook_section ? "9&" : "10&album.";
    $before = PLEX_SERVER . "/library/sections/$key/all?type=" . $type_query . "year%3C%3C=1900";
    $append = "&" . PLEX_TOKEN . "&type=" . ($audiobook_section ? "9" : "10") . "&X-Plex-Container-Start=0&X-Plex-Container-Size=0";
    
    $items = new \stdClass();
    $before_count = (int)simplexml_load_string(curl($before . $append))["totalSize"];
    if ($before_count != 0)
    {
        $dc = "<1900";
        $items->$dc = $before_count;
    }

    $max = (int)date("Y") / 10 * 10;
    $decade = 1900;
    $any = false;
    while ($decade <= $max)
    {
        $decadePath = PLEX_SERVER . "/library/sections/$key/all?type=" . $type_query . "decade=$decade" . $append;
        $count = (int)simplexml_load_string(curl($decadePath))["totalSize"];
        if ($count != 0 || $any)
        {
            $any = TRUE;
            $items->$decade = $count;
        }

        $decade += 10;
    }

    $section->decades = $items;
}

/// <summary>
/// Get the amount of total and free disk space, in bytes
/// </summary>
function parse_capacity()
{
    $cap = new \stdClass();
    $cap->title = "_FS";
    $cap->total = 0;
    $cap->free = 0;
    $level = try_get("ul");
    if ($level < UserLevel::Regular)
    {
        return $cap;
    }

    $total = 0;
    $available = 0;
    $zfs_overhead = 0;
    foreach (BACKING_STORAGE as $disk)
    {
        $total += disk_total_space($disk . ":");
        $available += disk_free_space($disk . ":");
    }

    if (ZFS_STATS)
    {
        $ssh = ssh2_connect(SSH_IP);
        if ($ssh && ssh2_auth_password($ssh, SSH_USER, SSH_PASS))
        {
            $stream = ssh2_exec($ssh, 'zpool list -Hp ' . ZFS_SHARE);
            if ($stream)
            {
                $zfs_overhead = (int)explode("\t", get_stream_data($stream))[1] - $total;
                $total += $zfs_overhead;
            }
        }
    }

    $cap->total = $total;
    $cap->free = $available;
    $cap->overhead = $zfs_overhead;
    return $cap;
}

/// <summary>
/// Reads and returns all data from the given stream
/// </summary>
function get_stream_data($stream)
{
    $data = '';
    stream_set_blocking($stream, FALSE);
    $wait = 0;
    while (!feof($stream))
    {
        if ($wait) { usleep($wait); }
        $wait = 50000;
        if (!feof($stream))
        {
            $block = stream_get_contents($stream);
            if ($block === FALSE) { break; }
            if ($block != '') { $data .= $block; $wait = 0; }
        }
    }

    stream_set_blocking($stream, TRUE);
    stream_get_contents($stream);
    fclose($stream);
    return $data;
}

json_message_and_exit(refresh_library_stats());

?>