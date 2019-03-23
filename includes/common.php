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
function verify_loggedin($redirect = FALSE) {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== TRUE)
    {
        if ($redirect)
        {
            header("Location: login.php");
            exit;
        }

        error_and_exit(401);
    }
}

/// <summary>
/// Return a 400 error if any of the given POST parameters are unset
/// </summary>
function exit_if_unset(...$fields)
{
    foreach ($fields as $field)
    {
        if (!isset($_POST[$field]))
        {
            error_and_exit(400);
        }
    }
}

/// <summary>
/// Return a 400 error if any of the given GET parameters are unset
/// </summary>
function exit_if_unset_get(...$fields)
{
    foreach ($fields as $field)
    {
        if (!isset($_GET[$field]))
        {
            error_and_exit(400);
        }
    }
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
    echo "{\"Error\": \"" . $error . "\"}";
    exit;
}

/// <summary>
/// Exits the script and returns a JSON error if any of the POST fields are not set
/// </summary>
function json_exit_if_unset(...$fields)
{
    foreach ($fields as $field)
    {
        if (!isset($_POST[$field]))
        {
            json_error_and_exit($field . " is not set!");
        }
    }
}

/// <summary>
/// Print a simple JSON success object and exit the script
/// </summary>
function json_success()
{
    header("Content-Type: application/json; charset=UTF-8");
    echo '{ "Success" : true }';
    exit;
}

function json_message_and_exit($message)
{
    header("Content-Type: application/json; charset=UTF-8");
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
/// Sets the error status and loads our error handler.
///
/// http_response_code appears to bypass ErrorDocument, so if we want our error to be displayed
/// by our error handler, we need this trickery, which has essentially the same effect as ErrorDocument.
/// </summary>
function error_and_exit($status)
{
    global $db;
    if ($db)
    {
        $db->close();
    }

    $_GET['r'] = $status;
    $_SERVER['REDIRECT_URL'] = "plexweb/get_status.php";
    include "C:/wamp64/www/error.php";
    exit;
}

// Different types of requests. Media requests should probably be
// different than permission requests, but it works out alright
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

    // Give me everything
    const SuperAdmin = 100;

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
            case RequestType::SuperAdmin:
                return RequestType::SuperAdmin;
            default:
                return RequestType::None;
        }
    }

    static function get_str($type)
    {
        switch($type)
        {
            case RequestType::Movie:
                return "Movie";
            case RequestType::TVShow:
                return "TV Show";
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
            case RequestType::SuperAdmin:
                return "Super Admin";
            default:
                return "Unknown";
        }
    }

    static function get_type_from_str($str)
    {
        switch (strtolower($str))
        {
            case "movie":
                return RequestType::Movie;
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
}

/// <summary>
/// Sends a request to send an email to the specified address. Everything better
/// be in order here, as we fire-and-forget
/// </summary>
function send_email_forget($to, $content, $subject)
{
    $url = "http://127.0.0.1/plexweb/includes/send_email.php";

    $data = http_build_query(array("to" => $to, "content" => $content, "subject" => $subject));
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
/// I'm too lazy to support IE, so block it
/// </summary>
function ieCheck()
{
	$ua = strtolower($_SERVER['HTTP_USER_AGENT']);
	if (strpos($ua, "msie") !== FALSE ||
		(strpos($ua, "trident") !== FALSE && strpos($ua, "11.") !== FALSE))
	{
		header("Location: ie.html");
	}
}
?>