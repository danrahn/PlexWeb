<?php
/// <summary>
/// Retrieves a thumbnail or background image. Serve directly from the cache if possible, but otherwise
/// grab the image from plex. A blur effect is also applied to background images
/// </summary>

session_start();

require_once "includes/common.php";
require_once "includes/config.php";
verify_loggedin();

$img_path = param_or_die("path");
$type = param_or_die("type");
if ($type !== "thumb" && $type !== "background")
{
    error_and_exit(400);
}

$isThumb = !strcmp($type, "thumb");
$root_folder = $isThumb ? "" : $type . "/";

$filename_parts = explode("/", $img_path);
$filename = "includes/cache/" . $root_folder . $filename_parts[count($filename_parts) - 2] . "/" . $filename_parts[count($filename_parts) - 3] . "_" . $filename_parts[count($filename_parts) - 1] . ".jpg";

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
        header('Cache-Control: private');
        header('Last-Modified: '.gmdate('D, d M Y H:i:s', $file_time) . ' GMT');
        if (isset($headers['If-Modified-Since']) && (strtotime($headers['If-Modified-Since']) >= $file_time))
        {
            header('HTTP/1.1 304 Not Modified');
            header('Connection: close');
        }
        else
        {
            header('HTTP/1.1 200 OK');
            header('Content-Length: '. filesize($filename));
            header('Content-type: image/jpeg');

            readfile($filename);
        }
    }
}
else
{
    serve_new_image($img_path, $filename, $isThumb);
}

/// <summary>
/// Grab the specified image from plex, resize it, and store it locally.
/// If it's not a thumb, also blur the image
/// </summary>
function serve_new_image($img_path, $filename, $isThumb)
{
    $img = new Imagick();
    $img->readImageBlob(curl(PLEX_SERVER . $img_path . '?' . PLEX_TOKEN));

    if ($isThumb)
    {
        $img->thumbnailImage(250, 0);
    }
    else
    {
        $img->thumbnailImage(600, 0);
        $img->blurImage(30.0, 6);
    }

    header('Cache-Control: private');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', time()) . ' GMT');
    header('HTTP/1.1 200 OK');
    file_put_contents($filename, $img->getImageBlob());
    header('Content-Length: '. filesize($filename));
    header("Content-Type: image/jpeg");
    echo $img->getImageBlob();
}

/// <summary>
/// Send a simple cURL request
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

?>