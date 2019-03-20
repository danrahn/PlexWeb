<?php
/// <summary>
/// Retreive a resource. Implement private cache control so users will get updated contents as
/// soon as they change, not when the browser decides to grab it again
/// </summary>
session_start();

require_once "includes/common.php";
requireSSL();

$resource = param_or_die("resource");

if (!file_exists($resource))
{
	// No error_and_exit, as we want to directly send the response code
	http_response_code(404);
	exit;
}

$file_time = filemtime($resource);
$headers = apache_request_headers();
header('Cache-Control: private');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $file_time) . ' GMT');
if (isset($headers['If-Modified-Since']) && (strtotime($headers['If-Modified-Since']) >= $file_time))
{
	header('HTTP/1.1 304 Not Modified');
	header('Connection: close');
}
else
{
	header('HTTP/1.1 200 OK');
	header('Content-Length: ' . filesize($resource));
	header('Content-type: ' . get_content_type($resource));

	readfile($resource);
}

function get_content_type($filename)
{
	$ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
	switch ($ext)
	{
		case "css":
			return "text/css";
		case "html":
		case "php":
			return "text/html";
		case "js":
			return "text/javascript";
		case "jpeg":
		case "jpg":
			return "image/jepg";
		case "png":
			return "image/png";
		default:
			return "text/plain";
	}
}

?>