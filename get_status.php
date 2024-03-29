<?php
session_start();

require_once "includes/common.php";
require_once "includes/config.php";
require_once "includes/tvdb.php";

requireSSL();
verify_loggedin(FALSE /*redirect*/, "" /*return*/, TRUE /*JSON*/);

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
    const Photo = 8;
    const Unknown = 9;

    /// <summary>
    /// Converts the Plex library name to its MediaType
    /// </summary>
    static function get_media_type($library)
    {
        switch ($library->type)
        {
            case "movie":
                return MediaType::Movie;
            case "show":
                return MediaType::TVShow;
            case "artist":
                if (preg_match("/\baudio\s*book/i", $library->name) == 1)
                {
                    return MediaType::Audiobook;
                }

                return MediaType::Music;
            case "photo":
                return MediaType::Photo;
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
/// Sorts sessions by play time remaining, with playing items always taking precedence over paused/buffering items
/// </summary>
function session_sort($session1, $session2)
{
    if ($session1->state != $session2->state)
    {
        if ($session1->state == "playing")
        {
            return -1;
        }

        if ($session2->state == "playing")
        {
            return 1;
        }
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
        UserLevel::set_current($result->fetch_row()[0]);
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
    $type = param_or_die('type');
    $query_type = QueryType::get_query_type($type);
    if (UserLevel::current() < UserLevel::Regular && $query_type != QueryType::Status)
    {
        json_error_and_exit("Not Authorized");
    }

    $payload = "";
    switch ($query_type)
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
            if (UserLevel::current() < UserLevel::Regular)
            {
                $payload = '{ "nopermission" : true }';
            }
            else
            {
                $payload = get_status();
            }
            break;
        default:
            error_and_exit("400");
    }

    header("Content-Type: application/json; charset=UTF-8");
    header("X-Content-Type-Options: nosniff");
    header("Cache-Control: no-cache");
    echo $payload;
}

/// <summary>
/// Returns our html-form session id. _Most_ streams have a built-in session id, but not all. sessionKey
/// is always present, but doesn't always change between streams (e.g. playing through an album), so the
/// end solution here is to squash the sessionKey with the title of the stream (removing non-alphanumeric)
/// Also prefix with an underscore, because if the title starts with a number, we don't have a valid HTML id
/// </summary>
function get_sesh_id($sesh)
{
    return '_' . preg_replace('/[^A-Za-z0-9]/', '', $sesh['title']) . '_' . (string)$sesh['sessionKey'];
}

/// <summary>
/// Returns a watered down list of active streams, only including information necessary
/// to identify the stream and indicate the current progress of the stream
/// </summary>
function get_all_progress()
{
    $sessions = simplexml_load_string(curl(PLEX_SERVER . '/status/sessions?' . PLEX_TOKEN));
    $progress = array();
    if ($sessions === FALSE)
    {
        return json_error("Bad response");
    }

    foreach ($sessions as $sesh)
    {
        $entry = new \stdClass();
        $entry->duration = get_duration($sesh);
        $entry->progress = (int)$sesh['viewOffset'];
        $entry->state = (string)$sesh->xpath("Player")[0]['state'];
        $entry->id = get_sesh_id($sesh);

        $transcode = $sesh->xpath("TranscodeSession");
        if ($transcode)
        {
            $entry->transcode_progress_old = min(100.0, (float)$transcode[0]['progress']);
            $duration = (float)$transcode[0]['duration'];
            $offset = (float)$transcode[0]['maxOffsetAvailable'] * 1000;
            $entry->transcode_progress = min(100.0, ($offset / $duration) * 100);
        }

        array_push($progress, $entry);
    }

    return json_encode($progress);
}

/// <summary>
/// Return minimal status information containing the number of playing and paused items
/// </summary>
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
            $slim = build_sesh($sesh, get_library_names());
            $slim->machine_id = get_machine_identifier();
            return json_encode($slim);
        }
    }

    // Couldn't find this session!
    error_and_exit("400");
}

/// <summary>
/// Return an array of all the plex library section names and types
/// </summary>
function get_library_names()
{
    $names = [];
    $sections = simplexml_load_string(curl(PLEX_SERVER . '/library/sections?' . PLEX_TOKEN));
    foreach ($sections as $section)
    {
        $library = new \stdClass();
        $library->title = (string)$section['title'];
        $library->type = (string)$section['type'];
        $names[(string)$section['key']] = $library;
    }

    return $names;
}

/// <summary>
/// Retrieve the full stream information for all active streams
/// </summary>
function get_all_sessions()
{
    $plex_server_id = get_machine_identifier();
    $sessions = simplexml_load_string(curl(PLEX_SERVER . '/status/sessions?' . PLEX_TOKEN));
    $library_names = get_library_names();
    $slim_sessions = array();
    foreach ($sessions as $sesh)
    {
        $slim = build_sesh($sesh, $library_names);
        if ($slim)
        {
            $slim->machine_id = $plex_server_id;
            array_push($slim_sessions, $slim);
        }
    }

    usort($slim_sessions, "session_sort");
    return json_encode($slim_sessions);
}

/// <summary>
/// Return the plex server machine identifier, used for
/// building links to plex for active streams
/// </summary>
function get_machine_identifier()
{
    $server_info = simplexml_load_string(curl(PLEX_SERVER . '?' . PLEX_TOKEN));
    return (string)$server_info['machineIdentifier'];

}

/// <summary>
/// Our main processing - builds up the session with all necessary information
/// </summary>
function build_sesh($sesh, $library_names)
{
    $section_id = (string)$sesh['librarySectionID'];
    $sesh_type = MediaType::Unknown;
    if (array_key_exists($section_id, $library_names))
    {
        $sesh_type = MediaType::get_media_type($library_names[$section_id]);
    }

    if ($sesh_type == MediaType::Photo)
    {
        // Don't treat viewing photo libraries as active streams.
        return FALSE;
    }

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
        // For audio, we don't always have a good art path. We also need to set the
        // plex key to its parent (the album) for navigation
        if ($sesh['parentKey'])
        {
            $parent = simplexml_load_string(curl(PLEX_SERVER . $sesh['parentKey'] . '?' . PLEX_TOKEN))[0]->xpath("Directory")[0];
        }
        else if ($sesh['parentRatingKey'])
        {
            $parent = simplexml_load_string(curl(PLEX_SERVER . '/library/metadata/' . $sesh['parentRatingKey'] . '?' . PLEX_TOKEN))[0]->xpath("Directory")[0];
        }
        else if ($sesh['grandparentRatingKey'])
        {
            $parent = simplexml_load_string(curl(PLEX_SERVER . '/library/metadata/' . $sesh['grandparentRatingKey'] . '?' . PLEX_TOKEN))[0]->xpath("Directory")[0];
        }

        if ($sesh['art'])
        {
            $slim_sesh->art_path = 'art' . $sesh['art'];
        }
        else if ($sesh['grandparentArt'])
        {
            $slim_sesh->art_path = 'art' . $sesh['grandparentArt'];
        }
        else if ($parent['thumb'])
        {
            $slim_sesh->art_path = 'art' . $parent['thumb'];
        }
        else
        {
            $slim_sesh->art_path = 'poster/audiodefault.svg';
        }

        if ($sesh['parentKey'])
        {
            $slim_sesh->plex_key = (string)$sesh['parentKey'];
        }
        else if ($parent['key'])
        {
            $slim_sesh->plex_key = substr($parent['key'], 0, strlen($parent['key']) - strlen('/children'));
        }
        else if ($parent['ratingKey'])
        {
            $slim_sesh->plex_key = '/library/metadata/' . (int)$parent['ratingKey'];
        }
        else if ($parent['parentKey'])
        {
            $slim_sesh->plex_key = (string)$parent['parentKey'];
        }
    }
    else
    {
        if ($sesh['key'])
        {
            $slim_sesh->plex_key = (string)$sesh['key'];
        }

        if ($sesh['art'])
        {
            $slim_sesh->art_path = 'art' . $sesh['art'];
        }
        else
        {
            $slim_sesh->art_path = 'poster/' . ($sesh_type == MediaType::TVShow ? 'tv' : 'movie') . 'default.svg';
        }
    }

    $slim_sesh->art_colors = get_img_average($slim_sesh->art_path);

    $slim_sesh->thumb_path = 'thumb' . ($sesh_type == MediaType::TVShow ? ($sesh['parentThumb'] ? $sesh['parentThumb'] : $sesh['grandparentThumb']) : $sesh['thumb']);
    if ($slim_sesh->thumb_path == 'thumb')
    {
        $thumb_path = 'poster/';
        switch ($sesh_type)
        {
            case MediaType::TVShow:
                $thumb_path .= 'tvdefault.svg';
                break;
            case MediaType::Movie:
                $thumb_path .= 'moviedefault.svg';
                break;
            case MediaType::Audiobook:
            case MediaType::Music:
                $thumb_path .= 'audiodefault.svg';
                break;
            default:
                $thumb_path .= 'moviedefault.svg';
                break;
        }

        $slim_sesh->thumb_path = $thumb_path;
    }

    $slim_sesh->duration = get_duration($sesh);
    $slim_sesh->progress = (int)$sesh['viewOffset'];
    $slim_sesh->release_date = MediaType::is_audio($sesh_type) ? (string)$parent['originallyAvailableAt'] : (string)$sesh['originallyAvailableAt'];
    if ($sesh_type === MediaType::Music)
    {
        $slim_sesh->album = (string)$sesh['parentTitle'];
    }

    $slim_sesh->title = get_title($sesh, $sesh_type);
    $slim_sesh->hyperlink = get_hyperlink($sesh, $sesh_type);
    $imdb_rating = "";
    if (get_imdb_rating($slim_sesh->hyperlink, $imdb_rating))
    {
        $slim_sesh->imdb_rating = $imdb_rating;
    }

    $slim_sesh->session_id = get_sesh_id($sesh);

    $level = UserLevel::current();
    if ($level >= UserLevel::SuperModerator)
    {
        $user = $sesh->xpath("User")[0];
        $slim_sesh->user = (string)$user['title'];
    }

    $player = $sesh->xpath("Player")[0];
    $slim_sesh->state = (string)$sesh->xpath("Player")[0]['state'];
    $slim_sesh->playback_device = get_playback_device($player);

    if ($level == UserLevel::Admin)
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
    $subtitle = $stream->xpath("Stream[@streamType=3]");
    $subtitle = $subtitle ? $subtitle[0] : NULL;

    $slim_sesh->bitrate = intval($stream['bitrate']);
    if ($slim_sesh->bitrate == 0)
    {
        $slim_sesh->bitrate = intval($media['bitrate']);
    }

    $slim_sesh->audio = new \stdClass();
    $slim_sesh->audio->transcode = (string)$audio['decision'];
    $slim_sesh->audio->original = (string)$audio['displayTitle'];
    $slim_sesh->audio->bitrate = (int)$audio['bitrate'];
    $slim_sesh->parts = array();
    $all_media = $sesh->xpath('Media');
    foreach ($all_media as $media_entry)
    {
        $part = $media_entry->xpath('Part[@decision]');
        $part = $part ? $part[0] : $media_entry->xpath('Part')[0];
        array_push($slim_sesh->parts, (string)$part['id']);
    }

    if ($slim_sesh->audio->transcode)
    {
        $slim_sesh->audio->transcoded_codec = strtoupper($audio['codec']);
        $slim_sesh->audio->transcoded_channels = get_audio_channels($audio['channels']);
    }

    if ($video)
    {
        $slim_sesh->video = new \stdClass();
        $slim_sesh->video->transcode = (string)$video['decision'];
        $slim_sesh->video->original = (string)($video['displayTitle']);
        $slim_sesh->video->bitrate = (int)$video['bitrate'];
        if ($slim_sesh->video->transcode)
        {
            $slim_sesh->video->transcoded_codec = strtoupper($media['videoCodec']);
            $slim_sesh->video->transcoded_resolution = (string)$media['videoResolution'];
        }
    }

    if ($subtitle)
    {
        $slim_sesh->subtitle = new \stdClass();
        $slim_sesh->subtitle->burn = (string)$subtitle['decision'];
        $slim_sesh->subtitle->language = (string)$subtitle['language'];
        $slim_sesh->subtitle->extended_title = (string)$subtitle['extendedDisplayTitle'];
    }

    $transcode = $sesh->xpath("TranscodeSession");
    if ($transcode)
    {
        $slim_sesh->transcode_progress_old = min(100.0, (float)$transcode[0]['progress']);
        $duration = (float)$transcode[0]['duration'];
        $offset = (float)$transcode[0]['maxOffsetAvailable'] * 1000;
        $slim_sesh->transcode_progress = min(100.0, ($offset / $duration) * 100);
        if (isset($transcode[0]['transcodeHwEncoding']))
        {
            $slim_sesh->video->hw_transcode = (string)$transcode[0]['transcodeHwEncoding'];
        }
    }

    return $slim_sesh;
}

/// <summary>
/// Gets the IMDb rating associated with the given link, putting it in $rating.
/// On failure, return FALSE and $rating's value is not guaranteed
/// </summary>
function get_imdb_rating($link, &$rating)
{
    global $db;
    $last = strrpos($link, "/");
    if ($last === FALSE)
    {
        return FALSE;
    }

    if (strlen($link) <= $last + 2 || $link[$last + 1] != 't' || $link[$last + 2] != 't')
    {
        return FALSE;
    }

    $tt = (int)substr($link, $last + 3);
    $query = "SELECT `rating` FROM `imdb_ratings` WHERE `imdbid`=$tt";
    $result = $db->query($query);
    if (!$result || $result->num_rows === 0)
    {
        return FALSE;
    }

    $rating = number_format($result->fetch_row()[0] / 10, 1, '.', '');
    return TRUE;
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
            $season = "";
            if (isset($sesh['parentIndex']))
            {
                $season = $sesh['parentIndex'];
            }
            else
            {
                $season = $sesh['parentTitle'];
                $season = substr($season, strrpos($season, ' ') + 1, strlen($season) + strrpos($season, ' ') + 1);
            }

            $season = strlen($season) == 1 ? '0' . $season : $season;
            $episode = $sesh['index'];
            $episode = strlen($episode) == 1 ? '0' . $episode : $episode;
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
            // Don't know what type of media this is. If there's a title attribute use that, otherwise show an error
            if (array_key_exists('title', $sesh))
            {
                return (string)$sesh['title'];
            }
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
function get_hyperlink_core($guid, $type)
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
            $id = get_tv_hyperlink($guid);
            if (!$id)
            {
                return "";
            }

            return $imdb_start . $id;
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
/// Gets the hyperlink for the specific MediaType, taking into account the new
/// media agent that stores the actual external id elsewhere
/// Movies - imdb
/// TV Shows - imdb (via TVDB API)
/// Audiobooks - audible
/// Music - none (#)
/// </summary>
function get_hyperlink($sesh, $type)
{
    // The new plex movie agent is denoted by a guid of plex://XYZ.
    // If we don't see it, it has the external id information already
    // and can be parsed directly
    if (substr($sesh['guid'], 0, 5) != 'plex:')
    {
        $hyperlink = get_hyperlink_core($sesh['guid'], $type);
        if (!$hyperlink)
        {
            return get_hyperlink_core($sesh['parentGuid'], $type);
        }

        return $hyperlink;
    }

    // Otherwise we have to go to the metadata for the item, looking for the right Guid
    $media_info = simplexml_load_string(curl(PLEX_SERVER . $sesh['key'] . '?' . PLEX_TOKEN));
    $guids = $media_info->xpath("//Guid");
    $tvdb_backup = ""; // For the new Series scanner if there's isn't an imdb guid.
    foreach ($guids as $guid)
    {
        if (substr($guid['id'], 0, 5) == 'imdb:')
        {
            return 'https://imdb.com/title/' . substr($guid['id'], 7);
        }
        else if ($type == MediaType::TVShow && strpos($guid['id'], 'tvdb:') === 0)
        {
            $tvdb_backup = "thetvdb://" . substr($guid['id'], 7);
        }
    }

    if ($tvdb_backup)
    {
        return 'https://imdb.com/title/' . get_tv_hyperlink($tvdb_backup);
    }

    return '#';
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
    $cached = get_cached_link($arr, TRUE /*checkDate*/);
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
            file_put_contents("includes/tvdberror.txt", "Login failed\n", FILE_APPEND);
            return "";
        }
    }

    $episode = NULL;
    if (count($arr) === 1)
    {
        $episode = $tvdb_client->get_episode_from_id($arr[0]);
    }
    else
    {
        $episode = $tvdb_client->get_episode($arr[0], $arr[1], $arr[2]);
    }

    if ($episode->isError())
    {
        // As a backup, attempt to grab the IMDb id for the series as a whole
        $series = $tvdb_client->get_series($arr[0]);
        if ($series->isError())
        {
            // Log errors to a file, since it's much more likely to be buggy than the better
            // supported package this replaced
            file_put_contents("includes/tvdberror.txt", $series->getError() . "\n", FILE_APPEND);
            return "";
        }

        return $series->getImdbLink(); // Don't cache (for now), in hopes of us eventually getting the right ID
    }
    else
    {
        set_imdb_link($episode->getSeriesId(), $episode->getSeason(), $episode->getEpisodeNumber(), $episode->getId(), $episode->getImdbLink());
        return $episode->getImdbLink();
    }
}

/// <summary>
/// Returns the imdb link to the given tv episode, or FALSE if it doesn't exist
/// </summary>
function get_cached_link($info, $check_date)
{
    global $db;

    $query = "";
    if (count($info) === 1)
    {
        $episode_id = (int)$info[0];
        $query = "SELECT imdb_link, CONVERT_TZ(date_added, @@session.time_zone, '+00:00') AS `date_added_utc` FROM imdb_tv_cache WHERE episode_id=$episode_id";
    }
    else
    {
        $show = (int)$info[0];
        $season = (int)$info[1];
        $episode = (int)$info[2];
    
        // TODO: re-grab the id if stale, or, cache whether we fell back to the show id, and only retry those
        $query = "SELECT imdb_link, CONVERT_TZ(date_added, @@session.time_zone, '+00:00') AS `date_added_utc` FROM imdb_tv_cache WHERE show_id=$show AND season=$season AND episode=$episode";
    }

    $result = $db->query($query);
    if (!$result || $result->num_rows === 0)
    {
        return FALSE;
    }

    $row = $result->fetch_row();
    if ($check_date)
    {
        $timestamp = new DateTime($row[1]);
        $now = new DateTime(date("Y-m-d H:i:s"));
        $diff = ($now->getTimestamp() - $timestamp->getTimestamp());
    
        // diff is in seconds. If it's greater than 30 days, refresh it
        if ($diff > 30 * 24 * 60 * 60)
        {
            $result->close();
            return FALSE;
        }
    }

    $cached_id = $row[0];
    $result->close();
    return $cached_id;
}

/// <summary>
/// Returns the imdb link to the given tv episode, or FALSE if it doesn't exist
/// </summary>
function set_imdb_link($show, $season, $episode, $episode_id, $link)
{
    global $db;
    // If the link is empty, don't do anything
    if (strlen($link) == 0)
    {
        return;
    }

    $show = (int)$show;
    $season = (int)$season;
    $episode = (int)$episode;
    $id = (int)$episode_id;
    $link = $db->real_escape_string($link);
    $query = "";

    // Assume it succeeds. If it doesn't not much we can do anyway, and we can always query tvdb directly
    $cached = get_cached_link(array(0=>$show, 1=>$season, 2=>$episode), FALSE /*checkDate*/);
    if ($cached !== FALSE && strcmp($cached, $link) !== 0)
    {
        // the entry exists but our value is different. Update it
        $query = "UPDATE imdb_tv_cache SET imdb_link='$link' WHERE ((show_id=$show AND season=$season AND episode=$episode) OR episode_id=$id)";
    }
    else if (!$cached)
    {
        // Our value doesn't exist yet
        $query = "INSERT INTO imdb_tv_cache (show_id, season, episode, episode_id, imdb_link) VALUES ($show, $season, $episode, $id, '$link')";
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
    else if (strpos($device, "Plex for Android") !== FALSE && $player["title"] && $player["vendor"])
    {
        $device = ucwords($player["vendor"]) . " " . $player["title"];
    }
    else if (UserLevel::is_admin() && $player["title"] && strlen($player["title"]) > 0)
    {
        $device .= " (" . $player["title"] . ")";
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
/// Gets the duration for the given media. Sometimes there are multiple versions with different lengths
/// (e.g. regular vs extended cuts). By default choose the duration attached to the top-level entry,
/// but if we have an explicitly selected stream, use that duration instead.
/// </summary>
function get_duration($sesh)
{
    $duration = (int)$sesh['duration'];
    $selected = $sesh->xpath('Media[@selected="1"]');
    if (count($selected) == 1)
    {
        return (int)$selected[0]['duration'];
    }

    return $duration;
}


/// <summary>
/// Get the average red/green/blue of a background
/// </summary>
function get_img_average($src)
{
    $colors = new \stdClass();
    $colors->red = 0;
    $colors->green = 0;
    $colors->blue = 0;

    $filename_parts = explode("/", $src);

    if (count($filename_parts) < 3)
    {
        return $colors;
    }

    $filename = $filename_parts[count($filename_parts) - 3] . "_" . $filename_parts[count($filename_parts) - 1] . ".jpg";
    $path = "includes/cache/background/" . $filename_parts[count($filename_parts) - 2] . "/" . $filename;

    global $db;
    $query = "SELECT `red`, `green`, `blue` FROM background_color_cache WHERE `path`='$filename'";
    $result = $db->query($query);
    if ($result === FALSE)
    {
        return db_error();
    }

    if ($result->num_rows === 1)
    {
        $row = $result->fetch_assoc();
        $colors->red = (int)$row['red'];
        $colors->green = (int)$row['green'];
        $colors->blue = (int)$row['blue'];
        return $colors;
    }

    // Our values aren't cached. Read in the image
    if (!file_exists($path))
    {
        // Art background doesn't exist yet, not the end of the world, we'll get it eventually
        return $colors;
    }

    $image_info = @getimagesize($path);
    $img = FALSE;
    if ($image_info['mime'] == "image/png")
    {
        $img = @imagecreatefrompng($path);
    }
    else if ($image_info['mime'] == "image/jpeg")
    {
        $img = @imagecreatefromjpeg($path);
    }

    if (!$img)
    {
        // Failed to create image, maybe a new mime check needs to be added
        return $colors;
    }

    $samples = 0;
    for ($x = 0; $x < $image_info[0]; $x += 5) // Every 5 pixels, as doing every pixel gets very expensive
    {
        for ($y = 0; $y < $image_info[1]; $y += 5)
        {
            $thisColor = imagecolorat($img, $x, $y);
            $rgb = imagecolorsforindex($img, $thisColor);
            $colors->red += $rgb['red'];
            $colors->green += $rgb['green'];
            $colors->blue += $rgb['blue'];
            $samples += 1;
        }
    }

    $colors->red = (int)($colors->red / $samples);
    $colors->green = (int)($colors->green / $samples);
    $colors->blue = (int)($colors->blue / $samples);

    $query = "INSERT INTO background_color_cache (`path`, `red`, `green`, `blue`) VALUES ('$filename', $colors->red, $colors->green, $colors->blue)";
    $db->query($query);

    return $colors;
}

process();
if ($db)
{
    $db->close();
}
?>