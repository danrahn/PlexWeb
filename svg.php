<?php
/// <summary>
/// Retrieves an SVG icon with the specified fill color
/// </summary>

session_start();

require_once "includes/common.php";
require_once "includes/config.php";

requireSSL();

$icon = get("icon");
$hash = get("hash");
$color = get("color");
$color_len = strlen($color);
if ($color_len != 3 && $color_len != 6)
{
    header('HTTP/1.1 400 Bad Request', true, 400);
    error_and_exit(400);
}

if (substr($icon, strlen($icon) - 4) == ".svg")
{
    $icon = substr($icon, 0, strlen($icon) - 4);
}

if (!free_icon($icon))
{
    verify_loggedin();
}

if (!preg_match("/^[a-fA-F0-9]+$/", $color))
{
    header('HTTP/1.1 400 Bad Request', true, 400);
    error_and_exit(400);
}

$gl = glob("min/icon/$icon.$hash.svg");
if (sizeof($gl) == 0)
{
    header("HTTP/1.0 404 Not Found");
    die();
}

$filename = $gl[0];

$headers = apache_request_headers();
$file_time = filemtime($filename);
header('Cache-Control: max-age=31536000, public');
header('Expires: ' . gmdate('D, d M Y H:i:s \G\M\T', time() + (60 * 60 * 24 * 7)));
header('Last-Modified: '.gmdate('D, d M Y H:i:s \G\M\T', $file_time));

if (isset($headers['If-Modified-Since']))
{
    error_log("Requested cached file " . $filename);
}

if (isset($headers['If-Modified-Since']) && (strtotime($headers['If-Modified-Since']) >= $file_time))
{
    header('HTTP/1.1 304 Not Modified');
    header('Connection: close');
}
else
{
    $img = file_get_contents($filename);
    $img = str_ireplace("FILL_COLOR", "#$color", $img);
    header('HTTP/1.1 200 OK');
    header('Content-Length: ' . filesize($filename));
    header('Content-type: image/svg+xml');
    header('Etag: ' . md5_file($filename));
    
    echo $img;
}

/// <summary>
/// Returns whether we're okay with serving this image
/// if the requestor isn't signed in
/// </summary>
function free_icon($icon)
{
    switch ($icon)
    {
        case "mdlink":
        case "mdimage":
        case "mdtable":
            return TRUE;
        default:
            return FALSE;
    }
}
?>