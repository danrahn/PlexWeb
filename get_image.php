<?php
/// <summary>
/// Retrieves a thumbnail or background image. Serve directly from the cache if possible, but otherwise
/// grab the image from plex. A blur effect is also applied to background images
/// </summary>

session_start();

require_once "includes/common.php";
require_once "includes/config.php";

$img_path = param_or_die("path");
$type = get_type();

if (!validate_path($img_path, $type))
{
    header('HTTP/1.1 400 Bad Request', true, 400);
    error_and_exit(400);
}

// Don't need to be logged in to get the *default.svg posters
if (substr(strtolower($img_path), strlen($img_path) - 11) != "default.svg")
{
    verify_loggedin();
}

$isThumb = $type == ImgType::Thumb;
$root_folder = $isThumb ? "" : param_or_die("type") . "/";

$filename_parts = explode("/", $img_path);
$filename = "";
$large = try_get("large");
if ($type == ImgType::Poster)
{

    $filename = "includes/cache/poster" . ($large ? "/342" : "") . $img_path;
}
else
{
    $filename = "includes/cache/" . $root_folder . $filename_parts[count($filename_parts) - 2] . "/" . $filename_parts[count($filename_parts) - 3] . "_" . $filename_parts[count($filename_parts) - 1] . ".jpg";
}

$contenttype = 'jpeg';
if (strpos($filename, '.svg') == strlen($filename) - 4)
{
    $contenttype = 'svg+xml';
}

if (file_exists($filename))
{
    // Plex explicitly doesn't cache anything, so this pretty much does nothing.
    // Could have an automated task to re-run this every few hours, but probably overkill.
    // I can just zap the cache dir if I want things to refresh
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, PLEX_SERVER . $img_path . "?" . PLEX_TOKEN);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FILETIME, true);
    $result = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    $file_time = filemtime($filename);
    if (isset($info['filetime']) && $info['filetime'] != -1 && strtotime($info['filetime']) >= $file_time)
    {
        // Plex has a newer image
        serve_new_image($img_path, $filename, $isThumb);
    }
    else
    {
        $headers = apache_request_headers();

        // Cache of one week. Could probably be longer, how often are posters going to change?
        header('Cache-Control: max-age=604800, public');
        header('Expires: ' . gmdate('D, d M Y H:i:s \G\M\T', time() + (60 * 60 * 24 * 7)));
        header('Last-Modified: '.gmdate('D, d M Y H:i:s \G\M\T', $file_time));
        if (isset($headers['If-Modified-Since']) && (strtotime($headers['If-Modified-Since']) >= $file_time))
        {
            header('HTTP/1.1 304 Not Modified');
            header('Connection: close');
        }
        else
        {
            header('HTTP/1.1 200 OK');
            header('Content-Length: '. filesize($filename));
            header('Content-type: image/' . $contenttype);
            header('Etag: ' . md5_file($filename));

            readfile($filename);
        }
    }
}
else
{
    serve_new_image($img_path, $filename, $type, $large);
}

/// <summary>
/// Types of images we retrieve. Thumb and Background
/// are from Plex, Posters are from external sources
/// </summary>
abstract class ImgType
{
    const Thumb = 0;
    const Background = 1;
    const Poster = 2;
}

/// <summary>
/// Grab the specified image from plex, resize it, and store it locally.
/// If it's not a thumb, also blur the image
/// </summary>
function serve_new_image($img_path, $filename, $type, $large)
{
    $img = new Imagick();

    try
    {
        if ($type == ImgType::Poster)
        {
            $img->readImageBlob(curl("https://image.tmdb.org/t/p/" . ($large ? "w342" : "w185") . $img_path));
        }
        else
        {
            $img->readImageBlob(curl(PLEX_SERVER . $img_path . '?' . PLEX_TOKEN));
        }
    }
    catch (Exception $e)
    {
        header("HTTP/1.0 404 Not Found");
        die();
    }

    switch($type)
    {
        case ImgType::Thumb:
            $img->thumbnailImage(250, 0);
            break;
        case ImgType::Background:
            $img->thumbnailImage(600, 0);
            $img->blurImage(30.0, 6);
            break;
        default:
            break;
    }

    header('Cache-Control: max-age=604800, public');
    header('Expires: ' . gmdate('D, d M Y H:i:s \G\M\T', time() + (60 * 60 * 24 * 7)));
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s \G\M\T', time()));
    header('HTTP/1.1 200 OK');
    file_put_contents($filename, $img->getImageBlob());
    header('Content-Length: '. filesize($filename));
    header("Content-Type: " . mime_content_type($filename));
    header('Etag: ' . md5_file($filename));
    echo $img->getImageBlob();
}

/// <summary>
/// Ensures we don't try to serve something unexpected
/// </summary>
function validate_path($path, $type)
{
    // Can't be going up directories, keep them where they are
    if (strpos($path, '..') !== FALSE)
    {
        return FALSE;
    }

    $ext_start = strrpos($path, '.');
    if ($ext_start === FALSE)
    {
        // No extension. This is only valid for non-poster requests
        return $type != ImgType::Poster;
    }

    // Only allow png, jpg, svg
    $ext = strtolower(substr($path, $ext_start, strlen($path) - $ext_start));
    if (strcmp($ext, '.png') && strcmp($ext, '.jpg') && strcmp($ext, '.svg'))
    {
        return FALSE;
    }

    return TRUE;
}

/// <summary>
/// Send a simple cURL request
/// </summary>
function curl($url)
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $return = curl_exec($ch);
    curl_close($ch);
    return $return;
}

/// <summary>
/// Map the passed in string type to its corresponding ImgType
/// </summary>
function get_type()
{
    $type = param_or_die("type");
    switch ($type)
    {
        case "thumb":
            return ImgType::Thumb;
        case "background":
            return ImgType::Background;
        case "poster":
            return ImgType::Poster;
        default:
            error_and_exit(400);
    }
}

?>