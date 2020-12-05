<?php
/// <summary>
/// Retrieves a thumbnail or background image. Serve directly from the cache if possible, but otherwise
/// grab the image from plex. A blur effect is also applied to background images
/// </summary>

session_start();

require_once "includes/common.php";
require_once "includes/config.php";

$path = urlencode(param_or_die("path"));

verify_loggedin();
if (UserLevel::current() < UserLevel::Regular)
{
    error_and_exit(401);
}

$url = PLEX_SERVER . "/photo/:/transcode?width=214&height=100&minSize=1&upscale=1&url=$path&" . PLEX_TOKEN;
$img = curl($url);

if ($img && $img[0] == '{')
{
    error_and_exit(404);
}

header('HTTP/1.1 200 OK');
header('Cache-Control: max-age=259200, public');
header('Content-Length: ' . strlen($img));
header('Content-Type: image/jpeg');
echo $img;
?>
