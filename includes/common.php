<?php

/// <summary>
/// Forces a session to use https (if it's not local)
/// </summary>
function requireSSL() {
    if ($_SERVER["REMOTE_ADDR"] != "::1" && $_SERVER["REMOTE_ADDR"] != "127.0.0.1" && (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] == 'off')) {
        header("Location: https://" . $_SERVER["HTTP_HOST"] . $_SERVER["REQUEST_URI"]);
        exit();
    }
}

/// <summary>
/// Ensure the user is logged in. If they're not, either return 401 or redirect to the login page
/// </summary>
function verify_loggedin($redirect = FALSE, $return = "", $json = FALSE)
{
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== TRUE)
    {
        if ($redirect)
        {
            $loc = "login.php";
            if (strlen($return) > 0)
            {
                $loc .= "?return=" . urlencode($return);
            }
            header("Location: " . $loc);
            exit;
        }

        if ($json)
        {
            json_error_and_exit("Not Authorized");
        }

        header('HTTP/1.1 401 Unauthorized', true, 401);
        error_and_exit(401);
    }
}

/// <summary>
/// Ensures the client accessing this site is not banned
/// </summary>
function check_if_banned()
{
    global $db;
    $ip = $db->real_escape_string($_SERVER["REMOTE_ADDR"]);
    $query = "SELECT * FROM `banned_ips` WHERE `ip`=\"$ip\"";
    $result = $db->query($query);
    if (!$result || $result->num_rows === 0)
    {
        return;
    }

    $message = "Your IP has been banned from accessing this resource. If you think this is an error, please contact admin@" . SITE_DOMAIN;
    header(HTTPStatusHeader(403), TRUE, 403);
    error_and_exit(403, $message);
}

/// <summary>
/// Print a simple JSON error and exit the script
/// </summary>
function json_error_and_exit($error)
{
    global $db;
    if ($db)
    {
        $db->close();
    }

    header("Content-Type: application/json; charset=UTF-8");
    header("Cache-Control: no-cache");
    header("X-Content-Type-Options: nosniff");
    echo json_error($error);
    exit;
}

/// <summary>
/// Returns the default Success JSON string
/// </summary>
function json_success()
{
    return '{ "Success" : true }';
}

/// <summary>
/// Returns a JSON string with a single 'Error' field, set to the given message
/// </summary>
function json_error($message)
{
    $err = new \stdClass();
    $err->Error = $message;
    return json_encode($err);
}

/// <summary>
/// Returns a json message that includes the database error for admins
/// </summary>
function db_error()
{
    global $db;
    $err = UserLevel::is_admin() ? $db->error : "Please contact the administrator with the details of how you encountered this error";
    return json_error("Error querying database: " . $err);
}

/// <summary>
/// Echos the given message as JSON and exits
/// </summary>
function json_message_and_exit($message)
{
    header("Content-Type: application/json; charset=UTF-8");
    header("Cache-Control: no-cache");
    header("X-Content-Type-Options: nosniff");
    echo $message;
    exit;
}

/// <summary>
/// Returns the GET or POST parameter (preferring POST over GET)
/// Exits with error 400 if it's not set as a POST or GET parameter
/// </summary>
function param_or_die($param)
{
    if (isset($_POST[$param]))
    {
        return $_POST[$param];
    }

    if (isset($_GET[$param]))
    {
        return $_GET[$param];
    }

    // Not set as a GET or POST parameter, fail
    error_and_exit(400);
}

/// <summary>
/// Similar to above, but instead of exiting with status 400,
/// exit 200 and return a json string with an error
/// </summary>
function param_or_json_exit($param)
{
    if (isset($_POST[$param]))
    {
        return $_POST[$param];
    }

    if (isset($_GET[$param]))
    {
        return $_GET[$param];
    }

    // Not set as a GET or POST parameter, fail
    json_error_and_exit($param . " is not set!");
}

/// <summary>
/// Alias for param_or_json_exit because I'm lazy and that's a lot to type out
/// </summary>
function get($param)
{
    return param_or_json_exit($param);
}

/// <summary>
/// Returns the get/post parameter, or FALSE if not found
/// </summary>
function try_get($param)
{
    $value = NULL;
    if (param($param, $value))
    {
        return $value;
    }

    return FALSE;
}

/// <summary>
/// If $param exists, sets $value to the given parameter and returns true, otherwise returns false
/// </summary>
function param($param, &$value)
{
    if (isset($_POST[$param]))
    {
        $value = $_POST[$param];
        return TRUE;
    }

    if (isset($_GET[$param]))
    {
        $value = $_GET[$param];
        return TRUE;
    }

    return FALSE;
}

/// <summary>
/// Echos the contents of the given javascript file. By default writes
/// the minified version, unless the 'nomin' get/post parameter is set
/// </summary>
function include_js($file)
{
    if (!try_get("nomin"))
    {
        return file_get_contents("min/script/" . $file . ".min.js");
    }
    else
    {
        return "/* $file */\n" . file_get_contents("script/" . $file . ".js");
    }
}

/// <summary>
/// Builds a consolidated single-scoped script block with all
/// the given files.
///
/// To ensure the most up-to-date contents are retrieved when nomin is not
/// specified, make sure to run minify.py after modifying any javascript file
/// </summary>
function build_js()
{
    $file = pathinfo($_SERVER['PHP_SELF'])['filename'];
    if (try_get("nomin"))
    {
        $includes = get_includes($file);
        foreach ($includes as $include)
        {
            echo "<script>\n" . include_js($include) . "</script>\n\n";
        }
    }
    else
    {
        // When minified, we add the md5 hash of the script to the filename, so
        // do a fuzzy glob match and use the first result. Combining the md5 hash
        // with a large max-age cache-control setting in httpd.conf results in the
        // best of both worlds: clients get the latest bits as soon as they available,
        // and when the content doesn't change, clients can use the cached version
        // without pinging us.
        echo '<script src="' . glob("min/script/$file.*.min.js")[0] . '"></script>';
    }
}

/// <summary>
/// Parses the deps json to determine what js files should be included
/// </summary>
function get_includes($file)
{
    $deps = json_decode(file_get_contents('includes/deps.json'));
    $result = [];
    get_includes_core($file, $deps, 0, $result);
    $flattened = flatten_includes($result);
    array_push($flattened, $file);

    $has_consolelog = array_search("consolelog", $flattened);
    
    if ($has_consolelog != FALSE)
    {
        array_splice($flattened, $has_consolelog, 1);
        array_splice($flattened, 0, 0, "consolelog");
    }

    $has_common = array_search("common", $flattened);
    if ($has_common !== FALSE && $has_common != ($has_consolelog === FALSE ? 0 : 1))
    {
        array_splice($flattened, $has_common, 1);
        array_splice($flattened, $has_consolelog === FALSE ? 0 : 1, 0, "common");
    }

    return $flattened;
}

/// <summary>
/// Recursively add dependencies to the result list
/// </summary>
function get_includes_core($dep, $deps, $depth, &$result)
{
    if (!array_key_exists($depth, $result))
    {
        $result[$depth] = [];
    }
    foreach ($deps->$dep->js as $include)
    {
        if (!in_array($include, $result[$depth]))
        {
            array_unshift($result[$depth], $include);
            get_includes_core($include, $deps, $depth + 1, $result);
        }
        else
        {
            array_splice($result[$depth], array_search($include, $result[$depth]), 1);
            array_unshift($result[$depth], $include);
        }
    }
}

/// <summary>
/// Given a list of dependencies bucketed by dependency
/// depth, return a flattened list in order of deepest to
/// shallowest dependency depth
/// </summary>
function flatten_includes($includes)
{
    $flattened = [];
    for ($i = count($includes) - 1; $i >= 0; --$i)
    {
        foreach ($includes[$i] as $dep)
        {
            if (!in_array($dep, $flattened))
            {
                array_push($flattened, $dep);
            }
        }
    }

    return $flattened;
}

/// <summary>
/// Adds the necessary stylesheet for the current page
///
/// If nomin is set, echoes each base stylesheet individually.
/// If nomin is not set, links the consolidated minified file.
/// </summary>
function build_css()
{
    $self = pathinfo($_SERVER['PHP_SELF'])['filename'];
    if (try_get("nomin"))
    {
        $includes = get_css_includes($self);
        foreach ($includes as $include)
        {
            echo "<style>\n/* $include.css */\n" . file_get_contents("style/$include.css") . "</style>\n";
        }
    }
    else
    {
        echo '<link rel="stylesheet" href="' . glob("min/style/$self.*.min.css")[0] . '">';
    }
}

/// <summary>
/// Builds up a list of CSS dependencies for the given file
/// </summary>
function get_css_includes($file)
{
    $deps = json_decode(file_get_contents('includes/deps.json'));
    $result = [];
    if (!isset($deps->$file))
    {
        return $result;
    }

    $includes = $deps->$file->css;
    if (in_array("style", $includes))
    {
        array_push($result, "style");
    }

    $implicit = [];
    get_css_deps_from_js($file, $deps, $implicit);

    // Some "base" css files should go first to allow overriding by subsequent files
    $base = ["overlay", "nav", "table", "tooltip"];
    foreach ($base as $css)
    {
        if (in_array($css, $implicit))
        {
            array_push($result, $css);
        }
    }

    foreach ($implicit as $css)
    {
        if (!in_array($css, $result))
        {
            array_push($result, $css);
        }
    }

    foreach ($includes as $include)
    {
        if ($include != "style" && $include != $file)
        {
            array_push($result, $include);
        }
    }

    if (in_array($file, $includes))
    {
        $idx = array_search($file, $result);
        if ($idx !== FALSE)
        {
            array_splice($result, $idx, 1);
        }
        
        array_push($result, $file);
    }

    return $result;
}

/// <summary>
/// Iterates through the dependency tree for both JS and CSS,
/// adding required CSS files to the result
/// <summary>
function get_css_deps_from_js($dep, $deps, &$result)
{
    if (!isset($deps->$dep))
    {
        return;
    }

    foreach ($deps->$dep->js as $include)
    {
        if (!isset($deps->$include))
        {
            continue;
        }

        foreach ($deps->$include->css as $css)
        {
            if (!in_array($css, $result))
            {
                array_push($result, $css);
                get_css_deps_from_js($css, $deps, $result);
            }
        }

        if (!in_array($include, $result))
        {
            get_css_deps_from_js($include, $deps, $result);
        }
    }
}

/// <summary>
/// Gets the stamped icon svg with the given name
/// </summary>
function icon($name)
{
    $gl = glob("min/icon/$name.*.svg");
    if (sizeof($gl) == 0)
    {
        echo 'min/icon/blank.svg';
        return;
    }

    $icon = substr($gl[0], strrpos($gl[0], "/") + 1);
    $icon = explode(".", $icon);
    echo "i/c1c1c1/" . $icon[0] . "." . $icon[1] . ".svg";
}

/// <summary>
/// Sets the error status and loads our error handler.
///
/// http_response_code appears to bypass ErrorDocument, so if we want our error to be displayed
/// by our error handler, we need this trickery, which has essentially the same effect as ErrorDocument.
/// </summary>
function error_and_exit($status, $message='')
{
    global $db;
    if ($db)
    {
        $db->close();
    }

    // For post requests, don't load the error page, create the actual error header
    if ($_SERVER['REQUEST_METHOD'] === 'POST')
    {
        header(HTTPStatusHeader($status), TRUE, $status);
        exit;
    }

    $_GET['r'] = $status;
    $_GET['m'] = $message;
    $_SERVER['REDIRECT_URL'] = "plex/get_status.php";
    include $_SERVER['DOCUMENT_ROOT'] . "/plex/error.php";
    exit;
}

/// <summary>
/// Returns the HTTP header string for the given error status.
/// Not complete, just covers the most common error status
/// </summary>
function HTTPStatusHeader($status)
{
    $header = "HTTP/1.1 $status ";
    switch ($status)
    {
        case 400:
            return $header . "Bad Request";
        case 401:
            return $header . "Unauthorized";
        case 403:
            return $header . "Forbidden";
        case 404:
            return $header . "Not Found";
        case 500:
            return $header . "Internal Server Error";
        case 503:
            return $header . "Service Unavailable";
        case 504:
            return $header . "Gateway Time-out";

        default:
            return $header;
    }
}

/// <summary>
/// Class to handle different types of requests. Media requests should
/// probably be different than permission requests, but it works out alright
/// </summary>
abstract class RequestType
{
    const None = 0;
    const Movie = 1;
    const TVShow = 2;
    const AudioBook = 3;
    const Music = 4;

    // 5-9 reserved for future media types

    const StreamAccess = 10;
    const ViewUsers = 11;
    const ViewAllRequests = 12;
    const FulfillRequests = 13;

    // 14-99 reserved for future user permissions

    const Max = 100;

    /// <summary>
    /// Returns the underlying request type for the given integer
    /// </summary>
    static function get_type($intval)
    {
        // Probably a better way to do this, but SplEnum doesn't seem to work
        switch ($intval)
        {
            case RequestType::Movie:
                return RequestType::Movie;
            case RequestType::TVShow:
                return RequestType::TVShow;
            case RequestType::AudioBook:
                return RequestType::AudioBook;
            case RequestType::Music:
                return RequestType::Music;
            case RequestType::StreamAccess:
                return RequestType::StreamAccess;
            case RequestType::ViewUsers:
                return RequestType::ViewUsers;
            case RequestType::ViewAllRequests:
                return RequestType::ViewAllRequests;
            case RequestType::FulfillRequests:
                return RequestType::FulfillRequests;
            default:
                return RequestType::None;
        }
    }

    /// <summary>
    /// Returns the string representation of the given RequestType
    /// </summary>
    static function get_str($type)
    {
        switch($type)
        {
            case RequestType::Movie:
                return "Movie";
            case RequestType::TVShow:
                return "TV";
            case RequestType::AudioBook:
                return "Audiobook";
            case RequestType::Music:
                return "Music";
            case RequestType::StreamAccess:
                return "Stream Access";
            case RequestType::ViewUsers:
                return "View Users";
            case RequestType::ViewAllRequests:
                return "View All Requests";
            case RequestType::FulfillRequests:
                return "Fulfill Requests";
            default:
                return "Unknown";
        }
    }

    /// <summary>
    /// Returns the underlying request type for the given string
    /// </summary>
    static function get_type_from_str($str)
    {
        switch (strtolower($str))
        {
            case "movie":
                return RequestType::Movie;
            case "tv show":
            case "tvshow":
            case "tv":
                return RequestType::TVShow;
            case "audiobook":
                return RequestType::AudioBook;
            case "music":
                return RequestType::Music;
            default:
                return RequestType::None;
        }
    }

    /// <summary>
    /// Returns whether the given RequestType is a media request
    /// </summary>
    static function is_media_request($type)
    {
        switch ($type)
        {
            case RequestType::Movie:
            case RequestType::TVShow:
            case RequestType::AudioBook:
            case RequestType::Music:
                return TRUE;
            default:
                return FALSE;
        }
    }

    /// <summary>
    /// Returns whether the given RequestType is an audio-only
    /// media type, i.e. music or an audiobook
    /// </summary>
    static function is_audio($type)
    {
        switch ($type)
        {
            case RequestType::AudioBook:
            case RequestType::Music:
                return TRUE;
            default:
                return FALSE;
        }
    }
}

/// <summary>
/// Helpers for working with user levels
/// </summary>
abstract class UserLevel
{
    const Invalid = -1;
    const Noob = 0;
    const Regular = 20;
    const Moderator = 60; // Unused
    const SuperModerator = 80; // Unused
    const Admin = 100;

    /// <summary>
    /// Determine whether the current user is an administrator
    /// </summary>
    static function is_admin()
    {
        return UserLevel::current() == UserLevel::Admin;
    }

    /// <summary>
    /// Get the current user's mapped level
    /// </summary>
    static function current()
    {
        if (!isset($_SESSION['level']))
        {
            return UserLevel::Invalid;
        }

        return UserLevel::get_type($_SESSION['level']);
    }

    /// <summary>
    /// Set the current user's level
    /// </summary>
    static function set_current($level)
    {
        $_SESSION['level'] = (int)$level;
    }

    /// <summary>
    /// Get the mapped level for the given integer
    /// </summary>
    static function get_type($level)
    {
        $level = (int)$level;
        if ($level < 20)
        {
            return UserLevel::Noob;
        }

        if ($level < 100)
        {
            return UserLevel::Regular;
        }

        return UserLevel::Admin;
    }
}

/// <summary>
/// Writes a request to the given url with the given data, and doesn't wait for a response
/// </summary>
function fire_and_forget($url, $data)
{
    $parts = parse_url($url);
    $fp = fsockopen($parts['host'], 80, $errno, $errstr, 30);
    $out = "POST " . $parts['path'] . " HTTP/1.1\r\n";
    $out .= "Host: " . $parts['host'] . "\r\n";
    $out .= "Content-Type: application/x-www-form-urlencoded\r\n";
    $out .= "Content-Length: " . strlen($data) . "\r\n";
    $out .= "Connection: Close\r\n\r\n";
    $out .= $data;

    fwrite($fp, $out);
    fclose($fp);
}

/// <summary>
/// Sends a request to send an email to the specified address. Everything better
/// be in order here, as we fire-and-forget
/// </summary>
function send_email_forget($to, $content, $subject)
{
    $url = SITE_ROOT_LOCAL . "/includes/send_email.php";
    $data = http_build_query(array("to" => $to, "content" => $content, "subject" => $subject));
    fire_and_forget($url, $data);
}

/// <summary>
/// Get the contents of the given url
/// </summary>
function curl($url, $extra=[])
{
    $ch = curl_init();
    curl_set($ch,
    Array(
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => TRUE,
        CURLOPT_FOLLOWLOCATION => TRUE
    ));

    curl_set($ch, $extra);
    $return = curl_exec($ch);

    if (curl_errno($ch))
    {
        $return = json_error(curl_error($ch));
    }
    else
    {
        switch ($http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE))
        {
            case 200:
                break;
            default:
                $return = json_error("Bad curl response: $http_code");
                break;
        }
    }

    curl_close($ch);
    return $return;
}

/// <summary>
/// Helper that makes it slightly less cumbersome to set
/// multiple curl options
/// </summary>
function curl_set($ch, $args)
{
    foreach ($args as $key => $value)
    {
        curl_setopt($ch, $key, $value);
    }
}

/// <summary>
/// I'm too lazy to support IE, so block it
/// </summary>
function ieCheck()
{
    if (!isset($_SERVER['HTTP_USER_AGENT']))
    {
        return;
    }

    $ua = strtolower($_SERVER['HTTP_USER_AGENT']);
    if (strpos($ua, "msie") !== FALSE ||
        (strpos($ua, "trident") !== FALSE && strpos($ua, "11.") !== FALSE))
    {
        header("Location: ie.html");
    }
}
?>