<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";
require_once "includes/tvdb.php";

requireSSL();
verify_loggedin();

$tvdb_client;

/// <summary>
/// Class for determining the type of request we're processing
/// </summary>
abstract class QueryType {
    const AllSessions = 1; // Get all necessary info for all sessions
    const SingleSession = 2; // Get all information for a single session
    const ActiveSessions = 3; // Get the currently active session ids
    const Progress = 4; // Get the current play progress for the given session ids
    const Status = 5; // Get the number of playing/paused sessions
    const Unknown = 6; // Invalid query

    static function get_query_type($type)
    {
        switch ($type)
        {
            case "1":
                return QueryType::AllSessions;
            case "2":
                return QueryType::SingleSession;
            case "3":
                return QueryType::ActiveSessions;
            case "4":
                return QueryType::Progress;
            case "5":
                return QueryType::Status;
            default:
                return QueryType::Unknown;
        }
    }
}

/// <summary>
/// Class for determining the type of media we're processing
/// </summary>
abstract class MediaType {
    const Movie = 1;
    const TVShow = 2;
    const Audiobook = 3;
    const Music = 4;
    const Featurette = 5;
    const Trailer = 6;
    const Preroll = 7;
    const Unknown = 8;

    /// <summary>
    /// Converts the Plex library name to its MediaType
    /// </summary>
    static function get_media_type($type)
    {
        switch ($type)
        {
            case "Movies":
                return MediaType::Movie;
            case "TV Shows":
                return MediaType::TVShow;
            case "Audiobooks":
                return MediaType::Audiobook;
            case "Music":
                return MediaType::Music;
            default:
                return MediaType::Unknown;
        }
    }

    /// <summary>
    /// Converts the given MediaType to a friendly name
    /// </summary>
    static function to_string($type)
    {
        switch ($type)
        {
            case MediaType::Movie:
                return "Movie";
            case MediaType::TVShow:
                return "TV Show";
            case MediaType::Audiobook:
                return "Audiobook";
            case MediaType::Music:
                return "Music";
            case MediaType::Featurette:
                return "Featurette";
            case MediaType::Preroll:
                return "Pre-Roll";
            case MediaType::Trailer:
                return "Trailer";
            default:
                return "Unknown media type";
        }
    }

    // Returns whether the given type is audio-only
    static function is_audio($type)
    {
        return $type === MediaType::Audiobook || $type === MediaType::Music;
    }
}

/// <summary>
/// Sorts sessions by play time remaining, with playing items always taking precedence over paused items
/// </summary>
function session_sort($session1, $session2)
{
    if ($session1->paused != $session2->paused)
    {
        return $session1->paused ? 1 : -1;
    }

    return ($session1->duration - $session1->progress) - ($session2->duration - $session2->progress);
}

/// <summary>
/// Updates the level of the current user, which could have changed if requests have been approved during their active session
/// </summary>
function update_level()
{
    global $db;
    $id = (int)$_SESSION['id'];
    $result = $db->query("SELECT level FROM users WHERE id=$id");
    if ($result)
    {
        $_SESSION['level'] = $result->fetch_row()[0];
        $result->close();
    }
}

/// <summary>
/// Main entrypoint - determine the type of query we're processing and return the JSON payload
/// 
/// Loads error.php with 400 if parameters are not set correctly
/// </summary>
function process()
{
    update_level();
    if (!isset($_SESSION['level']) || (int)$_SESSION['level'] < 20)
    {
        json_error_and_exit("Not Authorized");
    }

    $payload = "";
    $type = param_or_die('type');
    switch (QueryType::get_query_type($type))
    {
        case QueryType::AllSessions:
            $payload = get_all_sessions();
            break;
        case QueryType::Progress:
            $payload = get_all_progress();
            break;
        case QueryType::SingleSession:
            $payload = get_single_session(param_or_die('id'));
            break;
        case QueryType::Status:
            $payload = get_status();
            break;
        default:
            error_and_exit("400");
    }

    header("Content-Type: application/json; charset=UTF-8");
    echo $payload;
}

/// <summary>
/// Returns our html-form session id. _Most_ streams have a built-in session id, but not all. sessionKey
/// is always present, but doesn't always change between streams (e.g. playing through an album), so the
/// end solution here is to squash the sessionKey with the title of the stream (removing non-alphanumeric)
/// </summary>
function get_sesh_id($sesh)
{
    return (string)$sesh['sessionKey'] . '-' . preg_replace('/[^A-Za-z0-9]/', '', $sesh['title']);
}

/// <summary>
/// Returns a watered down list of active streams, only including information necessary
/// to identify the stream and indicate the current progress of the stream
/// </summary>
function get_all_progress()
{
    $sessions = simplexml_load_string(curl(PLEX_SERVER . '/status/sessions?' . PLEX_TOKEN));
    $progress = array();
    foreach ($sessions as $sesh)
    {
        $entry = new \stdClass();
        $entry->duration = (int)$sesh['duration'];
        $entry->progress = (int)$sesh['viewOffset'];
        $entry->paused = strcmp($sesh->xpath("Player")[0]['state'], 'paused') == 0;
        $entry->id = get_sesh_id($sesh);

        $transcode = $sesh->xpath("TranscodeSession");
        if ($transcode)
        {
            $entry->transcode_progress = (float)$transcode[0]['progress'];
        }

        array_push($progress, $entry);
    }

    return json_encode($progress);
}

function get_status()
{
    $sessions = simplexml_load_string(curl(PLEX_SERVER . '/status/sessions?' . PLEX_TOKEN));
    $status = new \stdClass();
    $status->play = 0;
    $status->pause = 0;
    foreach ($sessions as $sesh)
    {
        if (strcmp($sesh->xpath("Player")[0]['state'], 'paused') == 0)
        {
            $status->pause++;
        }
        else
        {
            $status->play++;
        }
    }

    return json_encode($status);
}

/// <summary>
/// Retrieve the full stream information for a single session id
/// </summary>
/// <param name="sid">The id to lookup, in the form of [sessionKey]-[title]</param>
function get_single_session($sid)
{
    $sessions = simplexml_load_string(curl(PLEX_SERVER . '/status/sessions?' . PLEX_TOKEN));
    $sesh = NULL;
    foreach ($sessions as $sesh)
    {
        if (strcmp(get_sesh_id($sesh), $sid) === 0)
        {
            return json_encode(build_sesh($sesh));
        }
    }

    // Couldn't find this session!
    error_and_exit("400");
}

/// <summary>
/// Retrieve the full stream information for all active streams
/// </summary>
function get_all_sessions()
{
    $sessions = simplexml_load_string(curl(PLEX_SERVER . '/status/sessions?' . PLEX_TOKEN));
    $slim_sessions = array();
    foreach ($sessions as $sesh)
    {
        array_push($slim_sessions, build_sesh($sesh));
    }

    usort($slim_sessions, "session_sort");
    return json_encode($slim_sessions);
}

/// <summary>
/// Our main processing - builds up the session with all necessary information
/// </summary>
function build_sesh($sesh)
{
    $sesh_type = MediaType::get_media_type($sesh['librarySectionTitle']);
    if ($sesh_type == MediaType::Unknown)
    {
        if ($sesh['subtype'])
        {
            $sesh_type = strcmp($sesh['subtype'], "trailer") ? MediaType::Featurette : MediaType::Trailer;
        }
        else if ($sesh['guid'] && strpos($sesh['guid'], "prerolls"))
        {
            $sesh_type = MediaType::Preroll;
        }
    }

    $slim_sesh = new \stdClass();
    $slim_sesh->media_type = MediaType::to_string($sesh_type);

    $parent = NULL;
    if (MediaType::is_audio($sesh_type))
    {
        // For audiobooks/music grab the parent thumb, which correlates to the book cover/album art
        $parent = simplexml_load_string(curl(PLEX_SERVER . $sesh['parentKey'] . '?' . PLEX_TOKEN))[0]->xpath("Directory")[0];
        $slim_sesh->art_path = 'art' . $parent['thumb'];
    }
    else
    {
        $slim_sesh->art_path = 'art' . $sesh['art'];
    }

    $slim_sesh->thumb_path = 'thumb' . ($sesh_type == MediaType::TVShow ? ($sesh['parentThumb'] ? $sesh['parentThumb'] : $sesh['grandparentThumb']) : $sesh['thumb']);
    if ($slim_sesh->thumb_path)
    $slim_sesh->duration = (int)$sesh['duration'];
    $slim_sesh->progress = (int)$sesh['viewOffset'];
    $slim_sesh->release_date = MediaType::is_audio($sesh_type) ? (string)$parent['originallyAvailableAt'] : (string)$sesh['originallyAvailableAt'];
    if ($sesh_type === MediaType::Music)
    {
        $slim_sesh->album = (string)$sesh['parentTitle'];
    }

    $slim_sesh->title = get_title($sesh, $sesh_type);
    $slim_sesh->hyperlink = get_hyperlink($sesh['guid'], $sesh_type);

    $slim_sesh->session_id = get_sesh_id($sesh);

    if ($_SESSION['level'] >= 80)
    {
        $user = $sesh->xpath("User")[0];
        $slim_sesh->user = (string)$user['title'];
    }

    $player = $sesh->xpath("Player")[0];
    $slim_sesh->paused = strcmp($player['state'], 'paused') == 0;
    $slim_sesh->playback_device = get_playback_device($player);

    if ($_SESSION['level'] >= 100)
    {
        $slim_sesh->ip = (string)$player['remotePublicAddress'];
    }

    // We don't always have a 'selected' media item for some reason, or a stream with a decision
    $media = $sesh->xpath('Media[@selected="1"]');
    $media = $media ? $media[0] : $sesh->xpath('Media')[0];

    $stream = $media->xpath('Part[@decision]');
    $stream = $stream ? $stream[0] : $media->xpath('Part')[0];

    $audio = $stream->xpath("Stream[@channels]")[0]; // A bit hacky - assumes the stream always includes the number of channels (which it should)
    $video = $stream->xpath("Stream[@width]");
    $video = $video ? $video[0] : NULL;

    $slim_sesh->bitrate = intval($stream['bitrate']);
    if ($slim_sesh->bitrate == 0)
    {
        $slim_sesh->bitrate = intval($media['bitrate']);
    }

    $slim_sesh->audio = new \stdClass();
    $slim_sesh->audio->transcode = strcmp($audio['decision'], 'transcode') === 0;
    $slim_sesh->audio->original = (string)$audio['displayTitle'];
    $slim_sesh->audio->bitrate = (int)$audio['bitrate'];

    if ($slim_sesh->audio->transcode)
    {
        $slim_sesh->audio->transcoded_codec = strtoupper($audio['codec']);
        $slim_sesh->audio->transcoded_channels = get_audio_channels($audio['channels']);
    }

    if ($video)
    {
        $slim_sesh->video = new \stdClass();
        $slim_sesh->video->transcode = strcmp($video['decision'], 'transcode') == 0;
        $slim_sesh->video->original = (string)($video['displayTitle']);
        $slim_sesh->video->bitrate = (int)$video['bitrate'];
        if ($slim_sesh->video->transcode)
        {
            $slim_sesh->video->transcoded_codec = strtoupper($media['videoCodec']);
            $slim_sesh->video->transcoded_resolution = (string)$media['videoResolution'];
        }
    }

    $transcode = $sesh->xpath("TranscodeSession");
    if ($transcode)
    {
        $slim_sesh->transcode_progress = (float)$transcode[0]['progress'];
    }

    return $slim_sesh;
}

/// <summary>
/// Return the user-friendly title for a session given it's MediaType.
/// Movies include only the title, TV shows additionally include the show and season/episode, music
/// includes the artist, and audiobooks include the author and book name
/// </summary>
function get_title($sesh, $type)
{
    switch ($type)
    {
        case MediaType::Movie:
        case MediaType::Featurette:
            return (string)$sesh['title'];
        case MediaType::TVShow:
        {
            $season = $sesh['parentTitle'];
            $season = substr($season, strrpos($season, ' ') + 1, strlen($season) + strrpos($season, ' ') + 1);
            $season = strlen($season) == 1 ? '0' . $season : $season;
            $episode = $sesh['index'];
            $episode = strlen($episode == 1) ? '0' . $episode : $episode;
            return $sesh['grandparentTitle'] . ': ' . $sesh['title'] . ' (S' . $season . 'E' . $episode . ')';
        }
        case MediaType::Audiobook:
            return $sesh['parentTitle'] . ' by ' . $sesh['grandparentTitle'] . ': ' . $sesh['title'];
        case MediaType::Music:
            return $sesh['title'] . ' - ' . $sesh['grandparentTitle'];
        case MediaType::Preroll:
            return "Pre-Roll";
        case MediaType::Trailer:
            // Don't prepend 'trailer' if it's already in the title
            if (strpos(strtolower((string)$sesh['title']), "trailer") === FALSE)
            {
                return "Trailer - " . (string)$sesh['title'];
            }
            return (string)$sesh['title'];
        default:
            return "<span style='color: red'>ERROR: Unknown MediaType</span>";
    }
}

/// <summary>
/// Gets the hyperlink for the specific MediaType
/// Movies - imdb
// TV Shows - imdb (via TVDB API)
// Audiobooks - audible
// Music - none (#)
/// </summary>
function get_hyperlink($guid, $type)
{
    $imdb_start = 'https://imdb.com/title/';
    switch ($type)
    {
        case MediaType::Movie:
        {
            $guid = substr($guid, strpos($guid, '://') + 3);
            return $imdb_start . $guid;
        }
        case MediaType::TVShow:
            return $imdb_start . get_tv_hyperlink($guid);
        case MediaType::Audiobook:
        {
            $start = strpos($guid, '://') + 3;
            $end = strrpos($guid, '/');
            $id = $end ? substr($guid, $start, $end - $start) : substr($guid, $start);
            return 'https://audible.com/pd/' . $id . '?ipRedirectOverride=true';
        }
        default:
            return '#'; // No link for music/unknown type
    }
}

/// <summary>
/// Takes the given tvdb guid and returns an IMDb link to the corresponding episode
/// </summary>
function get_tv_hyperlink($show_guid)
{
    global $tvdb_client;
    $ind = strpos($show_guid, "thetvdb://");
    if ($ind === FALSE)
    {
        // We don't have a tvdb guid, can't query
        return "";
    }

    $lang = strpos($show_guid, "?lang=");
    if ($lang === FALSE)
    {
        $show_guid = substr($show_guid, $ind + 10);
    }
    else
    {
        $show_guid = substr($show_guid, $ind + 10, $lang - ($ind + 10));
    }
 
     // $show-guid is in the form <Series>/<Season>/<Episode>
    $arr = explode("/", $show_guid);

    // If we have our link cached, grab it. Querying tvdb can be slow, and we also
    // don't want to swamp them with requests.
    $cached = get_cached_link($arr);
    if ($cached)
    {
        return $cached;
    }

    // This "in-house" tvdb class is targeted at implementing the bare minimum required to
    // get what's necessary for the following to work. adrenth/thetvdb2 worked, but brought
    // in a bunch of other dependencies (that admittedly probably didn't affect performance
    // at all).
    if (!$tvdb_client)
    {
        $tvdb_client = new Tvdb();
        if (!$tvdb_client || !$tvdb_client->ready())
        {
            file_put_contents("includes/tvdberror.txt", "Login failed", FILE_APPEND);
            return "";
        }
    }

    $episode = $tvdb_client->get_episode($arr[0], $arr[1], $arr[2]);
    if ($episode->isError())
    {
        // Log errors to a file, since it's much more likely to be buggy than the better
        // supported package this replaced
        file_put_contents("includes/tvdberror.txt", $episode->getError(), FILE_APPEND);
        return "";
    }
    else
    {
        set_imdb_link($arr[0], $arr[1], $arr[2], $episode->getImdbLink());
        return $episode->getImdbLink();
    }
}

/// <summary>
/// Returns the imdb link to the given tv episode, or FALSE if it doesn't exist
/// </summary>
function get_cached_link($info)
{
    global $db;

    $show = (int)$info[0];
    $season = (int)$info[1];
    $episode = (int)$info[2];

    $query = "SELECT imdb_link FROM imdb_tv_cache WHERE show_id=$show AND season=$season AND episode=$episode";
    $result = $db->query($query);
    if (!$result)
    {
        return FALSE;
    }

    $cached_id = $result->fetch_row()[0];
    $result->close();
    return $cached_id;
}

/// <summary>
/// Returns the imdb link to the given tv episode, or FALSE if it doesn't exist
/// </summary>
function set_imdb_link($show, $season, $episode, $link)
{
    global $db;

    $show = (int)$show;
    $season = (int)$season;
    $episode = (int)$episode;
    $link = $db->real_escape_string($link);
    $query = "";

    // Assume it succeeds. If it doesn't not much we can do anyway, and we can always query tvdb directly
    $cached = get_cached_link(array(0=>$show, 1=>$season, 2=>$episode));
    if ($cached && strcmp($cached, $link) !== 0)
    {
        // the entry exists but our value is different. Update it
        $query = "UPDATE imdcb_tv_cache SET imdb_link='$link' WHERE show_id=$show AND season=$season AND episode=$episode";
    }
    else if (!$cached)
    {
        // Our value doesn't exist yet
        $query = "INSERT INTO imdb_tv_cache (show_id, season, episode, imdb_link) VALUES ($show, $season, $episode, '$link')";
    }

    if (strlen($query) > 0)
    {
        $db->query($query);
    }
}



/// <summary>
/// Get the user-friendly playback device. If it's a web device, also list the browser
/// </summary>
function get_playback_device($player)
{
    $device = (string)$player["product"];
    if (!strcmp($device, "Plex Web"))
    {
        $device = $device . " (" . $player["title"] . ")";
    }
    else if (!strcmp($device, "Plex for Android") && $player["title"] && $player["vendor"])
    {
        $device = $player["vendor"] . " " . $player["title"];
    }

    return $device;
}

/// <summary>
/// Return the friendly string given the number of audio channels
/// </summary>
function get_audio_channels($channels)
{
    switch ((int)$channels)
    {
        case 1:
            return "Mono";
        case 2:
            return "Stereo";
        case 6:
            return "5.1";
        case 8:
            return "7.1";
        default:
            return $channels . " channel";
    }
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

process();
if ($db)
{
    $db->close();
}
?>